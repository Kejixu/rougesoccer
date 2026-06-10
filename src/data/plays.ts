// The active play table — soccer's poker hands. Tinker freely: patterns and
// multipliers here change scoring everywhere (engine, preview, sim) at once.
// Pattern semantics live in src/core/match/plays.ts.

import type { PlayDef } from "../core/types";
import { DEFAULT_PLAYS } from "../core/match/plays";

export const ACTIVE_PLAYS: PlayDef[] = DEFAULT_PLAYS.map((p) => ({ ...p }));
