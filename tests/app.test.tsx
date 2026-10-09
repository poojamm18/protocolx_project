import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/app/App";
import { zipSync } from "fflate";

describe("conversation input", () => {
  it("imports a WhatsApp text file into the editable conversation field", async () => {
    render(<App />);
    const file = new File(
      ["[10/04/26, 9:12 AM] Alex: The review is Friday."],
      "export.txt",
      { type: "text/plain" },
    );
    Object.defineProperty(file, "text", {
      value: async () => "[10/04/26, 9:12 AM] Alex: The review is Friday.",
    });
    fireEvent.change(screen.getByLabelText("Import a WhatsApp text export"), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Paste conversation text" })).toHaveValue(
        "[10/04/26, 9:12 AM] Alex: The review is Friday.",
      );
    });
    expect(await screen.findByText("export.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard chat" }));
    expect(screen.getByRole("textbox", { name: "Paste conversation text" })).toHaveValue("");
    expect(screen.getByText("Conversation discarded from this page.")).toBeInTheDocument();
  });

  it("rejects unsupported file extensions with a visible error", async () => {
    render(<App />);
    const file = new File(["anything"], "export.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Import a WhatsApp text export"), {
      target: { files: [file] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a whatsapp \.txt export or \.zip export/i);
  });

  it("imports the WhatsApp text file from a ZIP export", async () => {
    render(<App />);
    const message = "[10/04/26, 9:12 AM] Alex: The review is Friday.";
    const archive = zipSync({ "WhatsApp Chat with Alex.txt": new TextEncoder().encode(message) });
    const file = new File([archive], "whatsapp-export.zip", { type: "application/zip" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
    });
    fireEvent.change(screen.getByLabelText("Import a WhatsApp text export"), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Paste conversation text" })).toHaveValue(message);
    });
    expect(await screen.findByText("WhatsApp Chat with Alex.txt")).toBeInTheDocument();
  });

  it("switches between light and dark display modes", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(toggle);
    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
  });
});
