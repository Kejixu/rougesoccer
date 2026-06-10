// The play classifier — soccer's answer to poker hands. Every attack is
// classified by the POSITIONS of the player cards committed (tactics and
// moments ride along without affecting the pattern). The best-paying matching
// play wins, exactly like poker hand ranking.
//
// The active table the game uses lives in src/data/plays.ts — tinker there.

import type { PlayDef, PlayPattern, Position } from "../types";
import type { AttackCard } from "./scoring";

export const FALLBACK_PLAY_NAME = "Hopeful Punt"; // unstructured attack, x1

export const DEFAULT_PLAYS: readonly PlayDef[] = [
  {
    id: "solo_run",
    name: "Solo Run",
    baseMult: 1.1,
    blurb: "A single player takes them all on.",
    match: { kind: "soloRun" },
  },
  {
    id: "one_two",
    name: "One-Two",
    baseMult: 1.3,
    blurb: "Exactly two midfielders exchange passes.",
    match: { kind: "positions", need: { MF: 2 }, exact: 2 },
  },
  {
    id: "through_ball",
    name: "Through Ball",
    baseMult: 1.4,
    blurb: "Exactly a midfielder and a striker: the killer pass.",
    match: { kind: "positions", need: { MF: 1, ST: 1 }, exact: 2 },
  },
  {
    id: "wing_play",
    name: "Wing Play",
    baseMult: 1.5,
    blurb: "A winger and a striker together: cross and finish.",
    match: { kind: "positions", need: { WG: 1, ST: 1 } },
  },
  {
    id: "counter",
    name: "Counter Attack",
    baseMult: 1.65,
    blurb: "Exactly a winger and a striker, nobody else: the lightning break.",
    match: { kind: "positions", need: { WG: 1, ST: 1 }, exact: 2 },
  },
  {
    id: "overlap",
    name: "The Overlap",
    baseMult: 1.75,
    blurb: "A defender joins a winger's attack — risky and devastating.",
    match: { kind: "positions", need: { DF: 1, WG: 1 } },
  },
  {
    id: "tikitaka",
    name: "Tiki-Taka",
    baseMult: 2.0,
    blurb: "Three or more midfielders weave a passing web.",
    match: { kind: "minPosition", position: "MF", count: 3 },
  },
  {
    id: "total_football",
    name: "Total Football",
    baseMult: 2.4,
    blurb: "Four different positions in one attack. The complete game.",
    match: { kind: "distinct", count: 4 },
  },
];

function patternMatches(
  pattern: PlayPattern,
  playerCount: number,
  counts: Partial<Record<Position, number>>,
  distinct: number,
): boolean {
  switch (pattern.kind) {
    case "soloRun":
      return playerCount === 1;
    case "positions": {
      if (pattern.exact !== undefined && playerCount !== pattern.exact) return false;
      for (const [pos, n] of Object.entries(pattern.need)) {
        if ((counts[pos as Position] ?? 0) < (n ?? 0)) return false;
      }
      if (pattern.anyOf && !pattern.anyOf.some((p) => (counts[p] ?? 0) > 0)) return false;
      return true;
    }
    case "minPosition":
      return (counts[pattern.position] ?? 0) >= pattern.count;
    case "distinct":
      return distinct >= pattern.count;
  }
}

export function classifyAttack(
  cards: AttackCard[],
  plays: readonly PlayDef[],
): { play: PlayDef | null; mult: number; name: string } {
  const counts: Partial<Record<Position, number>> = {};
  let playerCount = 0;
  for (const c of cards) {
    const pos = c.def.position;
    if (!pos) continue; // tactics/moments don't shape the play
    playerCount += 1;
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  const distinct = Object.keys(counts).length;

  let best: PlayDef | null = null;
  for (const play of plays) {
    if (
      patternMatches(play.match, playerCount, counts, distinct) &&
      (!best || play.baseMult > best.baseMult)
    ) {
      best = play;
    }
  }
  return { play: best, mult: best?.baseMult ?? 1, name: best?.name ?? FALLBACK_PLAY_NAME };
}
