import { useRef } from "react";
import type { ChatMessage, Finding } from "../core/types";

const categoryLabels: Record<Finding["category"], string> = {
  task: "Action items",
  decision: "Decisions",
  update: "Updates",
  mention: "Direct mentions",
  schedule_change: "Schedule changes",
  question: "Open questions",
};
const categoryOrder: Finding["category"][] = ["task", "decision", "schedule_change", "question", "mention", "update"];

type Props = {
  findings: Finding[];
  messages: ChatMessage[];
};

export default function FindingsList({ findings, messages }: Props) {
  const transcriptRef = useRef<HTMLDetailsElement>(null);
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  if (findings.length === 0) {
    return <div className="empty-state success-empty"><div className="empty-check" aria-hidden="true">✓</div><p className="empty-title">Nothing matched this time.</p><p>These simple rules look for explicit wording. Try a longer export or review the original conversation.</p></div>;
  }
  const groupedFindings = categoryOrder
    .map((category) => ({ category, items: findings.filter((finding) => finding.category === category) }))
    .filter((group) => group.items.length > 0);
  const priorityCandidates = findings.filter((finding) => ["task", "decision", "schedule_change", "question"].includes(finding.category));
  const priorityBrief: Array<{ finding: Finding; related: Finding[] }> = [];
  const seenConflicts = new Set<string>();
  for (const finding of priorityCandidates) {
    if (finding.conflictGroup) {
      if (seenConflicts.has(finding.conflictGroup)) continue;
      seenConflicts.add(finding.conflictGroup);
      priorityBrief.push({
        finding,
        related: findings.filter((candidate) => candidate.conflictGroup === finding.conflictGroup),
      });
    } else {
      priorityBrief.push({ finding, related: [finding] });
    }
    if (priorityBrief.length === 2) break;
  }
  const totalCategories = groupedFindings.length;
  return (
    <div className="findings-list">
      <section className="findings-overview" aria-labelledby="overview-title">
        <div className="overview-heading">
          <div>
            <p className="overview-eyebrow">THE QUICK READ</p>
            <h3 id="overview-title">{findings.length} {findings.length === 1 ? "finding" : "findings"} across {totalCategories} {totalCategories === 1 ? "category" : "categories"}</h3>
          </div>
          <span className="overview-mark" aria-hidden="true">↘</span>
        </div>
        <ul className="category-summary" aria-label="Finding counts by category">
          {groupedFindings.map(({ category, items }) => (
            <li key={category}>
              <a href={`#finding-group-${category}`}>
                <span>{categoryLabels[category]}</span><strong>{items.length}</strong>
              </a>
            </li>
          ))}
        </ul>
        {priorityBrief.length > 0 && (
          <div className="priority-brief">
            <p className="priority-brief-label">FIRST TO REVIEW</p>
            {priorityBrief.map(({ finding, related }) => {
              const deadlines = [...new Set(related.map((item) => item.deadline).filter((deadline): deadline is string => Boolean(deadline)))];
              const owners = [...new Set(related.map((item) => item.owner).filter((owner): owner is string => Boolean(owner)))];
              return (
                <div className={`brief-item${finding.conflictGroup ? " brief-conflict" : ""}`} key={finding.id}>
                  <span className={`brief-marker marker-${finding.category}`} aria-hidden="true" />
                  <div className="brief-copy">
                    <p>{finding.summary}</p>
                    <span>
                      {finding.conflictGroup
                        ? `Conflicting deadlines: ${deadlines.join(" / ")}${owners.length ? ` · Owner${owners.length > 1 ? "s" : ""}: ${owners.join(" / ")}` : ""} · verify before acting`
                        : [finding.owner ? `Owner: ${finding.owner}` : null, finding.deadline ? `Due: ${finding.deadline}` : null].filter(Boolean).join(" · ") || categoryLabels[finding.category]}
                    </span>
                    {finding.priorityReasons.length > 0 && (
                      <span className="brief-rationale">
                        {finding.priorityReasons.slice(0, 3).join(" · ")}
                      </span>
                    )}
                  </div>
                  <div className="brief-sources">
                    {related.map((item, index) => {
                      const sourceId = item.evidenceIds[0];
                      if (!sourceId || !messagesById.has(sourceId)) return null;
                      return (
                        <a
                          className="brief-source"
                          href={`#${sourceId}`}
                          aria-label={`Open ${index + 1} of ${related.length} source messages for ${finding.summary}`}
                          key={`${item.id}-${sourceId}`}
                          onClick={() => { if (transcriptRef.current) transcriptRef.current.open = true; }}
                        >{related.length > 1 ? `Source ${index + 1}` : "Source"} ↗</a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div className="grouped-results-heading">
        <h3>All findings</h3>
        <span>Grouped by category</span>
      </div>
      <div className="finding-groups-grid">
        {groupedFindings.map(({ category, items }) => (
          <section className={`finding-group group-${category}`} key={category} id={`finding-group-${category}`} aria-labelledby={`group-${category}`}>
            <div className="finding-group-heading">
              <h3 id={`group-${category}`}>{categoryLabels[category]}</h3>
              <span>{items.length}</span>
            </div>
            {items.map((finding) => (
              <article className={`finding-card finding-${finding.category}${finding.conflictGroup ? " has-conflict" : ""}`} key={finding.id}>
                <div className="finding-topline">
                  {finding.category === "question" && <span className="question-flag">Needs an answer</span>}
                  <span className="priority" aria-label={`Priority score ${finding.priority}`}>Priority {finding.priority}</span>
                </div>
                <h4>{finding.summary}</h4>
                {(finding.owner || finding.deadline) && (
                  <dl className="finding-details">
                    {finding.owner && <div><dt>Owner</dt><dd>{finding.owner}</dd></div>}
                    {finding.deadline && <div><dt>When</dt><dd>{finding.deadline}</dd></div>}
                  </dl>
                )}
                {finding.uncertainty && <p className="uncertainty"><span aria-hidden="true">↳</span> {finding.uncertainty}</p>}
                {finding.priorityReasons.length > 0 && (
                  <details className="priority-reasons">
                    <summary>Why this was prioritized</summary>
                    <p>{finding.priorityReasons.join(" · ")}</p>
                  </details>
                )}
                <div className="evidence-list">
                  {finding.evidenceIds.map((sourceId, index) => {
                    const message = messagesById.get(sourceId);
                    if (!message) return null;
                    return (
                      <a
                        className="evidence-link"
                        href={`#${sourceId}`}
                        key={`${sourceId}-${index}`}
                        onClick={() => {
                          if (transcriptRef.current) transcriptRef.current.open = true;
                        }}
                      >
                        <span className="quote-mark" aria-hidden="true">“</span>
                        <span className="evidence-text">{finding.evidenceQuotes[index]}</span>
                        <span className="evidence-source">{message.sender || "Unknown sender"}{message.timestamp ? ` · ${message.timestamp}` : ""}<span aria-hidden="true"> ↗</span></span>
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
      <details className="source-transcript" ref={transcriptRef}>
        <summary>View original messages ({messages.length})</summary>
        <ol>
          {messages.map((message) => (
            <li id={message.id} key={message.id} className="source-message">
              <div><strong>{message.sender || "Unknown sender"}</strong><span>{message.timestamp || "Time not provided"} · line {message.line}</span></div>
              <p>{message.text}</p>
            </li>
          ))}
        </ol>
      </details>
      <p className="results-disclaimer"><strong>A useful starting point, not the whole story.</strong> These are explicit pattern matches, not AI summaries. Check each linked source message before acting.</p>
    </div>
  );
}
