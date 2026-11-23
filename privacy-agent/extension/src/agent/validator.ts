import type { Action, PageContext, PageElement } from "../shared/schema";
import {
  CHECKOUT_PATH_PATTERN,
  CONSEQUENTIAL_PATTERN,
  MAX_ACTIONS_PER_PLAN,
} from "../shared/schema";
import { detectPII } from "../privacy/detectors";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  actions: Action[];
}

export function findElement(page: PageContext, ref: string): PageElement | undefined {
  return page.elements.find((element) => element.ref === ref);
}

export function isConsequentialElement(element: PageElement): boolean {
  const label = `${element.name} ${element.text}`;
  if (CONSEQUENTIAL_PATTERN.test(label)) return true;
  if (element.path && CHECKOUT_PATH_PATTERN.test(element.path)) return true;
  return false;
}

export function validateActions(
  actions: Action[],
  page: PageContext,
  origin: string,
): ValidationResult {
  if (actions.length > MAX_ACTIONS_PER_PLAN) {
    return { ok: false, reason: "The plan exceeded the action limit", actions: [] };
  }

  const validated: Action[] = [];
  for (const action of actions) {
    let reason: string | undefined;

    if (action.type === "click" || action.type === "type" || action.type === "select") {
      const element = findElement(page, action.ref);
      if (!element) {
        reason = `Unknown element reference ${action.ref}`;
      } else if (element.disabled) {
        reason = `Element ${action.ref} is disabled`;
      } else if (action.type === "click") {
        if (isConsequentialElement(element)) {
          reason = "Checkout, payment and order-placement actions are blocked";
        } else if (!["button", "link", "menuitem", "option", "tab", "checkbox"].includes(element.role)) {
          reason = `Element ${action.ref} is not a clickable control`;
        }
      } else if (action.type === "type") {
        if (Boolean(action.text) === Boolean(action.placeholder)) {
          reason = "Exactly one of text or placeholder is required";
        } else if (!["textbox", "searchbox", "combobox"].includes(element.role)) {
          reason = `Element ${action.ref} does not accept text`;
        } else if (action.placeholder) {
          const tokenType = action.placeholder.match(/^\[([A-Z_]+)_\d+\]$/)?.[1];
          if (!element.sensitive) {
            reason = "A placeholder can only be used in a sensitive field";
          } else if (tokenType !== element.sensitive) {
            reason = "The placeholder type does not match the target field";
          } else if (["PASSWORD", "OTP", "CARD"].includes(element.sensitive)) {
            reason = "Password, OTP and card values are never auto-filled";
          }
        } else if (action.text) {
          if (["PASSWORD", "OTP", "CARD", "BANK"].includes(element.sensitive ?? "")) {
            reason = "Plain text cannot be entered into a high-risk field";
          } else if (element.sensitive) {
            reason = "Sensitive fields require an approved placeholder";
          } else if (detectPII(action.text).length > 0) {
            reason = "Personal data must be placed through the approval vault";
          }
        }
      } else if (action.type === "select") {
        if (element.role !== "combobox" && element.tag !== "select") {
          reason = `Element ${action.ref} is not a select control`;
        }
      }
    }

    if (!reason && action.type === "navigate") {
      if (!action.path.startsWith("/") || action.path.startsWith("//")) {
        reason = "Navigation must use a relative path on the approved origin";
      } else if (CHECKOUT_PATH_PATTERN.test(action.path)) {
        reason = "Checkout and payment navigation is blocked";
      } else if (detectPII(action.path).length > 0) {
        reason = "Navigation paths must not contain personal data";
      } else {
        try {
          const target = new URL(action.path, origin);
          if (target.origin !== origin) reason = "Cross-origin navigation is blocked";
        } catch {
          reason = "Invalid navigation path";
        }
      }
    }

    if (!reason && (action.type === "verify" || action.type === "verify_cart")) {
      const text = action.type === "verify" ? action.text : action.productName;
      if (detectPII(text).length > 0) reason = "Verification text contains personal data";
    }

    if (reason) return { ok: false, reason, actions: [] };
    validated.push(action);
  }

  return { ok: true, actions: validated };
}

export function describeAction(action: Action, page?: PageContext): string {
  const ref = "ref" in action && typeof action.ref === "string" ? action.ref : "";
  const element = page ? findElement(page, ref) : undefined;
  const label = element?.name || element?.text || action.type;
  switch (action.type) {
    case "click":
      return `Click “${label.slice(0, 80)}”`;
    case "type":
      return action.placeholder
        ? `Enter approved ${action.placeholder} into “${label.slice(0, 60)}”`
        : `Type “${(action.text ?? "").slice(0, 60)}” into “${label.slice(0, 60)}”`;
    case "select":
      return `Select “${action.option}” in “${label.slice(0, 60)}”`;
    case "scroll":
      return `Scroll ${action.direction}`;
    case "navigate":
      return `Navigate to ${action.path}`;
    case "wait":
      return "Wait for the page to update";
    case "verify":
      return `Verify “${action.text.slice(0, 80)}”`;
    case "verify_cart":
      return `Verify “${action.productName}” is in the cart`;
    default:
      return "Unsupported action";
  }
}
