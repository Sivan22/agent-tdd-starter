---
summary: Signing in, creating an account and signing out with Supabase Auth email and password.
covers:
  - app/login/**
  - components/auth/**
  - lib/auth/**
---
# Authentication

## Purpose

Who may use the application: anyone with an email and password. Read it before changing the login
page or adding a page that needs a signed-in user.

## Behaviour

1. `/login` shows «Sign in» with an email and a password. «Sign in» signs in an existing account;
   «Create account» creates one. A signed-in visitor who opens `/login` goes to `/notes`.
2. A wrong email or password answers «Wrong email or password.» without saying which was wrong.
   An unconfirmed email answers «Confirm your email first: follow the link we sent, then sign
   in.» Any other failure, such as a rate limit or an Auth outage, answers «Signing in is not
   possible right now. Wait a few minutes and try again.» (`lib/auth/sign-in-error.ts`).
3. A new account needs a password of at least 12 characters, in the form and in Supabase Auth.
   `minimum_password_length` in `supabase/config.toml` sets it for the local stack; the hosted
   project needs the same setting ([new project](../runbooks/new-project.md)).
4. When email confirmation is on, «Create account» answers «Check your email to confirm the
   account, then sign in.» The local stack turns confirmation off, so a new account is signed in
   at once.
5. «Sign out» on `/notes` ends the session and returns to `/login`.
6. A page that needs a user calls `requireUser()`; a signed-out caller goes to `/login`.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| The form | `components/auth/login-form.tsx` | none | `e2e/notes.spec.ts` |
| Sign in, create account, sign out | `app/login/actions.ts` (`authenticate`, `signOut`) | Supabase Auth | `e2e/notes.spec.ts` |
| What a failed sign-in says | `lib/auth/sign-in-error.ts` (`signInErrorMessage`) | none | `tests/unit/sign-in-error.test.ts` |
| The page-level check | `lib/auth/require-user.ts` (`requireUser`) | Supabase Auth | `e2e/notes.spec.ts` |

## Invariants

- Access to data is decided by RLS with the caller's session, not by which pages link where.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| «Create account» answers a rate-limit message, or sign-in answers «Signing in is not possible right now» | Supabase Auth limits sign-ups and sign-ins per hour | `[auth.rate_limit]` in `supabase/config.toml`, and the Auth logs |

## Open questions

- None.

## Decisions

- None yet.
