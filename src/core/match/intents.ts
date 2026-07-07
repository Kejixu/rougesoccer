// Opponent intent patterns: each style cycles a signature sequence, with point
// values scaled off the opponent's attack rating (±15% seeded variance).
// The intent is revealed at round start — the player always sees it coming.

import { nextFloat } from "../rng";
import type { Intent, MatchState, StyleId } from "../types";

type IntentSpec =
  | { kind: "attack"; mult: number; big?: boolean }
  | { kind: "sitDeep"; mult: number }
  | { kind: "press" }
  | { kind: "counter"; mult: number };

const PATTERNS: Record<StyleId, IntentSpec[]> = {
  balanced: [
    { kind: "attack", mult: 1.0 },
    { kind: "attack", mult: 1.1 },
    { kind: "sitDeep", mult: 0.7 },
    { kind: "attack", mult: 1.2 },
    { kind: "attack", mult: 1.4, big: true },
  ],
  flair: [
    { kind: "attack", mult: 1.1 },
    { kind: "attack", mult: 1.2 },
    { kind: "attack", mult: 1.7, big: true },
    { kind: "attack", mult: 1.0 },
    { kind: "attack", mult: 1.8, big: true },
  ],
  fortress: [
    { kind: "sitDeep", mult: 0.9 },
    { kind: "attack", mult: 0.9 },
    { kind: "sitDeep", mult: 1.0 },
    { kind: "attack", mult: 1.1 },
    { kind: "sitDeep", mult: 1.1 },
  ],
  counter: [
    { kind: "counter", mult: 1.5 },
    { kind: "attack", mult: 0.9 },
    { kind: "counter", mult: 1.7 },
    { kind: "attack", mult: 1.0 },
    { kind: "counter", mult: 1.9 },
  ],
  highpress: [
    { kind: "press" },
    { kind: "attack", mult: 1.1 },
    { kind: "attack", mult: 1.2 },
    { kind: "press" },
    { kind: "attack", mult: 1.4, big: true },
  ],
  possession: [
    { kind: "press" },
    { kind: "sitDeep", mult: 0.8 },
    { kind: "attack", mult: 1.1 },
    { kind: "press" },
    { kind: "attack", mult: 1.3 },
  ],
};

export function rollIntent(draft: MatchState): Intent {
  const pattern = PATTERNS[draft.opp.style];
  const spec = pattern[draft.intentStep % pattern.length]!;
  draft.intentStep += 1;

  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  const variance = 0.85 + v * 0.3; // ±15%
  const scaled = (mult: number) => Math.max(1, Math.round(draft.opp.attackRating * mult * variance));

  switch (spec.kind) {
    case "attack":
      return { kind: "attack", points: scaled(spec.mult), big: spec.big };
    case "sitDeep":
      return { kind: "sitDeep", amount: scaled(spec.mult) };
    case "press":
      return { kind: "press" };
    case "counter":
      return { kind: "counter", points: scaled(spec.mult) };
  }
}
