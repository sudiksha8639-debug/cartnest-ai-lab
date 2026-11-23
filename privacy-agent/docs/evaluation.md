# Evaluation

## Synthetic PII dataset

`extension/tests/fixtures/pii-dataset.ts` contains 22 fabricated text fixtures with 19 expected
entities. Values are entirely synthetic. Matching is by category and value containment.

Command:

```bash
cd privacy-agent/extension && bun run eval
```

Observed result (this run):

| Metric | Result |
| --- | ---: |
| Fixtures | 22 |
| Expected entities | 19 |
| True positives | 19 |
| False positives | 0 |
| False negatives | 0 |
| Precision | 100.0% |
| Recall | 100.0% |

| Category | TP | FP | FN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| PERSON | 2 | 0 | 0 | 100.0% | 100.0% |
| EMAIL | 3 | 0 | 0 | 100.0% | 100.0% |
| PHONE | 4 | 0 | 0 | 100.0% | 100.0% |
| ADDRESS | 2 | 0 | 0 | 100.0% | 100.0% |
| PIN | 3 | 0 | 0 | 100.0% | 100.0% |
| GOVT_ID | 2 | 0 | 0 | 100.0% | 100.0% |
| CARD | 1 | 0 | 0 | 100.0% | 100.0% |
| BANK | 1 | 0 | 0 | 100.0% | 100.0% |
| UPI | 1 | 0 | 0 | 100.0% | 100.0% |

**Do not read 100% as a real-world privacy guarantee.** The dataset is small and purpose-built to
exercise the detector's intended patterns. The negative cases cover prices, ratings, order IDs, a
product name after "Product name:" and short quantities. Unseen names, non-English text, unusual
address formats and adversarial obfuscation can still fail. See `security-limitations.md`.

## Automated test results

Extension: **34 passed, 0 failed** across 5 files (`bun test`).

| File | Coverage |
| --- | --- |
| `tests/privacy.test.ts` | Detection dataset, redaction, vault, high-risk values, repeated values, task and account-page sanitization, residual-PII gate, relevance filtering, payload budget, malformed-input fail-closed, DOM field extraction. |
| `tests/validator.test.ts` | Ref/role validation, checkout and Buy-now blocking, cross-origin/protocol-relative/checkout navigation, PII in ordinary typing, sensitive-field raw-text blocking, matching placeholder approval, type mismatch, high-risk refusal, action-count limit. |
| `tests/executor.test.ts` | Live input events, add-to-cart click, cart verification pass/fail, denied and approved sensitive entry, raw-text sensitive-field blocking, checkout execution and cross-origin form blocking. |
| `tests/origin.test.ts` | Default origin allowlist, rejection of unapproved origins, HTTP(S)-only normalization. |
| `tests/e2e.test.ts` | Sanitized pages → actual FastAPI mock planner → Zod validation → local execution → `/cart` verification for the headphones task. |

Backend: **18 passed, 0 failed** (`pytest`).

| Area | Coverage |
| --- | --- |
| API | Health, CORS preflight for the extension origin, mock plan, body limit, invalid schema, extra `gatePassed` field rejected, generic tripwire response. |
| Tripwire | Raw email/phone rejection without echo, placeholders accepted, bank/card/PAN patterns, unsafe response handling. |
| Planner | Full search → price → product → add → cart → verify sequence, sensitive phone placeholder, one-time approval completion, account-page recovery to the catalogue, high-risk refusal, summary task, prompt-injection resistance. |

Build verification:

```bash
cd privacy-agent/extension
bun run typecheck      # exit 0
bun run build          # background 153.2 KB, content 179.2 KB, side panel 147.7 KB
bun run validate       # all static Manifest V3 checks passed
```

Backend startup was checked with `uvicorn app.main:app`; it reached "Application startup complete"
and served the documented `/health` shape in tests.

## What is not verified here

There is no Chrome/Chromium binary in this workspace. A Playwright Chromium download was attempted
and failed because the environment could not complete the browser download (the workspace filesystem
is nearly full). Therefore:

- The extension has **not** been loaded into a real Chrome profile in this environment.
- The CartNest end-to-end test uses jsdom fixtures modeled on the actual CartNest components
  (search form, price filter, product-card labels, add-to-cart button, `/cart` markup), not a live
  React page in Chrome.
- No live Network panel capture was taken.

Everything below the browser boundary is exercised. The remaining manual check is:

1. Load `extension/dist` via `chrome://extensions` → Load unpacked.
2. Open CartNest, approve the origin if needed.
3. Run the headphones task and observe the action history and `/cart`.
4. Confirm the DevTools request body contains placeholders/sanitized text only.

## Acceptance status

| Criterion | Status |
| --- | --- |
| 1. Extension builds | **Verified** |
| 2. Extension loads in Chrome | **Not verified here**; static MV3 validation passed; manual step above |
| 3. Backend starts | **Verified** |
| 4. Mock mode works | **Verified** |
| 5. Extension inspects CartNest | **Component-verified with CartNest-modeled DOM**; live Chrome not verified |
| 6. Local PII detection/redaction | **Verified** |
| 7. Only minimized sanitized data transmitted | **Verified at component/API boundary**; live network not captured |
| 8. Backend tripwire | **Verified** |
| 9. Structured actions validated | **Verified** |
| 10. Headphones scenario adds to cart | **Verified in cross-stack simulation and executor tests**; live Chrome not verified |
| 11. Cart update verified | **Verified in same simulation**; live Chrome not verified |
| 12. Sensitive disclosure needs approval | **Verified in executor tests**; manual UI check pending |
| 13. Checkout cannot execute | **Verified** in validator, executor, backend planner tests |
| 14. Security/evaluation documented | **This document and the limitations document** |

## Reproduce

```bash
cd privacy-agent/extension
bun install
bun run typecheck
bun test
bun run eval
bun run build
bun run validate

cd ../backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```
