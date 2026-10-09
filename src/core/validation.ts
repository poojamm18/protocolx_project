import type { ChatMessage, Finding, FindingCategory } from "./types";
import { findingCategories } from "./types";

export const MAX_INPUT_CHARS = 1_000_000;
const categories = new Set<string>(findingCategories);
const modelFindingFields = [
  "category",
  "summary",
  "owner",
  "deadline",
  "evidenceIds",
  "evidenceQuotes",
  "uncertainty",
  "conflictGroup",
];

export type ModelFinding = Omit<Finding, "id" | "priority" | "priorityReasons">;

export function parseModelOutput(raw: string, messages: ChatMessage[]): ModelFinding[] {
  const sourceMap = new Map(messages.map((message) => [message.id, message]));
  const decoded = parseJsonArray(raw);

  const validated: ModelFinding[] = [];
  for (const [index, item] of decoded.entries()) {
    if (!isRecord(item)) throw new Error(`Finding ${index + 1} is not an object.`);
    if (Object.keys(item).length !== modelFindingFields.length || modelFindingFields.some((field) => !(field in item))) {
      throw new Error(`Finding ${index + 1} does not match the required output schema.`);
    }
    const category = item.category;
    if (!isFindingCategory(category)) {
      throw new Error(`Finding ${index + 1} has an unsupported category.`);
    }
    const summary = boundedString(item.summary, 500, "summary");
    const evidenceIds = stringArray(item.evidenceIds, 10, "evidenceIds");
    const quotes = stringArray(item.evidenceQuotes, 10, "evidenceQuotes");
    if (evidenceIds.length === 0 || evidenceIds.length !== quotes.length) {
      throw new Error(`Finding ${index + 1} must have matching source IDs and evidence quotes.`);
    }
    const citedMessages: ChatMessage[] = [];
    for (let evidenceIndex = 0; evidenceIndex < evidenceIds.length; evidenceIndex += 1) {
      const message = sourceMap.get(evidenceIds[evidenceIndex]);
      if (!message) throw new Error(`Finding ${index + 1} cites an unknown source message.`);
      if (!quotes[evidenceIndex] || !message.text.includes(quotes[evidenceIndex])) {
        throw new Error(`Finding ${index + 1} contains evidence not present in its cited message.`);
      }
      citedMessages.push(message);
    }
    const owner = nullableString(item.owner, 120, "owner");
    const deadline = nullableString(item.deadline, 120, "deadline");
    const uncertainty = nullableString(item.uncertainty, 300, "uncertainty");
    const conflictGroup = nullableString(item.conflictGroup, 120, "conflictGroup");
    if (!summaryIsSupported(summary, quotes)) {
      throw new Error(`Finding ${index + 1} summary is not supported by its evidence.`);
    }
    if (owner && !citedMessages.some((message) => message.sender === owner || message.text.includes(owner))) {
      throw new Error(`Finding ${index + 1} has an owner not stated by its cited messages.`);
    }

    function summaryIsSupported(summary: string, quotes: string[]): boolean {
      const evidenceWords = new Set(
        quotes.flatMap((quote) => quote.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []),
      );
      const summaryWords = summary.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      const contentWords = summaryWords.filter((word) => word.length > 2 && !["the", "and", "for", "you", "your", "with", "from", "that", "this"].includes(word));
      return contentWords.length > 0 && contentWords.every((word) => evidenceWords.has(word));
    }
    if (deadline && !citedMessages.some((message) => message.text.includes(deadline))) {
      throw new Error(`Finding ${index + 1} has a deadline not stated by its cited messages.`);
    }
    validated.push({
      category,
      summary,
      owner,
      deadline,
      evidenceIds,
      evidenceQuotes: quotes,
      uncertainty,
      conflictGroup,
    });
  }
  return validated;
}

function parseJsonArray(raw: string): unknown[] {
  const candidates = [raw.trim()];
  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] === "[") {
      const candidate = findArray(raw, start);
      if (candidate) candidates.push(candidate);
    }
  }
  for (const candidate of candidates) {
    try {
      const decoded: unknown = JSON.parse(candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      if (Array.isArray(decoded)) return decoded;
    } catch {
      continue;
    }
  }
  throw new Error(`The local model did not return a JSON array. Response began: ${JSON.stringify(raw.trim().slice(0, 160))}`);
}

function findArray(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFindingCategory(value: unknown): value is FindingCategory {
  return typeof value === "string" && categories.has(value);
}

function boundedString(value: unknown, max: number, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new Error(`Finding ${name} must be a non-empty string of at most ${max} characters.`);
  }
  return value.trim();
}

function nullableString(value: unknown, max: number, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) {
    throw new Error(`Finding ${name} must be null or a string of at most ${max} characters.`);
  }
  return value.trim() || null;
}

function stringArray(value: unknown, maxItems: number, name: string): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string")) {
    throw new Error(`Finding ${name} must be an array of at most ${maxItems} strings.`);
  }
  return value as string[];
}

export function validateConversationText(text: string): void {
  if (!text.trim()) throw new Error("Paste or import a conversation before continuing.");
  if (text.length > MAX_INPUT_CHARS) {
    throw new Error(`Conversation is too large. The limit is ${MAX_INPUT_CHARS.toLocaleString()} characters.`);
  }
}
