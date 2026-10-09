import { describe, expect, it } from "vitest";
import { parseConversation } from "../src/importers/whatsappTxt";

describe("parseConversation", () => {
  it("preserves ordered message content, sender, timestamp, and stable source IDs", () => {
    const input = "[10/04/26, 9:12 AM] Alex: Review moved to Friday.\n[10/04/26, 9:14 AM] Sam: I’ll update the brief.";
    const first = parseConversation(input);
    expect(parseConversation(input)).toEqual(first);
    expect(first).toEqual([
      { id: "message-00001", sender: "Alex", timestamp: "10/04/26, 9:12 AM", text: "Review moved to Friday.", line: 1 },
      { id: "message-00002", sender: "Sam", timestamp: "10/04/26, 9:14 AM", text: "I’ll update the brief.", line: 2 },
    ]);
  });

  it("keeps multiline message content and ignores blank lines before the first message", () => {
    const messages = parseConversation("\n31/12/2025, 23:55 - Jo: First line\nsecond line\n\n01/01/2026, 00:02 - Lee: New year");
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toBe("First line\nsecond line\n");
    expect(messages[1].sender).toBe("Lee");
  });

  it("keeps missing sender metadata missing", () => {
    const [message] = parseConversation("[4/5/26, 10:00 AM] System message without a name");
    expect(message.sender).toBeNull();
    expect(message.text).toBe("System message without a name");
  });

  it("rejects empty, malformed, and oversized conversations", () => {
    expect(() => parseConversation(" \n")).toThrow(/paste or import/i);
    expect(() => parseConversation("this is not a WhatsApp message")).toThrow(/line 1/i);
    expect(() => parseConversation("x".repeat(1_000_001))).toThrow(/too large/i);
  });
});
