export const CHAIN_GLOSSARY: Record<string, string> = {
  Chance: "Chance is your banked shot bonus for this possession.",
  Risk: "Risk is the interception chance on the next pass.",
  Recycle: "Recycle ends your possession safely without shooting.",
  "Stand off": "Stand off lets their next pass happen without committing a card.",
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
  return `Chance ${input.shotQuality} · shot ${Math.round(input.shootPct * 100)}% · next pass ${Math.round(input.riskPct * 100)}% risk.`;
}

export type CoachTipKey = "possession" | "risk" | "chance" | "punt" | "defense" | "push" | "combo";

export interface CoachTip {
  key: CoachTipKey;
  text: string;
}

export const COACH_TIPS: Record<CoachTipKey, string> = {
  possession: "Cards are passes. Each die you slot plays one — your first pass is always free.",
  risk: "That % is the chance they take the ball on your NEXT pass. Lose it and you lose all banked Chance — and they counter.",
  chance: "Chance is your shot's power. Shoot spends it: d20 + Chance vs their keeper. Build it with finishers.",
  punt: "A punt! Long shots are priced in — work the ball closer and bank Chance for better odds.",
  defense: "Their turn. Slot defenders to raise the interception % on their next pass — or stand off and let them play.",
  push: "You have the win. Bank it, or gamble extra time for budget — their attacks hit 2× harder.",
  combo: "A combo! Passes that flow like a real move — midfield wide, wing to striker — earn bonuses. Sequence your passes.",
};

export function coachTipFor(
  input: {
    possession: "you" | "them";
    passes: number;
    shotQuality: number;
    interceptionRisk: number;
    puntPressed: boolean;
    phase: "ROUND_ACTIVE" | "PUSH_DECISION" | "DONE";
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
    ["push", input.phase === "PUSH_DECISION"],
    ["possession", input.possession === "you" && input.passes === 0],
  ];

  for (const [key, active] of ordered) {
    if (active && !seenKeys.has(key)) return { key, text: COACH_TIPS[key] };
  }
  return null;
}
