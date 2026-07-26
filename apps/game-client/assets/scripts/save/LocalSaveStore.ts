import { hashUtf8 } from "@skymenders/deterministic-runtime";
import type { AccountProgressSave, ExpeditionSaveDocument } from "@skymenders/protocol";
import { accountProgressSaveSchema } from "@skymenders/protocol";
import { migrateExpeditionSave, verifyExpeditionSave } from "@skymenders/save-migration/runtime";

import type { PlatformAdapter } from "../platform/platform-adapter";

const SLOT_A = "skymenders.save.expedition.a.v1";
const SLOT_B = "skymenders.save.expedition.b.v1";
const ACTIVE_SLOT = "skymenders.save.expedition.active.v1";
const PROGRESS = "skymenders.save.progress.v1";

interface StoredEnvelope {
  readonly checksum: string;
  readonly payload: unknown;
}

export class LocalSaveStore {
  public constructor(private readonly platform: PlatformAdapter) {}

  public async readExpedition(): Promise<ExpeditionSaveDocument | null> {
    const active = await this.platform.readStorage(ACTIVE_SLOT);
    const order = active === "b" ? ([SLOT_B, SLOT_A] as const) : ([SLOT_A, SLOT_B] as const);
    for (const key of order) {
      const recovered = await this.readEnvelope(key, migrateExpeditionSave);
      if (recovered !== null) return recovered;
    }
    return null;
  }

  public async writeExpedition(document: ExpeditionSaveDocument): Promise<void> {
    const verified = verifyExpeditionSave(document);
    const active = await this.platform.readStorage(ACTIVE_SLOT);
    const next = active === "a" ? "b" : "a";
    await this.writeEnvelope(next === "a" ? SLOT_A : SLOT_B, verified);
    await this.platform.writeStorage(ACTIVE_SLOT, next);
  }

  public async readProgress(): Promise<AccountProgressSave | null> {
    return this.readEnvelope(PROGRESS, (value) => accountProgressSaveSchema.parse(value));
  }

  public async writeProgress(progress: AccountProgressSave): Promise<void> {
    await this.writeEnvelope(PROGRESS, accountProgressSaveSchema.parse(progress));
  }

  private async readEnvelope<T>(key: string, parse: (value: unknown) => T): Promise<T | null> {
    const raw = await this.platform.readStorage(key);
    if (raw === null) return null;
    try {
      const envelope = JSON.parse(raw) as StoredEnvelope;
      const serialized = JSON.stringify(envelope.payload);
      if (checksum(serialized) !== envelope.checksum) return null;
      return parse(envelope.payload);
    } catch {
      return null;
    }
  }

  private async writeEnvelope(key: string, payload: unknown): Promise<void> {
    const serialized = JSON.stringify(payload);
    const envelope: StoredEnvelope = { checksum: checksum(serialized), payload };
    await this.platform.writeStorage(key, JSON.stringify(envelope));
  }
}

function checksum(value: string): string {
  return hashUtf8(value);
}
