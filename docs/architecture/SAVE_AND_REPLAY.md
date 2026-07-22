# Save and Replay Architecture

Status: planned for Phase 1 and Phase 7.

Replays carry rule/content versions, initial seed, ordered commands, checkpoints, and final summary. Saves independently version account progress, expedition state, and turn-start recovery snapshots. Migrations must preserve explicit RNG state and hashes. Corrupt or incompatible recovery data falls back safely to the node start without silently deleting the expedition.
