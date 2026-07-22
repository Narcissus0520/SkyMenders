export const RELEASE_CHANNELS = ["development", "test", "release-candidate", "production"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export interface ProductVersions {
  readonly clientVersion: string;
  readonly contentVersion: string;
  readonly protocolVersion: string;
  readonly replaySchemaVersion: string;
  readonly rulesVersion: string;
  readonly saveSchemaVersion: string;
  readonly serverVersion: string;
}

export const INITIAL_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  clientVersion: "0.0.0",
  contentVersion: "0.0.0",
  protocolVersion: "0.0.0",
  replaySchemaVersion: "0.0.0",
  rulesVersion: "0.0.0",
  saveSchemaVersion: "0.0.0",
  serverVersion: "0.0.0",
});

export const PHASE_1_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  clientVersion: "0.0.0",
  contentVersion: "0.0.0",
  protocolVersion: "0.1.0",
  replaySchemaVersion: "0.1.0",
  rulesVersion: "0.1.0",
  saveSchemaVersion: "0.0.0",
  serverVersion: "0.0.0",
});

export const PHASE_2_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_1_PRODUCT_VERSIONS,
  rulesVersion: "0.2.0",
});

export const PHASE_3_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_2_PRODUCT_VERSIONS,
  protocolVersion: "0.2.0",
  rulesVersion: "0.3.0",
});

export const PHASE_4_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_3_PRODUCT_VERSIONS,
  rulesVersion: "0.4.0",
});

export const PHASE_5_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_4_PRODUCT_VERSIONS,
  clientVersion: "0.1.0",
});

export const PHASE_6_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_5_PRODUCT_VERSIONS,
  clientVersion: "0.2.0",
  contentVersion: "0.1.0",
  rulesVersion: "0.5.0",
});

export const PHASE_7_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_6_PRODUCT_VERSIONS,
  clientVersion: "0.3.0",
  protocolVersion: "0.3.0",
  saveSchemaVersion: "0.1.0",
  serverVersion: "0.1.0",
});

export const PHASE_8_PRODUCT_VERSIONS: ProductVersions = Object.freeze({
  ...PHASE_7_PRODUCT_VERSIONS,
  clientVersion: "0.4.0",
  protocolVersion: "0.4.0",
  replaySchemaVersion: "0.2.0",
  serverVersion: "0.2.0",
});

export const CURRENT_PRODUCT_VERSIONS: ProductVersions = PHASE_8_PRODUCT_VERSIONS;

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isProductVersions(value: unknown): value is ProductVersions {
  if (!isRecord(value)) {
    return false;
  }

  return Object.keys(CURRENT_PRODUCT_VERSIONS).every((key) => {
    const candidate = value[key];
    return typeof candidate === "string" && VERSION_PATTERN.test(candidate);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
