import { describe, expect, test } from "bun:test";
import { DEFAULT_ALLOWED_ORIGINS, isAllowedOrigin, normalizeOrigin } from "../src/shared/schema";

describe("origin policy", () => {
  test("only the seeded CartNest origins are allowed by default", () => {
    expect(isAllowedOrigin("http://localhost:5173", DEFAULT_ALLOWED_ORIGINS)).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173", DEFAULT_ALLOWED_ORIGINS)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", DEFAULT_ALLOWED_ORIGINS)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5174", DEFAULT_ALLOWED_ORIGINS)).toBe(false);
  });

  test("normalization rejects non-http(s) schemes and strips paths", () => {
    expect(normalizeOrigin("https://preview.example/path?q=1")).toBe("https://preview.example");
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("file:///tmp/page.html")).toBeNull();
    expect(normalizeOrigin("http://*.example.com")).toBeNull();
    expect(normalizeOrigin("http://user:pass@example.com")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
  });
});
