import { describe, expect, test } from "bun:test";
import { validateActions } from "../src/agent/validator";
import type { PageContext, PageElement } from "../src/shared/schema";

function element(overrides: Partial<PageElement> & Pick<PageElement, "ref" | "name">): PageElement {
  return {
    tag: "button",
    role: "button",
    text: "",
    ...overrides,
  };
}

const page: PageContext = {
  origin: "http://localhost:5173",
  path: "/product/pulse-buds-mini",
  title: "Pulse Buds Mini",
  headings: [],
  elements: [
    element({ ref: "e1", name: "Add Pulse Buds Mini to cart" }),
    element({ ref: "e2", name: "Buy now" }),
    element({ ref: "e3", name: "Proceed to checkout", tag: "a", role: "link", path: "/checkout" }),
    element({ ref: "e4", name: "Search products", tag: "input", role: "searchbox" }),
    element({
      ref: "e5",
      name: "Phone number",
      tag: "input",
      role: "textbox",
      sensitive: "PHONE",
      valueToken: "[PHONE_1]",
    }),
    element({
      ref: "e6",
      name: "Card number",
      tag: "input",
      role: "textbox",
      sensitive: "CARD",
      valueToken: "[CARD_1]",
    }),
    element({ ref: "e7", name: "Remove Pulse Buds Mini from cart", path: "/account" }),
  ],
  textBlocks: [],
};

describe("action validation", () => {
  test("allows adding to the cart", () => {
    const result = validateActions([{ type: "click", ref: "e1" }], page, "http://localhost:5173");
    expect(result.ok).toBe(true);
  });

  test("blocks checkout and buy-now actions", () => {
    expect(validateActions([{ type: "click", ref: "e2" }], page, "http://localhost:5173").ok).toBe(false);
    expect(validateActions([{ type: "click", ref: "e3" }], page, "http://localhost:5173").ok).toBe(false);
  });

  test("blocks cross-origin, protocol-relative and checkout navigation", () => {
    for (const path of ["https://evil.example/", "//evil.example/", "/checkout", "javascript:alert(1)"]) {
      const result = validateActions([{ type: "navigate", path }], page, "http://localhost:5173");
      expect(result.ok, path).toBe(false);
    }
  });

  test("blocks unknown references and unsupported types", () => {
    expect(validateActions([{ type: "click", ref: "e99" }], page, "http://localhost:5173").ok).toBe(false);
    expect(
      validateActions([{ type: "click", ref: "e4" }], page, "http://localhost:5173").ok,
    ).toBe(false);
  });

  test("blocks raw personal data in ordinary typing", () => {
    const result = validateActions(
      [{ type: "type", ref: "e4", text: "email me at a@b.co" }],
      page,
      "http://localhost:5173",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/approval vault/i);
  });

  test("blocks ordinary text into a sensitive field even when the detector misses it", () => {
    const result = validateActions(
      [{ type: "type", ref: "e5", text: "not obviously personal" }],
      page,
      "http://localhost:5173",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sensitive field/i);
  });

  test("allows a matching sensitive placeholder for approval-gated entry", () => {
    const result = validateActions(
      [{ type: "type", ref: "e5", placeholder: "[PHONE_1]" }],
      page,
      "http://localhost:5173",
    );
    expect(result.ok).toBe(true);
  });

  test("rejects placeholder type mismatches and high-risk auto-fill", () => {
    expect(
      validateActions([{ type: "type", ref: "e5", placeholder: "[EMAIL_1]" }], page, "http://localhost:5173")
        .ok,
    ).toBe(false);
    expect(
      validateActions([{ type: "type", ref: "e6", placeholder: "[CARD_1]" }], page, "http://localhost:5173")
        .ok,
    ).toBe(false);
  });

  test("rejects more than three actions in one plan", () => {
    const result = validateActions(
      [
        { type: "click", ref: "e1" },
        { type: "click", ref: "e2" },
        { type: "click", ref: "e3" },
        { type: "click", ref: "e1" },
      ],
      page,
      "http://localhost:5173",
    );
    expect(result.ok).toBe(false);
  });
});
