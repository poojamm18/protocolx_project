import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/core/types";
import { parseModelOutput } from "../src/core/validation";
import { representativeModelOutput } from "./fixtures/modelOutput";

const messages: ChatMessage[] = [
  { id: "message-00001", sender: "Alex", timestamp: "yesterday", text: "Please send the budget by Friday.", line: 1 },
];

describe("parseModelOutput", () => {
  it("accepts a fixed representative model-output fixture (validator test, not an inference test)", () => {
    expect(parseModelOutput(representativeModelOutput, messages)).toMatchObject([{
      category: "task",
      summary: "Send the budget",
      owner: null,
      deadline: "Friday",
      evidenceIds: ["message-00001"],
      evidenceQuotes: ["Please send the budget by Friday."],
    }]);
  });

  it("accepts valid structured findings with exact evidence", () => {
    const output = JSON.stringify([{
      category: "task",
      summary: "Send the budget",
      owner: "Alex",
      deadline: "Friday",
      evidenceIds: ["message-00001"],
      evidenceQuotes: ["send the budget by Friday"],
      uncertainty: null,
      conflictGroup: null,
    }]);
    expect(parseModelOutput(output, messages)[0]).toMatchObject({ owner: "Alex", deadline: "Friday" });
    expect(parseModelOutput(`Here is the result:\n\`\`\`json\n${output}\n\`\`\``, messages)).toHaveLength(1);
  });

  it("rejects malformed JSON and unsupported categories", () => {
    expect(() => parseModelOutput("not json", messages)).toThrow();
    const item = JSON.parse(representativeModelOutput)[0] as Record<string, unknown>;
    item.category = "made_up";
    expect(() => parseModelOutput(JSON.stringify([item]), messages)).toThrow(/category/i);
  });

  it("rejects missing required fields", () => {
    const item = JSON.parse(representativeModelOutput)[0] as Record<string, unknown>;
    delete item.uncertainty;
    expect(() => parseModelOutput(JSON.stringify([item]), messages)).toThrow(/required output schema/i);
  });

  it("rejects fabricated source IDs and quotes absent from source", () => {
    const base = {
      category: "task",
      summary: "Send a budget",
      owner: null,
      deadline: null,
      evidenceIds: ["message-99999"],
      evidenceQuotes: ["send the budget"],
      uncertainty: null,
      conflictGroup: null,
    };
    expect(() => parseModelOutput(JSON.stringify([base]), messages)).toThrow(/unknown source/i);
    expect(() => parseModelOutput(JSON.stringify([{ ...base, evidenceIds: ["message-00001"], evidenceQuotes: ["invented quote"] }]), messages)).toThrow(/not present/i);
  });

  it("rejects owners and deadlines unsupported by cited messages", () => {
    const base = {
      category: "task",
      summary: "Send the budget",
      owner: "Morgan",
      deadline: "Monday",
      evidenceIds: ["message-00001"],
      evidenceQuotes: ["send the budget by Friday"],
      uncertainty: null,
      conflictGroup: null,
    };
    expect(() => parseModelOutput(JSON.stringify([base]), messages)).toThrow(/owner not stated/i);
    expect(() => parseModelOutput(JSON.stringify([{ ...base, owner: null }]), messages)).toThrow(/deadline not stated/i);
  });

  it("requires a source quote for every source reference", () => {
    expect(() => parseModelOutput(JSON.stringify([{
      category: "update", summary: "Budget", owner: null, deadline: null,
      evidenceIds: ["message-00001"], evidenceQuotes: [],
      uncertainty: null, conflictGroup: null,
    }]), messages)).toThrow(/matching source IDs/i);
  });

  it("rejects a fabricated summary unrelated to its exact cited evidence", () => {
    const item = JSON.parse(representativeModelOutput)[0] as Record<string, unknown>;
    item.summary = "Transfer payroll to Morgan";
    expect(() => parseModelOutput(JSON.stringify([item]), messages)).toThrow(/not supported by its evidence/i);
  });
});
