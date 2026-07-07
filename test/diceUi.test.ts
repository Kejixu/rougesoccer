import { describe, expect, it } from "vitest";
import { CHAIN_GLOSSARY, coachTipFor, describeChainStatus } from "../src/ui/diceUx";

describe("dice UX copy", () => {
  it("explains that your first pass is safe", () => {
    expect(
      describeChainStatus({
        possession: "you",
        passes: 0,
        shotQuality: 0,
        riskPct: 0,
        oppPasses: 0,
        oppChance: 0,
        shootPct: 0,
      }),
    ).toBe("Open the move — your first pass is always safe.");
  });

  it("summarizes your live chance, shot, and next-pass risk", () => {
    expect(
      describeChainStatus({
        possession: "you",
        passes: 2,
        shotQuality: 7,
        riskPct: 0.28,
        oppPasses: 0,
        oppChance: 0,
        shootPct: 0.65,
      }),
    ).toBe("Chance 7 · shot 65% · next pass 28% risk.");
  });

  it("summarizes their chain and the defense choice", () => {
    expect(
      describeChainStatus({
        possession: "them",
        passes: 0,
        shotQuality: 0,
        riskPct: 0,
        oppPasses: 3,
        oppChance: 9,
        shootPct: 0,
      }),
    ).toBe("They're on pass 3 building a 9-chance. Commit defense or stand off.");
  });

  it("defines the chain glossary terms", () => {
    expect(CHAIN_GLOSSARY).toEqual({
      Chance: "Chance is your banked shot bonus for this possession.",
      Risk: "Risk is the interception chance on the next pass.",
      Recycle: "Recycle ends your possession safely without shooting.",
      "Stand off": "Stand off lets their next pass happen without committing a card.",
      Counter: "A counter is an instant shot after an interception.",
      Combo: "A combo is a linked pass sequence that earns a risk or Chance bonus.",
    });
  });
});

describe("coach tips", () => {
  const baseSummary = {
    possession: "you" as const,
    passes: 0,
      shotQuality: 0,
      interceptionRisk: 0,
      puntPressed: false,
      phase: "ROUND_ACTIVE" as const,
      comboTriggered: false,
    };

  it("shows the first-possession tip once", () => {
    expect(coachTipFor(baseSummary, new Set())).toEqual({
      key: "possession",
      text: "Cards are passes. Each die you slot plays one — your first pass is always free.",
    });
    expect(coachTipFor(baseSummary, new Set(["possession"]))).toBeNull();
  });

  it("prioritizes risk, chance, punt, defense, and push triggers when unseen", () => {
    expect(coachTipFor({ ...baseSummary, passes: 1, interceptionRisk: 0.15 }, new Set())).toEqual({
      key: "risk",
      text: "That % is the chance they take the ball on your NEXT pass. Lose it and you lose all banked Chance — and they counter.",
    });
    expect(coachTipFor({ ...baseSummary, passes: 1, shotQuality: 4 }, new Set(["risk"]))).toEqual({
      key: "chance",
      text: "Chance is your shot's power. Shoot spends it: d20 + Chance vs their keeper. Build it with finishers.",
    });
    expect(coachTipFor({ ...baseSummary, passes: 1, puntPressed: true }, new Set(["risk", "chance"]))).toEqual({
      key: "punt",
      text: "A punt! Long shots are priced in — work the ball closer and bank Chance for better odds.",
    });
    expect(coachTipFor({ ...baseSummary, possession: "them" }, new Set(["risk", "chance", "punt"]))).toEqual({
      key: "defense",
      text: "Their turn. Slot defenders to raise the interception % on their next pass — or stand off and let them play.",
    });
    expect(coachTipFor({ ...baseSummary, phase: "PUSH_DECISION" }, new Set(["risk", "chance", "punt", "defense"]))).toEqual({
      key: "push",
      text: "You have the win. Bank it, or gamble extra time for budget — their attacks hit 2× harder.",
    });
  });

  it("shows the combo tip the first time a combo triggers", () => {
    expect(coachTipFor({ ...baseSummary, comboTriggered: true }, new Set())).toEqual({
      key: "combo",
      text: "A combo! Passes that flow like a real move — midfield wide, wing to striker — earn bonuses. Sequence your passes.",
    });
    expect(coachTipFor({ ...baseSummary, comboTriggered: true }, new Set(["combo"]))).toEqual({
      key: "possession",
      text: "Cards are passes. Each die you slot plays one — your first pass is always free.",
    });
  });
});
