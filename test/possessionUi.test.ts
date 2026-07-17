import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { createDiceMatch } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import type { CardInstance, GameEvent, OppInfo } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import * as MatchUi from "../src/ui/screens/DiceMatchScreen";

type Owner = "you" | "them";

interface Handover {
  round: number;
  owner: Owner;
  title: string;
  subtitle: string;
}

type PossessionExports = typeof MatchUi & {
  PossessionStrip?: ComponentType<{ currentRound: number; matchRounds: number }>;
  HandoverBanner?: ComponentType<{ handover: Handover }>;
  handoverForRoundStart?: (events: readonly GameEvent[], previousOwner: Owner) => Handover | null;
};

const possessionUi = MatchUi as PossessionExports;
const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `possession-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

function matchScreenMarkup(possession: Owner, round: number): string {
  const content = makeContent();
  const match = {
    ...createDiceMatch(DICE_CARD_MAP, {
      opp: OPP,
      styleEffects: [],
      plays: [],
      context: "group",
      deck: [inst("d_shortpass", 0), inst("d_tackle", 1)],
      mutators: [],
      rng: seedRng("possession-ui"),
      balance: DEFAULT_BALANCE,
    }).state,
    possession,
    round,
  };
  const Screen = MatchUi.DiceMatchScreen as ComponentType<Record<string, unknown>>;

  return renderToStaticMarkup(createElement(Screen, {
    content,
    events: [],
    match,
    playerName: "USA",
    onMatchAction: () => undefined,
    tutorial: {
      step: { title: "Test", why: "Test", lock: { kind: "next" } },
      stepIndex: 0,
      totalSteps: 1,
      onContinue: () => undefined,
      onSkip: () => undefined,
    },
  }));
}

describe("possession strip", () => {
  it("renders the six-round alternating schedule and marks the current round", () => {
    const html = matchScreenMarkup("them", 4);

    expect(html).toContain('data-testid="possession-strip"');
    expect(html.match(/data-owner="you"/g)).toHaveLength(3);
    expect(html.match(/data-owner="them"/g)).toHaveLength(3);
    expect(html).toContain('data-round="4"');
    expect(html).toContain('aria-current="step"');
  });

  it("appends an extra-time slot when another round begins", () => {
    const html = matchScreenMarkup("you", 7);

    expect(html.match(/data-owner="(?:you|them)"/g)).toHaveLength(7);
    expect(html).toContain('data-round="7"');
    expect(html).toContain('data-owner="you"');
  });
});

describe("possession handover", () => {
  it("derives and renders the right banner when ROUND_START flips possession", () => {
    expect(possessionUi.handoverForRoundStart).toBeTypeOf("function");
    expect(possessionUi.HandoverBanner).toBeTypeOf("function");
    if (!possessionUi.handoverForRoundStart || !possessionUi.HandoverBanner) return;

    const handover = possessionUi.handoverForRoundStart(
      [{ type: "ROUND_START", round: 2, mode: "regulation" }],
      "you",
    );
    expect(handover).toEqual({
      round: 2,
      owner: "them",
      title: "ROUND 2 — THEIR BALL",
      subtitle: "Commit tackles or stand off",
    });
    if (!handover) return;

    const html = renderToStaticMarkup(createElement(possessionUi.HandoverBanner, { handover }));
    expect(html).toContain('data-testid="possession-handover"');
    expect(html).toContain("ROUND 2 — THEIR BALL");
    expect(html).toContain("Commit tackles or stand off");
  });

  it("does not create a banner when possession does not flip", () => {
    expect(possessionUi.handoverForRoundStart).toBeTypeOf("function");
    if (!possessionUi.handoverForRoundStart) return;

    expect(
      possessionUi.handoverForRoundStart(
        [{ type: "ROUND_START", round: 3, mode: "regulation" }],
        "you",
      ),
    ).toBeNull();
  });
});

describe("possession mode", () => {
  it("adds mode-defending to the match root exactly during their possession", () => {
    expect(matchScreenMarkup("them", 2)).toContain('<main class="board mode-defending">');
    expect(matchScreenMarkup("you", 3)).toContain('<main class="board">');
    expect(matchScreenMarkup("you", 3)).not.toContain("mode-defending");
  });
});
