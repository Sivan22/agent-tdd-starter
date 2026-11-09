/** pnpm qa:host: holds the application open for a QA agent until it is stopped (docs/runbooks/qa.md). */
import { runQaHost } from "./host";

runQaHost().catch((error: unknown) => {
  console.error(`[qa] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
