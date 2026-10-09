import type { ChatMessage, Finding } from "./types";
import type { ModelFinding } from "./validation";

const EXPLICIT_URGENCY = /\b(urgent|asap|immediately|urgently)\b/i;
const EXPLICIT_IMPORTANCE = /\bimportant\b/i;
const EXPLICIT_ASSIGNMENT = /\b(?:assigned\s+to|owner\s*:|you(?:'re| are)\s+responsible|i['’]ll|i will)\b/i;
const PERSONAL_MENTION = /@\w+/;
const DEADLINE_CLUES = /\b(today|tonight|tomorrow|asap|due|deadline)\b/i;

export function prioritizeFindings(items: ModelFinding[], messages: ChatMessage[]): Finding[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const findings = items.map((item, index) => {
    const text = item.evidenceIds.map((id) => byId.get(id)?.text ?? "").join(" ");
    const reasons: string[] = [];
    let score = 0;

    if (item.category === "task") {
      score += 3;
      reasons.push("action item");
    }
    if (item.category === "decision" || item.category === "schedule_change") {
      score += 2;
      reasons.push(item.category === "decision" ? "decision" : "schedule change");
    }
    if (item.owner) {
      score += 2;
      reasons.push("explicit owner identified");
    }
    if (item.deadline) {
      score += 2;
      reasons.push("deadline stated");
    }
    if (EXPLICIT_URGENCY.test(text)) {
      score += 8;
      reasons.push("explicit urgency");
    }
    if (EXPLICIT_IMPORTANCE.test(text)) {
      score += 2;
      reasons.push("importance explicitly flagged");
    }
    if (DEADLINE_CLUES.test(text) || /\b(?:by|before)\s+(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|noon|midnight)\b/i.test(text)) {
      score += 2;
      reasons.push("time-sensitive language");
    }
    if (PERSONAL_MENTION.test(text) || item.category === "mention") {
      score += 2;
      reasons.push("direct mention");
    }
    if (EXPLICIT_ASSIGNMENT.test(text)) {
      score += 1;
      reasons.push("responsibility language");
    }
    if (item.uncertainty || item.conflictGroup) {
      reasons.push(item.conflictGroup ? "conflicting evidence; needs review" : "uncertainty needs review");
    }

    return { ...item, id: `finding-${String(index + 1).padStart(4, "0")}`, priority: score, priorityReasons: reasons };
  });
  return findings.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}

export function annotateDeadlineConflicts(findings: Finding[]): Finding[] {
  const taskSignatures = new Map<string, Finding[]>();
  for (const finding of findings) {
    if (finding.category !== "task" || !finding.deadline) continue;
    const signature = normalizeTask(finding.summary);
    const group = taskSignatures.get(signature) ?? [];
    group.push(finding);
    taskSignatures.set(signature, group);
  }
  for (const group of taskSignatures.values()) {
    const deadlines = new Set(group.map((finding) => finding.deadline));
    if (group.length < 2 || deadlines.size < 2) continue;
    const conflictGroup = `deadline-conflict-${group.map((item) => item.id).join("-")}`;
    for (const finding of group) {
      finding.conflictGroup = conflictGroup;
      finding.uncertainty = finding.uncertainty
        ? `${finding.uncertainty} Conflicting deadlines are stated for a similar task.`
        : "Conflicting deadlines are stated for a similar task; verify which is current.";
      finding.priorityReasons = [...finding.priorityReasons, "conflicting deadlines; needs review"];
    }
  }
  return findings;
}

function normalizeTask(summary: string): string {
  return summary.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}
