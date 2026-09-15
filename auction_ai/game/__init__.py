"""Ground-truth game simulator — a faithful Python port of the production
TypeScript possession simulator (lib/arena/simulation.ts + matchup.ts).

This is the AUTHORITATIVE evaluator for training: the real game the user
experiences is decided here, not by the cheap proxy (team_simulator logistic).

SIMULATION_VERSION is bumped whenever the ported logic changes so training runs
can record which simulator produced their results, and so parity/drift checks
can flag a stale port after the TS engine changes.
"""

# Bump this when the ported game logic changes in a way that affects outcomes.
# Keep it aligned with the TS engine via the parity harness (validation/parity).
SIMULATION_VERSION = "gt-1.0.0"
