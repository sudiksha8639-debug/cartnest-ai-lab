# Setup

## Prerequisites

- Python 3.10 or newer
- Bun 1.1+ (or Node 20+ for the build script) and Chrome/Chromium 114+
- CartNest running locally or in a preview tab

No API key is required for the default mock mode.

## Backend

```bash
cd privacy-agent/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok","mode":"mock","llmConfigured":false,"tripwire":"enabled"}
```

Run tests:

```bash
.venv/bin/python -m pytest -q
```

## Extension

```bash
cd privacy-agent/extension
bun install
bun run build
```

The build outputs `extension/dist/` with `manifest.json`, bundled scripts, the side panel and icons.

Load it:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `extension/dist` directory.
4. Pin the extension. Clicking the toolbar icon opens the side panel (Chrome 114+).

After changing source, run `bun run build`, then click the reload button on the extension card.

## CartNest origin

The extension is pre-approved for:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

If you test CartNest in a preview or another host:

1. Copy the **origin only** from the address bar, for example `https://cartnest-preview.example`.
2. Open the side panel → **Connection and approved origins**.
3. Paste the origin and choose **Add origin**.
4. Approve Chrome's site-access prompt.
5. Reload the CartNest tab once so the content script attaches.
6. Reopen the side panel and check that the page shows **Approved**.

The panel never requests `<all_urls>` at install. Additional hosts are optional permissions granted
explicitly by you. Removing an origin also unregisters its content script and removes the Chrome
permission.

## Backend endpoint

Default: `http://localhost:8000`. The extension has host permission for localhost on port 8000.

To use another private endpoint:

1. Open **Connection and approved origins**.
2. Enter the full HTTP/HTTPS endpoint (a path prefix is allowed).
3. Choose **Save endpoint** and grant Chrome access to that host.
4. Start the backend at that address.

If the extension reports "Could not reach the backend", check the backend is running, the URL is
correct, and the host access was granted. The service worker cannot read a local file or a backend
without host permission.

## Optional LLM

Set environment variables on the backend process:

```bash
export LLM_MODE=openai
export LLM_API_KEY="your-key"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
.venv/bin/uvicorn app.main:app --port 8000
```

Do not put the key in the extension, the side panel, `manifest.json` or any committed file. The
backend sends only the sanitized, minimized page context. Use a provider whose retention/training
terms are acceptable for your demonstration data. With no key, the backend stays in mock mode even
if `LLM_MODE=openai` is set; `/health` reports the effective mode.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Side panel shows "No active page" | Use a normal http/https tab; add the origin if it is not CartNest localhost. |
| "Not approved" | Add the exact origin and grant Chrome access; reload the tab. |
| Backend not reached | Run `/health`; verify endpoint and host permission. |
| Agent stops after typing | Search submit may be the mobile "Go" button; the mock planner falls back to a same-origin `/shop?q=...` navigation. |
| Approval never appears | Keep the side panel open. If it is closed, approval times out and the action is denied. |
| Product not found | The mock planner uses CartNest's literal search. "wireless" is derived from the headphones task; for other products use a term that appears in the catalogue. |
| Cart verification fails | CartNest must show the product on `/cart`; the agent does not use a hidden server API. |

## Packaging

```bash
bash privacy-agent/scripts/package.sh
```

This creates the three ZIPs under `privacy-agent/deliverables/`. No dotenv files, virtualenvs,
`node_modules` or API keys are included.
