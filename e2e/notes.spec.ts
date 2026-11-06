/**
 * The notes flow in a real browser against the local stack. Each test creates and removes its
 * own users, so the spec needs no seed and leaves the database as it found it.
 */
import { expect, test } from "@playwright/test";
import { createTestUser, deleteTestUsers, userIdByEmail, type TestUser } from "../tests/helpers";

test("a signed-out visitor is sent to the login page", async ({ page }) => {
  await page.goto("/notes");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test.describe("a signed-in user", () => {
  let user: TestUser | undefined;
  let other: TestUser | undefined;

  test.beforeEach(async () => {
    user = await createTestUser("e2e");
    other = await createTestUser("e2e-other");
    const { error } = await other.client.from("notes").insert({ title: "Someone else's note" });
    if (error) throw error;
  });

  test.afterEach(async () => {
    await deleteTestUsers([user, other]);
  });

  test("writes a note, keeps it across a reload, and deletes it", async ({ page }) => {
    if (!user) throw new Error("fixture missing");
    await page.goto("/login");
    const login = page.getByRole("form", { name: "Sign in" });
    await login.getByLabel("Email").fill(user.email);
    await login.getByLabel("Password").fill("not-the-password");
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(login.getByRole("alert")).toHaveText("Wrong email or password.");

    await login.getByLabel("Password").fill(user.password);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
    await expect(page.getByText("No notes yet.")).toBeVisible();

    // A title of spaces passes the browser's `required` check; the server refuses it.
    const form = page.getByRole("form", { name: "New note" });
    const title = form.getByLabel("Title", { exact: true });
    const body = form.getByLabel("Note", { exact: true });
    await title.fill("   ");
    await form.getByRole("button", { name: "Add note" }).click();
    await expect(form.getByRole("alert")).toHaveText("Give the note a title.");

    await title.fill("Groceries");
    await body.fill("milk\neggs");
    await form.getByRole("button", { name: "Add note" }).click();
    const notes = page.getByRole("list", { name: "Notes" });
    await expect(notes.getByRole("heading", { name: "Groceries" })).toBeVisible();
    await expect(title).toHaveValue("");
    await expect(form.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expect(notes.getByRole("heading", { name: "Groceries" })).toBeVisible();
    await expect(page.getByText("milk")).toBeVisible();
    await expect(page.getByText("Someone else's note")).toHaveCount(0);
    await page.screenshot({ path: "e2e/.artifacts/notes.png", fullPage: true });

    await page.getByRole("button", { name: "Delete note: Groceries" }).click();
    await expect(page.getByText("No notes yet.")).toBeVisible();
  });
});

test("a new visitor creates an account and lands on their notes", async ({ page }) => {
  const email = `e2e-signup-${crypto.randomUUID()}@test.local`;
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    const id = await userIdByEmail(email);
    if (id) await deleteTestUsers([{ id }]);
  }
});
