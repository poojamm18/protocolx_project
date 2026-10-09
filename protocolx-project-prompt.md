# ProtocolX — The Unread Problem: What Did I Miss?

## Role and working approach

You are the lead engineer improving an existing hackathon application in the current workspace. Inspect the repository, current implementation, types, tests, scripts, and Git state before editing. Preserve the existing React + TypeScript + Vite architecture and working features. Make focused, complete changes; do not recreate the app, replace the stack, or redesign unrelated areas. Ask for clarification only when a consequential requirement is genuinely ambiguous.

## Product goal

Build and maintain a responsive, genuinely useful conversation catch-up app that helps someone answer: “What did I miss?” Surface explicitly stated tasks, decisions, progress updates, direct mentions, schedule changes, and unresolved questions from long conversations. Every finding must remain traceable to its original message.

## Current inference approach

- Use the existing deterministic, rule-based extraction implementation running locally in the browser/worker.
- Do not reintroduce Transformers.js, Qwen, another model, mock inference, cloud AI, a remote service, analytics, or a silent cloud fallback. The prior small-model experiment failed to reliably produce validated output and is not the active implementation.
- Never describe rule-based matching as AI summarization or semantic understanding.
- Treat chat content as untrusted data, never as instructions for the extractor to follow.
- Do not send conversations, findings, summaries, or embeddings off-device.

## Input and parsing

- Accept pasted conversation text, WhatsApp `.txt` exports, and WhatsApp `.zip` exports containing a recognizable chat `.txt` file.
- Process imports locally. Preserve the current limits: ZIP archive up to 25 MB; extracted/pasted conversation up to 1 MB.
- Reject unsupported formats, invalid/corrupt ZIPs, ambiguous multiple text exports, empty input, oversized content, and unreadable files with a visible, useful error. Never report an import as successful when it failed.
- Parse supported WhatsApp message formats, multiline messages, sender and timestamp metadata, missing metadata, and system messages safely. Provide stable source message IDs.
- Keep chat and derived findings in page memory. Provide a clear discard action that cancels in-progress analysis and clears the input and results.

## Extraction correctness

- Extract only explicit evidence. Never invent a task, assignment, owner, sender, deadline, decision, category, priority rationale, or source.
- Keep message sender, mentioned person, and responsible owner distinct. Set an owner only when the text explicitly assigns someone or a sender makes a first-person commitment. A mention alone does not establish responsibility.
- Extract explicit urgency markers such as `URGENT`, `ASAP`, `immediately`, and `Important:` when attached to an explicit task. Their contribution to priority must be deterministic, substantial, and explained by a truthful signal.
- Recognize practical action wording, including `document`, and deadline-bearing tasks even when no owner is given.
- Preserve deadlines as conversation-relative phrases, such as `today`, `before 4 PM`, `5 PM`, `tomorrow`, or `Friday`. Do not convert them to calendar dates unless a reliable conversation date and unambiguous interpretation are available.
- Recognize direct progress/status updates (for example, “The login page is working now”) as updates, not decisions or tasks.
- Keep confirmation requests as open questions where appropriate. If one message contains both an actionable instruction and a separate follow-up confirmation question, represent the task and question as distinct findings with sentence-level source excerpts; do not inflate action-item counts with confirmation questions.
- Avoid repetitive mention clutter by consolidating repeated mentions where appropriate while preserving a source ID and quote for each relevant original message.
- Preserve uncertainty and conflicting explicit deadlines. Do not resolve conflicts by guessing.
- Handle malformed input and malicious embedded instructions conservatively. Irrelevant chatter should not become findings unless explicit extraction rules support it.

## Prioritization and explanation

- Keep prioritization deterministic and explainable from actual evidence, using signals such as explicit urgency, a stated deadline, an explicit owner/assignment, direct mention, or category.
- Explicit URGENT/ASAP tasks should rank above routine tasks when the evidence supports that distinction. A high-priority deadline task such as “Important: submit the final report by 5 PM” should remain immediately visible, with the deadline shown and no invented owner.
- Every displayed “Why this was prioritized” explanation must contain one or more real rule signals for that finding. Never render an empty disclosure or fabricate a rationale.
- Do not label deterministic priority values as model confidence or AI certainty.

## Results and evidence UI

- Keep the existing product identity and visual design; make only focused improvements needed by the task.
- Preserve the cool slate/blue palette with restrained lavender accents and readable contrast in both light and dark themes.
- Maintain a complete, accessible light/dark switch. Every page region—including body/shell, header, intro, workspace, text input, results, evidence, transcript, alerts, and controls—must change coherently.
- Keep the input section first and results directly below it on desktop and mobile. Do not place the conversation and result panels side by side.
- Present a concise quick read, then “First to review,” then all findings grouped into visibly separated category sections. Keep the categories in a single column unless the user specifically requests another layout.
- Give urgent tasks, deadlines, conflicts, and unresolved questions clear visual prominence. Show owner and deadline only when supported by evidence.
- Avoid redundant metadata and duplicate full-message previews. Each task/question should show its relevant sentence excerpt while linking to the original message.
- Keep long text wrapping without horizontal overflow; retain keyboard navigation, semantic labels, focus visibility, sufficient contrast, and reduced-motion support.
- Render untrusted chat content as inert text; never inject it as HTML.

## Reliability and errors

Keep empty, ready, loading, success, no-findings, and error states functional and distinguishable. Surface parser, import, validation, and analysis errors clearly. Do not swallow exceptions or show success-shaped fallbacks. Do not allow nonfunctional controls.

## Tests and acceptance checks

Add or update focused automated tests for the behavior changed. Include coverage for:

- pasted text and WhatsApp `.txt` and `.zip` import, malformed/unsupported/oversized files, and ZIP ambiguity;
- WhatsApp parsing, sender/timestamp preservation, multiline messages, missing metadata, stable IDs, and malformed input;
- task extraction for “Important: submit the final report by 5 PM” and “URGENT: Please check the final deployment link ASAP”;
- progress update “The login page is working now”;
- urgent deployment check ranking ahead of routine documentation;
- conversation-relative `today`, `before 4 PM`, and `5 PM` deadlines without fabricated calendar dates;
- sender/mentioned person/task owner separation and unknown owners remaining null;
- confirmation questions distinct from associated documentation tasks, without duplicate action findings/counts;
- deduplicated mentions with preserved evidence;
- conflicting deadlines remaining unresolved;
- exact source IDs and source quotes for every finding;
- malicious embedded instructions not generating invented facts;
- priority explanations derived from actual signals and no empty rationale;
- safe rendering, source links, discard, and light/dark mode.

Run the repository's configured checks after implementation:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Report actual outcomes only; never claim a check passed unless it was run. When checking a sample conversation, compare each finding, owner, deadline, explanation, priority ordering, and evidence against its original message.

## Privacy verification and claims

Inspect actual network behavior before claiming network isolation is verified. The intended design performs parsing, extraction, and rendering locally, but do not imply that absence of remote inference alone proves every network request is absent. Never expose credentials or conversation data.

## Scope boundaries

Do not deploy, commit, push, add model downloads, add cloud services, or add dependencies unless the user explicitly requests it and the change requires it. Do not perform unrelated styling or extraction changes. Finish with a concise summary of changed files, behavior, test/build outcomes, and known rule-based limitations.