import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";
import { baseUrlFor, devServerCommand, e2ePort } from "./e2e/dev-server";

const PORT = e2ePort();
const baseURL = baseUrlFor(PORT);

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never", outputFolder: path.join(__dirname, "playwright-report") }], ["list"]] : "list",
  timeout: 60_000,
  // The dev server compiles a route on its first visit; give assertions room for that.
  expect: { timeout: 15_000 },
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: devServerCommand(PORT),
    cwd: __dirname,
    url: baseURL,
    // Never test a server this run did not start: it may be another checkout's code.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
