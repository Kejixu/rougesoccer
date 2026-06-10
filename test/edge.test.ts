// Ship-pass edge cases: tiny decks, exhausted piles, all-fatigued squads,
// resource guards.

import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch } from "../src/core/match/engine";
import { applyRunAction, createRun } from "../src/core/run/run";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import type { CardInstance, OppInfo } from "../src/core/types";
import { CARD_DEF_MAP } from "../src/data/cards";
import { makeContent } from "../src/data/content";

const content = makeContent();

const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `e-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

describe("edge cases", () => {
  it("a 5-card deck survives a full match (draw pile exhaustion + reshuffle)", () => {
    const deck = [
      inst("st_clinical", 1),
      inst("st_poacher", 2),
      inst("mf_engine", 3),
      inst("tac_through", 4),
      inst("df_stopper", 5),
    ];
    let { state } = createMatch(CARD_DEF_MAP, {
      opp: OPP,
      styleEffects: [],
      plays: [],
      context: "group",
      deck,
      rng: seedRng("edge-tiny"),
      balance: DEFAULT_BALANCE,
    });
    for (let guard = 0; guard < 100 && state.phase !== "DONE"; guard++) {
      if (state.phase === "PUSH_DECISION") {
        state = applyMatchAction(CARD_DEF_MAP, state, { type: "TAKE_WIN" }).state;
        continue;
      }
      const attacker = state.hand.find((c) => c.defId.startsWith("st_"));
      if (state.playsLeft > 0 && attacker) {
        state = applyMatchAction(CARD_DEF_MAP, state, {
          type: "ATTACK",
          cardUids: [attacker.uid],
        }).state;
      } else {
        state = applyMatchAction(CARD_DEF_MAP, state, { type: "END_ROUND" }).state;
      }
    }
    expect(state.phase).toBe("DONE");
    // all five cards still exist somewhere
    const all = [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exile, ...state.deployed];
    expect(all).toHaveLength(5);
  });

  it("an all-fatigued squad still gets a full match deck (fallback)", () => {
    let run = createRun(content, "edge-fatigue", "usa");
    run = structuredClone(run);
    for (const c of run.deck) c.fatigued = true;
    const step = applyRunAction(content, run, { type: "START_MATCH" });
    const m = step.state.activeMatch!;
    const matchCards = m.hand.length + m.drawPile.length;
    expect(matchCards).toBe(run.deck.length); // fell back to the whole squad
  });

  it("fatigued cards sit out when enough rested cards remain", () => {
    let run = createRun(content, "edge-fatigue-2", "usa");
    run = structuredClone(run);
    run.deck[0]!.fatigued = true;
    const step = applyRunAction(content, run, { type: "START_MATCH" });
    const m = step.state.activeMatch!;
    expect(m.hand.length + m.drawPile.length).toBe(run.deck.length - 1);
  });

  it("scouting twice is rejected", () => {
    let run = createRun(content, "edge-scout", "usa");
    run = applyRunAction(content, run, { type: "SCOUT_OPPONENT" }).state;
    expect(run.scouted).toBe(true);
    expect(() => applyRunAction(content, run, { type: "SCOUT_OPPONENT" })).toThrow(/already scouted/);
  });

  it("releasing below the minimum squad size is rejected", () => {
    let run = createRun(content, "edge-release", "usa");
    run = structuredClone(run);
    run.resources.budget = 999;
    // squad starts at 16, min is 10 -> 6 releases ok, 7th rejected
    for (let i = 0; i < 6; i++) {
      run = applyRunAction(content, run, { type: "RELEASE_CARD", uid: run.deck[0]!.uid }).state;
    }
    expect(run.deck.length).toBe(content.balance.MIN_DECK_SIZE);
    expect(() =>
      applyRunAction(content, run, { type: "RELEASE_CARD", uid: run.deck[0]!.uid }),
    ).toThrow(/minimum size/);
  });

  it("buying with insufficient budget is rejected", () => {
    let run = createRun(content, "edge-budget", "usa");
    run = structuredClone(run);
    run.resources.budget = 0;
    expect(() => applyRunAction(content, run, { type: "BUY_CARD", index: 0 })).toThrow(
      /not enough budget/,
    );
  });
});
