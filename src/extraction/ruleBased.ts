import type { ChatMessage, Finding } from "../core/types";
import { annotateDeadlineConflicts, prioritizeFindings } from "../core/prioritize";

type DraftFinding = Omit<Finding, "id" | "priority" | "priorityReasons">;

const ACTION_VERBS =
  /^(?:send|update|prepare|review|call|book|share|finish|complete|check|create|write|document|submit|upload|schedule|confirm|fix|follow up|pay|ask|publish|add|remove|test|draft|contact|read|bring|pick up|deliver|discuss|collect|organize|file|sign|approve|investigate|deploy|build|reply|respond|choose|decide|coordinate|review)\b/iu;
const DEADLINE =
  /\b(?:(before)\s+|(?:by|due(?:\s+(?:on|by))?|no later than|until)\s+)((?:\d{1,2}(?::\d{2})?\s?(?:AM|PM)|noon|midnight|today|tonight|tomorrow|(?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2}))\b/iu;
const MENTION = /@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu;
const SCHEDULE_CHANGE = /\b(?:reschedul(?:e|ed|ing)|mov(?:e|ed|ing)\s+(?:the\s+)?(?:[\p{L}'’-]+\s+){0,2}(?:meeting|call|review|deadline|date)|(?:meeting|call|review|deadline|date)\s+(?:is|was|has been)\s+moved|postpon(?:e|ed|ing)|delay(?:ed|ing)?|push(?:ed|ing)?\s+back|bring(?:ing)?\s+forward|shift(?:ed|ing)?|cancel(?:led|ed|ling)|change(?:d|ing)?\s+(?:the\s+)?(?:meeting|call|review|deadline|date))\b/iu;
const DECISION = /\b(?:we decided|agreed(?:\s+to)?|we agree|i agree|let['’]s|approved|confirmed|final decision)\b|\bdecision\s*:/iu;
const UPDATE = /\b(?:fyi\b|update:|status:|heads up|just letting you know|for your information)\b|\b(?:is|are|was|were|has been|have been)\s+(?:working|fixed|resolved|completed|finished|ready|live|available|restored|deployed|sent|submitted|uploaded|done)\b|\b(?:now works|working now|works now|is now working)\b/iu;
const CONFIRMATION_QUESTION = /\b(?:confirm|confirmation|verify|whether|check if)\b/iu;
const URGENCY_PREFIX = /^(?:(?:important|urgent|asap)\s*[:—-]\s*)+/iu;
const URGENCY_SUFFIX = /\s+(?:asap|urgently|immediately)\s*$/iu;

export function extractRuleBasedFindings(messages: ChatMessage[]): Finding[] {
  const drafts: DraftFinding[] = [];
  const mentions = new Map<string, DraftFinding>();

  for (const message of messages) {
    const text = message.text.trim();
    if (!text) continue;
    const source = (quote: string) => ({
      evidenceIds: [message.id],
      evidenceQuotes: [quote],
      owner: null,
      deadline: null,
      uncertainty: null,
      conflictGroup: null,
    } satisfies Omit<DraftFinding, "category" | "summary">);

    const seenMentions = new Set<string>();
    for (const match of text.matchAll(MENTION)) {
      const handle = match[1].replace(/[.-]+$/u, "");
      if (!handle) continue;
      const key = handle.toLocaleLowerCase();
      if (seenMentions.has(key)) continue;
      seenMentions.add(key);
      const existing = mentions.get(key);
      if (existing) {
        existing.evidenceIds.push(message.id);
        existing.evidenceQuotes.push(message.text);
        continue;
      }
      const mention: DraftFinding = {
        ...source(message.text),
        category: "mention",
        summary: `Direct mention of @${handle}`,
      };
      mentions.set(key, mention);
    }

    for (const statement of splitStatements(text)) {
      const deadline = findDeadline(statement);
      const evidence = source(statement);
      const task = extractTask(statement, message.sender);
      if (task) {
        drafts.push({
          ...evidence,
          category: "task",
          summary: task.summary,
          owner: task.owner,
          deadline,
        });
      }

      if (SCHEDULE_CHANGE.test(statement)) {
        drafts.push({ ...evidence, category: "schedule_change", summary: firstSentence(statement), deadline });
      }
      if (!statement.includes("?") && DECISION.test(statement)) {
        drafts.push({ ...evidence, category: "decision", summary: firstSentence(statement) });
      }
      if (!statement.includes("?") && UPDATE.test(statement)) {
        drafts.push({ ...evidence, category: "update", summary: firstSentence(statement) });
      }
      if (statement.includes("?") && (!task || CONFIRMATION_QUESTION.test(statement))) {
        drafts.push({ ...evidence, category: "question", summary: firstSentence(statement) });
      }
    }
  }

  drafts.push(...mentions.values());
  const findings = prioritizeFindings(deduplicate(drafts), messages);
  return annotateDeadlineConflicts(findings);
}

function extractTask(text: string, sender: string | null): { summary: string; owner: string | null } | null {
  const normalized = text.replace(URGENCY_PREFIX, "");
  if (normalized.includes("?") && CONFIRMATION_QUESTION.test(normalized)) return null;
  const explicitOwner = normalized.match(/^@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)[,:\s]+/u)?.[1] ?? null;
  const commitment = /^(?:@[\p{L}\p{N}_][\p{L}\p{N}_.-]*[,:\s]+)?(?:i['’]ll|i will)\s+/iu.test(normalized);
  const namedAssignment = normalized.match(/^([\p{Lu}][\p{L}\p{M}'’-]+)\s+will\s+/u)?.[1] ?? null;
  const command = normalized.replace(/^@[\p{L}\p{N}_][\p{L}\p{N}_.-]*[,:\s]+/u, "")
    .replace(/^[\p{Lu}][\p{L}\p{M}'’-]+\s+will\s+/u, "")
    .replace(/^(?:(?:important|urgent|asap)\s*[:—-]\s*)+/iu, "")
    .replace(/^(?:(?:i['’]ll|i will|we['’]ll|we will|can you|could you|please|need to|must|don['’]t forget to|do not forget to)\s+)/iu, "");
  const action = command.match(ACTION_VERBS);
  if (!action) return null;

  let taskText = command;
  const deadlineMatch = DEADLINE.exec(normalized);
  if (deadlineMatch) taskText = taskText.replace(DEADLINE, "").trim();
  else taskText = taskText.replace(/\b(?:today|tonight|tomorrow)\b/iu, "").trim();
  taskText = taskText.replace(/[.!?]+\s*$/u, "").replace(URGENCY_SUFFIX, "").trim();
  if (!taskText) return null;

  const summary = capitalize(taskText);
  return {
    summary,
    owner: commitment ? sender : explicitOwner ?? namedAssignment,
  };
}

function findDeadline(text: string): string | null {
  const qualified = DEADLINE.exec(text);
  if (qualified) return `${qualified[1] ? "before " : ""}${qualified[2]}`;
  return text.match(/\b(today|tonight|tomorrow)\b/iu)?.[1] ?? null;
}

function splitStatements(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/u).map((statement) => statement.trim()).filter(Boolean);
}

function firstSentence(text: string): string {
  const sentence = text.match(/^[\s\S]*?[.!?](?=\s|$)/u)?.[0] ?? text;
  return sentence.trim().slice(0, 500);
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function deduplicate(items: DraftFinding[]): DraftFinding[] {
  const unique = new Map<string, DraftFinding>();
  for (const item of items) {
    if (item.category === "mention") {
      const key = `${item.category}|${item.summary.toLocaleLowerCase()}`;
      const existing = unique.get(key);
      if (existing) {
        for (const [index, evidenceId] of item.evidenceIds.entries()) {
          if (existing.evidenceIds.includes(evidenceId)) continue;
          existing.evidenceIds.push(evidenceId);
          existing.evidenceQuotes.push(item.evidenceQuotes[index]);
        }
        continue;
      }
      unique.set(key, item);
      continue;
    }
    const key = `${item.category}|${item.summary.toLocaleLowerCase()}|${item.owner?.toLocaleLowerCase() ?? ""}|${item.deadline?.toLocaleLowerCase() ?? ""}|${item.evidenceIds[0]}`;
    unique.set(key, item);
  }
  return [...unique.values()];
}
