import { verifyDailySubmission } from "@skymenders/challenge-core";
import type { PveContentPack } from "@skymenders/content-schema";
import type { GameRepository, LeaderboardCache } from "@skymenders/game-server";
import { replayVerificationJobSchema, replayVerificationResultSchema } from "@skymenders/protocol";
import type { ReplayVerificationJob, ReplayVerificationResult } from "@skymenders/protocol";

export class ReplayVerificationProcessor {
  public constructor(
    private readonly repository: GameRepository,
    private readonly content: PveContentPack,
    private readonly cache: LeaderboardCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async process(jobInput: ReplayVerificationJob): Promise<ReplayVerificationResult> {
    const job = replayVerificationJobSchema.parse(jobInput);
    const context = await this.repository.getReplayVerificationContext(job.submissionId);
    if (context === null) throw new Error(`Replay submission ${job.submissionId} was not found`);
    if (context.submission.status === "verified" || context.submission.status === "rejected") {
      return replayVerificationResultSchema.parse({
        submissionId: context.submission.id,
        status: context.submission.status,
        score: context.submission.score,
        totalTurns: context.submission.totalTurns,
        rejectionCode: context.submission.rejectionCode,
      });
    }
    const result = verifyDailySubmission(
      this.content,
      context.challenge.definition,
      context.submission.request,
    );
    const completed = await this.repository.completeReplaySubmission(
      context.submission.id,
      result,
      this.now(),
    );
    if (completed === null) throw new Error(`Replay submission ${job.submissionId} disappeared`);
    if (completed.leaderboardChanged) await this.cache.invalidateChallenge(completed.challengeId);
    return result;
  }
}
