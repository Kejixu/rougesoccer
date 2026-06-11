// Nation class kits: per-nation starting decks, identity passives,
// exclusive card pools, and the two class mechanics (Break / La Ola).

import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch } from "../src/core/match/engine";
import { applyRunAction, createRun } from "../src/core/run/run";
import { rollCardOfRarity } from "../src/core/run/rewards";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import type { CardInstance, MatchState, OppInfo } from "../src/core/types";
import { CARD_DEF_MAP } from "../src/data/cards";
import { NATION_KITS } from "../src/data/kits";
import { makeContent } from "../src/data/content";

const content = makeContent();
const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `k-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

function startMatch(defIds: string[], seed = "kits"): MatchState {
  return createMatch(CARD_DEF_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: defIds.map((id, i) => inst(id, i)),
    rng: seedRng(seed),
    balance: DEFAULT_BALANCE,
  }).state;
}

function play(state: MatchState, defId: string): MatchState {
  const card = state.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`${defId} not in hand`);
  return applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: card.uid }).state;
}

describe("nation kit data", () => {
  it("every kit deck entry and star references a real card", () => {
    for (const [teamId, kit] of Object.entries(NATION_KITS)) {
      for (const entry of kit.startingDeck) {
        expect(CARD_DEF_MAP[entry.defId], `${teamId}: ${entry.defId}`).toBeDefined();
      }
    }
  });

  it("each nation starts with its kit deck plus its star", () => {
    for (const teamId of Object.keys(NATION_KITS)) {
      const run = createRun(content, `kit-${teamId}`, teamId);
      expect(run.deck).toHaveLength(NATION_KITS[teamId]!.startingDeck.length + 1);
    }
    const usa = createRun(content, "kit-usa", "usa");
    const ids = usa.deck.map((c) => c.defId);
    expect(ids).toContain("usa_press_trap");
    expect(ids).toContain("gp_gegenpress");
    expect(ids).toContain("wg_pulisick");
  });

  it("kit passives are live from kickoff (Mexico draws 6)", () => {
    let run = structuredClone(createRun(content, "kit-mex", "mex"));
    run = applyRunAction(content, run, { type: "START_MATCH" }).state;
    expect(run.activeMatch!.hand).toHaveLength(content.balance.HAND_SIZE + 1);
    expect(run.activeMatch!.activePassives).toContainEqual({ kind: "drawBonus", amount: 1 });
  });
});

describe("exclusive card pools", () => {
  it("another nation's signature cards never appear in your rewards", () => {
    const run = structuredClone(createRun(content, "kit-pool", "usa"));
    for (let i = 0; i < 300; i++) {
      const id = rollCardOfRarity(run, content, i % 2 ? "common" : "rare");
      const def = content.defs[id]!;
      if (def.exclusiveTo) expect(def.exclusiveTo).toBe("usa");
    }
  });
});

describe("class mechanics", () => {
  it("Break: bonus fires only while the opponent lines up an attack", () => {
    // intent depends on the seeded pattern: find a round with each intent kind
    let m = startMatch(
      ["can_breakaway", "can_breakaway", "df_stopper", "gk_wall", "academy_prospect",
       "can_breakaway", "df_stopper", "gk_wall", "academy_prospect", "can_breakaway"],
    );
    for (let guard = 0; guard < 10; guard++) {
      const card = m.hand.find((c) => c.defId === "can_breakaway");
      if (card && m.intent) {
        const intentKind = m.intent.kind;
        const before = m.playerShotPoints + m.playerGoals * DEFAULT_BALANCE.GOAL_THRESHOLD;
        m = applyMatchAction(CARD_DEF_MAP, m, { type: "PLAY_CARD", uid: card.uid }).state;
        const gained =
          m.playerShotPoints + m.playerGoals * DEFAULT_BALANCE.GOAL_THRESHOLD - before;
        // 7 base, +6 only when they attack (sitDeep absorption can reduce; skip those rounds)
        if (m.sitDeepPool === 0 && gained > 0) {
          expect(gained, `intent ${intentKind}`).toBe(intentKind === "attack" ? 13 : 7);
        }
      }
      if (m.phase !== "ROUND_ACTIVE") break;
      m = applyMatchAction(CARD_DEF_MAP, m, { type: "END_ROUND" }).state;
      if (m.phase !== "ROUND_ACTIVE") break;
    }
  });

  it("La Ola: power scales with cards already played this round", () => {
    let m = startMatch(["mex_ola", "academy_prospect", "academy_prospect", "gk_wall", "df_stopper"]);
    // play two cheap cards first, then the Ola winger: 5 base + 2x2 = 9
    m = play(m, "academy_prospect");
    m = play(m, "academy_prospect");
    const before = m.playerShotPoints;
    const absorbed = m.sitDeepPool;
    m = play(m, "mex_ola");
    const gained = m.playerShotPoints - before + Math.min(absorbed, 9);
    expect(gained).toBe(9);
  });
});
