import type { AgentState, PIIType, PrivacyReport } from "../shared/schema";
import { emptyState, normalizeOrigin } from "../shared/schema";
import type { BackgroundMessage, BackgroundResponse } from "../shared/messages";

const STATUS_LABELS: Record<AgentState["status"], string> = {
  idle: "Idle",
  inspecting: "Inspecting page",
  sanitizing: "Sanitizing locally",
  planning: "Requesting a plan",
  executing: "Executing approved actions",
  awaiting_approval: "Awaiting your approval",
  verifying: "Verifying result",
  complete: "Complete",
  blocked: "Blocked",
  error: "Error",
};

const PII_LABELS: Record<PIIType, string> = {
  PERSON: "Names",
  EMAIL: "Emails",
  PHONE: "Phone numbers",
  ADDRESS: "Addresses",
  PIN: "PIN codes",
  GOVT_ID: "Government IDs",
  CARD: "Card numbers",
  BANK: "Bank details",
  UPI: "UPI IDs",
  PASSWORD: "Passwords",
  OTP: "OTPs",
  OTHER: "Other",
};

const RUNNING = new Set<AgentState["status"]>([
  "inspecting",
  "sanitizing",
  "planning",
  "executing",
  "awaiting_approval",
  "verifying",
]);

interface TabInfo {
  id: number;
  url: string;
  origin: string;
  title: string;
  allowed?: boolean;
}

interface SettingsView {
  backendUrl: string;
  allowedOrigins: string[];
}

let state: AgentState = emptyState();
let tab: TabInfo | null = null;
let settings: SettingsView | null = null;
let approvalBusy = false;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element ${id}`);
  return element as T;
}

function text(id: string, value: string): void {
  byId(id).textContent = value;
}

function setPill(id: string, value: string, tone: "neutral" | "good" | "warn" | "bad"): void {
  const element = byId(id);
  element.textContent = value;
  element.className = `pill ${tone}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function renderStatus(): void {
  const running = RUNNING.has(state.status);
  const statusLabel = STATUS_LABELS[state.status];
  text("status-text", state.error && !running ? state.error : state.completion?.message ?? defaultStatus());
  byId("status-dot").className = `status-dot ${state.status}`;
  setPill(
    "step-pill",
    state.steps > 0 ? `Step ${state.steps}/12` : statusLabel,
    state.status === "complete"
      ? "good"
      : state.status === "blocked" || state.status === "error"
        ? "bad"
        : running
          ? "warn"
          : "neutral",
  );

  const runButton = byId<HTMLButtonElement>("run-button");
  const stopButton = byId<HTMLButtonElement>("stop-button");
  runButton.disabled = running;
  stopButton.disabled = !running;
  runButton.textContent = running ? "Agent running…" : "Start agent";

  const error = byId("run-error");
  if (state.error) {
    error.hidden = false;
    error.textContent = state.error;
  } else {
    error.hidden = true;
    error.textContent = "";
  }
}

function defaultStatus(): string {
  switch (state.status) {
    case "idle":
      return "Ready. The page is inspected locally before anything is sent.";
    case "inspecting":
      return "Reading visible controls and text. Sensitive field values are withheld.";
    case "planning":
      return "Sending only the sanitized, minimized context to the planner.";
    case "executing":
      return "Executing the validated plan with local element references.";
    case "awaiting_approval":
      return "A sensitive value needs your explicit one-time approval.";
    case "verifying":
      return "Checking the result in the live page.";
    case "complete":
      return "Run complete.";
    case "blocked":
      return "The run was blocked by the local privacy or action gate.";
    case "error":
      return "The agent stopped safely.";
    default:
      return "Ready.";
  }
}

function renderPrivacy(report: PrivacyReport | null): void {
  text("metric-elements", report ? String(report.elementsInspected) : "—");
  text("metric-redactions", report ? String(report.redactions) : "—");
  text("metric-excluded", report ? String(report.blocksExcluded) : "—");
  text(
    "metric-payload",
    report ? (report.payloadBytes >= 1024 ? `${(report.payloadBytes / 1024).toFixed(1)} KB` : `${report.payloadBytes} B`) : "—",
  );

  const categories = byId("pii-categories");
  categories.replaceChildren();
  if (report) {
    for (const category of report.categories) {
      categories.append(
        el("span", "category-tag", `${PII_LABELS[category.type]} · ${category.count}`),
      );
    }
    if (report.categories.length === 0) {
      categories.append(el("span", "category-tag", "No personal data detected"));
    }
  }

  if (!report) {
    setPill("gate-pill", "Gate idle", "neutral");
    return;
  }
  setPill(
    "gate-pill",
    report.gatePassed ? "Gate passed" : "Gate blocked",
    report.gatePassed ? "good" : "bad",
  );
}

function renderBackend(): void {
  const element = byId("backend-status");
  if (!state.backend) {
    element.textContent = state.status === "blocked" ? "No request sent" : "No request sent";
    return;
  }
  if (state.backend.accepted) {
    element.textContent = `Accepted · ${state.backend.mode ?? "unknown"} mode · ${state.backend.proposed} proposed`;
    if (state.backend.reasoning) {
      element.title = state.backend.reasoning;
      element.textContent += ` · ${state.backend.reasoning.slice(0, 90)}${state.backend.reasoning.length > 90 ? "…" : ""}`;
    }
  } else {
    element.textContent = state.backend.error ?? "Rejected";
  }
}

function renderApproval(): void {
  const card = byId("approval-card");
  if (!state.approval) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const request = state.approval;
  text("approval-origin", `${request.origin} · ${request.path}`);
  text("approval-field", request.fieldLabel);
  text("approval-type", PII_LABELS[request.dataType]);
  text("approval-masked", request.masked);
  byId<HTMLButtonElement>("approve-button").disabled = approvalBusy;
  byId<HTMLButtonElement>("deny-button").disabled = approvalBusy;
}

function renderActions(): void {
  const list = byId<HTMLOListElement>("action-list");
  list.replaceChildren();
  text("action-count", `${state.actions.length} action${state.actions.length === 1 ? "" : "s"}`);
  if (state.actions.length === 0) {
    list.append(el("li", "empty-state", "No actions yet."));
    return;
  }
  for (const action of state.actions) {
    const item = el("li");
    const main = el("div", "action-main");
    main.append(el("div", "action-label", action.label));
    if (action.detail) main.append(el("div", "action-detail", action.detail));
    item.append(main, el("span", `action-state ${action.status}`, action.status));
    list.append(item);
  }
}

function renderCompletion(): void {
  const card = byId("completion-card");
  if (!state.completion) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  text("completion-text", state.completion.message);
  setPill(
    "verified-pill",
    state.completion.verified ? "Verified in cart" : "No purchase",
    state.completion.verified ? "good" : "neutral",
  );
}

function renderTab(): void {
  const origin = tab?.origin ?? state.origin;
  text("tab-origin", origin || "No active page");
  const allowed = tab?.allowed ?? (settings ? settings.allowedOrigins.includes(origin) : false);
  if (!origin) {
    text("tab-detail", "Open CartNest in the active tab.");
    setPill("origin-status", "No page", "neutral");
  } else if (allowed) {
    text("tab-detail", tab?.title || "Approved origin");
    setPill("origin-status", "Approved", "good");
  } else {
    text("tab-detail", "Add this origin in Connection settings and grant Chrome access.");
    setPill("origin-status", "Not approved", "bad");
  }
}

function renderSettings(): void {
  if (!settings) return;
  const list = byId("origin-list");
  list.replaceChildren();
  const defaults = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
  for (const origin of settings.allowedOrigins) {
    const item = el("li");
    item.append(el("span", "", origin));
    if (defaults.has(origin)) {
      item.append(el("span", "chip", "Built-in"));
    } else {
      const remove = el("button", "", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => void removeOrigin(origin));
      item.append(remove);
    }
    list.append(item);
  }
  byId<HTMLInputElement>("backend-url").value = settings.backendUrl;
}

function renderConnection(): void {
  const pill = byId("connection-pill");
  if (!settings) {
    pill.textContent = "Connecting";
    pill.className = "pill neutral";
    return;
  }
  pill.textContent = settings.backendUrl.replace(/^https?:\/\//, "").split("/")[0] ?? "Backend";
  pill.className = "pill neutral";
}

function render(): void {
  renderStatus();
  renderPrivacy(state.privacy);
  renderBackend();
  renderApproval();
  renderActions();
  renderCompletion();
  renderTab();
  renderSettings();
  renderConnection();
}

async function send<T = BackgroundResponse>(message: BackgroundMessage): Promise<T | null> {
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch {
    return null;
  }
}

async function refreshTab(): Promise<void> {
  const response = await send<{ ok: boolean; tab?: TabInfo | null }>({ type: "GET_ACTIVE_TAB" });
  if (response?.ok) {
    tab = response.tab ?? null;
    renderTab();
  }
}

async function refreshSettings(): Promise<void> {
  const response = await send<{ ok: boolean; settings?: SettingsView }>({ type: "GET_SETTINGS" });
  if (response?.ok && response.settings) {
    settings = response.settings;
    renderSettings();
    renderConnection();
    renderTab();
  }
}

async function refreshState(): Promise<void> {
  const response = await send<{ ok: boolean; state?: AgentState }>({ type: "GET_STATE" });
  if (response?.ok && response.state) {
    state = response.state;
    approvalBusy = false;
    render();
  }
}

function setSettingsStatus(message: string, error = false): void {
  const element = byId("settings-status");
  element.textContent = message;
  element.style.color = error ? "var(--bad)" : "var(--muted)";
}

async function startRun(): Promise<void> {
  const task = byId<HTMLTextAreaElement>("task-input").value.trim();
  if (task.length < 4) {
    byId("run-error").hidden = false;
    byId("run-error").textContent = "Write a task first.";
    return;
  }
  await refreshTab();
  if (tab && tab.allowed === false) {
    byId("settings").setAttribute("open", "");
    byId("run-error").hidden = false;
    byId("run-error").textContent =
      "This page origin is not approved. Add it under Connection and approve Chrome access.";
    return;
  }
  await send({ type: "START_RUN", task });
}

async function stopRun(): Promise<void> {
  await send({ type: "STOP_RUN" });
}

async function resolveApproval(approved: boolean): Promise<void> {
  const request = state.approval;
  if (!request) return;
  approvalBusy = true;
  renderApproval();
  await send({ type: "RESOLVE_APPROVAL", decision: { id: request.id, approved } });
}

async function saveBackend(): Promise<void> {
  const input = byId<HTMLInputElement>("backend-url");
  let url: URL;
  try {
    url = new URL(input.value.trim());
  } catch {
    setSettingsStatus("Enter a valid HTTP or HTTPS endpoint.", true);
    return;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    setSettingsStatus("Enter a valid HTTP or HTTPS endpoint.", true);
    return;
  }
  setSettingsStatus("Checking Chrome access…");
  const originPattern = `${url.origin}/*`;
  try {
    // Request directly, while the click gesture is still active. Chrome resolves
    // true immediately when the host is already granted.
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) {
      setSettingsStatus("Chrome access to the backend origin was not granted.", true);
      return;
    }
  } catch {
    setSettingsStatus("Could not request access to that backend origin.", true);
    return;
  }
  const endpoint = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  const response = await send<{ ok: boolean; settings?: SettingsView; error?: string }>({
    type: "SAVE_SETTINGS",
    backendUrl: endpoint,
  });
  if (response?.ok && response.settings) {
    settings = response.settings;
    renderSettings();
    renderConnection();
    setSettingsStatus("Endpoint saved.");
  } else {
    setSettingsStatus(response?.error ?? "Could not save the endpoint.", true);
  }
}

async function addOrigin(): Promise<void> {
  const input = byId<HTMLInputElement>("origin-input");
  const origin = normalizeOrigin(input.value.trim());
  if (!origin) {
    setSettingsStatus("Enter a full http or https origin, for example https://preview.example.com.", true);
    return;
  }
  setSettingsStatus("Chrome is asking for site access…");
  try {
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      setSettingsStatus("Chrome access was declined, so the origin was not approved.", true);
      return;
    }
  } catch {
    setSettingsStatus("Chrome could not grant access to that origin.", true);
    return;
  }
  const response = await send<{ ok: boolean; settings?: SettingsView; error?: string }>({
    type: "ADD_ORIGIN",
    origin,
  });
  if (response?.ok && response.settings) {
    settings = response.settings;
    input.value = "";
    renderSettings();
    renderTab();
    setSettingsStatus(
      "Origin approved. If the page was already open, reload it so the content script attaches.",
    );
    await refreshTab();
  } else {
    setSettingsStatus(response?.error ?? "Could not approve the origin.", true);
  }
}

async function removeOrigin(origin: string): Promise<void> {
  const response = await send<{ ok: boolean; settings?: SettingsView; error?: string }>({
    type: "REMOVE_ORIGIN",
    origin,
  });
  if (response?.ok && response.settings) {
    settings = response.settings;
    renderSettings();
    renderTab();
    setSettingsStatus("Origin removed.");
  } else {
    setSettingsStatus(response?.error ?? "Could not remove the origin.", true);
  }
}

byId("example-task").addEventListener("click", () => {
  byId<HTMLTextAreaElement>("task-input").value =
    "Find the best-rated wireless headphones under ₹3,000 and add them to my cart.";
});

byId("run-button").addEventListener("click", () => void startRun());
byId("stop-button").addEventListener("click", () => void stopRun());
byId("approve-button").addEventListener("click", () => void resolveApproval(true));
byId("deny-button").addEventListener("click", () => void resolveApproval(false));
byId("save-backend").addEventListener("click", () => void saveBackend());
byId("add-origin").addEventListener("click", () => void addOrigin());

chrome.runtime.onMessage.addListener((message: { type?: string; state?: AgentState }) => {
  if (message.type === "STATE_UPDATE" && message.state) {
    state = message.state;
    approvalBusy = false;
    render();
  }
  return false;
});

void refreshState();
void refreshSettings();
void refreshTab();
setInterval(() => {
  if (!RUNNING.has(state.status)) void refreshTab();
}, 2500);
