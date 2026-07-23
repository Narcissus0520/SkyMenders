import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";

const configSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    buildRoot: z.string().min(1),
    sourceFallbackRoot: z.string().min(1),
    subpackages: z.array(
      z
        .object({
          name: z.string().min(1),
          buildDirectory: z.string().min(1),
          sourceDirectory: z.string().min(1),
        })
        .strict(),
    ),
    internalBudgets: z
      .object({
        mainPackageBytes: z.number().int().positive(),
        individualSubpackageBytes: z.number().int().positive(),
        totalPackageBytes: z.number().int().positive(),
      })
      .strict(),
    maximumOfficialEvidenceAgeDays: z.number().int().positive().max(90),
    officialLimitEvidence: z.discriminatedUnion("status", [
      z.object({ status: z.literal("blocked"), blockerId: z.string().min(1) }).strict(),
      z
        .object({
          status: z.literal("verified"),
          verifiedAt: z.iso.date(),
          sourceUrl: z.url(),
          mainPackageBytes: z.number().int().positive(),
          individualSubpackageBytes: z.number().int().positive(),
          totalPackageBytes: z.number().int().positive(),
        })
        .strict(),
    ]),
  })
  .strict();

export interface PackagePartition {
  readonly name: string;
  readonly bytes: number;
}

export interface PackageAuditResult {
  readonly mode: "compiled" | "source-estimate";
  readonly mainPackageBytes: number;
  readonly totalPackageBytes: number;
  readonly subpackages: readonly PackagePartition[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function auditPackage(
  configPath: string,
  repositoryRoot: string,
  releaseMode: boolean,
  referenceDate = new Date(),
): PackageAuditResult {
  let config: z.infer<typeof configSchema>;
  try {
    config = configSchema.parse(JSON.parse(readFileSync(configPath, "utf8")) as unknown);
  } catch (error) {
    return emptyResult([`Invalid package-budget configuration: ${String(error)}`]);
  }

  const buildRoot = safeRepositoryPath(repositoryRoot, config.buildRoot);
  const sourceRoot = safeRepositoryPath(repositoryRoot, config.sourceFallbackRoot);
  if (buildRoot === undefined || sourceRoot === undefined) {
    return emptyResult(["Package input roots must stay inside the repository"]);
  }
  const compiled = existsSync(buildRoot);
  const scanRoot = compiled ? buildRoot : sourceRoot;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(scanRoot))
    return emptyResult([`Package input does not exist: ${relative(repositoryRoot, scanRoot)}`]);
  if (!compiled) {
    const message = "Compiled WeChat package is absent; reporting a source-tree estimate only";
    if (releaseMode) errors.push(message);
    else warnings.push(message);
  }

  const files = walkFiles(scanRoot).map((absolutePath) => ({
    absolutePath,
    relativePath: normalize(relative(scanRoot, absolutePath)),
    bytes: statSync(absolutePath).size,
  }));
  if (compiled) {
    for (const file of files) {
      if ([".ts", ".map"].includes(extname(file.relativePath).toLowerCase())) {
        errors.push(`Compiled package contains a forbidden development file: ${file.relativePath}`);
      }
      if (/(?:^|\/)(?:development|placeholders?)(?:\/|$)/i.test(file.relativePath)) {
        errors.push(`Compiled package contains a placeholder path: ${file.relativePath}`);
      }
    }
  }

  const subpackagePrefixes = config.subpackages.map((subpackage) => {
    const directory = compiled ? subpackage.buildDirectory : subpackage.sourceDirectory;
    if (!isSafeRelativeDirectory(directory)) {
      errors.push(`Unsafe subpackage directory for ${subpackage.name}: ${directory}`);
    }
    const prefix = `${normalize(directory).replace(/\/$/, "")}/`;
    return {
      name: subpackage.name,
      prefix,
      bytes: files
        .filter((file) => file.relativePath.startsWith(prefix))
        .reduce((sum, file) => sum + file.bytes, 0),
    };
  });
  for (const file of files) {
    const owners = subpackagePrefixes.filter((subpackage) =>
      file.relativePath.startsWith(subpackage.prefix),
    );
    if (owners.length > 1) {
      errors.push(
        `Package file belongs to overlapping subpackages ${owners.map((owner) => owner.name).join(", ")}: ${file.relativePath}`,
      );
    }
  }
  const subpackages = subpackagePrefixes.map(({ name, bytes }) => ({ name, bytes }));
  const subpackageBytes = subpackages.reduce((sum, item) => sum + item.bytes, 0);
  const totalPackageBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const mainPackageBytes = totalPackageBytes - subpackageBytes;

  enforceLimits(
    "internal",
    config.internalBudgets,
    mainPackageBytes,
    totalPackageBytes,
    subpackages,
    errors,
  );
  if (config.officialLimitEvidence.status === "verified") {
    const source = new URL(config.officialLimitEvidence.sourceUrl);
    if (source.protocol !== "https:") errors.push("Official package-limit evidence must use HTTPS");
    const verifiedAt = Date.parse(`${config.officialLimitEvidence.verifiedAt}T00:00:00.000Z`);
    const ageDays = (referenceDate.getTime() - verifiedAt) / 86_400_000;
    if (ageDays < 0 || ageDays > config.maximumOfficialEvidenceAgeDays) {
      errors.push(
        `Official package-limit evidence is not current: ${config.officialLimitEvidence.verifiedAt}`,
      );
    }
    enforceLimits(
      "verified official",
      config.officialLimitEvidence,
      mainPackageBytes,
      totalPackageBytes,
      subpackages,
      errors,
    );
  } else {
    const message = `Current official platform package limits lack release evidence (${config.officialLimitEvidence.blockerId})`;
    if (releaseMode) errors.push(message);
    else warnings.push(message);
  }

  return {
    mode: compiled ? "compiled" : "source-estimate",
    mainPackageBytes,
    totalPackageBytes,
    subpackages,
    errors,
    warnings,
  };
}

function enforceLimits(
  label: string,
  limits: {
    mainPackageBytes: number;
    individualSubpackageBytes: number;
    totalPackageBytes: number;
  },
  mainPackageBytes: number,
  totalPackageBytes: number,
  subpackages: readonly PackagePartition[],
  errors: string[],
): void {
  if (mainPackageBytes > limits.mainPackageBytes) {
    errors.push(
      `${label} main-package budget exceeded: ${mainPackageBytes} > ${limits.mainPackageBytes}`,
    );
  }
  if (totalPackageBytes > limits.totalPackageBytes) {
    errors.push(
      `${label} total-package budget exceeded: ${totalPackageBytes} > ${limits.totalPackageBytes}`,
    );
  }
  for (const subpackage of subpackages) {
    if (subpackage.bytes > limits.individualSubpackageBytes) {
      errors.push(
        `${label} subpackage budget exceeded for ${subpackage.name}: ${subpackage.bytes} > ${limits.individualSubpackageBytes}`,
      );
    }
  }
}

function emptyResult(errors: readonly string[]): PackageAuditResult {
  return {
    mode: "source-estimate",
    mainPackageBytes: 0,
    totalPackageBytes: 0,
    subpackages: [],
    errors,
    warnings: [],
  };
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function isSafeRelativeDirectory(path: string): boolean {
  const normalized = normalize(path);
  return (
    !isAbsolute(path) &&
    normalized !== ".." &&
    !normalized.startsWith("../") &&
    !normalized.includes("/../")
  );
}

function safeRepositoryPath(repositoryRoot: string, path: string): string | undefined {
  if (isAbsolute(path)) return undefined;
  const absolutePath = resolve(repositoryRoot, path);
  const relativePath = relative(repositoryRoot, absolutePath);
  return relativePath.startsWith("..") || isAbsolute(relativePath) ? undefined : absolutePath;
}

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .flatMap((path) => (statSync(path).isDirectory() ? walkFiles(path) : [path]));
}
