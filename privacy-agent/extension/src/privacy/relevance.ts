import type { PageContext, PageElement, TextBlock } from "../shared/schema";
import { MAX_ELEMENTS, MAX_PAYLOAD_BYTES, MAX_TEXT_BLOCKS } from "../shared/schema";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "find",
  "best",
  "rated",
  "under",
  "over",
  "add",
  "cart",
  "my",
  "me",
  "please",
  "best-rated",
  "highest",
  "top",
  "want",
  "would",
  "like",
  "products",
  "product",
  "item",
  "items",
  "buy",
  "shop",
  "show",
  "looking",
  "about",
  "price",
  "rupees",
  "₹",
]);

const SHOPPING_INTENT = /\b(add|cart|buy|shop|find|search|product|price|rated|rating|under|headphones?|earbuds?|wireless)\b/i;
const ACCOUNT_INTENT = /\b(account|profile|address|email|phone|name|settings|checkout|delivery|payment)\b/i;
const SENSITIVE_BUSINESS = /\b(sign in|create account|wishlist|newsletter|support|orders|privacy|terms|about|staff)\b/i;

export interface RelevanceOptions {
  maxElements?: number;
  maxBlocks?: number;
  maxBytes?: number;
}

export interface RelevanceResult {
  page: PageContext;
  excluded: number;
}

function taskTokens(task: string): string[] {
  return Array.from(
    new Set(
      (task.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(
        (token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token),
      ),
    ),
  ).slice(0, 14);
}

function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token)) score += 2;
  }
  if (/₹|rating|rated|in stock|out of stock|add to cart|results?/i.test(text)) score += 2;
  return score;
}

export function relevanceFilter(
  page: PageContext,
  task: string,
  options: RelevanceOptions = {},
): RelevanceResult {
  const maxElements = options.maxElements ?? MAX_ELEMENTS;
  const maxBlocks = options.maxBlocks ?? MAX_TEXT_BLOCKS;
  const maxBytes = options.maxBytes ?? MAX_PAYLOAD_BYTES;
  const tokens = taskTokens(task);
  const shopping = SHOPPING_INTENT.test(task);
  const account = ACCOUNT_INTENT.test(task);

  const scored = page.elements.map((element) => {
    let score = 0;
    const haystack = `${element.name} ${element.text} ${element.context ?? ""}`;
    score += scoreText(haystack, tokens);

    if (/\b(search|filter|price|rating|sort|results?|cart|add to cart|in stock|available)\b/i.test(element.name)) {
      score += 4;
    }
    if (/\badd to cart\b/i.test(element.name) || element.product) score += 3;
    if (element.context && /₹/.test(element.context)) score += 2;
    if (element.path?.startsWith("/product/")) score += 2;
    if (element.sensitive && !account) score -= 8;

    if (!account && /\b(sign in|create account|wishlist|newsletter|support|my orders|staff workspace)\b/i.test(element.name)) {
      score -= 6;
    }
    if (!account && SENSITIVE_BUSINESS.test(element.name) && score < 3) score -= 2;
    if (!shopping && !account) score += 1;
    if (element.role === "button" || element.role === "textbox" || element.role === "searchbox") score += 1;
    return { element, score };
  });

  const keptElements = scored
    .filter(({ score }) => score > 2 || (shopping && score >= 0 && scored.filter((item) => item.score > 2).length === 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxElements)
    .map(({ element }) => element)
    // Restore a stable document order so refs are easier to reason about.
    .sort((a, b) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)));

  const blocks: { block: TextBlock; score: number }[] = page.textBlocks.map((block) => {
    let score = scoreText(block.text, tokens);
    if (block.heading) score += 1;
    if (/₹/.test(block.text)) score += 2;
    if (/\b(results?|found|sort|filter|price|rating)\b/i.test(block.text)) score += 2;
    if (block.text.length > 380) score -= 1;
    return { block, score };
  });

  const keptBlocks = blocks
    .filter(({ score }) => score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBlocks)
    .map(({ block }) => block)
    .sort((a, b) => page.textBlocks.indexOf(a) - page.textBlocks.indexOf(b));

  const excluded = page.elements.length - keptElements.length + (page.textBlocks.length - keptBlocks.length);

  let result: PageContext = { ...page, elements: keptElements, textBlocks: keptBlocks };
  const encoder = new TextEncoder();
  let serialized = JSON.stringify(result);
  while (encoder.encode(serialized).length > maxBytes) {
    if (result.textBlocks.length > 0) {
      result = { ...result, textBlocks: result.textBlocks.slice(0, -1) };
    } else if (result.elements.length > 1) {
      result = { ...result, elements: result.elements.slice(0, -1) };
    } else {
      throw new Error("Relevant page context exceeds the payload budget");
    }
    serialized = JSON.stringify(result);
  }

  return { page: result, excluded };
}

export function payloadBytes(page: PageContext): number {
  return new TextEncoder().encode(JSON.stringify(page)).length;
}

export function pageContainsText(page: PageContext, text: string): boolean {
  const needle = text.toLowerCase();
  return (
    page.title.toLowerCase().includes(needle) ||
    page.elements.some((element) => `${element.name} ${element.text} ${element.context ?? ""}`.toLowerCase().includes(needle)) ||
    page.textBlocks.some((block) => block.text.toLowerCase().includes(needle))
  );
}
