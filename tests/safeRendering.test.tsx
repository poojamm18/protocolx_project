import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FindingsList from "../src/components/FindingsList";
import type { ChatMessage, Finding } from "../src/core/types";
import { extractRuleBasedFindings } from "../src/extraction/ruleBased";

const messages: ChatMessage[] = [{
  id: "message-00001",
  sender: "<img src=x onerror=alert(1)>",
  timestamp: null,
  text: "<script>alert('x')</script> do not execute",
  line: 1,
}];
const finding: Finding = {
  id: "finding-0001",
  category: "update",
  summary: "<img src=x onerror=alert(1)>",
  owner: null,
  deadline: null,
  evidenceIds: ["message-00001"],
  evidenceQuotes: ["<script>alert('x')</script>"],
  uncertainty: null,
  conflictGroup: null,
  priority: 0,
  priorityReasons: [],
};

describe("safe rendering", () => {
  it("renders model output and imported messages as inert text with working source links", () => {
    render(<FindingsList findings={[finding]} messages={messages} />);
    expect(screen.getByRole("heading", { name: finding.summary })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    const evidenceLink = screen.getByRole("link", { name: /alert/ });
    expect(evidenceLink).toHaveAttribute("href", "#message-00001");
    fireEvent.click(evidenceLink);
    expect(screen.getByText(/View original messages/).closest("details")).toHaveAttribute("open");
    expect(screen.getByText(messages[0].text)).toBeInTheDocument();
  });

  it("summarizes real category counts and keeps both conflicting deadlines source-linked", () => {
    const conflictMessages: ChatMessage[] = [
      { id: "message-00001", sender: "Alex", timestamp: "9:00 AM", text: "@Sam please send the brief by Friday.", line: 1 },
      { id: "message-00002", sender: "Sam", timestamp: "9:02 AM", text: "I'll send the brief by Thursday.", line: 2 },
    ];
    const conflictFindings: Finding[] = ["Friday", "Thursday"].map((deadline, index) => ({
      ...finding,
      id: `finding-${index + 1}`,
      category: "task",
      summary: "Send the brief",
      owner: "Sam",
      deadline,
      evidenceIds: [`message-${String(index + 1).padStart(5, "0")}`],
      evidenceQuotes: [conflictMessages[index].text],
      uncertainty: "Conflicting deadlines are stated; verify which is current.",
      conflictGroup: "brief-deadline-conflict",
      priority: 8,
      priorityReasons: ["action item", "deadline stated"],
    }));

    render(<FindingsList findings={conflictFindings} messages={conflictMessages} />);
    expect(screen.getByRole("heading", { name: "2 findings across 1 category" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Action items 2/ })).toHaveAttribute("href", "#finding-group-task");
    expect(screen.getByText(/Conflicting deadlines: Friday \/ Thursday/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open 1 of 2 source messages/ })).toHaveAttribute("href", "#message-00001");
    expect(screen.getByRole("link", { name: /Open 2 of 2 source messages/ })).toHaveAttribute("href", "#message-00002");
    expect(screen.getAllByText(/Conflicting deadlines are stated/)).toHaveLength(2);
  });

  it("shows prioritized task rationale and keeps a documentation task separate from its question", () => {
    const messages: ChatMessage[] = [
      { id: "message-00001", sender: "Maya", timestamp: "9:00 AM", text: "Please document the deployment details today. Can you confirm once it's submitted?", line: 1 },
      { id: "message-00002", sender: "Alex", timestamp: "9:01 AM", text: "URGENT: Please check the final deployment link ASAP.", line: 2 },
      { id: "message-00003", sender: "Ravi", timestamp: "9:02 AM", text: "Important: submit the final report by 5 PM.", line: 3 },
    ];
    const findings = extractRuleBasedFindings(messages);
    render(<FindingsList findings={findings} messages={messages} />);

    expect(screen.getByRole("heading", { name: "4 findings across 2 categories" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Action items 3/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open questions 1/ })).toBeInTheDocument();
    const firstReview = document.querySelector(".priority-brief");
    expect(firstReview?.querySelector(".brief-copy p")).toHaveTextContent("Check the final deployment link");
    expect(within(firstReview as HTMLElement).getByText(/explicit urgency/)).toBeInTheDocument();
    expect(within(firstReview as HTMLElement).getByText(/Due: 5 PM/)).toBeInTheDocument();
    expect(within(firstReview as HTMLElement).getByText(/deadline stated/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Document the deployment details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Can you confirm once it's submitted?" })).toBeInTheDocument();
    expect(screen.getByText("Please document the deployment details today.")).toBeInTheDocument();
    expect(screen.getAllByText("Can you confirm once it's submitted?")).toHaveLength(2);
    expect([...document.querySelectorAll(".finding-card .priority-reasons p")]
      .every((paragraph) => Boolean(paragraph.textContent?.trim()))).toBe(true);
  });

  it("does not render an empty priority explanation", () => {
    render(<FindingsList findings={[finding]} messages={messages} />);
    expect(document.querySelector(".priority-reasons")).toBeNull();
  });
});
