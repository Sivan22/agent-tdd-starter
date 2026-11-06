---
summary: One sentence saying what this area does. The index shows it.
covers:
  - lib/<area>/**
  - app/<route>/**
---
# <Area>

## Purpose

Two or three sentences: what this area is for and who uses it.

## Behaviour

1. One rule per item, in the present tense. Name the screen and quote its label exactly as the code has it: "Save".
2. Say who may do it and what the database refuses.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| What this row is about | `lib/<area>/x.ts` (`symbolName`) | `table_name`, `function_name` | `tests/<dir>/x.test.ts` |

## Invariants

- What must never break, and the test or database constraint that enforces it.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| What the user sees or reports | Why it happens | A read-only query, log search or file to open |

## Open questions

- A question the owner has not answered yet, and what waits on it.

## Decisions

- [YYYY-MM-DD: the ruling in a few words](../decisions/<area>.md#yyyy-mm-dd-the-ruling-in-a-few-words)
