import { useEffect, useRef, useState } from "react";
import { parseConversation } from "../importers/whatsappTxt";
import { validateConversationText } from "../core/validation";
import type { ChatMessage, Finding } from "../core/types";
import FindingsList from "../components/FindingsList";
import { analyzeInWorker } from "../inference/client";
import { readWhatsAppZip } from "../importers/whatsappZip";

type Phase = "empty" | "ready" | "loading" | "success" | "error";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [phase, setPhase] = useState<Phase>("empty");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [importedFileName, setImportedFileName] = useState("");
  const [notice, setNotice] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelInferenceRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    document.body.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  function updateInput(value: string) {
    setInput(value);
    setMessages([]);
    setFindings([]);
    setError("");
    setStatus("");
    setImportedFileName("");
    setNotice("");
    setPhase(value.trim() ? "ready" : "empty");
  }

  async function importFile(file?: File) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "txt" && extension !== "zip") {
      setError("Choose a WhatsApp .txt export or .zip export.");
      setPhase("error");
      return;
    }
    if (extension === "txt" && file.size > 1_000_000) {
      setError("This file is too large. The limit is 1 MB.");
      setPhase("error");
      return;
    }
    try {
      const imported = extension === "zip"
        ? await readWhatsAppZip(file)
        : { name: file.name, text: await file.text() };
      const { text } = imported;
      validateConversationText(text);
      updateInput(text);
      setImportedFileName(imported.name);
      setNotice(`${imported.name} is ready to review.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be read.");
      setPhase("error");
    }
  }

  async function reviewConversation() {
    setError("");
    setFindings([]);
    try {
      validateConversationText(input);
      const parsed = parseConversation(input);
      setMessages(parsed);
      setPhase("loading");
      const task = analyzeInWorker(parsed, setStatus);
      cancelInferenceRef.current = task.cancel;
      const extracted = await task.promise;
      setFindings(extracted);
      setStatus("");
      setPhase("success");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setStatus("");
      setError(cause instanceof Error ? cause.message : "The conversation could not be analyzed.");
      setPhase("error");
    } finally {
      cancelInferenceRef.current = null;
    }
  }

  function discardConversation() {
    cancelInferenceRef.current?.();
    cancelInferenceRef.current = null;
    updateInput("");
    setNotice("Conversation discarded from this page.");
    setMessages([]);
    setFindings([]);
    setPhase("empty");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <main className="app-shell" data-theme={darkMode ? "dark" : "light"}>
      <header className="topbar">
        <a className="wordmark" href="#" aria-label="The Unread Problem home">
          <span className="brand-mark" aria-hidden="true">u.</span>
          <span className="wordmark-name">THE UNREAD PROBLEM</span>
        </a>
        <div className="topbar-actions">
          <button className="mode-toggle" type="button" aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`} aria-pressed={darkMode} onClick={() => setDarkMode((value) => !value)}>
            <span aria-hidden="true">{darkMode ? "☀" : "◐"}</span> {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <span className="privacy-pill"><span className="privacy-dot" aria-hidden="true" />On-device rules <span className="privacy-separator">·</span> no AI</span>
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div className="intro-copy-block">
          <p className="eyebrow"><span className="eyebrow-rule" />A CLEARER WAY BACK IN</p>
          <h1 id="page-title">What did<br /><em>I miss?</em></h1>
          <p className="intro-copy">Surface explicit tasks, changes and open questions from a long conversation. Every finding stays tied to the words that matter.</p>
        </div>
        <div className="intro-aside" aria-label="Product approach">
          <span className="aside-index">01 / PRIVATE BY DESIGN</span>
          <p>Your chat stays in this tab. Simple on-device patterns surface explicit signals—no AI interpretation and no upload.</p>
          <span className="aside-mark" aria-hidden="true">↘</span>
        </div>
      </section>

      <section className="workspace" aria-label="Conversation review">
        <div className="input-panel">
          <div className="panel-heading">
            <div className="heading-label"><span className="step-number">01</span><div><span className="section-kicker">START HERE</span><h2>Bring the conversation</h2></div></div>
            {input
              ? <button className="text-button" type="button" onClick={discardConversation}><span aria-hidden="true">×</span> Discard chat</button>
              : <span className="local-label">PRIVATE BY DESIGN</span>}
          </div>
          <label className="input-label" htmlFor="conversation">Paste conversation text</label>
          <textarea
            id="conversation"
            value={input}
            onChange={(event) => updateInput(event.target.value)}
            placeholder={"[10/04/26, 9:12 AM] Alex: Let’s move the review to Friday.\n[10/04/26, 9:14 AM] Sam: I’ll update the brief by Thursday."}
            rows={10}
            aria-describedby="input-help input-validation"
            aria-invalid={input.length > 1_000_000}
            disabled={phase === "loading"}
          />
          <div className="input-meta">
            <span id="input-help">.txt or .zip up to 25 MB · chat text max 1 MB</span>
            <span className={input.length > 1_000_000 ? "character-count is-invalid" : "character-count"}>{input.length.toLocaleString()} <span>/ 1,000,000</span></span>
          </div>
          <p id="input-validation" className={input.length > 1_000_000 ? "input-validation is-visible" : "input-validation"} role={input.length > 1_000_000 ? "alert" : undefined}>
            {input.length > 1_000_000 ? "This conversation exceeds the 1 MB limit." : "Paste a WhatsApp export or choose a .txt / .zip file (ZIP max 25 MB)."}
          </p>
          <div className="input-actions">
            <button className="button button-secondary" type="button" onClick={() => fileRef.current?.click()} disabled={phase === "loading"}>
              <span className="button-icon" aria-hidden="true">↥</span> Import .txt / .zip
            </button>
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept=".txt,.zip,text/plain,application/zip,application/x-zip-compressed"
              aria-label="Import a WhatsApp text export"
              onChange={(event) => void importFile(event.currentTarget.files?.[0])}
            />
            <button className="button button-primary" type="button" onClick={() => void reviewConversation()} disabled={phase === "loading" || !input.trim() || input.length > 1_000_000}>
              {phase === "loading" ? "Finding the important bits…" : "Find what matters"} <span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="input-feedback" aria-live="polite">
            {importedFileName && <p className="import-status"><span aria-hidden="true">✓</span> {importedFileName} <span>ready</span></p>}
            {notice && <p className="action-notice">{notice}</p>}
          </div>
          <p className="privacy-note"><span className="privacy-shield" aria-hidden="true">◆</span><span><strong>On-device, by design.</strong> Rule-based matching. No AI service, no upload.</span></p>
        </div>

        <section className={`results-panel phase-${phase}`} aria-labelledby="results-title" aria-live="polite">
          <div className="panel-heading results-heading">
            <div className="heading-label"><span className="step-number">02</span><div><span className="section-kicker">YOUR CATCH-UP</span><h2 id="results-title">The things that matter</h2></div></div>
            {phase === "success" && findings.length > 0 && <span className="finding-count">{findings.length} {findings.length === 1 ? "finding" : "findings"}</span>}
          </div>
          {phase === "empty" || phase === "ready" ? (
            <div className="empty-state">
              <div className="empty-illustration" aria-hidden="true"><span>↙</span><i /><b /></div>
              <p className="empty-title">A little quieter in here.</p>
              <p>{phase === "ready" ? "Ready when you are. Your source messages will stay linked." : "Bring in a conversation to see what needs your attention."}</p>
            </div>
          ) : null}
          {phase === "loading" && (
            <div className="loading-state" role="status">
              <span className="loader" aria-hidden="true" />
              <p className="empty-title">Reading between the messages.</p>
              <p>{status || "Preparing on-device analysis…"}</p>
              <small>Only explicit patterns are surfaced; review the original messages for context.</small>
            </div>
          )}
          {phase === "error" && (
            <div className="error-state" role="alert">
              <span aria-hidden="true">!</span>
              <div><p className="empty-title">We couldn’t review that chat.</p><p>{error}</p></div>
            </div>
          )}
          {phase === "success" && (
            <FindingsList findings={findings} messages={messages} />
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span className="footer-brand"><span className="brand-mark footer-mark" aria-hidden="true">u.</span> THE UNREAD PROBLEM</span>
        <span>ON-DEVICE RULES <i /> NO AI SERVICE <i /> NO CLOUD STORAGE</span>
      </footer>
    </main>
  );
}
