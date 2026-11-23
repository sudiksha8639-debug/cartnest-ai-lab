import type { PIIType } from "../shared/schema";

export interface Detection {
  type: PIIType;
  start: number;
  end: number;
  value: string;
  confidence: number;
  source: "regex" | "context" | "field";
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UPI_RE = /\b[A-Z0-9._-]{2,}@(?:okhdfcbank|oksbi|okaxis|okicici|paytm|ybl|upi|apl)\b/gi;
const PHONE_RE =
  /(?:\+91[\s-]?)?(?:0)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PIN_RE = /\b[1-9]\d{5}\b/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const PHONE_HINT = /\b(phone|mobile|contact number|whatsapp|tel)\b/i;
const PIN_HINT = /\b(pin|pin code|postal|zip)\b/i;
const ADDRESS_HINT =
  /\b(address|flat|house|street|road|lane|drive|marg|nagar|apartment|tower|wing|block|floor|sector|colony|layout|delivery address|shipping address)\b/i;
const NAME_LABEL_RE =
  /\b(?:full name|customer name|recipient name|name|contact person|account holder)\b\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;
const ADDRESS_LABEL_RE =
  /\b(?:address|delivery address|shipping address|home address)\b\s*[:\-]\s*([^\n|]{10,140})/gi;
const BANK_LABEL_RE =
  /\b(?:account number|a\/c no|bank account|account no)\b\s*[:\-]?\s*([0-9][0-9 -]{7,22})/gi;

export const PII_PATTERNS = {
  EMAIL_RE,
  PHONE_RE,
  CARD_RE,
  PIN_RE,
  AADHAAR_RE,
  PAN_RE,
};

function pushUnique(found: Detection[], detection: Detection): void {
  const overlap = found.some(
    (item) =>
      item.type === detection.type &&
      item.start < detection.end &&
      detection.start < item.end,
  );
  if (overlap) return;
  found.push(detection);
}

function collect(re: RegExp, text: string, type: PIIType, confidence: number, source: Detection["source"]): Detection[] {
  const results: Detection[] = [];
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const value = match[0];
    if (!value) continue;
    results.push({
      type,
      start: match.index,
      end: match.index + value.length,
      value,
      confidence,
      source,
    });
    if (re.lastIndex === match.index) re.lastIndex++;
  }
  return results;
}

function luhnValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function luhnCandidates(text: string): Detection[] {
  const results: Detection[] = [];
  CARD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARD_RE.exec(text)) !== null) {
    if (!match[0] || !luhnValid(match[0])) continue;
    results.push({
      type: "CARD",
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      confidence: 0.99,
      source: "regex",
    });
  }
  return results;
}

/**
 * Local detectors. They are deliberately conservative for names and addresses:
 * context (labels, autocomplete, field names) is required for those categories.
 */
export function detectPII(text: string, context = ""): Detection[] {
  if (!text) return [];
  const found: Detection[] = [];

  for (const detection of collect(EMAIL_RE, text, "EMAIL", 0.99, "regex")) {
    if (!UPI_RE.test(detection.value)) pushUnique(found, detection);
    UPI_RE.lastIndex = 0;
  }
  for (const detection of collect(UPI_RE, text, "UPI", 0.95, "regex")) pushUnique(found, detection);
  for (const detection of collect(CARD_RE, text, "CARD", 0.99, "regex")) {
    if (luhnValid(detection.value)) pushUnique(found, detection);
  }
  for (const detection of collect(PAN_RE, text, "GOVT_ID", 0.95, "regex")) pushUnique(found, detection);
  for (const detection of collect(PHONE_RE, text, "PHONE", 0.92, "regex")) {
    const digits = detection.value.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) pushUnique(found, detection);
  }

  const hints = `${context} ${text}`;
  const addressHint = ADDRESS_HINT.test(hints);
  if (PIN_HINT.test(hints) || addressHint) {
    for (const detection of collect(PIN_RE, text, "PIN", 0.88, "context")) pushUnique(found, detection);
  }
  if (/\b(aadhaar|aadhar|uidai|government id|govt id)\b/i.test(hints)) {
    for (const detection of collect(AADHAAR_RE, text, "GOVT_ID", 0.9, "context")) pushUnique(found, detection);
  }
  if (/\b(bank|account|ifsc|upi)\b/i.test(hints)) {
    for (const detection of collect(BANK_LABEL_RE, text, "BANK", 0.9, "context")) pushUnique(found, detection);
  }
  for (const match of text.matchAll(NAME_LABEL_RE)) {
    const value = match[1];
    if (!value || match.index === undefined) continue;
    const prefix = text.slice(Math.max(0, match.index - 24), match.index).toLowerCase();
    if (/\b(product|brand|item|file|category|model)\s+$/.test(prefix)) continue;
    const start = match.index + match[0].indexOf(value);
    pushUnique(found, {
      type: "PERSON",
      start,
      end: start + value.length,
      value,
      confidence: 0.85,
      source: "context",
    });
  }
  for (const match of text.matchAll(ADDRESS_LABEL_RE)) {
    const value = match[1]?.trim();
    if (!value || match.index === undefined) continue;
    const start = match.index + match[0].indexOf(value);
    pushUnique(found, {
      type: "ADDRESS",
      start,
      end: start + value.length,
      value,
      confidence: 0.8,
      source: "context",
    });
  }
  // A labelled street address without the word "address" (common in address cards).
  if (addressHint && PIN_RE.test(text)) {
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 12 && ADDRESS_HINT.test(line));
    for (const line of lines) {
      const start = text.indexOf(line);
      if (start < 0) continue;
      pushUnique(found, {
        type: "ADDRESS",
        start,
        end: start + line.length,
        value: line,
        confidence: 0.68,
        source: "context",
      });
    }
  }

  return found.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function classifyField(input: {
  type?: string | null;
  name?: string | null;
  id?: string | null;
  autocomplete?: string | null;
  label?: string | null;
  placeholder?: string | null;
}): PIIType | null {
  const meta = [input.name, input.id, input.autocomplete, input.label, input.placeholder, input.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (input.type === "password" || /\b(current-password|new-password|password)\b/.test(meta)) return "PASSWORD";
  if (/\b(one-time-code|otp|verification code)\b/.test(meta)) return "OTP";
  if (/\b(cc-number|cc-csc|cc-exp|card number|card number|credit card|debit card)\b/.test(meta)) return "CARD";
  if (/\b(email|e-mail)\b/.test(meta)) return "EMAIL";
  if (/\b(phone|mobile|telephone|tel|whatsapp)\b/.test(meta)) return "PHONE";
  if (/\b(postal|pin code|pincode|zip)\b/.test(meta)) return "PIN";
  if (/\b(address|street|house|flat|building|city|state|country)\b/.test(meta) && input.type !== "hidden") return "ADDRESS";
  if (/\b(full name|recipient name|customer name|name)\b/.test(meta) && input.type !== "hidden") return "PERSON";
  if (/\b(account number|a\/c|iban|ifsc|bank)\b/.test(meta)) return "BANK";
  return null;
}
