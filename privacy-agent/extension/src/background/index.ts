import type {
  Action,
  AgentState,
  ApprovalRequest,
  HistoryEntry,
  PlanRequest,
  PrivacyReport,
} from "../shared/schema";
import {
  emptyState,
  isAllowedOrigin,
  MAX_STEPS,
  normalizeOrigin,
} from "../shared/schema";
import type {
  ActionResponse,
  BackgroundMessage,
  ContentMessage,
  ScanResponse,
} from "../shared/messages";
import { requestPlan } from "./backend";
import {
  contentScriptId,
  ensureDynamicContentScripts,
  loadSettings,
  saveSettings,
  type AgentSettings,
} from "./settings";
import { describeAction, findElement, validateActions } from "../agent/validator";

let state: AgentState = emptyState();
let running = false;
let stopRequested = false;
let settings: AgentSettings;
let pendingApproval: {
  request: ApprovalRequest;
  resolve: (approved: boolean) => void;
  timer: number;
} | null = null;

const settingsReady = loadSettings().then((loaded) => {
  settings = loaded;
  void ensureDynamicContentScripts(loaded);
});

function broadcast(): void {
  void chrome.runtime.sendMessage({ type: "STATE_UPDATE", state }).catch(() => {});
}

function patch(next: Partial<AgentState>): void {
  state = { ...state, ...next };
  broadcast();
}

function resetRun(task: string, origin: string): string {
  const runId = `run-${Date.now().toString(36)}`;
  state = {
    ...emptyState(),
    runId,
    task,
    origin,
    domain: origin ? new URL(origin).host : "",
    status: "inspecting",
  };
  broadcast();
  return runId;
}

function historyFromState(): HistoryEntry[] {
  return state.actions
    .filter((item) => item.status === "executed" || item.status === "blocked")
    .map((item) => ({
      actionType: item.type,
      status: item.status === "executed" ? ("success" as const) : ("blocked" as const),
      note: `${item.label}${item.detail ? ` — ${item.detail}` : ""}`.slice(0, 220),
    }));
}

async function activeTab(): Promise<{ id: number; url: string; origin: string; title: string } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return null;
  const origin = normalizeOrigin(tab.url);
  if (!origin) return null;
  return { id: tab.id, url: tab.url, origin, title: tab.title ?? "" };
}

async function sendToContent<T>(tabId: number, message: ContentMessage): Promise<T | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch {
    return null;
  }
}

async function ensureContentScript(tabId: number, origin: string): Promise<boolean> {
  const ping = await sendToContent<ActionResponse>(tabId, { type: "PING" });
  if (ping) return true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch {
    return false;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const retry = await sendToContent<ActionResponse>(tabId, { type: "PING" });
    if (retry) return true;
  }
  return false;
}

async function scan(tabId: number, task: string): Promise<ScanResponse | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await sendToContent<ScanResponse>(tabId, { type: "SCAN_PAGE", task });
    if (response) return response;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

function stopRun(reason: string, status: "blocked" | "error" = "blocked"): void {
  stopRequested = true;
  patch({ status, error: reason, approval: null });
  if (pendingApproval) {
    clearTimeout(pendingApproval.timer);
    pendingApproval.resolve(false);
    pendingApproval = null;
  }
}

async function startRun(task: string): Promise<void> {
  if (running) {
    patch({ error: "A run is already in progress." });
    return;
  }
  const trimmed = task.trim();
  if (trimmed.length < 4) {
    patch({ status: "blocked", error: "Enter a task with at least a few words." });
    return;
  }
  await settingsReady;
  running = true;
  stopRequested = false;

  const tab = await activeTab();
  if (!tab) {
    running = false;
    patch({ status: "blocked", error: "Open an approved webpage in the active tab." });
    return;
  }
  if (!isAllowedOrigin(tab.origin, settings.allowedOrigins)) {
    running = false;
    resetRun(trimmed, tab.origin);
    stopRun(
      `The origin ${tab.origin} is not approved. Add it in Connection settings and grant Chrome access before running the agent.`,
    );
    return;
  }

  resetRun(trimmed, tab.origin);
  const ready = await ensureContentScript(tab.id, tab.origin);
  if (!ready) {
    running = false;
    stopRun("The page could not be inspected. Reload the CartNest tab and try again.");
    return;
  }

  let verified = false;
  let verifiedProduct: string | null = null;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (stopRequested) break;
      patch({ steps: step + 1, status: "inspecting", approval: null });

      const scanResponse = await scan(tab.id, trimmed);
      if (!scanResponse || !scanResponse.ok) {
        stopRun(
          scanResponse?.ok === false
            ? scanResponse.error
            : "The page stopped responding during inspection.",
        );
        break;
      }
      const result = scanResponse.result;
      patch({
        privacy: result.report,
        ...(result.page ? { origin: result.page.origin, domain: new URL(result.page.origin).host } : {}),
      });

      if (!result.ok || !result.page || !result.report.gatePassed) {
        patch({
          status: "blocked",
          backend: null,
          error:
            result.error ??
            "The privacy gate blocked the run. No page data was sent to the backend.",
        });
        break;
      }

      const request: PlanRequest = {
        task: result.task,
        page: result.page,
        history: historyFromState(),
      };

      patch({ status: "planning" });
      const planResponse = await requestPlan(settings.backendUrl, request);
      if (!planResponse.accepted || !planResponse.plan) {
        patch({
          status: "blocked",
          backend: {
            accepted: false,
            proposed: 0,
            error: planResponse.error ?? "The backend rejected the request.",
          },
          error: `${planResponse.error ?? "The backend rejected the request."} Nothing was executed.`,
        });
        break;
      }

      const plan = planResponse.plan;
      patch({
        backend: {
          accepted: true,
          mode: plan.mode ?? planResponse.mode,
          proposed: plan.actions.length,
          reasoning: plan.reasoning,
        },
      });

      if (plan.done) {
        const shoppingTask = /\b(add|cart|buy|shop|purchase)\b/i.test(trimmed);
        if (shoppingTask && !verified) {
          patch({
            status: "blocked",
            error:
              "The planner marked the task complete without a successful cart verification. Completion was rejected.",
          });
        } else {
          patch({
            status: "complete",
            completion: {
              verified,
              message:
                plan.completion ??
                (verified
                  ? `Verified ${verifiedProduct ?? "the selected product"} in the cart.`
                  : "Task completed without a shopping action."),
            },
          });
        }
        break;
      }

      if (plan.actions.length === 0) {
        patch({ status: "blocked", error: "The planner returned no executable actions." });
        break;
      }

      const validation = validateActions(plan.actions, result.page, tab.origin);
      if (!validation.ok) {
        const rejected = plan.actions.map((action, index) => ({
          id: `${step}-rejected-${index}`,
          type: action.type,
          label: describeAction(action, result.page),
          status: "blocked" as const,
          detail: validation.reason,
        }));
        patch({
          status: "blocked",
          actions: [...state.actions, ...rejected],
          error: `Action plan rejected locally: ${validation.reason}. Nothing was executed.`,
        });
        break;
      }

      patch({ status: "executing" });
      let stopAfterActions = false;
      for (const action of validation.actions) {
        if (stopRequested) break;
        const label = describeAction(action, result.page);
        const recordId = `${step}-${Math.random().toString(36).slice(2, 7)}`;
        patch({
          actions: [...state.actions, { id: recordId, type: action.type, label, status: "proposed" }],
        });

        const outcome = await sendToContent<ActionResponse & { ok: boolean; status?: string; note?: string }>(
          tab.id,
          { type: "EXECUTE_ACTION", action },
        );

        if (!outcome) {
          patch({
            actions: state.actions.map((item) =>
              item.id === recordId
                ? { ...item, status: "failed", detail: "The page did not respond" }
                : item,
            ),
          });
          stopRun("The page stopped responding while executing an action.");
          stopAfterActions = true;
          break;
        }

        if (pendingApproval) {
          clearTimeout(pendingApproval.timer);
          pendingApproval = null;
          patch({ approval: null });
        }

        const succeeded = outcome.ok === true && outcome.status === "success";
        patch({
          actions: state.actions.map((item) =>
            item.id === recordId
              ? {
                  ...item,
                  status: succeeded ? "executed" : "blocked",
                  detail: outcome.note ?? "",
                }
              : item,
          ),
        });

        if (!succeeded) {
          patch({
            status: "blocked",
            error: `${outcome.note ?? "The action was blocked."} No further actions were executed.`,
          });
          stopAfterActions = true;
          break;
        }

        if (action.type === "verify_cart") {
          verified = true;
          verifiedProduct = action.productName;
        }

        // Navigation, link clicks and SPA updates need a fresh DOM scan.
        if (action.type === "click" || action.type === "navigate" || action.type === "verify_cart") {
          await new Promise((resolve) => setTimeout(resolve, outcome.navigated ? 900 : 450));
          stopAfterActions = true;
          break;
        }
      }

      if (stopAfterActions) {
        const blocked = state.status === "blocked" || state.status === "error";
        if (blocked) break;
        continue;
      }
    }

    if (state.status !== "complete" && state.status !== "blocked" && state.status !== "error") {
      patch({
        status: "blocked",
        error: "The run reached the step limit before verification. No purchase was attempted.",
      });
    }
  } catch {
    patch({
      status: "error",
      error: "The agent stopped unexpectedly. Nothing further was executed.",
    });
  } finally {
    running = false;
    stopRequested = false;
  }
}

async function resolveApproval(id: string, approved: boolean): Promise<void> {
  if (!pendingApproval || pendingApproval.request.id !== id) return;
  const pending = pendingApproval;
  pendingApproval = null;
  clearTimeout(pending.timer);
  patch({ approval: null, status: approved ? "executing" : "blocked" });
  pending.resolve(approved);
  if (!approved) {
    stopRun("Sensitive entry was denied. The value was never written to the page.");
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    sender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "REQUEST_APPROVAL") {
      if (!running || sender.id !== chrome.runtime.id || !message.request) {
        sendResponse({ approved: false });
        return false;
      }
      if (pendingApproval) {
        sendResponse({ approved: false });
        return false;
      }
      const timer = setTimeout(() => {
        if (pendingApproval?.request.id === message.request.id) {
          const pending = pendingApproval;
          pendingApproval = null;
          patch({ approval: null });
          pending.resolve(false);
        }
      }, 60_000) as unknown as number;
      pendingApproval = {
        request: message.request,
        resolve: (approved) => sendResponse({ approved }),
        timer,
      };
      patch({ status: "awaiting_approval", approval: message.request });
      return true;
    }

    void settingsReady;

    if (message.type === "GET_STATE") {
      sendResponse({ ok: true, state });
      return false;
    }

    if (message.type === "GET_ACTIVE_TAB") {
      void activeTab().then((tab) => {
        sendResponse({
          ok: true,
          tab: tab
            ? {
                ...tab,
                allowed: isAllowedOrigin(tab.origin, settings?.allowedOrigins ?? []),
              }
            : null,
        });
      });
      return true;
    }

    if (message.type === "START_RUN") {
      void startRun(message.task);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "STOP_RUN") {
      if (running) stopRun("Stopped by the user.");
      sendResponse({ ok: true, state });
      return false;
    }

    if (message.type === "GET_SETTINGS") {
      void settingsReady.then(() => sendResponse({ ok: true, settings }));
      return true;
    }

    if (message.type === "SAVE_SETTINGS") {
      void settingsReady
        .then(() => saveSettings({ ...settings, backendUrl: message.backendUrl }))
        .then((saved) => {
          settings = saved;
          sendResponse({ ok: true, settings });
        })
        .catch(() => sendResponse({ ok: false, error: "Could not save settings." }));
      return true;
    }

    if (message.type === "ADD_ORIGIN") {
      const origin = normalizeOrigin(message.origin);
      if (!origin) {
        sendResponse({ ok: false, error: "Enter a valid http or https origin." });
        return false;
      }
      void settingsReady
        .then(async () => {
          settings = await saveSettings({
            ...settings,
            allowedOrigins: [...settings.allowedOrigins, origin],
          });
          await ensureDynamicContentScripts(settings);
          const tab = await activeTab();
          if (tab?.origin === origin) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            }).catch(() => undefined);
          }
          sendResponse({ ok: true, settings });
        })
        .catch(() => sendResponse({ ok: false, error: "Could not approve that origin." }));
      return true;
    }

    if (message.type === "REMOVE_ORIGIN") {
      const origin = normalizeOrigin(message.origin);
      if (!origin) {
        sendResponse({ ok: false, error: "Invalid origin." });
        return false;
      }
      void settingsReady
        .then(async () => {
          settings = await saveSettings({
            ...settings,
            allowedOrigins: settings.allowedOrigins.filter((item) => item !== origin),
          });
          const id = contentScriptId(origin);
          await chrome.scripting
            .unregisterContentScripts({ ids: [id] })
            .catch(() => undefined);
          await chrome.permissions.remove({ origins: [`${origin}/*`] }).catch(() => undefined);
          sendResponse({ ok: true, settings });
        })
        .catch(() => sendResponse({ ok: false, error: "Could not remove that origin." }));
      return true;
    }

    if (message.type === "RESOLVE_APPROVAL") {
      void resolveApproval(message.decision.id, message.decision.approved);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) void chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  void settingsReady;
});

chrome.runtime.onStartup.addListener(() => {
  void settingsReady;
});
