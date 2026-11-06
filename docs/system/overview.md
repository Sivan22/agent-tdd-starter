---
summary: What the application is, who uses it, and the one example flow it ships with.
---
# Overview

## Purpose

This repository is a starting point for a full-stack web application built by agents, test first,
under the rules in [AGENTS.md](../../AGENTS.md). It ships with one small feature, private notes,
so that every part of the method has a working example: a migration with row-level security,
database tests that prove the refusals, a Server Action with validation, a page, a browser test,
and the documents that describe them.

A project made from this template replaces this overview with its own: what the product is, who
uses it, and the life of its central object from creation to completion.

## Behaviour

1. A visitor lands on «Notes» at `/` and follows «Sign in» to `/login`
   ([Authentication](auth.md)).
2. A signed-in user reads, writes and deletes their own notes at `/notes`, and sees nobody
   else's ([Notes](notes.md)).
3. Everything else is the platform around it: [architecture](architecture.md),
   [hosting, CI and migrations](platform/README.md) and [testing](platform/testing.md).

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| The landing page | `app/page.tsx` | none | `e2e/notes.spec.ts` |

## Invariants

- Every area of the code is claimed by exactly the system documents that describe it; `pnpm docs:check` fails on unclaimed code.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| Every page throws "Missing environment variable" | `.env` is missing or the stack is not running | [Local database](../runbooks/local-database.md) |

## Open questions

- None.

## Decisions

- [2026-11-06: a general template, without a layered security model](../decisions/platform.md#2026-11-06-a-general-template-without-a-layered-security-model)
