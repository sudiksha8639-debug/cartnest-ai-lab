import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { executeAction } from "../src/content/executor";
import { extractPage } from "../src/content/extractor";
import { buildPrivacyScan } from "../src/privacy/engine";
import { PlaceholderVault } from "../src/privacy/vault";
import { accountPage, cartPage, homePage, productPage } from "./fixtures/pages";

const globals = globalThis as unknown as Record<string, unknown>;

function installDom(dom: ReturnType<typeof homePage>): void {
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.CSS = { escape: (value: string) => value.replace(/["\\]/g, "\\$&") };
  (dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView =
    () => undefined;
  dom.window.scrollBy = (() => undefined) as unknown as typeof dom.window.scrollBy;
}

function setApproval(approved: boolean): void {
  globals.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (_message: unknown, callback: (response: { approved: boolean }) => void) =>
        callback({ approved }),
    },
  };
}

describe("action executor", () => {
  beforeEach(() => setApproval(true));
  afterEach(() => {
    delete globals.chrome;
  });

  test("types into the live search field with input events", async () => {
    const dom = homePage();
    installDom(dom);
    const raw = extractPage(dom.window.document);
    const scan = buildPrivacyScan(raw, "Find wireless headphones", new PlaceholderVault());
    const search = scan.page?.elements.find((element) => /search/i.test(element.name));
    expect(search).toBeDefined();
    let inputEvents = 0;
    const input = raw.refs.get(search!.ref) as HTMLInputElement;
    input.addEventListener("input", () => inputEvents++);

    const outcome = await executeAction(
      { type: "type", ref: search!.ref, text: "wireless", clear: true },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(true);
    expect(input.value).toBe("wireless");
    expect(inputEvents).toBeGreaterThan(0);
  });

  test("clicks add-to-cart locally", async () => {
    const dom = productPage();
    installDom(dom);
    const raw = extractPage(dom.window.document);
    const scan = buildPrivacyScan(raw, "Add Pulse Buds Mini to my cart", new PlaceholderVault());
    const add = scan.page?.elements.find((element) => /Add Pulse Buds Mini/i.test(element.name));
    expect(add).toBeDefined();
    let clicked = 0;
    raw.refs.get(add!.ref)!.addEventListener("click", () => clicked++);
    const outcome = await executeAction(
      { type: "click", ref: add!.ref },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(true);
    expect(clicked).toBe(1);
  });

  test("verifies the cart only when the product is visible on /cart", async () => {
    const dom = cartPage();
    installDom(dom);
    const raw = extractPage(dom.window.document);
    const outcome = await executeAction(
      { type: "verify_cart", productName: "Pulse Buds Mini" },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(true);
    const missing = await executeAction(
      { type: "verify_cart", productName: "Nova X9 Pro" },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(missing.ok).toBe(false);
  }, 15_000);

  test("blocks sensitive entry when approval is denied", async () => {
    const dom = accountPage();
    installDom(dom);
    setApproval(false);
    const raw = extractPage(dom.window.document);
    const vault = new PlaceholderVault();
    const scan = buildPrivacyScan(raw, "Enter my saved phone number", vault);
    const phone = scan.page?.elements.find((element) => element.sensitive === "PHONE");
    expect(phone?.valueToken).toBe("[PHONE_1]");
    const before = (raw.refs.get(phone!.ref) as HTMLInputElement).value;
    const outcome = await executeAction(
      { type: "type", ref: phone!.ref, placeholder: "[PHONE_1]" },
      raw.refs,
      vault,
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(false);
    expect((raw.refs.get(phone!.ref) as HTMLInputElement).value).toBe(before);
  });

  test("blocks ordinary text into a sensitive field without a placeholder", async () => {
    const dom = accountPage();
    installDom(dom);
    setApproval(true);
    const raw = extractPage(dom.window.document);
    const vault = new PlaceholderVault();
    const scan = buildPrivacyScan(raw, "Enter my saved phone number", vault);
    const phone = scan.page?.elements.find((element) => element.sensitive === "PHONE");
    const outcome = await executeAction(
      { type: "type", ref: phone!.ref, text: "some text" },
      raw.refs,
      vault,
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.note).toMatch(/approved placeholder/i);
  });

  test("writes a sensitive value only after explicit approval", async () => {
    const dom = accountPage();
    installDom(dom);
    setApproval(true);
    const raw = extractPage(dom.window.document);
    const vault = new PlaceholderVault();
    const scan = buildPrivacyScan(raw, "Enter my saved phone number", vault);
    const phone = scan.page?.elements.find((element) => element.sensitive === "PHONE");
    const field = raw.refs.get(phone!.ref) as HTMLInputElement;
    field.value = "";
    const outcome = await executeAction(
      { type: "type", ref: phone!.ref, placeholder: "[PHONE_1]" },
      raw.refs,
      vault,
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(true);
    expect(field.value).toBe("+91 98200 45512");
  });

  test("blocks a click that would submit a form off-origin", async () => {
    const dom = homePage();
    installDom(dom);
    dom.window.document.body.innerHTML =
      '<form action="https://evil.example/collect"><button type="submit">Continue</button></form>';
    const raw = extractPage(dom.window.document);
    const button = [...raw.refs.entries()].find(([, element]) => element.tagName === "BUTTON")?.[0];
    expect(button).toBeDefined();
    const outcome = await executeAction(
      { type: "click", ref: button! },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.note).toContain("Cross-origin");
  });

  test("blocks checkout clicks and navigation at execution time", async () => {
    const dom = cartPage();
    installDom(dom);
    const raw = extractPage(dom.window.document);
    const checkout = Array.from(dom.window.document.querySelectorAll("a")).find((anchor) =>
      /checkout/i.test(anchor.textContent ?? ""),
    ) as HTMLAnchorElement;
    const ref = [...raw.refs.entries()].find(([, element]) => element === checkout)?.[0];
    expect(ref).toBeDefined();
    const click = await executeAction(
      { type: "click", ref: ref! },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(click.ok).toBe(false);
    const navigate = await executeAction(
      { type: "navigate", path: "/checkout" },
      raw.refs,
      new PlaceholderVault(),
      "http://localhost:5173",
    );
    expect(navigate.ok).toBe(false);
  });
});
