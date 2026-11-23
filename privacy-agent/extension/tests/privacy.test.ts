import { describe, expect, test } from "bun:test";
import { detectPII } from "../src/privacy/detectors";
import { sanitizeText } from "../src/privacy/sanitize";
import { PlaceholderVault } from "../src/privacy/vault";
import { buildPrivacyScan, verifySanitizedPage } from "../src/privacy/engine";
import { relevanceFilter } from "../src/privacy/relevance";
import { extractPage } from "../src/content/extractor";
import type { PageContext } from "../src/shared/schema";
import { accountPage, cartPage, homePage, productPage, shopPage } from "./fixtures/pages";
import { PII_DATASET } from "./fixtures/pii-dataset";

describe("local PII detection", () => {
  test("contextual detection for the synthetic dataset", () => {
    for (const fixture of PII_DATASET) {
      const found = detectPII(fixture.text, fixture.context ?? "");
      for (const expected of fixture.expected) {
        expect(
          found.some((item) => item.type === expected.type && item.value.includes(expected.value)),
          `${fixture.id} should detect ${expected.type}`,
        ).toBe(true);
      }
      if (fixture.expected.length === 0) {
        expect(found, `${fixture.id} should not produce false positives`).toEqual([]);
      }
    }
  });

  test("redaction uses typed placeholders and does not retain values", () => {
    const vault = new PlaceholderVault();
    const result = sanitizeText("Name: Ananya Deshpande, ananya@example.com, +91 98200 45512", vault);
    expect(result.text).toContain("[PERSON_1]");
    expect(result.text).toContain("[EMAIL_1]");
    expect(result.text).toContain("[PHONE_1]");
    expect(result.text).not.toContain("Ananya");
    expect(result.text).not.toContain("98200");
    expect(vault.get("[EMAIL_1]")?.value).toBe("ananya@example.com");
    expect(result.stats.redactions).toBeGreaterThanOrEqual(3);
  });

  test("high-risk values are counted but never stored in the vault", () => {
    const vault = new PlaceholderVault();
    const result = sanitizeText("Card 4111 1111 1111 1111", vault);
    expect(result.text).toContain("[CARD_1]");
    expect(vault.get("[CARD_1]")?.resolvable).toBe(false);
    expect(vault.get("[CARD_1]")?.value).toBeNull();
  });

  test("repeated values reuse one placeholder", () => {
    const vault = new PlaceholderVault();
    sanitizeText("a@b.co", vault);
    const second = sanitizeText("a@b.co", vault);
    expect(second.text).toBe("[EMAIL_1]");
    expect(vault.size).toBe(1);
  });
});

describe("fail-closed privacy engine", () => {
  test("home page scan passes the gate and keeps shopping controls", () => {
    const dom = homePage();
    const raw = extractPage(dom.window.document);
    const scan = buildPrivacyScan(raw, "Find wireless headphones and add them to my cart", new PlaceholderVault());
    expect(scan.ok).toBe(true);
    expect(scan.report.gatePassed).toBe(true);
    expect(scan.page?.elements.some((element) => /search/i.test(element.name))).toBe(true);
    expect(scan.page?.elements.some((element) => /cart/i.test(element.name))).toBe(true);
    expect(scan.report.blocksExcluded).toBeGreaterThan(0);
  });

  test("account page PII is removed before the payload is releasable", () => {
    const dom = accountPage();
    const raw = extractPage(dom.window.document);
    const scan = buildPrivacyScan(
      raw,
      "Review my account page and summarize it without exposing personal details",
      new PlaceholderVault(),
    );
    expect(scan.ok).toBe(true);
    expect(scan.report.categories.map((item) => item.type)).toEqual(
      expect.arrayContaining(["EMAIL", "PHONE", "PERSON"]),
    );
    const serialized = JSON.stringify(scan.page);
    expect(serialized).not.toContain("Ananya");
    expect(serialized).not.toContain("ananya.deshpande@example.com");
    expect(serialized).not.toContain("98200");
    expect(serialized).not.toContain("400049");
    expect(serialized).toContain("[PERSON_1]");
    expect(scan.report.redactions).toBeGreaterThanOrEqual(3);
  });

  test("residual raw PII fails independent payload verification", () => {
    const page: PageContext = {
      origin: "http://localhost:5173",
      path: "/leak",
      title: "Leak",
      headings: [],
      elements: [],
      textBlocks: [{ tag: "p", text: "Contact synthetic@example.com" }],
    };
    const result = verifySanitizedPage(page);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/personal data/i);
  });

  test("personal data in the user's own task is sanitized too", () => {
    const raw = extractPage(homePage().window.document);
    const scan = buildPrivacyScan(
      raw,
      "Email me at task.user@example.com about wireless headphones",
      new PlaceholderVault(),
    );
    expect(scan.ok).toBe(true);
    expect(scan.task).toContain("[EMAIL_1]");
    expect(scan.task).not.toContain("task.user@example.com");
    expect(JSON.stringify(scan.page)).not.toContain("task.user@example.com");
  });

  test("malformed inspection input fails closed", () => {
    const raw = extractPage(homePage().window.document);
    const broken = { ...raw, elements: undefined } as unknown as typeof raw;
    const scan = buildPrivacyScan(broken, "Find headphones", new PlaceholderVault());
    expect(scan.ok).toBe(false);
    expect(scan.report.gatePassed).toBe(false);
    expect(scan.page).toBeUndefined();
    expect(scan.error).toMatch(/blocked/i);
  });

  test("relevance filtering drops account fields for a shopping task", () => {
    const dom = accountPage();
    const raw = extractPage(dom.window.document);
    const scan = buildPrivacyScan(raw, "Find wireless headphones and add them to my cart", new PlaceholderVault());
    expect(scan.ok).toBe(true);
    expect(scan.page?.elements.some((element) => element.sensitive)).toBe(false);
    expect(scan.report.blocksExcluded).toBeGreaterThan(0);
  });

  test("payload budget is enforced", () => {
    const base = extractPage(homePage().window.document);
    const scan = buildPrivacyScan(base, "Find wireless headphones and add them to my cart", new PlaceholderVault());
    expect(scan.report.payloadBytes).toBeLessThanOrEqual(24_000);
    const filtered = relevanceFilter(
      scan.page!,
      "Find wireless headphones and add them to my cart",
      { maxBytes: 900, maxElements: 3, maxBlocks: 1 },
    );
    expect(new TextEncoder().encode(JSON.stringify(filtered.page)).length).toBeLessThanOrEqual(900);
    expect(() =>
      relevanceFilter(scan.page!, "Find wireless headphones", { maxBytes: 180, maxElements: 1, maxBlocks: 0 }),
    ).toThrow(/payload budget/i);
  });
});

describe("DOM page extraction", () => {
  test("extracts references without exposing passwords or sensitive values", () => {
    const dom = accountPage();
    const doc = dom.window.document;
    const password = doc.createElement("input");
    password.type = "password";
    password.name = "password";
    password.value = "super-secret";
    doc.body.append(password);
    const raw = extractPage(doc);
    const passwordElement = raw.elements.find((element) => element.type === "password");
    expect(passwordElement).toBeDefined();
    expect(passwordElement?.highRisk).toBe(true);
    expect(passwordElement?.value).toBeUndefined();
  });

  test("extracts stable local references for the shopping flow", () => {
    const shop = extractPage(shopPage().window.document);
    const search = shop.elements.find((element) => /search/i.test(element.name));
    const apply = shop.elements.find((element) => /apply price/i.test(element.name));
    const pulse = shop.elements.find((element) => /View Pulse Buds Mini/i.test(element.name));
    expect(search?.ref).toMatch(/^e\d+$/);
    expect(apply?.ref).toMatch(/^e\d+$/);
    expect(pulse?.ref).toMatch(/^e\d+$/);
    expect(shop.blocks.some((block) => block.text.includes("Pulse Buds Mini"))).toBe(true);
  });

  test("product and cart pages contain the expected controls", () => {
    const product = extractPage(productPage().window.document);
    const cart = extractPage(cartPage().window.document);
    expect(product.elements.some((element) => /Add Pulse Buds Mini to cart/i.test(element.name))).toBe(true);
    expect(cart.elements.some((element) => /checkout/i.test(element.name))).toBe(true);
  });
});
