# PvP Architecture

Status: gated until V1.0 Definition of Done.

PvP will reuse versioned deterministic rules without altering existing PvE replay semantics. WebSocket gateways handle ordered protocol messages while scalable battle workers own authoritative room clocks, command validation, RNG, snapshots, reconnect, and results. Matchmaking and replay verification can scale independently. The client never chooses turn ownership, energy, random state, terrain mutations, or winner.
