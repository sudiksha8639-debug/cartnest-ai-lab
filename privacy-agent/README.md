# CartNest Privacy Agent

A privacy-first Chrome extension and independent FastAPI planner. It reads an approved webpage,
detects and redacts personal data locally, sends only a minimized sanitized context to the backend,
validates the returned structured actions, and executes them with a hard stop before checkout.

CartNest is the demonstration storefront. This project does **not** modify or rebuild CartNest; it
interacts with the rendered page through the same DOM any Chrome extension sees.

## What is implemented

- Manifest V3 Chrome extension with a persistent side panel (Chrome 114+).
- Local DOM extraction with opaque references (`e1`, `e2`, …). Raw selectors are never sent to the
  planner.
- Local PII detection using regex, field type, autocomplete, labels, placeholders and DOM context:
  names, emails, Indian and international phone numbers, addresses, PIN codes, government IDs,
  payment cards (Luhn-checked), bank identifiers and UPI IDs.
- A local Placeholder Vault. Sensitive values never enter the backend payload.
- Task-based relevance filtering, payload-size budgeting, and a fail-closed verification gate.
- FastAPI backend with strict Pydantic schemas, a PII tripwire, mock planner and optional
  OpenAI-compatible planner.
- Local action validation for clicks, typing, selects, scrolling, same-origin navigation, waits and
  verification. No JavaScript is accepted from the planner.
- One-time, default-deny approval for sensitive field entry. Password, OTP, card and banking values
  are never auto-filled.
- Checkout, payment and order-placement actions are blocked in both the planner and the executor.
- Cross-stack test suite and a synthetic PII evaluation.

## Repository layout

```
privacy-agent/
├─ extension/             # Manifest V3 source, tests, build output
│  ├─ src/privacy/        # detectors, vault, sanitization, relevance, gate
│  ├─ src/content/        # DOM extractor, executor, content message bridge
│  ├─ src/background/     # agent loop, backend client, settings, approvals
│  ├─ src/ui/             # side panel HTML/CSS/TypeScript
│  ├─ tests/              # Bun tests, fixtures, synthetic PII dataset
│  └─ dist/               # built unpacked extension (after `bun run build`)
├─ backend/               # FastAPI app, schemas, tripwire, planners, pytest suite
├─ docs/                  # architecture, setup, demonstration, evaluation, limitations
├─ demo/                  # optional prompt-injection fixture page
├─ deliverables/          # generated downloadable ZIPs
└─ scripts/               # icon generation, packaging, extension validation
```

## Quick start

### 1. Backend (mock mode)

```bash
cd privacy-agent/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verify `http://127.0.0.1:8000/health` returns `"mode": "mock"`.

### 2. Build and load the extension

```bash
cd privacy-agent/extension
bun install
bun run build
```

In Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `privacy-agent/extension/dist`.
4. Pin **CartNest Privacy Agent**.

### 3. Open CartNest and approve its origin

- CartNest locally: `http://localhost:5173` is approved by default.
- CartNest in a preview or another host: open the side panel, expand **Connection and approved
  origins**, enter the exact origin (for example `https://your-preview.example`), choose **Add
  origin**, and grant Chrome access. Reload the page once so the content script attaches.
- The backend endpoint defaults to `http://localhost:8000`. If you change it, save it in the same
  settings section and grant access to that backend host.

### 4. Run the demonstration task

Keep the side panel open, open CartNest, and enter:

> Find the best-rated wireless headphones under ₹3,000 and add them to my cart.

The agent searches, applies the price ceiling, selects the best-rated matching product (Pulse Buds
Mini in the seeded catalogue), adds it to the cart, opens `/cart`, verifies the product, and stops.
It never clicks checkout, Buy now, or Place order.

See `docs/demonstration.md` for the full script and the other scenarios.

## Optional real LLM

The default planner is deterministic and free. To use an OpenAI-compatible model, set these on the
**backend** process, never in extension files:

```bash
export LLM_MODE=openai
export LLM_API_KEY="..."
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
.venv/bin/uvicorn app.main:app --port 8000
```

The backend still applies the tripwire and strict response schema. The extension still validates
every action and origin locally. Use a provider whose data-retention terms you accept; the backend
never logs prompt bodies.

## Permissions

Required host access is limited to CartNest on localhost and the local backend. Other origins are
granted at runtime through Chrome's permission prompt when you explicitly add them. No `<all_urls>`
permission is requested at install time. `activeTab`, `storage`, `sidePanel` and `scripting` are
used for the panel, local settings and content-script attachment.

## Tests

```bash
cd privacy-agent/extension && bun run typecheck && bun test && bun run eval
cd privacy-agent/backend && .venv/bin/python -m pytest -q
```

Current results and methodology are in `docs/evaluation.md`. The browser-level Chrome run is **not**
verified in this workspace because no Chrome/Chromium binary is available; the extension was built
and statically validated, and DOM behavior is tested with jsdom fixtures modeled on the real
CartNest components. Load it in Chrome and follow `docs/demonstration.md` for the final visual check.

## Downloadable builds

Run `bash privacy-agent/scripts/package.sh` to regenerate:

- `deliverables/privacy-agent-extension.zip` — load-unpacked extension (manifest at ZIP root).
- `deliverables/privacy-agent-backend.zip` — backend source, requirements and tests.
- `deliverables/privacy-agent-source.zip` — full source, docs and tests (no dependencies or
  virtualenv).

No `.env` files, API keys, `node_modules`, `.venv` or generated caches are included.

## Limitations

This is a privacy-minimization demonstration, not a claim of perfect anonymity. Detection is
heuristic, bare names and free-form addresses can be missed, and no DLP system can guarantee zero
leakage. The backend is a local development service without authentication. Read
`docs/security-limitations.md` before using it with anything other than synthetic data.
