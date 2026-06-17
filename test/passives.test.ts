// Gameplans (match-long enchantments), staff hires (run-long relics),
// drilling (imbue), and the warm-up mulligan.

import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch } from "../src/core/match/engine";
import { applyRunAction, createRun } from "../src/core/run/run";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import type { CardInstance, MatchState, OppInfo, PassiveEffect } from "../src/core/types";
import { CARD_DEF_MAP } from "../src/data/cards";
import { makeContent } from "../src/data/content";

const content = makeContent();
const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `p-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

/** A 5-card deck is fully drawn into the opening hand (HAND_SIZE = 5). */
function startMatch(defIds: string[], passives: PassiveEffect[] = []): MatchState {
  return createMatch(CARD_DEF_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: defIds.map((id, i) => inst(id, i)),
    passives,
    rng: seedRng("passives"),
    balance: DEFAULT_BALANCE,
  }).state;
}

function play(state: MatchState, defId: string): MatchState {
  const card = state.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`${defId} not in hand`);
  return applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: card.uid }).state;
}

describe("gameplans", () => {
  it("playing a gameplan activates its passive and exiles the card", () => {
    let m = startMatch(["gp_gegenpress", "mf_metronome", "mf_engine", "df_stopper", "st_clinical"]);
    m = play(m, "gp_gegenpress");
    expect(m.gameplansPlayed).toEqual(["gp_gegenpress"]);
    expect(m.activePassives).toEqual([{ kind: "blockOnPosition", position: "MF", amount: 3 }]);
    expect(m.exile.some((c) => c.defId === "gp_gegenpress")).toBe(true);

    // Gegenpress: the next midfielder grants block
    m = play(m, "mf_metronome");
    expect(m.block).toBe(3);
  });

  it("a duplicate gameplan cannot be played (Unique)", () => {
    let m = startMatch(["gp_lowblock", "gp_lowblock", "mf_engine", "df_stopper", "st_clinical"]);
    m = play(m, "gp_lowblock");
    expect(() => play(m, "gp_lowblock")).toThrow(/already in effect/);
  });

  it("blockPerRound grants free block at the start of each round", () => {
    let m = startMatch(["gp_lowblock", "mf_engine", "mf_metronome", "df_stopper", "st_clinical"]);
    m = play(m, "gp_lowblock");
    expect(m.block).toBe(0); // kicks in from the next round
    m = applyMatchAction(CARD_DEF_MAP, m, { type: "END_ROUND" }).state;
    expect(m.block).toBe(3);
  });
});

describe("staff passives", () => {
  it("firstAttackMult boosts only the first attack of a round", () => {
    let m = startMatch(
      ["st_clinical", "academy_prospect", "df_stopper", "gk_wall", "tac_through"],
      [{ kind: "firstAttackMult", amount: 2 }],
    );
    m = play(m, "st_clinical"); // 12 power x2 = 24
    expect(m.playerShotPoints).toBe(24);
    m = play(m, "academy_prospect"); // 3 power, no doubling
    expect(m.playerShotPoints).toBe(27);
  });

  it("roundStamina and drawBonus shape every round", () => {
    const m = startMatch(
      Array.from({ length: 10 }, (_, i) => (i % 2 ? "mf_engine" : "df_stopper")),
      [
        { kind: "roundStamina", amount: 1 },
        { kind: "drawBonus", amount: 1 },
      ],
    );
    expect(m.stamina).toBe(DEFAULT_BALANCE.STAMINA_PER_ROUND + 1);
    expect(m.hand).toHaveLength(DEFAULT_BALANCE.HAND_SIZE + 1);
  });
});

describe("warm-up mulligan", () => {
  it("redraws the hand once, then is spent", () => {
    let m = startMatch(Array.from({ length: 10 }, (_, i) => (i % 2 ? "mf_engine" : "df_stopper")));
    const before = m.hand.map((c) => c.uid);
    m = applyMatchAction(CARD_DEF_MAP, m, { type: "MULLIGAN" }).state;
    expect(m.mulliganUsed).toBe(true);
    expect(m.hand).toHaveLength(before.length);
    expect(() => applyMatchAction(CARD_DEF_MAP, m, { type: "MULLIGAN" })).toThrow(/already used/);
  });
});

describe("staff hires and drilling (run layer)", () => {
  it("PICK_STAFF hires and the passive reaches the next match", () => {
    let run = structuredClone(createRun(content, "staff-pick", "usa"));
    run.phase = "STAFF";
    run.pendingStaff = { staffIds: ["staff_legend", "staff_youth", "staff_gkcoach"] };
    run = applyRunAction(content, run, { type: "PICK_STAFF", index: 0 }).state;
    expect(run.staff).toEqual(["staff_legend"]);
    expect(run.phase).toBe("IDLE");
    expect(run.shop).not.toBeNull();

    run = applyRunAction(content, run, { type: "START_MATCH" }).state;
    const m = run.activeMatch!;
    expect(m.activePassives).toContainEqual({ kind: "roundStamina", amount: 1 });
    // in dice mode roundStamina grants an extra die in the pool
    expect(m.dice.length).toBe(content.balance.DICE.POOL_SIZE + 1);
  });

  it("a staff pick falls through to a queued card reward", () => {
    let run = structuredClone(createRun(content, "staff-reward", "usa"));
    run.phase = "STAFF";
    run.pendingStaff = { staffIds: ["staff_gkcoach"] };
    run.pendingReward = { defIds: ["d_finish", "d_shortpass"] };
    run = applyRunAction(content, run, { type: "PICK_STAFF", index: 0 }).state;
    expect(run.phase).toBe("REWARD");
    expect(run.pendingStaff).toBeNull();
  });

  it("the Youth Scout refunds budget on a reward-screen cut", () => {
    let run = structuredClone(createRun(content, "cut-refund", "usa"));
    run.staff = ["staff_youth"];
    run.phase = "REWARD";
    run.pendingReward = { defIds: ["mf_engine"] };
    const before = run.resources.budget;
    run = applyRunAction(content, run, { type: "CUT_CARD", uid: run.deck[0]!.uid }).state;
    expect(run.resources.budget).toBe(before + 5);
  });
});
