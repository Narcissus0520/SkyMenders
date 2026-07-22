import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import {
  bossCatalogSchema,
  enemyCatalogSchema,
  eventCatalogSchema,
  formatZodIssues,
  localizationCatalogSchema,
  mapCatalogSchema,
  moduleCatalogSchema,
  objectiveCatalogSchema,
  progressionCatalogSchema,
  regionCatalogSchema,
  robotCatalogSchema,
  routeCatalogSchema,
  tutorialCatalogSchema,
  validateContentPack,
} from "@skymenders/content-schema";
import type { ContentIssue, ContentPackReport, PveContentPack } from "@skymenders/content-schema";
import { validateAuthoredMaps } from "@skymenders/content-runtime";
import { BOSS_IDS, ENEMY_PROTOTYPE_IDS } from "@skymenders/ai-core";
import { MODULE_DEFINITIONS, MODULE_IDS, MODULE_UPGRADE_ROUTE_IDS } from "@skymenders/battle-core";

const manifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    contentVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    defaultLocale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/),
    locales: z.array(z.string().regex(/^[a-z]{2}-[A-Z]{2}$/)).min(1),
    contentRoots: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)),
  })
  .strict();

export interface ValidationResult {
  readonly errors: readonly string[];
  readonly manifest?: z.infer<typeof manifestSchema>;
}

export interface ContentDirectoryValidation {
  readonly pack?: PveContentPack;
  readonly report: ContentPackReport;
}

export function validateManifest(manifestPath: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error) {
    return { errors: [`Unable to parse ${manifestPath}: ${String(error)}`] };
  }

  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`,
      ),
    };
  }

  const contentDirectory = dirname(dirname(manifestPath));
  const errors = parsed.data.contentRoots
    .filter((root) => !existsSync(join(contentDirectory, root)))
    .map((root) => `Declared content root does not exist: ${root}`);

  if (!parsed.data.locales.includes(parsed.data.defaultLocale)) {
    errors.push("defaultLocale must be present in locales");
  }

  return { errors, manifest: parsed.data };
}

export function validateContentDirectory(contentDirectory: string): ContentDirectoryValidation {
  const issues: ContentIssue[] = [];
  const read = (relativePath: string): unknown => {
    const path = join(contentDirectory, relativePath);
    try {
      return JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch (error) {
      issues.push({ code: "CONTENT_FILE_INVALID", path: relativePath, message: String(error) });
      return undefined;
    }
  };
  try {
    const pack: PveContentPack = {
      robots: robotCatalogSchema.parse(read("robots/catalog.json")),
      modules: moduleCatalogSchema.parse(read("modules/catalog.json")),
      enemies: enemyCatalogSchema.parse(read("enemies/catalog.json")),
      bosses: bossCatalogSchema.parse(read("bosses/catalog.json")),
      objectives: objectiveCatalogSchema.parse(read("objectives/catalog.json")),
      maps: mapCatalogSchema.parse(read("maps/catalog.json")),
      regions: regionCatalogSchema.parse(read("regions/catalog.json")),
      events: eventCatalogSchema.parse(read("events/catalog.json")),
      routes: routeCatalogSchema.parse(read("routes/catalog.json")),
      tutorials: tutorialCatalogSchema.parse(read("tutorials/catalog.json")),
      progression: progressionCatalogSchema.parse(read("progression/catalog.json")),
      localization: localizationCatalogSchema.parse(read("localization/zh-CN.json")),
    };
    const report = validateContentPack(pack);
    validateAuthoredMaps(pack).forEach((mapReport) => {
      mapReport.issues
        .filter((issue) => issue.severity === "error")
        .forEach((issue) =>
          issues.push({
            code: `TERRAIN_${issue.code}`,
            path: `maps.${mapReport.mapId}.${issue.path}`,
            message: issue.message,
          }),
        );
    });
    validateCodeCatalogAlignment(pack).forEach((issue) => issues.push(issue));
    return { pack, report: mergeReports(issues, report) };
  } catch (error) {
    if (error instanceof z.ZodError) issues.push(...formatZodIssues(error));
    else
      issues.push({ code: "CONTENT_VALIDATION_FAILED", path: "content", message: String(error) });
    return { report: { valid: false, issues, counts: {} } };
  }
}

export function validateCodeCatalogAlignment(pack: PveContentPack): readonly ContentIssue[] {
  const issues: ContentIssue[] = [];
  compareIds(
    issues,
    "modules",
    pack.modules.modules.map((entry) => entry.id),
    MODULE_IDS,
  );
  compareIds(
    issues,
    "enemies",
    pack.enemies.enemies.map((entry) => entry.id),
    ENEMY_PROTOTYPE_IDS,
  );
  compareIds(
    issues,
    "bosses",
    pack.bosses.bosses.map((entry) => entry.id),
    BOSS_IDS,
  );
  const authoredRoutes = pack.modules.modules.flatMap((entry) =>
    entry.routes.map((route) => route.id),
  );
  compareIds(issues, "moduleRoutes", authoredRoutes, MODULE_UPGRADE_ROUTE_IDS);
  pack.modules.modules.forEach((entry, index) => {
    const authority = MODULE_DEFINITIONS[entry.id];
    if (authority.moduleClass !== entry.class) {
      issues.push({
        code: "MODULE_CLASS_MISMATCH",
        path: `modules[${index}].class`,
        message: entry.id,
      });
    }
    compareIds(
      issues,
      `modules[${index}].routes`,
      entry.routes.map((route) => route.id),
      authority.routes.map((route) => route.id),
    );
  });
  return issues;
}

function compareIds(
  issues: ContentIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  expected.forEach((value) => {
    if (!actualSet.has(value))
      issues.push({ code: "CODE_CATALOG_ID_MISSING", path, message: value });
  });
  actual.forEach((value) => {
    if (!expectedSet.has(value))
      issues.push({ code: "CODE_CATALOG_ID_UNKNOWN", path, message: value });
  });
}

function mergeReports(
  prefix: readonly ContentIssue[],
  report: ContentPackReport,
): ContentPackReport {
  const issues = [...prefix, ...report.issues];
  return { ...report, valid: issues.length === 0, issues };
}
