import type { Action } from "../shared/schema";
import { ScanResultSchema } from "../shared/schema";
import type { ActionResponse, ContentMessage, ScanResponse } from "../shared/messages";
import { extractPage, type RawPage } from "./extractor";
import { buildPrivacyScan } from "../privacy/engine";
import { PlaceholderVault } from "../privacy/vault";
import { executeAction } from "./executor";

declare global {
  interface Window {
    __cartnestPrivacyAgent?: boolean;
  }
}

const vault = new PlaceholderVault();
let lastRaw: RawPage | null = null;
let lastPath = "";
let lastFingerprint = "";
const refs = new Map<string, HTMLElement>();

if (!window.__cartnestPrivacyAgent) {
  window.__cartnestPrivacyAgent = true;

  chrome.runtime.onMessage.addListener(
    (message: ContentMessage, _sender, sendResponse: (response: ScanResponse | ActionResponse) => void) => {
      if (message.type === "PING") {
        sendResponse({ ok: true } as unknown as ScanResponse);
        return false;
      }

      if (message.type === "SCAN_PAGE") {
        void (async () => {
          try {
            const raw = extractPage(document);
            if (lastPath && raw.path !== lastPath) vault.clear();
            lastPath = raw.path;
            lastRaw = raw;
            refs.clear();
            for (const [ref, element] of raw.refs) refs.set(ref, element);
            lastFingerprint = raw.contentFingerprint;
            const result = buildPrivacyScan(raw, message.task, vault);
            const validated = ScanResultSchema.safeParse(result);
            if (!validated.success) {
              sendResponse({
                ok: true,
                result: {
                  ok: false,
                  task: "",
                  report: result.report,
                  error: "Privacy scan produced an invalid result and was blocked.",
                },
              });
              return;
            }
            sendResponse({ ok: true, result: validated.data });
          } catch {
            sendResponse({ ok: false, error: "Page inspection failed. No data was transmitted." });
          }
        })();
        return true;
      }

      if (message.type === "EXECUTE_ACTION") {
        void (async () => {
          try {
            const outcome = await executeAction(
              message.action as Action,
              refs,
              vault,
              window.location.origin,
            );
            sendResponse({
              ok: outcome.ok,
              status: outcome.status,
              note: outcome.note,
              navigated: outcome.navigated,
            } as ActionResponse);
          } catch {
            sendResponse({
              ok: false,
              status: "blocked",
              note: "The action failed safely",
              navigated: false,
            } as ActionResponse);
          }
        })();
        return true;
      }

      return false;
    },
  );

  // Notify the agent when the SPA changes route in the same document.
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      try {
        chrome.runtime.sendMessage({ type: "PAGE_CHANGED", path: location.pathname });
      } catch {
        // Background may be asleep; the next scan still uses the current DOM.
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
}

console.debug("[CartNest Privacy Agent] content script ready");

export function __debugSnapshot(): { path: string; fingerprint: string; refs: number } {
  return { path: lastPath, fingerprint: lastFingerprint, refs: refs.size };
}
