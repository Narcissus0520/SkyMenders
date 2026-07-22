import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  bossCatalogSchema,
  enemyCatalogSchema,
  eventCatalogSchema,
  localizationCatalogSchema,
  mapCatalogSchema,
  moduleCatalogSchema,
  objectiveCatalogSchema,
  progressionCatalogSchema,
  regionCatalogSchema,
  robotCatalogSchema,
  routeCatalogSchema,
  tutorialCatalogSchema,
} from "@skymenders/content-schema";
import type { PveContentPack } from "@skymenders/content-schema";

export function loadChallengeContent(contentRoot = resolveChallengeContentRoot()): PveContentPack {
  const read = (relativePath: string): unknown =>
    JSON.parse(readFileSync(resolve(contentRoot, relativePath), "utf8")) as unknown;
  return {
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
}

function resolveChallengeContentRoot(): string {
  const candidates = [resolve(process.cwd(), "content"), resolve(process.cwd(), "../../content")];
  const contentRoot = candidates.find((candidate) =>
    existsSync(resolve(candidate, "manifests/content-manifest.json")),
  );
  if (contentRoot === undefined)
    throw new Error("content root was not found; run from the workspace root or an app package");
  return contentRoot;
}
