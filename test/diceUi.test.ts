import { describe, expect, it } from "vitest";
import { CHAIN_GLOSSARY, describeChainStatus } from "../src/ui/diceUx";

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
    });
  });
});
