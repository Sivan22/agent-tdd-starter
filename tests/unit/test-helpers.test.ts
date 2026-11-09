import { beforeEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ attempted: [] as string[], refused: "", signInError: null as Error | null }));

vi.mock("dotenv/config", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "just-made" } }, error: null }),
        deleteUser: async (id: string) => {
          calls.attempted.push(id);
          return { error: id === calls.refused ? new Error(`refused ${id}`) : null };
        },
      },
      signInWithPassword: async () => ({ error: calls.signInError }),
    },
  }),
}));

beforeEach(() => {
  calls.attempted = [];
  calls.refused = "";
  calls.signInError = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
});

it("removes the user it just made when the sign-in fails, so no account is orphaned", async () => {
  const { createTestUser } = await import("../helpers");
  calls.signInError = new Error("too many sign-ins");
  await expect(createTestUser("qa")).rejects.toThrow("too many sign-ins");
  expect(calls.attempted).toEqual(["just-made"]);
});

it("tries every user before it reports a removal that failed", async () => {
  const { deleteTestUsers } = await import("../helpers");
  calls.refused = "first";
  await expect(deleteTestUsers([{ id: "first" }, undefined, { id: "second" }])).rejects.toThrow("refused first");
  expect(calls.attempted).toEqual(["first", "second"]);
});
