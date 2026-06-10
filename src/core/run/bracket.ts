// Knockout opponent draws. MVP simplification: the wider bracket isn't fully
// simulated — opponents are drawn from the unused team pool with harder tiers
// reserved for later stages, and the FINAL always serves the strongest
// remaining team as the boss.

import { nextFloat } from "../rng";
import type { RunState, Stage, TeamDef } from "../types";

const STAGE_TIER_PREFS: Record<Exclude<Stage, "GROUP">, number[]> = {
  R32: [4, 3],
  R16: [3, 2],
  QF: [2, 1],
  SF: [1, 2],
  FINAL: [1],
};

export function drawKnockoutOpponent(
  draft: RunState,
  teams: TeamDef[],
  stage: Exclude<Stage, "GROUP">,
): string {
  const available = teams.filter(
    (t) => t.id !== draft.playerTeamId && !draft.usedTeamIds.includes(t.id),
  );
  if (available.length === 0) throw new Error("no teams left to draw");

  if (stage === "FINAL") {
    // boss: strongest remaining team
    const boss = [...available].sort((a, b) => b.attackRating - a.attackRating)[0]!;
    return boss.id;
  }

  let candidates: TeamDef[] = [];
  for (const tier of STAGE_TIER_PREFS[stage]) {
    candidates = available.filter((t) => t.tier === tier);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) candidates = available;

  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return candidates[Math.floor(v * candidates.length)]!.id;
}
