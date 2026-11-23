import type {
  PageContext,
  PageElement,
  PIIType,
  PrivacyReport,
  TextBlock,
} from "../shared/schema";
import { MAX_PAYLOAD_BYTES } from "../shared/schema";
import type { RawBlock, RawElement, RawPage } from "../content/extractor";
import { detectPII } from "./detectors";
import { relevanceFilter } from "./relevance";
import { mergeStats, sanitizeText, safeOneLine, type SanitizeStats } from "./sanitize";
import type { PlaceholderVault } from "./vault";

export interface PrivacyScan {
  ok: boolean;
  task: string;
  page?: PageContext;
  report: PrivacyReport;
  error?: string;
}

const PROFILE_PAGE = /\b(account|profile|customer dashboard|settings)\b/i;
const PERSON_HEADING = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;
const UI_HEADINGS =
  /^(my account|your account|customer dashboard|account overview|profile|saved addresses|my reviews|order history|settings|personal details|default address)$/i;

function emptyStats(): SanitizeStats {
  return { redactions: 0, categories: new Map() };
}

function addCategory(stats: SanitizeStats, type: PIIType, count = 1): void {
  stats.redactions += count;
  stats.categories.set(type, (stats.categories.get(type) ?? 0) + count);
}

function parseProduct(element: RawElement): PageElement["product"] | undefined {
  const nameMatch =
    element.name.match(/^Add (.+) to cart$/i) ?? element.name.match(/^View (.+)$/i);
  const source = `${element.name} ${element.context ?? ""}`;
  const priceMatch = source.match(/₹\s*([\d,]+)/);
  const ratingMatch =
    source.match(/Rated\s+([0-5](?:\.\d)?)\s+out of 5/i) ??
    source.match(/\b([0-5]\.\d)\s*\(\s*\d/i) ??
    source.match(/\b([0-5]\.\d)\b/);
  const price = priceMatch?.[1] ? Number(priceMatch[1].replace(/,/g, "")) : undefined;
  const rating = ratingMatch?.[1] ? Number(ratingMatch[1]) : undefined;
  // A rating-only control (for example a “4.5 & above” filter) is not a product.
  if (!nameMatch?.[1]) return undefined;
  return {
    name: safeOneLine(nameMatch[1], 140),
    price,
    rating,
    available: !/out of stock|sold out|unavailable/i.test(source),
  };
}

function sanitizeProduct(
  raw: RawElement,
  vault: PlaceholderVault,
  stats: SanitizeStats,
  contextHint: string,
): PageElement["product"] | undefined {
  const product = parseProduct(raw);
  if (!product) return undefined;
  const name = sanitizeText(product.name, vault, contextHint, 140);
  mergeStats(stats, name.stats);
  // If the product label itself contains personal data, do not send it as a
  // product identifier. The page can still be used for non-product actions.
  if (name.detections.length > 0) return undefined;
  return { ...product, name: name.text };
}

function sanitizeElement(
  raw: RawElement,
  vault: PlaceholderVault,
  stats: SanitizeStats,
  pageHint: string,
): PageElement {
  const contextHint = `${pageHint} ${raw.fieldLabel ?? ""} ${raw.name}`;
  const name = sanitizeText(raw.name, vault, contextHint, 220);
  mergeStats(stats, name.stats);
  const text = sanitizeText(raw.text, vault, contextHint, 420);
  mergeStats(stats, text.stats);
  const context = raw.context
    ? sanitizeText(raw.context, vault, contextHint, 280)
    : undefined;
  if (context) mergeStats(stats, context.stats);
  const placeholder = raw.placeholder
    ? sanitizeText(raw.placeholder, vault, contextHint, 140)
    : undefined;
  if (placeholder) mergeStats(stats, placeholder.stats);
  const path = raw.path ? sanitizeText(raw.path, vault, "url", 220) : undefined;
  if (path) mergeStats(stats, path.stats);
  const role = sanitizeText(raw.role, vault, contextHint, 30);
  mergeStats(stats, role.stats);
  const tag = sanitizeText(raw.tag, vault, contextHint, 20);
  mergeStats(stats, tag.stats);
  const fieldTypeName = raw.type
    ? sanitizeText(raw.type, vault, contextHint, 30)
    : undefined;
  if (fieldTypeName) mergeStats(stats, fieldTypeName.stats);
  const autocomplete = raw.autocomplete
    ? sanitizeText(raw.autocomplete, vault, contextHint, 80)
    : undefined;
  if (autocomplete) mergeStats(stats, autocomplete.stats);

  let sensitive: PIIType | undefined = raw.fieldType ?? undefined;
  let valueToken: string | undefined;
  let currentText: string | undefined;

  const rawValue = raw.value?.trim();
  if (raw.fieldType && rawValue) {
    valueToken = vault.add(raw.fieldType, rawValue, raw.fieldLabel ?? raw.name);
    addCategory(stats, raw.fieldType);
    sensitive = raw.fieldType;
  } else if (rawValue) {
    const sanitizedValue = sanitizeText(rawValue, vault, contextHint, 180);
    mergeStats(stats, sanitizedValue.stats);
    if (sanitizedValue.detections.length > 0) {
      sensitive = sanitizedValue.detections[0]?.type;
      const singleFull =
        sanitizedValue.detections.length === 1 &&
        /^\[[A-Z_]+_\d+\]$/.test(sanitizedValue.text);
      if (singleFull) {
        valueToken = sanitizedValue.text;
      } else {
        currentText = sanitizedValue.text;
      }
    } else {
      currentText = sanitizedValue.text;
    }
  }

  const options = raw.options?.map((option) => {
    const label = sanitizeText(option.label, vault, raw.name, 120);
    mergeStats(stats, label.stats);
    const value = sanitizeText(option.value, vault, raw.name, 80);
    mergeStats(stats, value.stats);
    return { value: value.text, label: label.text };
  });
  const product = sanitizeProduct(raw, vault, stats, contextHint);

  return {
    ref: raw.ref,
    tag: tag.text,
    role: role.text,
    name: name.text,
    text: text.text,
    ...(fieldTypeName ? { type: fieldTypeName.text } : {}),
    ...(placeholder ? { placeholder: placeholder.text } : {}),
    ...(autocomplete ? { autocomplete: autocomplete.text } : {}),
    ...(raw.disabled ? { disabled: true } : {}),
    ...(sensitive ? { sensitive } : {}),
    ...(valueToken ? { valueToken } : {}),
    ...(currentText ? { currentText } : {}),
    ...(path ? { path: path.text } : {}),
    ...(options ? { options } : {}),
    ...(context ? { context: context.text } : {}),
    ...(product ? { product } : {}),
  };
}

function sanitizeBlock(
  raw: RawBlock,
  vault: PlaceholderVault,
  stats: SanitizeStats,
  pageHint: string,
  profilePage: boolean,
): TextBlock {
  let text = raw.text;
  if (profilePage && raw.heading && PERSON_HEADING.test(text) && !UI_HEADINGS.test(text)) {
    const token = vault.add("PERSON", text);
    addCategory(stats, "PERSON");
    text = token;
  } else {
    const sanitized = sanitizeText(text, vault, `${pageHint} address`, 520);
    mergeStats(stats, sanitized.stats);
    text = sanitized.text;
  }
  return { tag: raw.tag, text, ...(raw.heading ? { heading: true } : {}) };
}

export function verifySanitizedPage(page: PageContext): { ok: boolean; reason?: string } {
  let serialized: string;
  try {
    serialized = JSON.stringify(page);
  } catch {
    return { ok: false, reason: "Sanitized payload could not be serialized" };
  }
  if (new TextEncoder().encode(serialized).length > MAX_PAYLOAD_BYTES) {
    return { ok: false, reason: "Sanitized payload exceeded the size budget" };
  }
  const residual = detectPII(serialized, "sanitized payload");
  if (residual.length > 0) {
    return { ok: false, reason: "Residual personal data remained after sanitization" };
  }
  return { ok: true };
}

export function buildPrivacyScan(raw: RawPage, task: string, vault: PlaceholderVault): PrivacyScan {
  const started = Date.now();
  const stats = emptyStats();
  const pageHint = `${raw.path} ${raw.title} ${raw.headings.join(" ")}`;
  try {
    const taskSanitized = sanitizeText(task, vault, "user task", 600);
    mergeStats(stats, taskSanitized.stats);

    const profilePage = PROFILE_PAGE.test(pageHint);
    const elements = raw.elements.map((element) =>
      sanitizeElement(element, vault, stats, pageHint),
    );
    const blocks = raw.blocks.map((block) =>
      sanitizeBlock(block, vault, stats, pageHint, profilePage),
    );

    const title = sanitizeText(raw.title, vault, "page title", 180);
    mergeStats(stats, title.stats);
    const headings = raw.headings.map((heading) => {
      if (profilePage && PERSON_HEADING.test(heading) && !UI_HEADINGS.test(heading)) {
        const token = vault.add("PERSON", heading);
        addCategory(stats, "PERSON");
        return token;
      }
      const sanitized = sanitizeText(heading, vault, pageHint, 180);
      mergeStats(stats, sanitized.stats);
      return sanitized.text;
    });

    const pagePath = sanitizeText(raw.path, vault, "page url", 220);
    mergeStats(stats, pagePath.stats);
    const draft: PageContext = {
      origin: raw.origin,
      path: pagePath.text,
      title: title.text,
      headings,
      elements,
      textBlocks: blocks,
    };

    const relevant = relevanceFilter(draft, taskSanitized.text);
    const verification = verifySanitizedPage(relevant.page);

    const categories = [...stats.categories.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type));

    const report: PrivacyReport = {
      elementsInspected: raw.elements.length,
      blocksConsidered: raw.elements.length + raw.blocks.length,
      blocksIncluded:
        relevant.page.elements.length + relevant.page.textBlocks.length,
      blocksExcluded: relevant.excluded,
      redactions: stats.redactions,
      categories,
      gatePassed: verification.ok,
      ...(verification.reason ? { gateReason: verification.reason } : {}),
      sanitizationMs: Date.now() - started,
      payloadBytes: new TextEncoder().encode(JSON.stringify(relevant.page)).length,
    };

    if (!verification.ok) {
      return {
        ok: false,
        task: taskSanitized.text,
        report,
        error: "Privacy gate blocked the request. Nothing was sent to the backend.",
      };
    }

    return { ok: true, task: taskSanitized.text, page: relevant.page, report };
  } catch {
    const safeElementCount = Array.isArray(raw?.elements) ? raw.elements.length : 0;
    const safeBlockCount = Array.isArray(raw?.blocks) ? raw.blocks.length : 0;
    const report: PrivacyReport = {
      elementsInspected: safeElementCount,
      blocksConsidered: safeElementCount + safeBlockCount,
      blocksIncluded: 0,
      blocksExcluded: safeElementCount + safeBlockCount,
      redactions: stats.redactions,
      categories: [...stats.categories.entries()].map(([type, count]) => ({ type, count })),
      gatePassed: false,
      gateReason: "Sanitization did not complete",
      sanitizationMs: Date.now() - started,
      payloadBytes: 0,
    };
    return {
      ok: false,
      task: "",
      report,
      error: "Privacy engine failed. The request was blocked before transmission.",
    };
  }
}
