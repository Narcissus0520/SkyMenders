import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcessCommand } from "./process-runner.js";

export interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
) => CommandResult;

export interface RestoreDrillResult {
  readonly sourceTables: readonly string[];
  readonly restoredTables: readonly string[];
  readonly commandsRun: number;
}

const tableQuery =
  "SELECT schemaname || '.' || tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename";

export function validateRestoreTarget(sourceUrl: string, restoreUrl: string): void {
  const source = parsePostgresUrl(sourceUrl, "source");
  const restore = parsePostgresUrl(restoreUrl, "restore");
  if (source.identity === restore.identity)
    throw new Error("restore database must differ from source database");
  if (!restore.database.endsWith("_restore_drill")) {
    throw new Error("restore database name must end with _restore_drill");
  }
}

export function runRestoreDrill(
  sourceUrl: string,
  restoreUrl: string,
  runner: CommandRunner = runProcessCommand,
): RestoreDrillResult {
  validateRestoreTarget(sourceUrl, restoreUrl);
  const source = parsePostgresUrl(sourceUrl, "source");
  const restore = parsePostgresUrl(restoreUrl, "restore");
  const workingDirectory = mkdtempSync(join(tmpdir(), "skymenders-restore-drill-"));
  const archivePath = join(workingDirectory, "database.dump");
  let commandsRun = 0;
  const execute = (command: string, args: readonly string[], password: string): CommandResult => {
    commandsRun += 1;
    const result = runner(command, args, password === "" ? {} : { PGPASSWORD: password });
    if (result.status !== 0)
      throw new Error(`${command} failed: ${result.stderr.trim() || "unknown error"}`);
    return result;
  };

  const adminUrl = new URL(restore.safeUrl);
  adminUrl.pathname = "/postgres";
  let result: Omit<RestoreDrillResult, "commandsRun"> | undefined;
  let primaryError: unknown;
  try {
    execute(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", archivePath, source.safeUrl],
      source.password,
    );
    execute(
      "dropdb",
      ["--if-exists", "--force", "--maintenance-db", adminUrl.toString(), restore.database],
      restore.password,
    );
    execute(
      "createdb",
      ["--maintenance-db", adminUrl.toString(), restore.database],
      restore.password,
    );
    execute(
      "pg_restore",
      [
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        restore.safeUrl,
        archivePath,
      ],
      restore.password,
    );
    const sourceTables = parseTableList(
      execute(
        "psql",
        ["--dbname", source.safeUrl, "--tuples-only", "--no-align", "--command", tableQuery],
        source.password,
      ).stdout,
    );
    const restoredTables = parseTableList(
      execute(
        "psql",
        ["--dbname", restore.safeUrl, "--tuples-only", "--no-align", "--command", tableQuery],
        restore.password,
      ).stdout,
    );
    if (sourceTables.length === 0)
      throw new Error("source database has no public tables to verify");
    if (sourceTables.join("\n") !== restoredTables.join("\n")) {
      throw new Error("restored public table inventory does not match the source");
    }
    result = { sourceTables, restoredTables };
  } catch (error) {
    primaryError = error;
  }
  try {
    execute(
      "dropdb",
      ["--if-exists", "--force", "--maintenance-db", adminUrl.toString(), restore.database],
      restore.password,
    );
  } catch (error) {
    primaryError ??= error;
  } finally {
    rmSync(workingDirectory, { force: true, recursive: true });
  }
  if (primaryError !== undefined) {
    throw primaryError instanceof Error
      ? primaryError
      : new Error("restore drill failed with a non-error value");
  }
  if (result === undefined) throw new Error("restore drill finished without a verification result");
  return { ...result, commandsRun };
}

function parsePostgresUrl(
  value: string,
  label: string,
): {
  database: string;
  identity: string;
  password: string;
  safeUrl: string;
} {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} database URL is invalid`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${label} database URL must use PostgreSQL`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (database.length === 0 || database.includes("/"))
    throw new Error(`${label} database name is invalid`);
  const password = decodeURIComponent(url.password);
  url.password = "";
  const identity = `${url.hostname.toLowerCase()}:${url.port || "5432"}/${database}`;
  return { database, identity, password, safeUrl: url.toString() };
}

function parseTableList(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
}
