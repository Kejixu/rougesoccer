import { describe, expect, it } from "vitest";
import { CHAIN_GLOSSARY, coachTipFor, describeChainStatus } from "../src/ui/diceUx";
import { dieDropInfo, dieDropTargets } from "../src/ui/diceDropTargets";
import { createDiceMatch } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import type { CardInstance, DiceMatchState, OppInfo } from "../src/core/types";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import * as DiceUx from "../src/ui/diceUx";

const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `ui-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

function start(defIds: string[], seed = "dice-ui"): DiceMatchState {
  return createDiceMatch(DICE_CARD_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: defIds.map((id, i) => inst(id, i)),
    mutators: [],
    rng: seedRng(seed),
    balance: DEFAULT_BALANCE,
  }).state;
}

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
    ).toBe("Chance 7 · shot 65% · next pass pressure 6 (28%).");
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
      Possession: "Possessions alternate like innings: three attacks and three defenses. Fight for the ball within each round through tackles, interceptions, and counters.",
      Chance: "Chance is your banked shot bonus for this possession.",
      Risk: "Risk becomes d20 pressure on the next pass.",
      Recycle: "Recycle ends your possession safely without shooting.",
      "Stand off": "Stand off lets their next pass happen without committing a card, banking up to 2 unused dice for your next attack.",
      Counter: "A counter is an instant shot after an interception.",
      Combo: "A combo is a linked pass sequence that earns a risk or Chance bonus.",
      Corner: "A corner gives you one card delivery, then an automatic headed shot.",
      Rattled: "A rattled keeper has -2 DC against your next regular or counter shot, once.",
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
      comboTriggered: false,
      corner: false,
      keeperRattled: false,
    };

  it("shows the first-possession tip once", () => {
    expect(coachTipFor(baseSummary, new Set())).toEqual({
      key: "possession",
      text: "Cards are passes. Each die you slot plays one — your first pass is always free.",
    });
    expect(coachTipFor(baseSummary, new Set(["possession"]))).toBeNull();
  });

  it("shows the schedule tip once on the first their-possession", () => {
    const theirSummary = { ...baseSummary, possession: "them" as const };

    expect((DiceUx as typeof DiceUx & { COACH_TIP_KEYS?: readonly string[] }).COACH_TIP_KEYS).toContain("schedule");
    expect(coachTipFor(theirSummary, new Set())).toEqual({
      key: "schedule",
      text: "Possessions alternate like innings — three attacks, three defenses. You fight for the ball within a round: tackles, interceptions, counters.",
    });
    expect(coachTipFor(theirSummary, new Set(["schedule"]))).not.toMatchObject({ key: "schedule" });
  });

  it("prioritizes risk, chance, punt, and defense triggers when unseen", () => {
    expect(coachTipFor({ ...baseSummary, passes: 1, interceptionRisk: 0.15 }, new Set())).toEqual({
      key: "risk",
      text: "Pressure is the d20 number they tackle on for your NEXT pass. Lose it and you lose all banked Chance — and they counter.",
    });
    expect(coachTipFor({ ...baseSummary, passes: 1, shotQuality: 4 }, new Set(["risk"]))).toEqual({
      key: "chance",
      text: "Chance is your shot's power. Shoot spends it: d20 + Chance vs their keeper. Build it with finishers.",
    });
    expect(coachTipFor({ ...baseSummary, passes: 1, puntPressed: true }, new Set(["risk", "chance"]))).toEqual({
      key: "punt",
      text: "A punt! Long shots are priced in — work the ball closer and bank Chance for better odds.",
    });
    expect(coachTipFor({ ...baseSummary, possession: "them" }, new Set(["schedule", "risk", "chance", "punt"]))).toEqual({
      key: "defense",
      text: "Their turn. Unused dice carry to your attack, up to 2. Stand off to bank energy; commit defenders to spend it on safety now.",
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

  it("shows the two set-piece tips once with corner instructions first", () => {
    expect(coachTipFor({ ...baseSummary, corner: true, keeperRattled: true }, new Set())).toEqual({
      key: "corner",
      text: "A save close to the mark goes out for a corner — one delivery, then the header. Bank Chance with your best card.",
    });
    expect(
      coachTipFor({ ...baseSummary, corner: true, keeperRattled: true }, new Set(["corner"])),
    ).toEqual({
      key: "rattled",
      text: "You hit him hard — the keeper's shaken. Your next shot gets -2 DC: shoot again while he's down.",
    });
    expect(
      coachTipFor(
        { ...baseSummary, corner: true, keeperRattled: true },
        new Set(["corner", "rattled", "possession"]),
      ),
    ).toBeNull();
  });
});

describe("die drop targets", () => {
  it("returns only cards that the dragged die can legally activate", () => {
    const m = {
      ...start(["d_shortpass", "d_finish", "d_tackle"], "drop-targets"),
      possession: "you" as const,
      dice: [{ value: 4, used: false }],
      hand: [inst("d_shortpass", 0), inst("d_finish", 1), inst("d_tackle", 2)],
    };

    expect(dieDropTargets(DICE_CARD_MAP, m, 0)).toEqual(new Set(["ui-d_shortpass-0"]));
  });

  it("returns no targets for a used die or missing die", () => {
    const m = {
      ...start(["d_shortpass"], "drop-used"),
      dice: [{ value: 4, used: true }],
      hand: [inst("d_shortpass", 0)],
    };

    expect(dieDropTargets(DICE_CARD_MAP, m, 0)).toEqual(new Set());
    expect(dieDropTargets(DICE_CARD_MAP, m, 9)).toEqual(new Set());
  });

  it("respects their possession defensive role and tutorial play-card locks", () => {
    const m = {
      ...start(["d_clearance", "d_tackle", "d_shortpass"], "drop-tutorial"),
      possession: "them" as const,
      dice: [{ value: 2, used: false }],
      hand: [inst("d_clearance", 0), inst("d_tackle", 1), inst("d_shortpass", 2)],
    };

    expect(dieDropTargets(DICE_CARD_MAP, m, 0)).toEqual(new Set(["ui-d_clearance-0", "ui-d_tackle-1"]));
    expect(dieDropTargets(DICE_CARD_MAP, m, 0, { kind: "playCard", defId: "d_tackle" })).toEqual(
      new Set(["ui-d_tackle-1"]),
    );
    expect(dieDropTargets(DICE_CARD_MAP, m, 0, { kind: "endRound" })).toEqual(new Set());
  });
});

describe("die drop info", () => {
  it("marks a fitting attack card locked during their possession", () => {
    const m = {
      ...start(["d_finish"], "drop-attack-locked"),
      possession: "them" as const,
      dice: [{ value: 6, used: false }],
      hand: [inst("d_finish", 0)],
    };

    expect(dieDropInfo(DICE_CARD_MAP, m, 0)).toEqual(new Map([["ui-d_finish-0", "locked"]]));
  });

  it("marks a fitting defense card locked during your possession", () => {
    const m = {
      ...start(["d_tackle"], "drop-defense-locked"),
      possession: "you" as const,
      dice: [{ value: 2, used: false }],
      hand: [inst("d_tackle", 0)],
    };

    expect(dieDropInfo(DICE_CARD_MAP, m, 0)).toEqual(new Map([["ui-d_tackle-0", "locked"]]));
  });

  it("marks fitting cards ok and omits non-fitting cards", () => {
    const m = {
      ...start(["d_shortpass", "d_finish"], "drop-info-fit"),
      possession: "you" as const,
      dice: [{ value: 4, used: false }],
      hand: [inst("d_shortpass", 0), inst("d_finish", 1)],
    };

    expect(dieDropInfo(DICE_CARD_MAP, m, 0)).toEqual(new Map([["ui-d_shortpass-0", "ok"]]));
  });

  it("omits cards blocked by the tutorial lock", () => {
    const m = {
      ...start(["d_clearance", "d_tackle"], "drop-info-tutorial"),
      possession: "them" as const,
      dice: [{ value: 2, used: false }],
      hand: [inst("d_clearance", 0), inst("d_tackle", 1)],
    };

    expect(dieDropInfo(DICE_CARD_MAP, m, 0, { kind: "playCard", defId: "d_tackle" })).toEqual(
      new Map([["ui-d_tackle-1", "ok"]]),
    );
  });
});
