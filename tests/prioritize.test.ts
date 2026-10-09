import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/core/types";
import { annotateDeadlineConflicts, prioritizeFindings } from "../src/core/prioritize";
import type { ModelFinding } from "../src/core/validation";

const messages: ChatMessage[] = [
  { id: "message-00001", sender: "Alex", timestamp: null, text: "Please send the deck by Friday.", line: 1 },
  { id: "message-00002", sender: "Sam", timestamp: null, text: "Send the deck by Monday instead.", line: 2 },
];

const task = (deadline: string, evidenceId: string, quote: string): ModelFinding => ({
  category: "task",
  summary: "Send the deck",
  owner: null,
  deadline,
  evidenceIds: [evidenceId],
  evidenceQuotes: [quote],
  uncertainty: null,
  conflictGroup: null,
});

describe("finding prioritization", () => {
  it("ranks and explains time-sensitive owned tasks deterministically", () => {
    const tasks = [
      { ...task("Friday", "message-00001", "send the deck by Friday"), owner: "Alex" },
      { ...task("Monday", "message-00002", "Send the deck by Monday"), category: "update" as const },
    ];
    const first = prioritizeFindings(tasks, messages);
    expect(first[0].priority).toBeGreaterThan(first[1].priority);
    expect(first[0].priorityReasons).toContain("explicit owner identified");
    expect(prioritizeFindings(tasks, messages)).toEqual(first);
  });

  it("flags conflicting deadlines for the same task without choosing one", () => {
    const findings = prioritizeFindings([
      task("Friday", "message-00001", "send the deck by Friday"),
      task("Monday", "message-00002", "Send the deck by Monday"),
    ], messages);
    const annotated = annotateDeadlineConflicts(findings);
    expect(annotated[0].deadline).not.toBe(annotated[1].deadline);
    expect(annotated[0].conflictGroup).toBe(annotated[1].conflictGroup);
    expect(annotated.every((finding) => finding.uncertainty?.includes("Conflicting deadlines"))).toBe(true);
  });
});
