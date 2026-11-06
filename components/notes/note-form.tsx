"use client";

import { useActionState } from "react";
import { createNote, type NoteFormState } from "@/app/notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from "@/lib/notes/input";

const initialState: NoteFormState = { errors: {}, values: { title: "", body: "" } };

export function NoteForm() {
  const [state, action, pending] = useActionState(createNote, initialState);
  return (
    <form action={action} className="grid gap-4" aria-label="New note">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={NOTE_TITLE_MAX}
          defaultValue={state.values.title}
          aria-invalid={state.errors.title ? true : undefined}
          aria-describedby={state.errors.title ? "title-error" : undefined}
        />
        {state.errors.title ? (
          <p id="title-error" role="alert" className="text-sm text-destructive">
            {state.errors.title}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body">Note</Label>
        <Textarea
          id="body"
          name="body"
          maxLength={NOTE_BODY_MAX}
          defaultValue={state.values.body}
          aria-invalid={state.errors.body ? true : undefined}
          aria-describedby={state.errors.body ? "body-error" : undefined}
        />
        {state.errors.body ? (
          <p id="body-error" role="alert" className="text-sm text-destructive">
            {state.errors.body}
          </p>
        ) : null}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          Add note
        </Button>
      </div>
    </form>
  );
}
