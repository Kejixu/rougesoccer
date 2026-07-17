// Group-stage support: simulated AI-vs-AI fixtures, table updates, standings.

import { nextFloat, type RngState } from "../rng";
import type { FixtureResult, GroupRow, RunState, TeamDef, ThirdsVerdict } from "../types";

function rand(draft: { rng: RngState }): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

export function emptyRow(teamId: string): GroupRow {
  return { teamId, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
}

export function recordResult(
  table: GroupRow[],
  teamId: string,
  goalsFor: number,
  goalsAgainst: number,
): void {
  const row = table.find((r) => r.teamId === teamId);
  if (!row) throw new Error(`no group row for ${teamId}`);
  row.gf += goalsFor;
  row.ga += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.w += 1;
    row.pts += 3;
  } else if (goalsFor === goalsAgainst) {
    row.d += 1;
    row.pts += 1;
  } else {
    row.l += 1;
  }
}

/** Simulate an AI-vs-AI fixture: logistic win probability on the rating gap
 * (divided by 6), a flat 25% draw band, rating-scaled scorelines. */
export function simulateFixture(
  draft: { rng: RngState },
  home: TeamDef,
  away: TeamDef,
): { homeGoals: number; awayGoals: number } {
  const pHome = 1 / (1 + Math.exp(-(home.attackRating - away.attackRating) / 6));
  const roll = rand(draft);
  const DRAW_BAND = 0.25;

  const goalsFor = (team: TeamDef): number => {
    // 1..3-ish goals, better teams skew higher
    const r = rand(draft);
    const lift = team.attackRating / 40;
    return 1 + Math.floor(r * (1.2 + lift) + lift * 0.5);
  };

  if (roll < DRAW_BAND) {
    const g = Math.floor(rand(draft) * 3); // 0-0, 1-1, 2-2
    return { homeGoals: g, awayGoals: g };
  }
  const homeWins = roll - DRAW_BAND < pHome * (1 - DRAW_BAND);
  const winner = homeWins ? home : away;
  const winGoals = goalsFor(winner);
  const loseGoals = Math.max(0, winGoals - 1 - Math.floor(rand(draft) * 2));
  return homeWins
    ? { homeGoals: winGoals, awayGoals: loseGoals }
    : { homeGoals: loseGoals, awayGoals: winGoals };
}

/** Play the matchday fixture between the two AI teams the player isn't facing. */
export function simulateOtherFixture(
  draft: RunState,
  teams: TeamDef[],
  matchday: number,
): FixtureResult {
  const playerOpp = draft.groupOpponentOrder[matchday - 1];
  const others = draft.groupTeamIds.filter((id) => id !== playerOpp);
  if (others.length !== 2) throw new Error("group must have exactly 2 other teams per matchday");
  const home = teams.find((t) => t.id === others[0])!;
  const away = teams.find((t) => t.id === others[1])!;
  const { homeGoals, awayGoals } = simulateFixture(draft, home, away);
  recordResult(draft.groupTable, home.id, homeGoals, awayGoals);
  recordResult(draft.groupTable, away.id, awayGoals, homeGoals);
  const fixture: FixtureResult = { matchday, homeId: home.id, awayId: away.id, homeGoals, awayGoals };
  draft.groupFixtures.push(fixture);
  return fixture;
}

/** Standings: pts -> goal difference -> goals for -> seeded tiebreak. */
export function standings(table: GroupRow[], tiebreak: Record<string, number>): GroupRow[] {
  return [...table].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return (tiebreak[b.teamId] ?? 0) - (tiebreak[a.teamId] ?? 0);
  });
}

export function playerGroupRank(state: RunState): number {
  const sorted = standings(state.groupTable, state.tiebreak);
  return sorted.findIndex((r) => r.teamId === state.playerTeamId) + 1;
}

/** Compare the player's third-place record with 11 seeded synthetic groups.
 * Points use a plausible weighted spread; GD and the final tie are also seeded. */
export function simulateThirdsVerdict(draft: RunState): ThirdsVerdict {
  const player = draft.groupTable.find((row) => row.teamId === draft.playerTeamId);
  if (!player) throw new Error("player is missing from the group table");

  const pointSpread = [2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6] as const;
  const comparison: Array<{
    points: number;
    gd: number;
    tiebreak: number;
    player: boolean;
  }> = Array.from({ length: 11 }, () => ({
    points: pointSpread[Math.floor(rand(draft) * pointSpread.length)]!,
    gd: Math.floor(rand(draft) * 6) - 3,
    tiebreak: rand(draft),
    player: false,
  }));
  comparison.push({
    points: player.pts,
    gd: player.gf - player.ga,
    tiebreak: rand(draft),
    player: true,
  });
  comparison.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.tiebreak - a.tiebreak,
  );
  const rank = comparison.findIndex((record) => record.player) + 1;
  return {
    points: player.pts,
    gd: player.gf - player.ga,
    rank,
    through: rank <= 8,
  };
}
