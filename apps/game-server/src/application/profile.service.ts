import { Inject, Injectable } from "@nestjs/common";

import {
  accountProgressSaveSchema,
  profileSettingsPatchSchema,
  profileSettingsSchema,
} from "@skymenders/protocol";
import type { AccountProgressSave } from "@skymenders/protocol";

import { GAME_REPOSITORY, SERVER_CLOCK } from "../core/contracts.js";
import type { GameRepository, ServerClock } from "../core/contracts.js";
import { ApiError } from "../http/api-error.js";

@Injectable()
export class ProfileService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  public async get(accountId: string) {
    const [profile, progress] = await Promise.all([
      this.repository.getProfile(accountId),
      this.repository.getProgress(accountId),
    ]);
    if (profile === null || progress === null)
      throw new ApiError(404, "PROFILE_NOT_FOUND", "The account profile does not exist");
    return {
      accountId,
      systemCode: profile.systemCode,
      settings: profile.settings,
      unlockIds: progress.unlockIds,
      achievementIds: progress.achievementIds,
      compendiumEntryIds: progress.compendiumEntryIds,
      completedTutorialIds: progress.completedTutorialIds,
      statistics: progress.statistics,
    };
  }

  public async patchSettings(accountId: string, input: unknown) {
    const patch = profileSettingsPatchSchema.parse(input);
    const profile = await this.repository.getProfile(accountId);
    const progress = await this.repository.getProgress(accountId);
    if (profile === null || progress === null)
      throw new ApiError(404, "PROFILE_NOT_FOUND", "The account profile does not exist");
    const settings = profileSettingsSchema.parse({ ...profile.settings, ...patch });
    const now = this.clock.now();
    const mergedProgress = accountProgressSaveSchema.parse({
      ...progress,
      settings,
      logicalClock: progress.logicalClock + 1,
      updatedAt: now.toISOString(),
    });
    const [updated] = await Promise.all([
      this.repository.updateProfileSettings(accountId, settings),
      this.repository.putProgress(accountId, mergedProgress),
    ]);
    return updated;
  }

  public async getUnlocks(accountId: string): Promise<readonly string[]> {
    return (await this.requireProgress(accountId)).unlockIds;
  }

  public async getAchievements(accountId: string): Promise<readonly string[]> {
    return (await this.requireProgress(accountId)).achievementIds;
  }

  private async requireProgress(accountId: string): Promise<AccountProgressSave> {
    const progress = await this.repository.getProgress(accountId);
    if (progress === null)
      throw new ApiError(404, "PROFILE_NOT_FOUND", "The account profile does not exist");
    return progress;
  }
}
