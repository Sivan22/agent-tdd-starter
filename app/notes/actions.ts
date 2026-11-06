"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { parseNoteInput, type NoteInput, type NoteInputErrors } from "@/lib/notes/input";

export type NoteFormState = { errors: NoteInputErrors; values: NoteInput };

/** Postgres refused a row because a CHECK constraint failed. */
const CHECK_VIOLATION = "23514";

export async function createNote(_previous: NoteFormState, form: FormData): Promise<NoteFormState> {
  const submitted = { title: String(form.get("title") ?? ""), body: String(form.get("body") ?? "") };
  const input = parseNoteInput(form);
  if (!input.ok) return { errors: input.errors, values: submitted };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("notes").insert(input.value);
  if (error?.code === CHECK_VIOLATION) {
    return { errors: { title: "The note was refused. Check the title and text and try again." }, values: submitted };
  }
  if (error) throw error;
  revalidatePath("/notes");
  return { errors: {}, values: { title: "", body: "" } };
}

const noteId = z.uuid();

export async function deleteNote(form: FormData): Promise<void> {
  const id = noteId.parse(form.get("id"));
  const { supabase } = await requireUser();
  // RLS limits the delete to the caller's own notes; another user's id deletes nothing.
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/notes");
}
