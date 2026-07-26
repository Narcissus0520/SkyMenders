import type { ExpeditionSaveDocument } from "@skymenders/protocol/account-save";

import type { NetworkState } from "../platform/platform-adapter";
import type { LocalSaveStore } from "./LocalSaveStore";

export interface SaveSummary {
  readonly saveId: string;
  readonly revision: number;
  readonly logicalClock: number;
  readonly updatedAt: string;
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly summary: ExpeditionSaveDocument["summary"];
}

export interface CloudSaveConflict {
  readonly kind: "conflict";
  readonly local: SaveSummary | null;
  readonly cloud: SaveSummary | null;
}

export interface CloudSaveGateway {
  put(
    baseRevision: number | null,
    document: ExpeditionSaveDocument,
    idempotencyKey: string,
  ): Promise<ExpeditionSaveDocument | CloudSaveConflict>;
  resolve(
    choice: "local" | "cloud",
    expectedCloudRevision: number,
    localDocument: ExpeditionSaveDocument | null,
    idempotencyKey: string,
  ): Promise<ExpeditionSaveDocument>;
}

export type SyncState =
  | { readonly kind: "idle" }
  | { readonly kind: "queued" }
  | { readonly kind: "syncing"; readonly attempt: number }
  | { readonly kind: "synced"; readonly revision: number }
  | { readonly kind: "conflict"; readonly local: SaveSummary | null; readonly cloud: SaveSummary }
  | { readonly kind: "retry_wait"; readonly attempt: number; readonly message: string };

export class CloudSaveCoordinator {
  #state: SyncState = { kind: "idle" };
  #pending: ExpeditionSaveDocument | null = null;
  #baseRevision: number | null = null;
  #attempt = 0;

  public constructor(
    private readonly local: LocalSaveStore,
    private readonly cloud: CloudSaveGateway,
    private readonly delay: (milliseconds: number) => Promise<void> = defaultDelay,
  ) {}

  public state(): SyncState {
    return this.#state;
  }

  public async hydrate(): Promise<ExpeditionSaveDocument | null> {
    const document = await this.local.readExpedition();
    this.#pending = document;
    this.#baseRevision = document?.revision ?? null;
    this.#state = document === null ? { kind: "idle" } : { kind: "queued" };
    return document;
  }

  public async queue(document: ExpeditionSaveDocument): Promise<void> {
    await this.local.writeExpedition(document);
    this.#pending = document;
    this.#state = { kind: "queued" };
  }

  public async flush(network: NetworkState, maximumAttempts = 3): Promise<SyncState> {
    const pending = this.#pending;
    if (pending === null) return this.#state;
    if (!network.connected) {
      this.#state = { kind: "queued" };
      return this.#state;
    }
    while (this.#attempt < maximumAttempts) {
      this.#attempt += 1;
      this.#state = { kind: "syncing", attempt: this.#attempt };
      try {
        const result = await this.cloud.put(this.#baseRevision, pending, idempotencyKey(pending));
        if (isConflict(result)) {
          if (result.cloud === null)
            throw new Error("cloud conflict response has no cloud summary");
          this.#state = { kind: "conflict", local: result.local, cloud: result.cloud };
          return this.#state;
        }
        await this.local.writeExpedition(result);
        this.#pending = null;
        this.#baseRevision = result.revision;
        this.#attempt = 0;
        this.#state = { kind: "synced", revision: result.revision };
        return this.#state;
      } catch (error) {
        const message = error instanceof Error ? error.message : "network request failed";
        this.#state = { kind: "retry_wait", attempt: this.#attempt, message };
        if (this.#attempt >= maximumAttempts) return this.#state;
        await this.delay(Math.min(4_000, 250 * 2 ** (this.#attempt - 1)));
      }
    }
    return this.#state;
  }

  public async resolve(choice: "local" | "cloud"): Promise<ExpeditionSaveDocument> {
    if (this.#state.kind !== "conflict") throw new Error("there is no save conflict to resolve");
    const local = this.#pending;
    const resolved = await this.cloud.resolve(
      choice,
      this.#state.cloud.revision,
      choice === "local" ? local : null,
      `resolve:${this.#state.cloud.saveId}:${this.#state.cloud.revision}:${choice}`,
    );
    await this.local.writeExpedition(resolved);
    this.#baseRevision = resolved.revision;
    this.#pending = null;
    this.#attempt = 0;
    this.#state = { kind: "synced", revision: resolved.revision };
    return resolved;
  }
}

function isConflict(
  result: ExpeditionSaveDocument | CloudSaveConflict,
): result is CloudSaveConflict {
  return "kind" in result;
}

function idempotencyKey(document: ExpeditionSaveDocument): string {
  return `save:${document.saveId}:${document.logicalClock}`;
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
