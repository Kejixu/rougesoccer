export const CHAIN_GLOSSARY: Record<string, string> = {
  Chance: "Chance is your banked shot bonus for this possession.",
  Risk: "Risk is the interception chance on the next pass.",
  Recycle: "Recycle ends your possession safely without shooting.",
  "Stand off": "Stand off lets their next pass happen without committing a card.",
  Counter: "A counter is an instant shot after an interception.",
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
