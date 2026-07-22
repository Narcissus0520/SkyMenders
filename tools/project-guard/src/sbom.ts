import { readFileSync } from "node:fs";

import { parse } from "yaml";

interface LockPackage {
  readonly resolution?: { readonly integrity?: string };
}

interface Lockfile {
  readonly packages?: Readonly<Record<string, LockPackage>>;
}

interface CycloneDxComponent {
  readonly type: "library";
  readonly name: string;
  readonly version: string;
  readonly purl: string;
  readonly hashes?: readonly [{ readonly alg: "SHA-512"; readonly content: string }];
}

export interface CycloneDxBom {
  readonly bomFormat: "CycloneDX";
  readonly specVersion: "1.6";
  readonly version: 1;
  readonly metadata: {
    readonly component: {
      readonly type: "application";
      readonly name: "skymenders";
      readonly version: string;
    };
  };
  readonly components: readonly CycloneDxComponent[];
}

export function createSbom(lockfilePath: string, productVersion: string): CycloneDxBom {
  const lockfile = parse(readFileSync(lockfilePath, "utf8")) as Lockfile;
  const components = Object.entries(lockfile.packages ?? {})
    .map(([key, value]) => toComponent(key, value))
    .sort((left, right) => left.purl.localeCompare(right.purl, "en"));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: { type: "application", name: "skymenders", version: productVersion },
    },
    components,
  };
}

function toComponent(key: string, value: LockPackage): CycloneDxComponent {
  const separator = key.lastIndexOf("@");
  if (separator <= 0 || separator === key.length - 1) {
    throw new Error(`Unsupported pnpm package key: ${key}`);
  }

  const name = key.slice(0, separator);
  const version = key.slice(separator + 1);
  const integrity = value.resolution?.integrity;
  const hash = integrity?.startsWith("sha512-")
    ? Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex")
    : undefined;

  return {
    type: "library",
    name,
    version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    ...(hash === undefined ? {} : { hashes: [{ alg: "SHA-512", content: hash }] }),
  };
}
