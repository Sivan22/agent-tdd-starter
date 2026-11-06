---
summary: The example feature: a user writes, reads and deletes private notes; nobody else can see them.
covers:
  - app/notes/**
  - components/notes/**
  - lib/notes/**
---
# Notes

## Purpose

Each signed-in user keeps private notes: a title and an optional text. The feature is small on
purpose; it is the worked example of the method, from migration to browser test.

## Behaviour

1. `/notes` lists the caller's notes, newest first, under «Your notes», or «No notes yet.» when
   there are none.
2. «Add note» saves a note. The title is required, trimmed, and at most 120 characters; the text
   is optional, trimmed, and at most 10,000 characters. A title of only spaces answers «Give the
   note a title.»
3. The bin button («Delete note: <title>») deletes the note at once.
4. Notes are never edited: delete and write again. No role holds UPDATE on `notes`, not even
   the secret-key role. This keeps a deliberately absent permission, and the test that proves it,
   in the example; a project that wants editing adds an update grant, an update policy and their
   RLS cases in a new migration.
5. A user never sees, deletes or writes another user's notes, whatever the request.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| Validation and limits | `lib/notes/input.ts` (`parseNoteInput`) | CHECK constraints on `notes.title`, `notes.body` | `tests/unit/note-input.test.ts` |
| Saving and deleting | `app/notes/actions.ts` (`createNote`, `deleteNote`) | `notes` policies | `tests/rls/notes.test.ts` |
| The page and form | `app/notes/page.tsx`, `components/notes/note-form.tsx` | none | `e2e/notes.spec.ts` |
| The table | `supabase/migrations/0001_notes.sql` | `notes` | `tests/rls/notes.test.ts` |

## Invariants

- A note belongs to the user who wrote it: `owner_id` defaults to `auth.uid()` and the insert
  policy refuses any other value (`tests/rls/notes.test.ts`).
- The database refuses a blank, padded or over-long title, and a padded or over-long text, even
  when the form is skipped.
- Deleting a user deletes their notes (`on delete cascade`).

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| «The note was refused. Check the title and text and try again.» | A CHECK constraint refused a value the form accepted: the two limits disagree | Compare `lib/notes/input.ts` with the constraints in `docs/db/schema.snapshot.sql` |

## Open questions

- None.

## Decisions

- None yet.
