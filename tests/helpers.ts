/**
 * Clients and fixtures for tests that reach the local Supabase stack. Importing this file loads
 * `.env` and refuses any Supabase URL that is not on this machine, so a suite can never write
 * to a shared or production project.
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { present } from "@/lib/env";

const url = present("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
const publishableKey = present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const secretKey = present("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);

if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)) {
  throw new Error(`Tests run only against a local Supabase stack, not ${url}`);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** The secret-key client: bypasses RLS. Use it to build fixtures and to read back what really happened. */
export const admin: SupabaseClient<Database> = createClient<Database>(url, secretKey, noSession);

/** A signed-out caller. */
export const anonClient = (): SupabaseClient<Database> => createClient<Database>(url, publishableKey, noSession);

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient<Database> };

/** A fresh confirmed user, signed in through the real Auth API. Remove it with `deleteTestUsers`. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@test.local`;
  const password = `pw-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw signedIn.error;
  }
  return { id: created.data.user.id, email, password, client };
}

/** Deleting a user cascades to the rows it owns. Tries every user, then reports the first failure. */
export async function deleteTestUsers(users: readonly ({ id: string } | undefined)[]): Promise<void> {
  let failure: Error | undefined;
  for (const user of users) {
    if (!user) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    failure ??= error ?? undefined;
  }
  if (failure) throw failure;
}

/** The id of the account an e2e spec created through the UI, so the spec can remove it. */
export async function userIdByEmail(email: string): Promise<string | undefined> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id;
}
