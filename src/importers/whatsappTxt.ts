import type { ChatMessage } from "../core/types";
import { validateConversationText } from "../core/validation";

const MESSAGE_STARTS = [
  /^\[(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\]\s/,
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\s*[-–]\s/,
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s/,
];

export function parseConversation(text: string): ChatMessage[] {
  validateConversationText(text);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const start = detectStart(line);
    if (start) {
      if (current) messages.push(current);
      const remainder = line.slice(start.prefixLength);
      const separator = remainder.indexOf(": ");
      const sender = separator > 0 ? remainder.slice(0, separator).trim() : null;
      const body = separator > 0 ? remainder.slice(separator + 2) : remainder;
      current = {
        id: `message-${String(messages.length + 1).padStart(5, "0")}`,
        sender: sender || null,
        timestamp: `${start.date}, ${start.time}`,
        text: body,
        line: index + 1,
      };
      continue;
    }
    if (current) {
      current.text += `\n${line}`;
    } else if (line.trim()) {
      throw new Error(`Could not recognize a message at line ${index + 1}. Use a WhatsApp .txt export.`);
    }
  }
  if (current) messages.push(current);
  if (messages.length === 0) throw new Error("No WhatsApp messages were found in this conversation.");
  return messages;
}

function detectStart(line: string): { date: string; time: string; prefixLength: number } | null {
  for (const pattern of MESSAGE_STARTS) {
    const match = pattern.exec(line);
    if (!match) continue;
    return {
      date: match[1],
      time: match[2],
      prefixLength: match[0].length,
    };
  }
  return null;
}
