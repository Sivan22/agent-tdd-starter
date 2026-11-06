/**
 * Who may do what to `public.notes`, asked of the database directly. The page never shows
 * another user's notes, but these cases prove the database refuses even when the UI is skipped.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createTestUser, deleteTestUsers, type TestUser } from "@/tests/helpers";

let alice: TestUser | undefined;
let bob: TestUser | undefined;
let noteId = "";

const users = () => {
  if (!alice || !bob) throw new Error("fixtures were not created");
  return { alice, bob };
};

const stillThere = async (id: string) => {
  const { data, error } = await admin.from("notes").select("id").eq("id", id);
  if (error) throw error;
  return data.length === 1;
};

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
  const { data, error } = await alice.client.from("notes").insert({ title: "Alice's note", body: "private" }).select("id, owner_id").single();
  if (error) throw error;
  expect(data.owner_id).toBe(alice.id);
  noteId = data.id;
});

afterAll(async () => {
  await deleteTestUsers([alice, bob]);
});

describe("notes RLS", () => {
  it("lets the owner read her note", async () => {
    const { data, error } = await users().alice.client.from("notes").select("id, title").eq("id", noteId);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: noteId, title: "Alice's note" }]);
  });

  it("shows another user nothing", async () => {
    const { data, error } = await users().bob.client.from("notes").select("id").eq("id", noteId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses a signed-out caller outright", async () => {
    const { data, error } = await anonClient().from("notes").select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("refuses a note written in someone else's name", async () => {
    const { alice: a, bob: b } = users();
    const { error } = await b.client.from("notes").insert({ owner_id: a.id, title: "Forged" });
    expect(error?.code).toBe("42501");
  });

  it("lets nobody but the owner delete a note", async () => {
    const { error } = await users().bob.client.from("notes").delete().eq("id", noteId);
    expect(error).toBeNull();
    expect(await stillThere(noteId)).toBe(true);
  });

  it("refuses an edit, because notes are never edited", async () => {
    const { error } = await users().alice.client.from("notes").update({ title: "Changed" }).eq("id", noteId);
    expect(error?.code).toBe("42501");
  });

  it("refuses an edit from the secret-key role too, because no role holds UPDATE", async () => {
    const { error } = await admin.from("notes").update({ title: "Changed" }).eq("id", noteId);
    expect(error?.code).toBe("42501");
  });

  it("refuses a blank or padded title even without the form", async () => {
    for (const title of ["   ", " padded", "t".repeat(121)]) {
      const { error } = await users().alice.client.from("notes").insert({ title });
      expect(error?.code, JSON.stringify(title)).toBe("23514");
    }
  });

  it("refuses a padded or over-long body even without the form", async () => {
    for (const body of [" padded", "padded\n", "b".repeat(10_001)]) {
      const { error } = await users().alice.client.from("notes").insert({ title: "Body check", body });
      expect(error?.code, JSON.stringify(body.slice(0, 12))).toBe("23514");
    }
  });

  it("lets the owner delete her note", async () => {
    const { error } = await users().alice.client.from("notes").delete().eq("id", noteId);
    expect(error).toBeNull();
    expect(await stillThere(noteId)).toBe(false);
  });
});
