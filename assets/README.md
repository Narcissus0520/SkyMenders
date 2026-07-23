# Assets

`development/` is reserved for clearly marked development placeholders. `release/` may only contain assets with an approved entry in `provenance/asset-registry.json`.

Every release entry records the source file and location, author, creation and review dates, license evidence, commercial and modification rights, content hash, reference sources, reviewer, placeholder state, and any generative-AI tool/process approval. The audit rejects missing evidence, changed binaries, prohibited licenses, unapproved generated material, competitor terms, and known prohibited fingerprints.

An empty `release/` directory is valid during development. It is not sufficient for a release candidate: `pnpm release:gate` separately requires the final art, font, music, and sound-effect evidence sets.
