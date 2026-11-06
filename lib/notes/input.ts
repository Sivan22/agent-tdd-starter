import { z } from "zod";

/** The same limits are CHECK constraints on `public.notes`; the database refuses what this misses. */
export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 10_000;

const noteInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the note a title.")
    .max(NOTE_TITLE_MAX, `Keep the title to ${NOTE_TITLE_MAX} characters or fewer.`),
  body: z.string().trim().max(NOTE_BODY_MAX, `Keep the note to ${NOTE_BODY_MAX} characters or fewer.`),
});

export type NoteInput = z.infer<typeof noteInput>;
export type NoteInputErrors = Partial<Record<keyof NoteInput, string>>;

export function parseNoteInput(form: FormData): { ok: true; value: NoteInput } | { ok: false; errors: NoteInputErrors } {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const parsed = noteInput.safeParse({ title: text("title"), body: text("body") });
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: NoteInputErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if ((key === "title" || key === "body") && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
