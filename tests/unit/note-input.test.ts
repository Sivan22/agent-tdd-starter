import { describe, expect, it } from "vitest";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, parseNoteInput } from "@/lib/notes/input";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseNoteInput", () => {
  it("trims the title and body", () => {
    expect(parseNoteInput(form({ title: "  Groceries ", body: " milk \n" }))).toEqual({
      ok: true,
      value: { title: "Groceries", body: "milk" },
    });
  });

  it("accepts a missing body as empty", () => {
    expect(parseNoteInput(form({ title: "Only a title" }))).toEqual({ ok: true, value: { title: "Only a title", body: "" } });
  });

  it("refuses a title that is blank after trimming", () => {
    const result = parseNoteInput(form({ title: "   ", body: "x" }));
    expect(result).toEqual({ ok: false, errors: { title: "Give the note a title." } });
  });

  it("refuses a title or body over the limit, with the limit in the message", () => {
    const result = parseNoteInput(form({ title: "t".repeat(NOTE_TITLE_MAX + 1), body: "b".repeat(NOTE_BODY_MAX + 1) }));
    expect(result).toEqual({
      ok: false,
      errors: {
        title: `Keep the title to ${NOTE_TITLE_MAX} characters or fewer.`,
        body: `Keep the note to ${NOTE_BODY_MAX} characters or fewer.`,
      },
    });
  });

  it("accepts a title exactly at the limit", () => {
    expect(parseNoteInput(form({ title: "t".repeat(NOTE_TITLE_MAX) })).ok).toBe(true);
  });
});
