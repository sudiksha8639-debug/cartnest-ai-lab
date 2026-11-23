import type {
  Action,
  AgentState,
  ApprovalDecision,
  ApprovalRequest,
  PlanResponse,
  ScanResult,
} from "./schema";

export type BackgroundMessage =
  | { type: "GET_ACTIVE_TAB" }
  | { type: "GET_STATE" }
  | { type: "START_RUN"; task: string }
  | { type: "STOP_RUN" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; backendUrl: string }
  | { type: "ADD_ORIGIN"; origin: string }
  | { type: "REMOVE_ORIGIN"; origin: string }
  | { type: "RESOLVE_APPROVAL"; decision: ApprovalDecision }
  | { type: "REQUEST_APPROVAL"; request: ApprovalRequest };

export type ContentMessage =
  | { type: "PING" }
  | { type: "SCAN_PAGE"; task: string }
  | { type: "EXECUTE_ACTION"; action: Action };

export type BackgroundResponse =
  | { ok: true; state?: AgentState; tab?: { id: number; url: string; origin: string; title: string } }
  | { ok: false; error: string };

export type ScanResponse =
  | { ok: true; result: ScanResult }
  | { ok: false; error: string };

export type ActionResponse =
  | { ok: boolean; status: "success" | "blocked"; note: string; navigated: boolean }
  | { ok: false; error: string };

export type PlanEnvelope = {
  accepted: boolean;
  plan?: PlanResponse;
  mode?: string;
  error?: string;
};

export type RuntimeStateMessage = { type: "STATE_UPDATE"; state: AgentState };
