import { detectPII } from "../src/privacy/detectors";
import type { PIIType } from "../src/shared/schema";
import { PII_DATASET } from "./fixtures/pii-dataset";

interface Metrics {
  tp: number;
  fp: number;
  fn: number;
}

const types: PIIType[] = [
  "PERSON",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "PIN",
  "GOVT_ID",
  "CARD",
  "BANK",
  "UPI",
];

const metrics = new Map<PIIType, Metrics>(types.map((type) => [type, { tp: 0, fp: 0, fn: 0 }]));
let fixtureFailures = 0;

for (const fixture of PII_DATASET) {
  const found = detectPII(fixture.text, fixture.context ?? "");
  const unmatched = [...found];
  for (const expected of fixture.expected) {
    const index = unmatched.findIndex(
      (item) => item.type === expected.type && (item.value.includes(expected.value) || expected.value.includes(item.value)),
    );
    if (index >= 0) {
      metrics.get(expected.type)!.tp += 1;
      unmatched.splice(index, 1);
    } else {
      metrics.get(expected.type)!.fn += 1;
      fixtureFailures += 1;
    }
  }
  for (const extra of unmatched) {
    metrics.get(extra.type)!.fp += 1;
    fixtureFailures += 1;
  }
}

const totals = [...metrics.values()].reduce(
  (acc, item) => ({ tp: acc.tp + item.tp, fp: acc.fp + item.fp, fn: acc.fn + item.fn }),
  { tp: 0, fp: 0, fn: 0 },
);

const precision = totals.tp / Math.max(1, totals.tp + totals.fp);
const recall = totals.tp / Math.max(1, totals.tp + totals.fn);

console.log("# Synthetic PII detection evaluation\n");
console.log(`Fixtures: ${PII_DATASET.length}`);
console.log(`Expected entities: ${totals.tp + totals.fn}`);
console.log(`True positives: ${totals.tp}`);
console.log(`False positives: ${totals.fp}`);
console.log(`False negatives: ${totals.fn}`);
console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
console.log(`Fixtures with any mismatch: ${fixtureFailures}\n`);
console.log("| Category | TP | FP | FN | Precision | Recall |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const type of types) {
  const item = metrics.get(type)!;
  const p = item.tp / Math.max(1, item.tp + item.fp);
  const r = item.tp / Math.max(1, item.tp + item.fn);
  if (item.tp + item.fp + item.fn === 0) continue;
  console.log(
    `| ${type} | ${item.tp} | ${item.fp} | ${item.fn} | ${(p * 100).toFixed(1)}% | ${(r * 100).toFixed(1)}% |`,
  );
}

if (fixtureFailures > 0) process.exitCode = 1;
