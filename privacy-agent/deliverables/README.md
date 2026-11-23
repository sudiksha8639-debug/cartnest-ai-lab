# Deliverables

Regenerate with `bash privacy-agent/scripts/package.sh`.

| File | Purpose |
| --- | --- |
| `privacy-agent-extension.zip` | Load-unpacked Manifest V3 extension. `manifest.json` is at the ZIP root. |
| `privacy-agent-backend.zip` | FastAPI source, tests, requirements and `env.example`. |
| `privacy-agent-source.zip` | Complete extension/backend/docs/demo/test source without dependencies. |

The ZIPs contain no virtualenv, `node_modules`, generated caches or API keys. The backend runs in
mock mode without a key; see `docs/setup.md` for the optional real-LLM configuration.
