import type { ChatMessage, Finding } from "../core/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export type InferenceTask = {
  promise: Promise<Finding[]>;
  cancel: () => void;
};

export function analyzeInWorker(messages: ChatMessage[], onProgress: (message: string) => void): InferenceTask {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  let settled = false;
  let rejectPromise: (reason: Error) => void;
  const promise = new Promise<Finding[]>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.type === "progress") {
        onProgress(response.message);
        return;
      }
      settled = true;
      worker.terminate();
      if (response.type === "complete") resolve(response.findings);
      else reject(new Error(response.message));
    };
    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || "The local inference worker stopped unexpectedly."));
    };
  });
  worker.postMessage({ messages } satisfies WorkerRequest);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      const error = new Error("Local analysis was cancelled.");
      error.name = "AbortError";
      rejectPromise(error);
    },
  };
}
