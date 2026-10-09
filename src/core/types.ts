export type ChatMessage = {
  id: string;
  sender: string | null;
  timestamp: string | null;
  text: string;
  line: number;
};

export const findingCategories = [
  "task",
  "decision",
  "update",
  "mention",
  "schedule_change",
  "question",
] as const;

export type FindingCategory = (typeof findingCategories)[number];

export type Finding = {
  id: string;
  category: FindingCategory;
  summary: string;
  owner: string | null;
  deadline: string | null;
  evidenceIds: string[];
  evidenceQuotes: string[];
  uncertainty: string | null;
  conflictGroup: string | null;
  priority: number;
  priorityReasons: string[];
};
