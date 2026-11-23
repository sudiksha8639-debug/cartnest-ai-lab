# Security and privacy limitations

This project demonstrates privacy-preserving browser automation. It does not provide a formal
guarantee that personal data can never leak. Treat it as a research/demo prototype.

## Detection is heuristic

- Regex and context detectors can miss names, addresses and identifiers that do not match expected
  shapes. A bare name such as "Ananya Deshpande" is only detected in a profile heading, a labelled
  field, or a `Name:` context. Free-form names in reviews or product text can pass through.
- Addresses without labels or a PIN are often missed. Non-Indian address formats, regional scripts
  and transliterated names are not comprehensively covered.
- False positives are possible: a price, rating, order number or phone-like product code can look
  like an identifier. The tests cover common negatives but not every catalogue.
- Cards are Luhn-checked; a test card or a mistyped card may not be classified. Aadhaar detection
  uses separators or explicit context.
- Detection is not OCR. Text rendered inside images, canvas, video or PDFs is not inspected.

The synthetic evaluation (22 fixtures, 19 expected entities, 100% precision/recall in this run) is
not evidence of real-world accuracy.

## Fail-closed is scoped

The gate fails closed when detection/sanitization throws, the payload exceeds the budget, the final
payload still contains high-confidence PII patterns, the backend tripwire rejects it, the plan schema
is invalid, a ref is missing, or an action is not allowed. It cannot fail closed for PII that the
detector never recognized in the first place.

## Vault and approvals

- Sensitive values are kept in the content script's memory for the document lifetime. On SPA route
  changes the detector clears the vault; full navigation reloads the content script.
- Approvals are one-time and default-deny. If the side panel closes or the user does not respond, the
  request times out and is denied.
- Password, OTP, card and bank values are counted as detections but deliberately **not stored** in
  the vault, so they can never be auto-filled. The extension also never reads password/OTP/card/bank
  input values during extraction.
- An approved value can still be read by the destination page after insertion. Approval means you
  chose to disclose it to that field; it is not a guarantee about how the site handles it.
- The masked preview is shown in the extension UI only; the backend never receives it.

## Page content is untrusted

- Prompt injection is mitigated by treating page text as data in the backend prompt and by ignoring
  page instructions in the mock planner. The extension validator independently restricts actions,
  refs and origins. A sufficiently capable external model could still be manipulated into proposing
  an allowed-looking but unhelpful action.
- A malicious approved page can change its DOM between scan and execution, hide controls, or show
  misleading labels. The executor checks refs, roles, visibility and origins and fails closed, but
  it cannot verify the page's intent.
- Content scripts run in an isolated world, but the page can still alter the DOM the agent acts on.

## Consequences and checkout

- Checkout, payment, purchase and order-placement actions are blocked by label/path patterns and by
  the mock planner. This is a safety policy, not a payment authorization system.
- Adding to the cart is intentionally allowed once the user starts a shopping task. It is reversible
  in the demo and does not spend money.
- Do not use this with real payment credentials. CartNest itself is a synthetic demo with no real
  gateway.

## Backend security

- The backend has no authentication, authorization, rate limiting or TLS by itself. Run it on
  localhost for the demo. If deployed privately, put authentication, TLS and rate limiting in front
  of it and restrict network access.
- Reverse proxies/load balancers may log request bodies by default. Disable body logging; the
  sanitized payload still contains page text and product context.
- The app logs only mode, action count and element count. It does not log payloads, page paths or keys.
- `LLM_API_KEY` is read from the backend environment only. The extension has no API key field or
  secret storage. Do not add one to extension code.
- When a real LLM is enabled, the sanitized context leaves your machine to that provider. Provider
  retention, training and jurisdiction policies apply. Choose accordingly.
- The backend's tripwire is defense-in-depth, not a second full DLP engine. It focuses on
  high-confidence patterns and can miss bare names/addresses that the local engine also missed.

## Origin and permission model

- Required host access is limited to CartNest on localhost and the local backend. Additional origins
  are optional permissions granted through Chrome's prompt when you add them.
- The extension cannot inspect an unapproved origin. If you approve a broad production origin, every
  page on that origin becomes inspectable. Approve only the exact CartNest testing origin.
- Removing an origin unregisters its dynamic content script and removes the Chrome permission, but
  already-open pages may need a reload.

## Operational limitations

- The side panel must stay open for approval. Closing it causes a deny-by-timeout.
- The agent has a 12-step limit and a 3-action-per-plan limit. Dynamic pages can exceed these.
- Only native `<select>` elements are supported by the `select` action; custom listbox widgets must
  be driven by clicking the trigger and then an option (if exposed as a ref).
- The mock planner is tailored to the CartNest demonstration task. It is not a general-purpose
  autonomous shopper. A real LLM is optional and must be evaluated separately.
- The extension does not maintain a backend-side run history. The privacy report is local to the
  current run; settings/origin approvals are stored in `chrome.storage.local`.
- Browser-level end-to-end execution in Chrome was not performed in this build environment (no
  Chrome binary); see `evaluation.md`. jsdom fixtures and component tests are not a substitute for a
  live browser check.

## Recommendation

Use synthetic CartNest data only. Keep the backend local or privately authenticated. Review the
outbound request in DevTools for every new task type. Extend the synthetic dataset and tests before
relying on the detector for a new data category, language or page layout.
