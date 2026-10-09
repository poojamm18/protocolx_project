import type { ChatMessage, Finding } from "../core/types";

export type WorkerRequest = { messages: ChatMessage[] };

export type WorkerResponse =
  | { type: "progress"; message: string }
  | { type: "complete"; findings: Finding[] }
  | { type: "error"; message: string };
