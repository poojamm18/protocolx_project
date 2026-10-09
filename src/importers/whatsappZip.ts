import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { validateConversationText } from "../core/validation";

const MAX_ARCHIVE_BYTES = 25_000_000;
const MAX_TEXT_BYTES = 1_000_000;

export async function readWhatsAppZip(file: File): Promise<{ name: string; text: string }> {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error("This ZIP file is too large. The limit is 25 MB.");
  }

  const archive = new Uint8Array(await file.arrayBuffer());
  const textFiles: Array<{ name: string; bytes: Uint8Array }> = [];
  let totalTextBytes = 0;
  let extractionError: Error | null = null;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (entry) => {
    if (!entry.name.toLowerCase().endsWith(".txt") || entry.name.endsWith("/")) return;
    const chunks: Uint8Array[] = [];
    let fileBytes = 0;
    entry.ondata = (error, data, final) => {
      if (error) {
        extractionError = new Error("The ZIP archive contains a damaged text file.");
        return;
      }
      fileBytes += data.length;
      totalTextBytes += data.length;
      if (fileBytes > MAX_TEXT_BYTES || totalTextBytes > MAX_TEXT_BYTES) {
        extractionError = new Error("The extracted conversation exceeds the 1 MB text limit.");
        return;
      }
      chunks.push(data);
      if (final) {
        const bytes = new Uint8Array(fileBytes);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        textFiles.push({ name: entry.name, bytes });
      }
    };
    try {
      entry.start();
    } catch {
      extractionError = new Error("This ZIP uses an unsupported compression method.");
    }
  };

  try {
    unzip.push(archive, true);
  } catch {
    throw new Error("This ZIP archive is invalid or could not be opened.");
  }
  if (extractionError) throw extractionError;
  if (textFiles.length === 0) {
    throw new Error("No WhatsApp .txt conversation was found inside this ZIP.");
  }
  const preferredFiles = textFiles.filter(({ name }) =>
    /(?:^|\/)(?:whatsapp chat|chat)(?:[ _-].*)?\.txt$/iu.test(name),
  );
  const selected = preferredFiles.length === 1
    ? preferredFiles[0]
    : textFiles.length === 1
      ? textFiles[0]
      : null;
  if (!selected) {
    throw new Error("This ZIP contains multiple text files. Keep only the WhatsApp conversation export and try again.");
  }

  const text = new TextDecoder("utf-8", { fatal: true }).decode(selected.bytes);
  validateConversationText(text);
  return { name: selected.name.split("/").pop() || selected.name, text };
}
