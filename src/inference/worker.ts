import { extractRuleBasedFindings } from "../extraction/ruleBased";
import type { WorkerRequest, WorkerResponse } from "./protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void analyze(event.data);
};

async function analyze(request: WorkerRequest): Promise<void> {
  try {
    self.postMessage({ type: "progress", message: "Checking explicit tasks, dates, mentions, decisions, and questions on this device…" } satisfies WorkerResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const findings = extractRuleBasedFindings(request.messages);
    self.postMessage({ type: "complete", findings } satisfies WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local analysis failed unexpectedly.";
    self.postMessage({ type: "error", message } satisfies WorkerResponse);
  }
}
