import type { Action, ApprovalRequest } from "../shared/schema";
import {
  ACTION_TIMEOUT_MS,
  APPROVAL_TIMEOUT_MS,
  CHECKOUT_PATH_PATTERN,
  maskValue,
} from "../shared/schema";
import { classifyField, detectPII } from "../privacy/detectors";
import { PlaceholderVault } from "../privacy/vault";

export interface ExecutionOutcome {
  ok: boolean;
  status: "success" | "blocked";
  note: string;
  navigated: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function bodyText(): string {
  return document.body.innerText || document.body.textContent || "";
}

function safeNoteText(value: string, fallback = "the selected control"): string {
  const clean = value.replace(/\s+/g, " ").trim().slice(0, 100);
  return clean && detectPII(clean).length === 0 ? clean : fallback;
}

function labelFor(el: HTMLElement): string {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 120);
  }
  const wrapping = el.closest("label");
  if (wrapping?.textContent?.trim()) return wrapping.textContent.trim().slice(0, 120);
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("name") ||
    el.tagName.toLowerCase()
  ).slice(0, 120);
}

function requestApproval(request: ApprovalRequest): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (approved: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(approved);
    };
    const timer = setTimeout(() => finish(false), APPROVAL_TIMEOUT_MS);
    try {
      chrome.runtime.sendMessage({ type: "REQUEST_APPROVAL", request }, (response) => {
        if (chrome.runtime.lastError) {
          finish(false);
          return;
        }
        finish(Boolean(response?.approved));
      });
    } catch {
      finish(false);
    }
  });
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const view = el.ownerDocument.defaultView;
  const prototype =
    el.tagName === "TEXTAREA"
      ? (view?.HTMLTextAreaElement ?? HTMLTextAreaElement).prototype
      : (view?.HTMLInputElement ?? HTMLInputElement).prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) descriptor.set.call(el, value);
  else el.value = value;
  const EventCtor = view?.Event ?? Event;
  el.dispatchEvent(new EventCtor("input", { bubbles: true }));
  el.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

async function waitForRef(
  refs: Map<string, HTMLElement>,
  ref: string | undefined,
  timeoutMs: number,
): Promise<HTMLElement | null> {
  if (!ref) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const element = refs.get(ref);
    if (element?.isConnected && isVisible(element)) return element;
    await sleep(100);
  }
  return null;
}

export async function executeAction(
  action: Action,
  refs: Map<string, HTMLElement>,
  vault: PlaceholderVault,
  origin: string,
): Promise<ExecutionOutcome> {
  // Sensitive entry includes a human approval window. Give it more time than
  // the normal action timeout, but still fail closed if the panel disappears.
  const timeoutMs =
    action.type === "type" && action.placeholder
      ? APPROVAL_TIMEOUT_MS + 10_000
      : ACTION_TIMEOUT_MS;
  const timeout = new Promise<ExecutionOutcome>((resolve) =>
    setTimeout(
      () =>
        resolve({
          ok: false,
          status: "blocked",
          note: "The action timed out",
          navigated: false,
        }),
      timeoutMs,
    ),
  );

  return Promise.race([runAction(action, refs, vault, origin), timeout]);
}

async function runAction(
  action: Action,
  refs: Map<string, HTMLElement>,
  vault: PlaceholderVault,
  origin: string,
): Promise<ExecutionOutcome> {
  if (action.type === "navigate") {
    if (CHECKOUT_PATH_PATTERN.test(action.path)) {
      return { ok: false, status: "blocked", note: "Checkout navigation is blocked", navigated: false };
    }
    let target: URL;
    try {
      target = new URL(action.path, origin);
    } catch {
      return { ok: false, status: "blocked", note: "Invalid navigation path", navigated: false };
    }
    if (target.origin !== origin) {
      return { ok: false, status: "blocked", note: "Cross-origin navigation is blocked", navigated: false };
    }
    window.location.assign(target.href);
    return {
      ok: true,
      status: "success",
      note: `Navigated to ${safeNoteText(target.pathname, "the requested page")}`,
      navigated: true,
    };
  }

  if (action.type === "scroll") {
    window.scrollBy({ top: action.direction === "down" ? (action.amount ?? 640) : -(action.amount ?? 640), behavior: "auto" });
    return { ok: true, status: "success", note: `Scrolled ${action.direction}`, navigated: false };
  }

  if (action.type === "wait") {
    if (action.ref) {
      const found = await waitForRef(refs, action.ref, action.timeoutMs ?? 3000);
      return found
        ? { ok: true, status: "success", note: "Element appeared", navigated: false }
        : { ok: false, status: "blocked", note: "Timed out waiting for the element", navigated: false };
    }
    await sleep(action.ms ?? 500);
    return { ok: true, status: "success", note: "Waited for the page", navigated: false };
  }

  if (action.type === "verify") {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!action.ref || refs.get(action.ref)?.isConnected) {
        const body = bodyText().toLowerCase();
        if (body.includes(action.text.toLowerCase())) {
          return {
            ok: true,
            status: "success",
            note: `Verified “${safeNoteText(action.text, "the expected text")}”`,
            navigated: false,
          };
        }
      }
      await sleep(250);
    }
    return { ok: false, status: "blocked", note: "Expected text was not found on the page", navigated: false };
  }

  if (action.type === "verify_cart") {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const onCart = /\/cart\/?$/i.test(window.location.pathname);
      const body = bodyText().toLowerCase();
      const productPresent = body.includes(action.productName.toLowerCase());
      const cartHeading = /your cart|order summary/i.test(bodyText());
      if (onCart && productPresent && cartHeading) {
        return {
          ok: true,
          status: "success",
          note: `Verified “${safeNoteText(action.productName, "the selected product")}” in the cart`,
          navigated: false,
        };
      }
      await sleep(250);
    }
    return {
      ok: false,
      status: "blocked",
      note: "Cart verification failed: the product is not visible in the cart",
      navigated: false,
    };
  }

  const element = await waitForRef(refs, action.ref, 2000);
  if (!element) {
    return { ok: false, status: "blocked", note: "The target element is missing or changed", navigated: false };
  }
  if (!isVisible(element)) {
    return { ok: false, status: "blocked", note: "The target element is not visible", navigated: false };
  }

  if (action.type === "click") {
    const clickLabel = `${element.getAttribute("aria-label") ?? ""} ${element.innerText || element.textContent || ""}`;
    if (/(place\s+(my\s+)?order|complete\s+(the\s+)?(order|checkout)|pay\s+now|submit\s+payment|buy\s+now)/i.test(clickLabel)) {
      return { ok: false, status: "blocked", note: "Consequential actions are blocked", navigated: false };
    }
    const form = (element as HTMLButtonElement).form;
    const formTarget = element.getAttribute("formaction") ?? form?.action;
    if (formTarget) {
      try {
        const actionUrl = new URL(formTarget, origin);
        if (actionUrl.origin !== origin) {
          return { ok: false, status: "blocked", note: "Cross-origin form submission is blocked", navigated: false };
        }
        if (CHECKOUT_PATH_PATTERN.test(actionUrl.pathname)) {
          return { ok: false, status: "blocked", note: "Checkout form submission is blocked", navigated: false };
        }
      } catch {
        return { ok: false, status: "blocked", note: "Invalid form target", navigated: false };
      }
    }
    const ping = element.getAttribute("ping");
    if (ping) {
      for (const candidate of ping.split(/\s+/).filter(Boolean)) {
        try {
          if (new URL(candidate, origin).origin !== origin) {
            return { ok: false, status: "blocked", note: "Cross-origin link reporting is blocked", navigated: false };
          }
        } catch {
          return { ok: false, status: "blocked", note: "Invalid link reporting target", navigated: false };
        }
      }
    }
    element.scrollIntoView({ block: "center", inline: "nearest" });
    const href = element.getAttribute("href");
    if (href) {
      try {
        const target = new URL(href, origin);
        if (target.origin !== origin) {
          return { ok: false, status: "blocked", note: "Cross-origin click is blocked", navigated: false };
        }
        if (CHECKOUT_PATH_PATTERN.test(target.pathname)) {
          return { ok: false, status: "blocked", note: "Checkout click is blocked", navigated: false };
        }
      } catch {
        return { ok: false, status: "blocked", note: "Invalid link target", navigated: false };
      }
    }
    (element as HTMLElement).click();
    const navigated = Boolean(href && !href.startsWith("#"));
    const clickedLabel = safeNoteText(
      element.getAttribute("aria-label") || element.innerText || element.textContent || labelFor(element),
    );
    return {
      ok: true,
      status: "success",
      note: `Clicked “${clickedLabel}”`,
      navigated,
    };
  }

  if (action.type === "select") {
    if (element.tagName !== "SELECT") {
      return { ok: false, status: "blocked", note: "Only native select controls are supported", navigated: false };
    }
    const select = element as HTMLSelectElement;
    const option = Array.from(select.options).find(
      (item) => item.value === action.option || item.text.trim() === action.option,
    );
    if (!option) {
      return { ok: false, status: "blocked", note: "The requested option is not available", navigated: false };
    }
    select.value = option.value;
    const view = select.ownerDocument.defaultView;
    const EventCtor = view?.Event ?? Event;
    select.dispatchEvent(new EventCtor("input", { bubbles: true }));
    select.dispatchEvent(new EventCtor("change", { bubbles: true }));
    return {
      ok: true,
      status: "success",
      note: `Selected “${safeNoteText(option.text, "the requested option")}”`,
      navigated: false,
    };
  }

  // type
  if (!["INPUT", "TEXTAREA"].includes(element.tagName) && !element.isContentEditable) {
    return { ok: false, status: "blocked", note: "The target is not a text field", navigated: false };
  }

  const destinationType = classifyField({
    type: element.getAttribute("type"),
    name: element.getAttribute("name"),
    id: element.id,
    autocomplete: element.getAttribute("autocomplete"),
    label: labelFor(element),
    placeholder: element.getAttribute("placeholder"),
  });

  let value = action.text ?? "";
  if (action.placeholder) {
    const entry = vault.get(action.placeholder);
    if (!entry || !entry.resolvable || entry.value === null) {
      return {
        ok: false,
        status: "blocked",
        note: "This sensitive value cannot be disclosed automatically",
        navigated: false,
      };
    }
    if (entry.type !== "PERSON" && entry.type !== "EMAIL" && entry.type !== "PHONE" && entry.type !== "ADDRESS" && entry.type !== "PIN") {
      return { ok: false, status: "blocked", note: "This value type is never auto-filled", navigated: false };
    }
    if (destinationType !== entry.type) {
      return {
        ok: false,
        status: "blocked",
        note: "The sensitive value type does not match the destination field",
        navigated: false,
      };
    }
    const approved = await requestApproval({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      origin,
      fieldLabel: safeNoteText(labelFor(element), "the selected field"),
      dataType: entry.type,
      masked: maskValue(entry.type, entry.value),
      placeholder: action.placeholder,
      path: safeNoteText(window.location.pathname, "this page"),
    });
    if (!approved) {
      return {
        ok: false,
        status: "blocked",
        note: "Sensitive entry was denied or timed out",
        navigated: false,
      };
    }
    value = entry.value;
  } else if (destinationType) {
    // A sensitive destination always needs the one-time approval path above.
    return {
      ok: false,
      status: "blocked",
      note: "Sensitive fields require an approved placeholder",
      navigated: false,
    };
  }

  if (element.isContentEditable) {
    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  } else {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    if (action.clear) setNativeValue(field, "");
    setNativeValue(field, value);
    field.blur();
  }
  return {
    ok: true,
    status: "success",
    note: `Entered text into “${safeNoteText(labelFor(element), "the selected field")}”`,
    navigated: false,
  };
}
