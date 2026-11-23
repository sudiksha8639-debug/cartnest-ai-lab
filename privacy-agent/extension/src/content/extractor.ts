import type { PageElement } from "../shared/schema";
import { MAX_ELEMENT_CONTEXT } from "../shared/schema";
import { classifyField } from "../privacy/detectors";

export interface RawElement {
  ref: string;
  element: HTMLElement;
  tag: string;
  role: string;
  name: string;
  text: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  disabled?: boolean;
  value?: string;
  path?: string;
  options?: { value: string; label: string }[];
  context?: string;
  fieldLabel?: string;
  fieldType: ReturnType<typeof classifyField>;
  highRisk: boolean;
}

export interface RawBlock {
  tag: string;
  text: string;
  heading?: boolean;
}

export interface RawPage {
  origin: string;
  path: string;
  title: string;
  headings: string[];
  elements: RawElement[];
  blocks: RawBlock[];
  refs: Map<string, HTMLElement>;
  contentFingerprint: string;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='option']",
  "[role='combobox']",
  "[contenteditable='true']",
].join(",");

const BLOCK_SELECTOR = "h1,h2,h3,p,li,label,blockquote,figcaption";

function clean(value: string | null | undefined, max = 420): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function isVisible(el: Element, win: Window | null): boolean {
  if (!win) return true;
  if (el.hasAttribute("hidden")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (node.tagName === "DIALOG" && !(node as HTMLDialogElement).open) return false;
  }
  return true;
}

function labelFor(el: HTMLElement, doc: Document): string {
  const id = el.getAttribute("id");
  if (id) {
    const label = doc.querySelector(`label[for="${cssEscape(id)}"]`);
    if (label) return clean(label.textContent, 120);
  }
  const wrapping = el.closest("label");
  if (wrapping) {
    const clone = wrapping.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,select,textarea,button").forEach((item) => item.remove());
    return clean(clone.textContent, 120);
  }
  return "";
}

function accessibleName(el: HTMLElement, doc: Document, fieldLabel: string): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return clean(aria, 200);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (text.trim()) return clean(text, 200);
  }
  if (fieldLabel) return fieldLabel;
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return clean(placeholder, 160);
  const title = el.getAttribute("title");
  if (title) return clean(title, 160);
  const text = clean(el.innerText || el.textContent, 200);
  if (text) return text;
  const name = el.getAttribute("name");
  if (name) return clean(name.replace(/[_-]+/g, " "), 120);
  return clean(el.tagName.toLowerCase(), 40);
}

function contextFor(el: HTMLElement): string {
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    const tag = node.tagName;
    const role = node.getAttribute("role");
    if (["ARTICLE", "LI", "FORM", "SECTION"].includes(tag) || ["listitem", "group"].includes(role ?? "")) {
      const text = clean(node.innerText || node.textContent, 500);
      if (text.length >= 12) return text;
    }
  }
  return clean(el.parentElement?.innerText || "", 500);
}

function inferRole(el: HTMLElement): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "submit" || type === "button") return "button";
    if (type === "search") return "searchbox";
    return "textbox";
  }
  if (el.isContentEditable) return "textbox";
  return tag;
}

function safeHref(el: HTMLElement, origin: string): string | undefined {
  if (el.tagName !== "A") return undefined;
  const href = el.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return undefined;
  try {
    const url = new URL(href, el.ownerDocument.location.href);
    if (url.origin !== origin) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

export function extractPage(doc: Document, maxElements = 160): RawPage {
  const win = doc.defaultView;
  const origin = doc.location.origin;
  const refs = new Map<string, HTMLElement>();
  const elements: RawElement[] = [];
  const seen = new Set<Element>();

  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR))) {
    if (elements.length >= maxElements) break;
    if (seen.has(el) || !isVisible(el, win)) continue;
    if (el.closest("[aria-hidden='true']")) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" && (el as HTMLInputElement).type === "hidden") continue;
    const fieldLabel = labelFor(el, doc);
    const fieldType = classifyField({
      type: (el as HTMLInputElement).type ?? null,
      name: el.getAttribute("name"),
      id: el.getAttribute("id"),
      autocomplete: el.getAttribute("autocomplete"),
      label: fieldLabel || el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder"),
    });
    const highRisk = fieldType === "PASSWORD" || fieldType === "OTP" || fieldType === "CARD" || fieldType === "BANK";
    const inputType = tag === "input" ? (el as HTMLInputElement).type : undefined;
    const rawValue =
      highRisk || inputType === "password"
        ? undefined
        : tag === "input" || tag === "textarea"
          ? (el as HTMLInputElement | HTMLTextAreaElement).value
          : undefined;

    const options =
      tag === "select"
        ? Array.from((el as HTMLSelectElement).options)
            .slice(0, 24)
            .map((option) => ({ value: clean(option.value, 80), label: clean(option.text, 120) }))
        : undefined;

    const ref = `e${elements.length + 1}`;
    refs.set(ref, el);
    seen.add(el);
    elements.push({
      ref,
      element: el,
      tag,
      role: inferRole(el),
      name: accessibleName(el, doc, fieldLabel),
      text: clean(el.innerText || el.textContent, 320),
      type: inputType || el.getAttribute("type") || undefined,
      placeholder: clean(el.getAttribute("placeholder"), 140) || undefined,
      autocomplete: clean(el.getAttribute("autocomplete"), 80) || undefined,
      disabled: (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true",
      value: rawValue,
      path: safeHref(el, origin),
      options,
      context: contextFor(el).slice(0, MAX_ELEMENT_CONTEXT) || undefined,
      fieldLabel: fieldLabel || undefined,
      fieldType,
      highRisk,
    });
  }

  const blocks: RawBlock[] = [];
  const blockTexts = new Set<string>();
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))) {
    if (blocks.length >= 90) break;
    if (!isVisible(el, win)) continue;
    const text = clean(el.innerText || el.textContent, 520);
    if (text.length < 3 || text.length > 520) continue;
    if (blockTexts.has(text)) continue;
    blockTexts.add(text);
    blocks.push({
      tag: el.tagName.toLowerCase(),
      text,
      heading: /^H[1-3]$/.test(el.tagName),
    });
  }

  const headings = Array.from(doc.querySelectorAll<HTMLElement>("h1,h2,h3"))
    .filter((el) => isVisible(el, win))
    .map((el) => clean(el.innerText || el.textContent, 180))
    .filter(Boolean)
    .slice(0, 10);

  const bodyText = clean(doc.body?.innerText || "", 1200);

  return {
    origin,
    path: `${doc.location.pathname}${doc.location.search}`,
    title: clean(doc.title, 180),
    headings,
    elements,
    blocks,
    refs,
    contentFingerprint: `${doc.location.pathname}${doc.location.search}|${elements.length}|${bodyText.length}|${bodyText.slice(0, 160)}`,
  };
}

export function describeElementForAction(element: PageElement): string {
  return element.name || element.text || element.role;
}

export function findActionElement(doc: Document, element: HTMLElement): boolean {
  return doc.contains(element);
}
