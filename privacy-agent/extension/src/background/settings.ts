import {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_BACKEND_URL,
  isAllowedBackend,
  normalizeOrigin,
} from "../shared/schema";

export interface AgentSettings {
  backendUrl: string;
  allowedOrigins: string[];
}

const SETTINGS_KEY = "privacyAgentSettings";

export async function loadSettings(): Promise<AgentSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<AgentSettings> | undefined;
  const origins = Array.isArray(value?.allowedOrigins)
    ? value.allowedOrigins.filter((origin): origin is string => typeof origin === "string" && Boolean(normalizeOrigin(origin)))
    : [];
  const backendUrl =
    typeof value?.backendUrl === "string" && isAllowedBackend(value.backendUrl)
      ? value.backendUrl
      : DEFAULT_BACKEND_URL;
  return {
    backendUrl,
    allowedOrigins: Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...origins.map((origin) => normalizeOrigin(origin) ?? origin)])),
  };
}

export async function saveSettings(next: AgentSettings): Promise<AgentSettings> {
  const normalized: AgentSettings = {
    backendUrl: isAllowedBackend(next.backendUrl) ? next.backendUrl : DEFAULT_BACKEND_URL,
    allowedOrigins: Array.from(
      new Set(
        [...DEFAULT_ALLOWED_ORIGINS, ...next.allowedOrigins]
          .map((origin) => normalizeOrigin(origin))
          .filter((origin): origin is string => Boolean(origin)),
      ),
    ),
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export function contentScriptId(origin: string): string {
  let hash = 2166136261;
  for (let index = 0; index < origin.length; index++) {
    hash ^= origin.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `origin-${(hash >>> 0).toString(36)}`;
}

export async function ensureDynamicContentScripts(settings: AgentSettings): Promise<void> {
  const defaults = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  for (const origin of settings.allowedOrigins) {
    if (defaults.has(origin)) continue;
    const id = contentScriptId(origin);
    try {
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      if (existing.length === 0) {
        await chrome.scripting.registerContentScripts([
          {
            id,
            matches: [`${origin}/*`],
            js: ["content.js"],
            runAt: "document_idle",
            persistAcrossSessions: true,
          },
        ]);
      }
    } catch {
      // A missing host permission is handled by the explicit add-origin flow.
    }
  }
}
