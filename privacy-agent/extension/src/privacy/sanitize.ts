import type { PIIType } from "../shared/schema";
import { detectPII, type Detection } from "./detectors";
import type { PlaceholderVault } from "./vault";

export interface SanitizeStats {
  redactions: number;
  categories: Map<PIIType, number>;
}

export interface SanitizedText {
  text: string;
  stats: SanitizeStats;
  detections: Detection[];
}

export function sanitizeText(
  raw: string,
  vault: PlaceholderVault,
  context = "",
  maxLength = 2000,
): SanitizedText {
  const text = raw.replace(/\s+/g, " ").trim();
  const stats: SanitizeStats = { redactions: 0, categories: new Map() };
  if (!text) return { text: "", stats, detections: [] };

  // Detect on the full string before truncation so a value is never cut in half
  // and mistaken for harmless fragments.
  const detections = detectPII(text, context);
  if (detections.length === 0) return { text, stats, detections: [] };

  let output = "";
  let cursor = 0;
  for (const detection of detections) {
    if (detection.start < cursor) continue;
    const token = vault.add(detection.type, detection.value);
    output += text.slice(cursor, detection.start);
    output += token;
    cursor = detection.end;
    stats.redactions += 1;
    stats.categories.set(detection.type, (stats.categories.get(detection.type) ?? 0) + 1);
  }
  output += text.slice(cursor);
  // Collapse whitespace introduced by removed tokens without touching price separators.
  return {
    text: output.replace(/[ \t]{2,}/g, " ").trim().slice(0, maxLength),
    stats,
    detections,
  };
}

export function mergeStats(target: SanitizeStats, source: SanitizeStats): void {
  target.redactions += source.redactions;
  for (const [type, count] of source.categories) {
    target.categories.set(type, (target.categories.get(type) ?? 0) + count);
  }
}

export function safeOneLine(value: string, max = 160): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
