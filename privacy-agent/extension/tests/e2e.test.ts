import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import type { JSDOM } from "jsdom";
import { extractPage, type RawPage } from "../src/content/extractor";
import { buildPrivacyScan } from "../src/privacy/engine";
import { PlaceholderVault } from "../src/privacy/vault";
import { executeAction } from "../src/content/executor";
import { validateActions } from "../src/agent/validator";
import { PlanResponseSchema, type Action, type HistoryEntry, type PlanRequest } from "../src/shared/schema";
import { cartPage, homePage, productPage, shopPage } from "./fixtures/pages";

const globals = globalThis as unknown as Record<string, unknown>;
const backendDir = path.resolve(import.meta.dir, "../../backend");
const python = path.join(backendDir, ".venv/bin/python");
const TASK = "Find the best-rated wireless headphones under ₹3,000 and add them to my cart.";

function installDom(dom: JSDOM): void {
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.CSS = { escape: (value: string) => value.replace(/["\\]/g, "\\$&") };
  (dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView =
    () => undefined;
  dom.window.scrollBy = (() => undefined) as unknown as typeof dom.window.scrollBy;
  globals.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (_message: unknown, callback: (response: { approved: boolean }) => void) =>
        callback({ approved: false }),
    },
  };
}

function pythonPlan(request: PlanRequest) {
  const script = [
    "import sys, base64, json",
    "from app.schemas import PlanRequest",
    "from app.llm.mock import plan",
    "req = PlanRequest.model_validate_json(base64.b64decode(sys.argv[1]))",
    "print(plan(req).model_dump_json(by_alias=True, exclude_none=True))",
  ].join("\n");
  const encoded = Buffer.from(JSON.stringify(request)).toString("base64");
  const result = Bun.spawnSync({
    cmd: [python, "-c", script, encoded],
    cwd: backendDir,
    env: { ...process.env, PYTHONPATH: backendDir },
  });
  if (result.exitCode !== 0) {
    throw new Error(`backend planner failed: ${result.stderr.toString().slice(0, 500)}`);
  }
  const output = result.stdout.toString().trim().split("\n").at(-1) ?? "";
  return PlanResponseSchema.parse(JSON.parse(output));
}

type PageKind = "home" | "shop" | "product" | "cart";

function loadPage(kind: PageKind): { dom: JSDOM; raw: RawPage } {
  const dom = kind === "home" ? homePage() : kind === "shop" ? shopPage() : kind === "product" ? productPage() : cartPage();
  installDom(dom);
  return { dom, raw: extractPage(dom.window.document) };
}

describe("cross-stack CartNest scenario", () => {
  test("sanitized pages drive the mock planner through cart verification", async () => {
    if (!existsSync(python)) {
      throw new Error("Backend virtualenv is missing. Run backend setup before the cross-stack test.");
    }
    const vault = new PlaceholderVault();
    let current = loadPage("home");
    const history: HistoryEntry[] = [];
    const executed: Action[] = [];

    for (let step = 0; step < 12; step++) {
      const scan = buildPrivacyScan(current.raw, TASK, vault);
      expect(scan.ok).toBe(true);
      expect(scan.report.gatePassed).toBe(true);
      const request: PlanRequest = { task: scan.task, page: scan.page!, history };
      const plan = pythonPlan(request);
      if (plan.done) {
        expect(history.some((item) => item.actionType === "verify_cart" && item.status === "success")).toBe(true);
        expect(plan.completion).toContain("Pulse Buds Mini");
        break;
      }
      const validation = validateActions(plan.actions, scan.page!, "http://localhost:5173");
      expect(validation.ok, validation.reason).toBe(true);

      for (const action of plan.actions) {
        executed.push(action);
        if (action.type === "navigate") {
          current = loadPage(action.path === "/cart" ? "cart" : "shop");
          history.push({ actionType: "navigate", status: "success", note: `Navigated to ${action.path}` });
          continue;
        }
        if (action.type === "verify_cart") {
          const outcome = await executeAction(action, current.raw.refs, vault, "http://localhost:5173");
          expect(outcome.ok).toBe(true);
          history.push({ actionType: "verify_cart", status: "success", note: outcome.note });
          continue;
        }
        const outcome = await executeAction(action, current.raw.refs, vault, "http://localhost:5173");
        expect(outcome.ok, outcome.note).toBe(true);
        history.push({ actionType: action.type, status: "success", note: outcome.note });

        if (action.type === "click") {
          const element = scan.page!.elements.find((item) => item.ref === action.ref);
          if (/search/i.test(element?.name ?? "") && element?.role === "button") {
            current = loadPage("shop");
          } else if (element?.path?.startsWith("/product/")) {
            current = loadPage("product");
          } else if (/add .* to cart/i.test(element?.name ?? "")) {
            current = loadPage("cart");
          } else {
            current = { dom: current.dom, raw: extractPage(current.dom.window.document) };
          }
        } else if (action.type === "type") {
          current = { dom: current.dom, raw: extractPage(current.dom.window.document) };
        }
      }
    }

    expect(executed.some((action) => action.type === "verify_cart")).toBe(true);
    expect(executed.some((action) => action.type === "navigate" && action.path === "/checkout")).toBe(false);
    expect(executed.some((action) => action.type === "click" && /checkout|buy now/i.test(JSON.stringify(action)))).toBe(false);
  });
});
