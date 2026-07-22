import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

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
