# The Unread Problem — What Did I Miss?

A responsive, private-by-design web app for reviewing WhatsApp `.txt` conversations. The current MVP uses deterministic, on-device rules—not AI inference—to surface explicit tasks, direct mentions, decisions, schedule changes, explicit update markers, and questions. Findings are linked to the original message and retain the exported sender and timestamp.

## Run locally

Requirements: Node.js 20+ and npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. No model download or cloud service is required.

## Input and results

Paste a WhatsApp plain-text export or import a `.txt` export. Supported message prefixes include common bracketed `[date, time]` and unbracketed `date, time - ` exports. Continuation lines belong to their preceding message. Unrecognized non-empty lines are rejected instead of guessed. Input is limited to 1,000,000 characters.

Message IDs are deterministic for the current input order. Sender and timestamp values are retained as exported; missing sender details stay unknown, and dates are not normalized or inferred. The rule extractor only emits categories when explicit patterns match. It does not understand paraphrases or conversation-wide implied context. Explicit matching patterns, assignment heuristics, and date expressions are documented in `src/extraction/ruleBased.ts`. Deadline disagreement detection only compares identical normalized task summaries with different explicit deadlines.

Review linked source evidence before acting. The rules can miss real findings and can still misclassify messages that happen to match a pattern. Priority scores are deterministic heuristics, not predictions of importance.

## Privacy

Conversation analysis runs in an in-page Web Worker and uses no remote AI inference, analytics, cloud database, embeddings, or conversation persistence. Conversation text and findings exist in page memory until discarded or the page is closed. The UI provides a discard action.

This implementation has no code path that sends conversation text or findings to a network service. That code-level property is not a claim that all browser network traffic or a particular deployment has been independently inspected. The previous dev-server observation saw 60 same-origin resource URLs, but did not inspect request bodies/methods and was made during a failed model inference. The present rule-based path does not load a model. Inspect the actual browser requests when validating a deployment.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

## Why the local model was removed from the default path

The pinned Qwen2.5-0.5B-Instruct int8 model occupied 512,096,557 bytes. A real run took 213,083 ms and failed JSON validation; the later worker run also failed output validation because its `summary` violated the required non-empty string, maximum-500-character constraint. The raw response was not retained, so it is unknown whether the summary was missing, blank, non-string, or too long. The model's tokenizer configuration includes a Qwen chat template, and the app passed system/user chat messages to the text-generation pipeline; generation explicitly requested `do_sample: false`. This evidence does not establish a template defect or justify another lengthy inference attempt.

The old model prompt/runtime and model-fetch scripts have been removed from the active project; no silent AI fallback remains. A fixed model-output fixture is used only to test the retired schema validator. It is not an inference test and does not claim that the model can extract findings.

## Limitations and next steps

- Rules only recognize supported explicit language patterns. Natural-language paraphrases, implicit ownership, nuanced decisions, and semantic summaries are not handled.
- Date extraction supports explicit forms such as weekdays, today/tomorrow, and common numeric or month-name dates only when introduced by supported deadline wording. Relative dates remain verbatim.
- The rules do not resolve cross-message context. Conflicts are flagged only when extracted task summaries match and explicit deadlines differ.
- A future AI path should only be reintroduced after it reliably passes the fixture/schema suite and a bounded real-inference quality and latency evaluation. It must remain local-only with no remote fallback.
