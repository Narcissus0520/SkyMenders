import { runRestoreDrill } from "./restore-drill.js";

const sourceUrl = process.env.DATABASE_URL;
const restoreUrl = process.env.RESTORE_DATABASE_URL;
if (sourceUrl === undefined || restoreUrl === undefined) {
  process.stderr.write("DATABASE_URL and RESTORE_DATABASE_URL are required\n");
  process.exitCode = 1;
} else {
  try {
    const result = runRestoreDrill(sourceUrl, restoreUrl);
    process.stdout.write(
      `backup restore drill: passed (${result.sourceTables.length} public tables, ${result.commandsRun} commands)\n`,
    );
  } catch (error) {
    process.stderr.write(`backup restore drill failed: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
