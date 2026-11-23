import { z } from "zod";

export const DEFAULT_BACKEND_URL = "http://localhost:8000";
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export const MAX_PAYLOAD_BYTES = 24_000;
export const MAX_ELEMENTS = 70;
export const MAX_TEXT_BLOCKS = 36;
export const MAX_ELEMENT_CONTEXT = 280;
export const MAX_STEPS = 12;
export const MAX_ACTIONS_PER_PLAN = 3;
export const ACTION_TIMEOUT_MS = 12_000;
export const APPROVAL_TIMEOUT_MS = 60_000;
export const BACKEND_TIMEOUT_MS = 25_000;

export const CONSEQUENTIAL_PATTERN =
  /(place\s+(my\s+)?order|complete\s+(the\s+)?(order|checkout|purchase)|pay\s+now|submit\s+payment|confirm\s+(order|payment|purchase)|buy\s+now|proceed\s+to\s+checkout)/i;

export const CHECKOUT_PATH_PATTERN = /^\/(checkout|order-confirmation|payment)(\/|$)/i;

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.hostname.includes("*")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string, allowed: readonly string[]): boolean {
  return allowed.includes(origin);
}

export function isAllowedBackend(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export const PIITypes = [
  "PERSON",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "PIN",
  "GOVT_ID",
  "CARD",
  "BANK",
  "UPI",
  "PASSWORD",
  "OTP",
  "OTHER",
] as const;

export const PIITypeSchema = z.enum(PIITypes);
export type PIIType = z.infer<typeof PIITypeSchema>;

export const CategoryCountSchema = z.object({
  type: PIITypeSchema,
  count: z.number().int().nonnegative(),
});

export const PrivacyReportSchema = z.object({
  elementsInspected: z.number().int().nonnegative(),
  blocksConsidered: z.number().int().nonnegative(),
  blocksIncluded: z.number().int().nonnegative(),
  blocksExcluded: z.number().int().nonnegative(),
  redactions: z.number().int().nonnegative(),
  categories: z.array(CategoryCountSchema),
  gatePassed: z.boolean(),
  gateReason: z.string().max(240).optional(),
  sanitizationMs: z.number().nonnegative(),
  payloadBytes: z.number().int().nonnegative(),
});
export type PrivacyReport = z.infer<typeof PrivacyReportSchema>;

export const PageElementSchema = z
  .object({
    ref: z.string().regex(/^e\d+$/),
    tag: z.string().max(20),
    role: z.string().max(30),
    name: z.string().max(220),
    text: z.string().max(420).default(""),
    type: z.string().max(30).optional(),
    placeholder: z.string().max(140).optional(),
    autocomplete: z.string().max(80).optional(),
    disabled: z.boolean().optional(),
    sensitive: PIITypeSchema.optional(),
    valueToken: z.string().max(40).optional(),
    currentText: z.string().max(180).optional(),
    path: z.string().max(220).optional(),
    options: z
      .array(
        z.object({
          value: z.string().max(80),
          label: z.string().max(120),
        }),
      )
      .max(24)
      .optional(),
    context: z.string().max(MAX_ELEMENT_CONTEXT).optional(),
    product: z
      .object({
        name: z.string().max(140),
        price: z.number().nonnegative().optional(),
        rating: z.number().min(0).max(5).optional(),
        available: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();
export type PageElement = z.infer<typeof PageElementSchema>;

export const TextBlockSchema = z
  .object({
    ref: z.string().max(12).optional(),
    tag: z.string().max(20),
    text: z.string().max(520),
    heading: z.boolean().optional(),
  })
  .strict();
export type TextBlock = z.infer<typeof TextBlockSchema>;

export const PageContextSchema = z
  .object({
    origin: z.string().max(120),
    path: z.string().max(220),
    title: z.string().max(180),
    headings: z.array(z.string().max(180)).max(10),
    elements: z.array(PageElementSchema).max(MAX_ELEMENTS),
    textBlocks: z.array(TextBlockSchema).max(MAX_TEXT_BLOCKS),
  })
  .strict();
export type PageContext = z.infer<typeof PageContextSchema>;

export const HistoryEntrySchema = z
  .object({
    actionType: z.string().max(24),
    status: z.enum(["success", "failed", "blocked"]),
    note: z.string().max(220),
  })
  .strict();
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), ref: z.string().regex(/^e\d+$/) }).strict(),
  z
    .object({
      type: z.literal("type"),
      ref: z.string().regex(/^e\d+$/),
      text: z.string().max(200).optional(),
      placeholder: z.string().regex(/^\[[A-Z_]+_\d+\]$/).optional(),
      clear: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("select"),
      ref: z.string().regex(/^e\d+$/),
      option: z.string().max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("scroll"),
      direction: z.enum(["up", "down"]),
      amount: z.number().int().min(100).max(2400).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("navigate"),
      path: z.string().min(1).max(220),
    })
    .strict(),
  z
    .object({
      type: z.literal("wait"),
      ms: z.number().int().min(0).max(4000).optional(),
      ref: z.string().regex(/^e\d+$/).optional(),
      timeoutMs: z.number().int().min(200).max(8000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("verify"),
      text: z.string().min(1).max(160),
      ref: z.string().regex(/^e\d+$/).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("verify_cart"),
      productName: z.string().min(1).max(140),
    })
    .strict(),
]);
export type Action = z.infer<typeof ActionSchema>;

export const PlanResponseSchema = z
  .object({
    actions: z.array(ActionSchema).max(MAX_ACTIONS_PER_PLAN),
    reasoning: z.string().max(500),
    done: z.boolean(),
    completion: z.string().max(300).optional(),
    mode: z.enum(["mock", "llm"]).optional(),
  })
  .strict();
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const PlanRequestSchema = z
  .object({
    task: z.string().min(1).max(600),
    page: PageContextSchema,
    history: z.array(HistoryEntrySchema).max(20),
  })
  .strict();
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const ScanResultSchema = z.object({
  ok: z.boolean(),
  task: z.string(),
  page: PageContextSchema.optional(),
  report: PrivacyReportSchema,
  error: z.string().max(240).optional(),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1).max(60),
  origin: z.string().max(120),
  fieldLabel: z.string().max(160),
  dataType: PIITypeSchema,
  masked: z.string().max(80),
  placeholder: z.string().max(40),
  path: z.string().max(220),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.object({
  id: z.string(),
  approved: z.boolean(),
});
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export type RunStatus =
  | "idle"
  | "inspecting"
  | "sanitizing"
  | "planning"
  | "executing"
  | "awaiting_approval"
  | "verifying"
  | "complete"
  | "blocked"
  | "error";

export interface ActionRecord {
  id: string;
  type: string;
  label: string;
  status: "proposed" | "executed" | "blocked" | "failed";
  detail?: string;
}

export interface BackendInfo {
  accepted: boolean;
  mode?: string;
  proposed: number;
  reasoning?: string;
  error?: string;
}

export interface AgentState {
  runId: string | null;
  task: string;
  status: RunStatus;
  origin: string;
  domain: string;
  steps: number;
  privacy: PrivacyReport | null;
  backend: BackendInfo | null;
  actions: ActionRecord[];
  approval: ApprovalRequest | null;
  completion: { verified: boolean; message: string } | null;
  error: string | null;
  warnings: string[];
}

export const emptyState = (): AgentState => ({
  runId: null,
  task: "",
  status: "idle",
  origin: "",
  domain: "",
  steps: 0,
  privacy: null,
  backend: null,
  actions: [],
  approval: null,
  completion: null,
  error: null,
  warnings: [],
});

export function maskValue(type: PIIType, value: string): string {
  if (type === "EMAIL") {
    const [user = "", domain = ""] = value.split("@");
    return `${user.slice(0, 1)}•••@${domain || "•••"}`;
  }
  if (type === "PHONE") return `••••••${value.replace(/\D/g, "").slice(-3)}`;
  if (type === "CARD" || type === "GOVT_ID" || type === "BANK" || type === "PIN")
    return "•".repeat(Math.min(12, Math.max(4, value.replace(/\s/g, "").length)));
  if (type === "PERSON") return `${value.slice(0, 1)}•••• ${value.split(/\s+/).slice(-1)[0]?.slice(0, 1) ?? ""}••••`;
  return "••••••";
}
