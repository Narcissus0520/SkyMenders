import { describe, expect, it } from "vitest";

import {
  runRestoreDrill,
  validateRestoreTarget,
  type CommandRunner,
} from "../src/restore-drill.js";

const source = "postgresql://user:source-secret@127.0.0.1:5432/skymenders";
const restore = "postgresql://user:restore-secret@127.0.0.1:5432/skymenders_restore_drill";

describe("database restore drill", () => {
  it("rejects unsafe database URLs and restore targets", () => {
    expect(() => {
      validateRestoreTarget("not-a-url", restore);
    }).toThrow("source database URL is invalid");
    expect(() => {
      validateRestoreTarget("https://example.com/db", restore);
    }).toThrow("source database URL must use PostgreSQL");
    expect(() => {
      validateRestoreTarget("postgresql://host", restore);
    }).toThrow("source database name is invalid");
    expect(() => {
      validateRestoreTarget("postgresql://host/one/two", restore);
    }).toThrow("source database name is invalid");
    expect(() => {
      validateRestoreTarget(source, "https://example.com/skymenders_restore_drill");
    }).toThrow("restore database URL must use PostgreSQL");
    expect(() => {
      validateRestoreTarget(source, source);
    }).toThrow("restore database must differ");
    expect(() => {
      validateRestoreTarget(
        "postgresql://source-user@127.0.0.1:5432/shared_restore_drill",
        "postgresql://restore-user@127.0.0.1:5432/shared_restore_drill",
      );
    }).toThrow("restore database must differ");
    expect(() => {
      validateRestoreTarget(source, "postgresql://host/production");
    }).toThrow("restore database name must end with _restore_drill");
  });

  it("runs a password-safe dump, isolated restore, verification and cleanup", () => {
    const calls: { command: string; args: readonly string[]; password: string | undefined }[] = [];
    const runner: CommandRunner = (command, args, environment) => {
      calls.push({ command, args, password: environment.PGPASSWORD });
      return {
        status: 0,
        stdout: command === "psql" ? "public.accounts\npublic.saves\n" : "",
        stderr: "",
      };
    };
    const result = runRestoreDrill(source, restore, runner);

    expect(result.sourceTables).toEqual(["public.accounts", "public.saves"]);
    expect(result.commandsRun).toBe(7);
    expect(calls.at(-1)?.command).toBe("dropdb");
    expect(JSON.stringify(calls.map(({ command, args }) => ({ command, args })))).not.toContain(
      "source-secret",
    );
    expect(JSON.stringify(calls.map(({ command, args }) => ({ command, args })))).not.toContain(
      "restore-secret",
    );
    expect(calls[0]?.password).toBe("source-secret");
  });

  it("cleans up the restore database after command or verification failure", () => {
    const calls: string[] = [];
    const runner: CommandRunner = (command) => {
      calls.push(command);
      if (command === "pg_restore") return { status: 2, stdout: "", stderr: "corrupt archive" };
      return { status: 0, stdout: "", stderr: "" };
    };
    expect(() => runRestoreDrill(source, restore, runner)).toThrow(
      "pg_restore failed: corrupt archive",
    );
    expect(calls.at(-1)).toBe("dropdb");

    const noMessageRunner: CommandRunner = () => ({ status: 1, stdout: "", stderr: "" });
    expect(() => runRestoreDrill(source, restore, noMessageRunner)).toThrow(
      "pg_dump failed: unknown error",
    );
  });

  it("rejects empty or different restored table inventories", () => {
    let query = 0;
    const emptyRunner: CommandRunner = (command) => ({
      status: 0,
      stdout: command === "psql" ? "" : "",
      stderr: "",
    });
    expect(() => runRestoreDrill(source, restore, emptyRunner)).toThrow(
      "source database has no public tables",
    );
    const mismatchRunner: CommandRunner = (command) => ({
      status: 0,
      stdout: command === "psql" ? (query++ === 0 ? "public.accounts\n" : "public.other\n") : "",
      stderr: "",
    });
    expect(() => runRestoreDrill(source, restore, mismatchRunner)).toThrow("does not match");

    const noPasswordSource = "postgresql://user@127.0.0.1:5432/skymenders";
    const noPasswordRestore = "postgresql://user@127.0.0.1:5432/skymenders_restore_drill";
    const environments: Readonly<Record<string, string>>[] = [];
    const noPasswordRunner: CommandRunner = (command, _args, environment) => {
      environments.push(environment);
      return { status: 0, stdout: command === "psql" ? "public.accounts\n" : "", stderr: "" };
    };
    runRestoreDrill(noPasswordSource, noPasswordRestore, noPasswordRunner);
    expect(environments.every((environment) => Object.keys(environment).length === 0)).toBe(true);
  });
});
