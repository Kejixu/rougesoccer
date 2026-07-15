import { pressureOf } from "../core/types";

export const CHAIN_GLOSSARY: Record<string, string> = {
  Chance: "Chance is your banked shot bonus for this possession.",
  Risk: "Risk becomes d20 pressure on the next pass.",
  Recycle: "Recycle ends your possession safely without shooting.",
  "Stand off": "Stand off lets their next pass happen without committing a card, banking up to 2 unused dice for your next attack.",
  Counter: "A counter is an instant shot after an interception.",
  Combo: "A combo is a linked pass sequence that earns a risk or Chance bonus.",
};

export function describeChainStatus(input: {
  possession: "you" | "them";
  passes: number;
  shotQuality: number;
  riskPct: number;
  oppPasses: number;
  oppChance: number;
  shootPct: number;
}): string {
  if (input.possession === "them") {
    return `They're on pass ${input.oppPasses} building a ${input.oppChance}-chance. Commit defense or stand off.`;
  }
  if (input.passes === 0) {
    return "Open the move — your first pass is always safe.";
  }
  return `Chance ${input.shotQuality} · shot ${Math.round(input.shootPct * 100)}% · next pass pressure ${pressureOf(input.riskPct)} (${Math.round(input.riskPct * 100)}%).`;
}

export type CoachTipKey = "possession" | "risk" | "chance" | "punt" | "defense" | "combo";

export interface CoachTip {
  key: CoachTipKey;
  text: string;
}

export const COACH_TIPS: Record<CoachTipKey, string> = {
  possession: "Cards are passes. Each die you slot plays one — your first pass is always free.",
  risk: "Pressure is the d20 number they tackle on for your NEXT pass. Lose it and you lose all banked Chance — and they counter.",
  chance: "Chance is your shot's power. Shoot spends it: d20 + Chance vs their keeper. Build it with finishers.",
  punt: "A punt! Long shots are priced in — work the ball closer and bank Chance for better odds.",
  defense: "Their turn. Unused dice carry to your attack, up to 2. Stand off to bank energy; commit defenders to spend it on safety now.",
  combo: "A combo! Passes that flow like a real move — midfield wide, wing to striker — earn bonuses. Sequence your passes.",
};

export function coachTipFor(
  input: {
    possession: "you" | "them";
    passes: number;
    shotQuality: number;
    interceptionRisk: number;
    puntPressed: boolean;
    comboTriggered: boolean;
  },
  seenKeys: ReadonlySet<CoachTipKey | string>,
): CoachTip | null {
  const ordered: [CoachTipKey, boolean][] = [
    ["combo", input.comboTriggered],
    ["risk", input.interceptionRisk > 0],
    ["chance", input.shotQuality > 0],
    ["punt", input.puntPressed],
    ["defense", input.possession === "them"],
    ["possession", input.possession === "you" && input.passes === 0],
  ];

  for (const [key, active] of ordered) {
    if (active && !seenKeys.has(key)) return { key, text: COACH_TIPS[key] };
  }
  return null;
}
