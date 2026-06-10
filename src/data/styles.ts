import type { StyleDef, StyleId } from "../core/types";

// Team playing styles: each opponent's mechanical identity. clockMult is baked
// into OppInfo.attackRating when the run layer builds a matchup; effects are
// passed to the match engine as styleEffects.

export const STYLES: Record<StyleId, StyleDef> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    blurb: "No tricks. No mercy.",
    clockMult: 1,
    effects: [],
  },
  possession: {
    id: "possession",
    name: "Possession",
    blurb: "They keep the ball: you lose a random card every round.",
    clockMult: 1,
    effects: [
      { trigger: "onRoundStart", op: { kind: "scripted", key: "forceRandomDiscard1" } },
    ],
  },
  flair: {
    id: "flair",
    name: "Flair",
    blurb: "Relentless attack: +20% clock rate.",
    clockMult: 1.2,
    effects: [],
  },
  fortress: {
    id: "fortress",
    name: "Fortress",
    blurb: "Massed defense: your attack mult is capped at x2.",
    clockMult: 0.9,
    effects: [{ trigger: "onMatchStart", op: { kind: "scripted", key: "capMultAt2x" } }],
  },
  counter: {
    id: "counter",
    name: "Counter-Attack",
    blurb: "Waste an attack and they break: failed attacks feed their clock.",
    clockMult: 0.9,
    effects: [
      { trigger: "onAttackResolve", op: { kind: "scripted", key: "burstClockOnFailedAttack" } },
    ],
  },
  highpress: {
    id: "highpress",
    name: "High Press",
    blurb: "Suffocating press: your hand size is reduced by 1.",
    clockMult: 1,
    effects: [{ trigger: "onMatchStart", op: { kind: "scripted", key: "shrinkHand1" } }],
  },
};
