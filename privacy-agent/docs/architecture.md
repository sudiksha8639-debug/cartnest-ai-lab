# Architecture

## Trust boundary

```
CartNest page
    │  visible DOM only (no password/OTP/card values)
    ▼
Content script ── local PII detection ──► Placeholder Vault (values stay here)
    │                    │
    │                    └─ redaction + relevance + payload budget
    │
    │  sanitized, minimized JSON only
    ▼
Background service worker ──► FastAPI /v1/plan
    │                              │
    │                              ├─ independent PII tripwire
    │                              ├─ mock planner or external LLM
    │                              └─ schema validation
    │  structured actions only
    ▼
Local action validator ── allowlist + refs + origin + consequence checks
    │
    ▼
Content executor ──► approved DOM controls
    └─ one-time approval for sensitive entry
```

The external AI is never trusted to authorize disclosure. It never receives the vault, real
sensitive values, CSS selectors, raw HTML, or data from irrelevant page regions.

## Extension modules

| Module | Responsibility |
| --- | --- |
| `src/content/extractor.ts` | Visible interactive elements, text blocks, labels, autocomplete, context, opaque refs. Password/OTP/card values are not read. |
| `src/privacy/detectors.ts` | Regex + field metadata + label/context detection; Luhn card validation; field classification. |
| `src/privacy/vault.ts` | Placeholder-to-value mappings. PASSWORD/OTP/CARD/BANK/GOVT_ID values are counted but never stored. |
| `src/privacy/sanitize.ts` | Replacement with `[TYPE_n]` tokens; detects before truncation. |
| `src/privacy/relevance.ts` | Task-token scoring, removal of unrelated blocks/fields, budget enforcement. |
| `src/privacy/engine.ts` | End-to-end scan report, residual-PII verification, fail-closed behavior. |
| `src/agent/validator.ts` | Reference existence, role checks, origin checks, checkout blocking, placeholder/field type matching. |
| `src/content/executor.ts` | Native-value input, clicks, selects, waits, verification, one-time approval. |
| `src/background/index.ts` | Run loop, step/action limits, backend calls, state broadcasting, approval brokering. |
| `src/background/settings.ts` | Backend URL, approved origins, dynamic content-script registration. |
| `src/ui/sidepanel.ts` | Dashboard, privacy/action report, approval UI, connection settings. |

## Data contracts

The TypeScript Zod schemas in `extension/src/shared/schema.ts` and the Pydantic models in
`backend/app/schemas.py` describe the same camelCase JSON:

- `PlanRequest`: sanitized task, minimized page (`origin`, `path`, `title`, `headings`, `elements`,
  `textBlocks`), bounded action history.
- `PlanResponse`: up to three actions, a short reasoning string, `done`, optional completion, mode.
- Actions: `click`, `type`, `select`, `scroll`, `navigate`, `wait`, `verify`, `verify_cart`.
  Unknown fields and unknown action types are rejected.

The backend forbids extra fields, so a client cannot smuggle a `gatePassed` claim into the trust
decision. The extension's local gate flag is informational only; the backend runs its own tripwire.

## Privacy engine details

Detection combines:

- Regular expressions for emails, Indian/international phone formats, Luhn-valid cards, PAN, Aadhaar
  (with separators or explicit context), UPI IDs, labelled bank accounts and PINs.
- Field metadata: `type`, `name`, `id`, `autocomplete`, associated label, placeholder.
- Context: label text, nearest article/list/form/section, page title/path/headings.
- Conservative profile heuristics: an account-page heading matching a person-name shape is
  redacted as `PERSON`.

Relevance scoring retains search/filter/sort/product/add-to-cart/cart/verification controls and the
task-relevant text. Account fields, footer links, unrelated navigation and marketing blocks are
excluded for a shopping task. A hard byte budget (24,000 bytes) drops lowest-value items; if the
remaining context cannot fit, the scan fails closed.

The engine serializes the final payload and re-runs high-confidence detection over it. Any residual
finding fails the gate and the backend request is never made. Raw PII is also never put into error
messages or logs.

## Action execution

The planner only sees local refs. At execution time the refs are resolved against the same document
scan. Actions are rejected if the ref is missing, the role is wrong, the element is disabled, the
URL leaves the approved origin, the path is checkout/payment, or the label indicates a purchase.
Text entry uses native setters plus `input`/`change` events for React compatibility.

Sensitive `type` actions carry a placeholder token, never a value. The executor resolves the token
from the content-script vault, verifies that the field is of the same PII type, then opens a one-time
approval with the destination origin, field label, type and masked value. Denial or timeout leaves
the page untouched. The approval is never cached or reused.

## Backend

- `/health` reports mode and tripwire status.
- `/v1/plan` enforces a 64 KB body limit, validates the schema, recursively scans every string with
  the tripwire, runs the planner, validates the response, and scans the response before returning.
- Mock planner: deterministic rule engine over sanitized element metadata. It ignores page text as
  instructions and never proposes checkout or high-risk credentials.
- Real planner: OpenAI-compatible chat completions with a strict system prompt and JSON response
  parsing. Any provider failure or invalid JSON returns a generic 502.
- Logs contain only path, mode, counts and `done`; no page text or PII.

## Why the backend is separate

The extension is not tied to the Freebuff preview. It calls the configured HTTP endpoint. The
backend can run locally or behind a private reverse proxy. No source or credentials are sent to
GitHub or an external host by this project.
