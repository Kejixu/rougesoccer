# Possession Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Momentum Duel's lane-bucket rounds with push-your-luck possession chains: each card+die is one pass that resolves instantly, Chance climbs, interception risk climbs, shoot anytime; on their possession the opponent chains and your defensive cards raise their interception risk.

**Architecture:** A round = one possession, alternating (odd rounds yours, even theirs). Your chain: `ASSIGN_DIE` = a pass (first pass safe, later passes roll an interception check first), `SHOOT` = cash in from anywhere with a zone DC penalty, `END_ROUND` = recycle safely. Their chain: `ASSIGN_DIE` on a defensive card commits risk against them and lets their next pass happen; `END_ROUND` = stand off (their next pass happens undefended). Interceptions trigger a one-roll instant counter for the winner. All lane fields (`buildUp`/`chance`/`cover`), duel resolution, pending-commit UI, decision coach, and duel preview are deleted. Everything else (dice slots, pitch, keeper DCs, extra time / sudden death / shootout, run layer) is preserved.

**Tech Stack:** TypeScript strict, Vitest, React 19, Vite, pnpm, seeded RNG. **Node 22 required:** prefix every command with `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-possession-chain-design.md`. Working dir: `/Users/kejixu/Projects/rougesoccer/.worktrees/momentum-duel` (branch `feature/momentum-duel`). Do NOT touch the main checkout.
- `src/core/**` and `src/data/**` must not import react/document/window/localStorage/Math.random/Date.now (enforced by `test/boundaries.test.ts`). All randomness via `state.rng` through the existing `rand`/`rollDie` helpers in `dice.ts`.
- Run-layer contract frozen: `DiceMatchState` keeps `playerGoals, oppGoals, hand, drawPile, discardPile, exile, earned, extraRoundsPlayed, result, rng` plus push-your-luck / sudden death / shootout flow. Combat engine (`src/core/match/engine.ts`, `MatchState`, ClockBar) untouched.
- First pass of a possession is ALWAYS safe (no interception check). A first-pass shot must be a punt (~25–35% from your half), a worked 4-pass chance ≥ 75% — enforced by zone DC penalty + development gains.
- Real country names, no FIFA branding. Update `GAME.md` in the same task that changes mechanics (Task 4 does the full rewrite).
- Verify with: `tsc --noEmit`, `vitest run`, `vite build`, `tsx src/sim/funProbe.ts` (all with the Node-22 PATH prefix).

---

### Task 1: Core engine — possession chains (yours + theirs), effects, cards

The whole match-core rewrite in one coherent unit: types, balance constants, engine, card data, core tests. After this task `tsc` errors are confined to `src/sim/strategies.ts`, `src/sim/funProbe.ts`, `src/ui/diceUx.ts`, `src/ui/screens/DiceMatchScreen.tsx` (fixed in Tasks 2–3) — note them, don't fix them.

**Files:**
- Modify: `src/core/types.ts` (DiceEffect, DiceMutator, DiceMatchState, GameEvent)
- Modify: `src/core/balance.ts` (`DICE` block + `MATCH_ROUNDS`)
- Modify: `src/core/match/dice.ts` (the chain engine)
- Modify: `src/data/diceCards.ts` (pool + starting deck)
- Modify: `src/data/content.ts` (Canada mutator)
- Test: `test/dice.test.ts` (rewrite lane/duel tests as chain tests)

**Interfaces (produced, relied on by Tasks 2–3):**
- State: `passes: number`, `nextChanceBonus: number`, `nextRiskDelta: number`, `defenseCommit: number`, `oppPasses: number`, `oppChance: number`; `possession` = whose possession this round is; `shotQuality` = your banked chain Chance. Lane fields `buildUp`/`chance`/`cover` are GONE.
- Pure helpers exported from `dice.ts`:
  - `interceptionRisk(state: DiceMatchState): number` — risk of YOUR next pass (0 when `passes === 0`)
  - `oppInterceptionRisk(state: DiceMatchState): number` — risk of THEIR next pass
  - `shotEstimate(state: DiceMatchState): { dc: number; p: number }` — SHOOT right now
  - `zoneOf(ball, bal)` unchanged; `playableCards`, `bestDieFor` unchanged signatures (role-gated by possession again)
- Events: `PASS_COMPLETED`, `CHAIN_INTERCEPTED`, `COUNTER_SHOT`, `OPP_PASS`, `DEFENSE_COMMITTED` (shapes in Step 2); `SHOT_TAKEN`/`OPP_SHOT`/`GOAL_SCORED` (with the `goals:0` concede marker) unchanged.

- [ ] **Step 1: Update `DICE` balance shape and values**

In `src/core/balance.ts`: set `MATCH_ROUNDS: 6` (was 5; 6 alternating possessions). Replace the `DICE` block of the interface and `DEFAULT_BALANCE`. Remove `STEAL_LINE`, `BUILD_UP_SCALE`, `OPP_ADVANCE_SCALE`, `OPP_DANGER_PER_RATING`, `DANGER_CAP`. Add (import `StyleId` from `./types` — it's already imported for `Stage`; extend the import):

```ts
  DICE: {
    POOL_SIZE: number;
    DIE_FACES: number;
    HAND_SIZE: number;
    PITCH_LEN: number;          // 0 = your goal, PITCH_LEN = their goal
    MIDFIELD: number;
    ZONE_WIDTH: number;         // 5 zones, for zoneOf + DC penalty
    THEIR_BOX: number;
    YOUR_BOX: number;
    KEEPER_DC_BASE: number;
    KEEPER_DC_PER_RATING: number;
    OWN_KEEPER_DC_BASE: number;
    SHOT_DIE: number;           // d20
    SIT_DEEP_DC_BONUS: number;  // sitDeep posture also hardens their keeper
    // ---- your chain ----
    RISK_BASE_PRESS: number;    // their press posture: base interception risk
    RISK_BASE_BALANCED: number;
    RISK_BASE_DEEP: number;     // sitDeep posture: easy to keep the ball
    RISK_RAMP: number;          // added per pass beyond the first
    RISK_CAP: number;
    DEVELOPMENT_GAIN: number;   // each chance effect gains +passes * this (the move develops)
    ZONE_DC_PENALTY: number[];  // indexed by zoneOf(ball): [yourBox, yourThird, mid, theirThird, theirBox]
    COUNTER_CHANCE: number;     // your instant-counter shot bonus
    COUNTER_SHALLOW_BONUS: number; // their counter is scarier if you lost it in your half
    // ---- their chain ----
    OPP_RISK_BASE: number;      // their base interception risk per pass
    OPP_RISK_RAMP: number;
    OPP_PASS_ADVANCE: number;   // ball steps toward your goal per completed opp pass
    OPP_CHANCE_PER_RATING: number; // their per-pass chance gain = round(rating * this)
    OPP_CHANCE_CAP: number;     // per-pass gain cap
    OPP_CHAIN_TARGET: Record<StyleId, number>; // passes they want before shooting
  };
```

Values in `DEFAULT_BALANCE`:

```ts
  DICE: {
    POOL_SIZE: 5,
    DIE_FACES: 6,
    HAND_SIZE: 4,
    PITCH_LEN: 20,
    MIDFIELD: 10,
    ZONE_WIDTH: 4,
    THEIR_BOX: 16,
    YOUR_BOX: 4,
    KEEPER_DC_BASE: 9,
    KEEPER_DC_PER_RATING: 0.14,
    OWN_KEEPER_DC_BASE: 14,
    SHOT_DIE: 20,
    SIT_DEEP_DC_BONUS: 4,
    RISK_BASE_PRESS: 0.25,
    RISK_BASE_BALANCED: 0.15,
    RISK_BASE_DEEP: 0.08,
    RISK_RAMP: 0.06,
    RISK_CAP: 0.65,
    DEVELOPMENT_GAIN: 1,
    ZONE_DC_PENALTY: [6, 6, 6, 3, 0],
    COUNTER_CHANCE: 4,
    COUNTER_SHALLOW_BONUS: 3,
    OPP_RISK_BASE: 0.12,
    OPP_RISK_RAMP: 0.05,
    OPP_PASS_ADVANCE: 2,
    OPP_CHANCE_PER_RATING: 0.08,
    OPP_CHANCE_CAP: 6,
    OPP_CHAIN_TARGET: { balanced: 3, possession: 4, flair: 4, fortress: 2, counter: 2, highpress: 3 },
  },
```

- [ ] **Step 2: Update the dice types**

In `src/core/types.ts`:

`DiceEffect` becomes (drop `advance`, `winPossession`, `pushBack`, `clearance`, and the `minZone` params — chance always banks; distance is priced at shot time):

```ts
export type DiceEffect =
  | { kind: "progress"; amount: number } // move the ball toward their goal now
  | { kind: "progressFromDie" } // move by the slotted die's value
  | { kind: "shotQuality"; amount: number } // grow the chain's banked Chance
  | { kind: "shotQualityFromDie" }
  | { kind: "safePass"; amount: number } // recycle: lower your NEXT interception check
  | { kind: "setupNext"; bonus: number } // the next chance effect gains +bonus (through ball / cross)
  | { kind: "defend"; amount: number } // their possession: raise their interception risk
  | { kind: "draw"; amount: number };
```

`DiceMutator`: replace `oppAdvanceDelta` with `{ kind: "oppRiskDelta"; amount: number }` (Canada: + to their interception risk vs you). Keep `rerollDie`, `keeperDcDelta`, `poolDelta`, `counterSpring` (now: bonus on YOUR instant counter shot).

`DiceMatchState`: remove `buildUp`, `chance`, `cover`, `intentStep` stays. Add:

```ts
  passes: number; // completed passes in your current chain (this possession)
  nextChanceBonus: number; // banked by setupNext, consumed by the next chance effect
  nextRiskDelta: number; // banked by safePass, consumed by your next interception check
  defenseCommit: number; // risk you've committed against THEIR chain this possession
  oppPasses: number;
  oppChance: number;
```

`GameEvent`: remove `LANE_COMMITTED` and `DUEL_RESOLVED`, `POSSESSION_WON`, `POSSESSION_LOST`, `BALL_CLEARED`. Add:

```ts
  | { type: "PASS_COMPLETED"; uid: string; cardName: string; passes: number; chanceGained: number; shotQuality: number; risked: number }
  | { type: "CHAIN_INTERCEPTED"; byYou: boolean; passes: number; chanceLost: number }
  | { type: "COUNTER_SHOT"; byYou: boolean; roll: number; bonus: number; dc: number; goal: boolean }
  | { type: "OPP_PASS"; passes: number; oppChance: number; risk: number }
  | { type: "DEFENSE_COMMITTED"; uid: string; cardName: string; die: number; amount: number; total: number }
```

(`risked` on PASS_COMPLETED = the risk that pass survived, 0 for the first pass — the UI shows it.)

- [ ] **Step 3: Write the failing chain tests**

Rewrite `test/dice.test.ts`'s lane/duel describe-blocks (`slotting dice` lane assertions, `tug-of-war`, `advancing and shooting`) with chain tests. Keep `dice slot fit`, `dice roll`, and `match terminates` (update field refs). The `start`/`inst`/`playWith` helpers stay. New blocks:

```ts
describe("your chain", () => {
  it("the first pass is always safe and resolves immediately", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "chain1");
    m = { ...m, dice: [{ value: 4, used: false }], hand: [inst("d_shortpass", 0)] };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    const pass = step.events.find((e) => e.type === "PASS_COMPLETED");
    expect(pass).toMatchObject({ type: "PASS_COMPLETED", passes: 1, risked: 0 });
    expect(step.state.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD + 4); // progressFromDie moves now
    expect(step.state.passes).toBe(1);
  });

  it("interceptionRisk is 0 before the first pass, then base + ramp", () => {
    let m = start(["d_shortpass"], "risk");
    m = { ...m, intent: { kind: "press" }, passes: 0 };
    expect(interceptionRisk(m)).toBe(0);
    m = { ...m, passes: 1 };
    expect(interceptionRisk(m)).toBeCloseTo(DEFAULT_BALANCE.DICE.RISK_BASE_PRESS, 5);
    m = { ...m, passes: 3 };
    expect(interceptionRisk(m)).toBeCloseTo(
      DEFAULT_BALANCE.DICE.RISK_BASE_PRESS + 2 * DEFAULT_BALANCE.DICE.RISK_RAMP, 5);
  });

  it("chance effects grow with development: later passes are worth more", () => {
    let m = start(["d_poacher"], "dev");
    m = { ...m, passes: 3, nextChanceBonus: 0, intent: { kind: "sitDeep", amount: 1 },
          dice: [{ value: 2, used: false }], hand: [inst("d_poacher", 0)] };
    // Poacher adds 5 base; development = passes(3) * DEVELOPMENT_GAIN(1); risk seed must survive
    const before = m.shotQuality;
    const after = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 }).state;
    if (after.passes === 4) expect(after.shotQuality - before).toBe(5 + 3);
  });

  it("setupNext banks a bonus for the next chance effect", () => {
    let m = start(["d_throughball", "d_poacher"], "setup");
    m = { ...m, passes: 0, intent: { kind: "sitDeep", amount: 1 },
          dice: [{ value: 5, used: false }, { value: 2, used: false }],
          hand: [inst("d_throughball", 0), inst("d_poacher", 1)] };
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 }).state;
    expect(m.nextChanceBonus).toBe(4);
    if (interceptionRisk(m) < 1) {
      const sq = m.shotQuality;
      const after = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 1 }).state;
      if (after.passes === 2) {
        expect(after.shotQuality - sq).toBe(5 + 4 + 1 * DEFAULT_BALANCE.DICE.DEVELOPMENT_GAIN);
        expect(after.nextChanceBonus).toBe(0);
      }
    }
  });

  it("you can shoot from midfield at a punt penalty; from the box at none", () => {
    let m = start(["d_shortpass"], "zones");
    m = { ...m, passes: 1, shotQuality: 4, ball: DEFAULT_BALANCE.DICE.MIDFIELD, intent: null };
    expect(shotEstimate(m).dc).toBe(m.keeperDC + 6);
    m = { ...m, ball: DEFAULT_BALANCE.DICE.THEIR_BOX };
    expect(shotEstimate(m).dc).toBe(m.keeperDC);
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" });
    expect(step.events.some((e) => e.type === "SHOT_TAKEN")).toBe(true);
    expect(step.state.round).toBeGreaterThan(m.round); // the shot ended the possession
  });

  it("an interception loses the whole banked chance and triggers their counter", () => {
    let m = start(["d_shortpass"], "picked");
    // force certain interception: passes >= 1 and a saturating risk
    m = { ...m, passes: 4, shotQuality: 9, intent: { kind: "press" },
          nextRiskDelta: 10, // absurd delta to force risk to the cap — clamped, then rand must lose
          dice: [{ value: 4, used: false }], hand: [inst("d_shortpass", 0)] };
    // run several seeds; at RISK_CAP 0.65 most rolls intercept — assert semantics when it happens
    let sawInterception = false;
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const fresh = { ...m, rng: seedRng(seed) };
      const step = applyDiceAction(DICE_CARD_MAP, fresh, { type: "ASSIGN_DIE", uid: fresh.hand[0]!.uid, dieIndex: 0 });
      const picked = step.events.find((e) => e.type === "CHAIN_INTERCEPTED");
      if (picked) {
        sawInterception = true;
        expect(picked).toMatchObject({ byYou: false, chanceLost: 9 });
        expect(step.events.some((e) => e.type === "COUNTER_SHOT" && !e.byYou)).toBe(true);
        expect(step.state.shotQuality).toBe(0);
        expect(step.state.round).toBeGreaterThan(m.round);
        break;
      }
    }
    expect(sawInterception).toBe(true);
  });

  it("END_ROUND recycles safely: possession ends, no shot, no counter", () => {
    let m = start(["d_shortpass"], "recycle");
    m = { ...m, passes: 2, shotQuality: 5 };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    expect(step.events.some((e) => e.type === "CHAIN_INTERCEPTED" || e.type === "SHOT_TAKEN")).toBe(false);
    expect(step.state.round).toBeGreaterThan(m.round);
  });
});

describe("their chain", () => {
  function theirRound(defIds: string[], seed = "def"): DiceMatchState {
    let m = start(defIds, seed);
    // advance to round 2 (their possession) by recycling round 1
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    expect(m.possession).toBe("them");
    return m;
  }

  it("possession alternates: round 1 yours, round 2 theirs", () => {
    const m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"]);
    expect(m.round).toBe(2);
    expect(m.oppPasses).toBe(0);
  });

  it("standing off lets their chain advance one pass", () => {
    const m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "standoff");
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    const advanced = step.events.some((e) => e.type === "OPP_PASS");
    const picked = step.events.some((e) => e.type === "CHAIN_INTERCEPTED" && e.byYou);
    expect(advanced || picked).toBe(true); // one of the two must happen
    if (advanced) expect(step.state.ball).toBeLessThan(m.ball);
  });

  it("committing a defensive card raises their risk and their next pass happens", () => {
    const m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "commit");
    const idx = m.dice.findIndex((d) => !d.used && d.value <= 2);
    if (idx >= 0) {
      const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: idx });
      const committed = step.events.find((e) => e.type === "DEFENSE_COMMITTED");
      expect(committed).toBeTruthy();
      expect(step.events.some((e) => e.type === "OPP_PASS" || e.type === "CHAIN_INTERCEPTED")).toBe(true);
    }
  });

  it("attack cards cannot be played on their possession", () => {
    const m = theirRound(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "wrongrole");
    const playable = playableCards(DICE_CARD_MAP, m);
    expect(playable.size).toBe(0);
    expect(() =>
      applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 }),
    ).toThrow();
  });

  it("winning the interception gives you an instant counter shot", () => {
    let saw = false;
    for (const seed of ["c1", "c2", "c3", "c4", "c5", "c6"]) {
      let m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], seed);
      m = { ...m, defenseCommit: 0.9 }; // force near-certain interception (clamped to cap)
      const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
      const counter = step.events.find((e) => e.type === "COUNTER_SHOT");
      if (counter) {
        saw = true;
        expect(counter).toMatchObject({ byYou: true });
        break;
      }
    }
    expect(saw).toBe(true);
  });
});
```

Also update `nation mutators` block: Canada test becomes `oppRiskDelta` (their risk is higher with the mutator: compare `oppInterceptionRisk` with/without `{ kind: "oppRiskDelta", amount: 0.06 }`); USA test: force an interception you win (as in the counter test, with `[{ kind: "counterSpring", amount: 3 }]`) and assert the `COUNTER_SHOT` event's `bonus` equals `DEFAULT_BALANCE.DICE.COUNTER_CHANCE + 3`. Import `interceptionRisk, oppInterceptionRisk, shotEstimate` from `../src/core/match/dice`.

- [ ] **Step 4: Run to verify failure**

Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/dice.test.ts`
Expected: FAIL (compile errors on removed fields / missing exports).

- [ ] **Step 5: Rewrite the engine in `src/core/match/dice.ts`**

Delete: `intentPressure`, `resolveIntent`, `projectedZone`, `resolvePlayerLanes`, the `DUEL_RESOLVED` emission in `endRound`, and lane writes in `applyDiceEffect`. Keep: rng/pile helpers, `zoneOf`, `moveBall`, `finish`, `shootout`, `enterSuddenDeath`, `concludeRound`, `assertPhase`, `mutatorSum`, `passiveSum`, `createDiceMatch` scaffolding, Brazil reroll handler.

New/changed code (complete bodies):

```ts
// ---------- chain math (pure, exported for UI + bots) ----------

function riskBase(state: DiceMatchState): number {
  const k = state.intent?.kind;
  if (k === "press") return state.bal.DICE.RISK_BASE_PRESS;
  if (k === "sitDeep") return state.bal.DICE.RISK_BASE_DEEP;
  return state.bal.DICE.RISK_BASE_BALANCED;
}

/** Risk that YOUR next pass is intercepted. First pass of a possession is free. */
export function interceptionRisk(state: DiceMatchState): number {
  if (state.possession !== "you" || state.passes === 0) return 0;
  const raw = riskBase(state) + state.bal.DICE.RISK_RAMP * (state.passes - 1) + state.nextRiskDelta;
  return Math.min(state.bal.DICE.RISK_CAP, Math.max(0.02, raw));
}

/** Risk that THEIR next pass is intercepted (your defense commits included). */
export function oppInterceptionRisk(state: DiceMatchState): number {
  const raw =
    state.bal.DICE.OPP_RISK_BASE +
    state.bal.DICE.OPP_RISK_RAMP * state.oppPasses +
    state.defenseCommit +
    mutatorSum(state.mutators, "oppRiskDelta");
  return Math.min(state.bal.DICE.RISK_CAP, Math.max(0.02, raw));
}

/** DC and win probability if you pressed SHOOT right now. */
export function shotEstimate(state: DiceMatchState): { dc: number; p: number } {
  const zonePen = state.bal.DICE.ZONE_DC_PENALTY[zoneOf(state.ball, state.bal)] ?? 0;
  const sitDeep = state.intent?.kind === "sitDeep" ? state.bal.DICE.SIT_DEEP_DC_BONUS : 0;
  const dc = state.keeperDC + zonePen + sitDeep;
  const p = Math.max(0.05, Math.min(0.95, (state.bal.DICE.SHOT_DIE - dc + 1 + state.shotQuality) / state.bal.DICE.SHOT_DIE));
  return { dc, p };
}

function isDefenseCard(def: CardDef | undefined): boolean {
  return (def?.diceEffects ?? []).some((e) => e.kind === "defend");
}
```

`applyDiceEffect` (chance effects consume `nextChanceBonus` + development; progress moves the ball now):

```ts
function applyDiceEffect(draft: DiceMatchState, eff: DiceEffect, dieValue: number, events: GameEvent[]): number {
  // returns chance gained (for the PASS_COMPLETED event)
  switch (eff.kind) {
    case "progress":
      moveBall(draft, eff.amount, events);
      return 0;
    case "progressFromDie":
      moveBall(draft, dieValue, events);
      return 0;
    case "shotQuality":
    case "shotQualityFromDie": {
      const base = eff.kind === "shotQuality" ? eff.amount : dieValue;
      const gained = base + draft.nextChanceBonus + draft.passes * draft.bal.DICE.DEVELOPMENT_GAIN;
      draft.nextChanceBonus = 0;
      draft.shotQuality += gained;
      return gained;
    }
    case "safePass":
      draft.nextRiskDelta -= eff.amount;
      return 0;
    case "setupNext":
      draft.nextChanceBonus += eff.bonus;
      return 0;
    case "defend":
      draft.defenseCommit += eff.amount;
      return 0;
    case "draw":
      drawCards(draft, eff.amount, events);
      return 0;
  }
}
```

`assignDie` (two possession-dependent paths; die/card validation as today):

```ts
function assignDie(defs: CardDefMap, draft: DiceMatchState, uid: string, dieIndex: number, events: GameEvent[]): void {
  const die = draft.dice[dieIndex];
  if (!die) throw new Error(`no die at index ${dieIndex}`);
  if (die.used) throw new Error("that die is already used");
  const cardIdx = draft.hand.findIndex((c) => c.uid === uid);
  if (cardIdx === -1) throw new Error(`card ${uid} not in hand`);
  const inst = draft.hand[cardIdx]!;
  const def = defs[inst.defId];
  if (!def || !def.slot) throw new Error(`card ${inst.defId} has no dice slot`);
  if (!dieFitsSlot(die.value, def.slot)) throw new Error(`die ${die.value} doesn't fit this card`);
  const defense = isDefenseCard(def);
  if (draft.possession === "you" && defense) throw new Error("you have the ball — defensive cards wait for their possession");
  if (draft.possession === "them" && !defense) throw new Error("they have the ball — commit defense or stand off");

  die.used = true;
  draft.hand.splice(cardIdx, 1);
  events.push({ type: "DIE_ASSIGNED", uid, die: die.value });
  events.push({ type: "CARD_PLAYED", uid, as: defense ? "defend" : "attack", cost: 0 });
  const discard = () => { if (def.exileOnPlay) draft.exile.push(inst); else draft.discardPile.push(inst); };

  if (draft.possession === "them") {
    // defense commit, then their chain advances one pass
    let total = 0;
    for (const eff of def.diceEffects ?? []) total += applyDiceEffect(draft, eff, die.value, events) * 0; // defend/draw only
    // recompute committed amount for the event
    const amount = (def.diceEffects ?? []).reduce((a, e) => (e.kind === "defend" ? a + e.amount : a), 0);
    events.push({ type: "DEFENSE_COMMITTED", uid, cardName: def.name, die: die.value, amount, total: draft.defenseCommit });
    discard();
    oppPassAttempt(defs, draft, events);
    return;
  }

  // your possession: passes beyond the first risk interception BEFORE the pass resolves
  const risk = interceptionRisk(draft);
  draft.nextRiskDelta = 0; // a safePass discount covers exactly one attempt
  if (risk > 0 && rand(draft) < risk) {
    discard();
    chainIntercepted(defs, draft, events);
    return;
  }
  let gained = 0;
  for (const eff of def.diceEffects ?? []) gained += applyDiceEffect(draft, eff, die.value, events);
  draft.passes += 1;
  events.push({ type: "PASS_COMPLETED", uid, cardName: def.name, passes: draft.passes, chanceGained: gained, shotQuality: draft.shotQuality, risked: risk });
  discard();
}
```

Interception + instant counters:

```ts
function chainIntercepted(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  events.push({ type: "CHAIN_INTERCEPTED", byYou: false, passes: draft.passes, chanceLost: draft.shotQuality });
  draft.shotQuality = 0;
  // their instant counter: scarier if you lost it in your own half
  const shallow = draft.ball < draft.bal.DICE.MIDFIELD ? draft.bal.DICE.COUNTER_SHALLOW_BONUS : 0;
  const gain = Math.min(draft.bal.DICE.OPP_CHANCE_CAP, Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_CHANCE_PER_RATING));
  const bonus = gain + shallow;
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + bonus >= draft.ownKeeperDC;
  events.push({ type: "COUNTER_SHOT", byYou: false, roll, bonus, dc: draft.ownKeeperDC, goal });
  if (goal) {
    draft.oppGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals }); // goals:0 = concede marker
  }
  draft.ball = draft.bal.DICE.MIDFIELD;
  concludeRound(defs, draft, events);
}

function oppPassAttempt(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  const risk = oppInterceptionRisk(draft);
  if (rand(draft) < risk) {
    events.push({ type: "CHAIN_INTERCEPTED", byYou: true, passes: draft.oppPasses, chanceLost: draft.oppChance });
    // YOUR instant counter (breakaway: no zone penalty)
    const bonus = draft.bal.DICE.COUNTER_CHANCE + mutatorSum(draft.mutators, "counterSpring");
    const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
    const goal = roll + bonus >= draft.keeperDC;
    events.push({ type: "COUNTER_SHOT", byYou: true, roll, bonus, dc: draft.keeperDC, goal });
    if (goal) {
      draft.playerGoals += 1;
      events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
    }
    draft.ball = draft.bal.DICE.MIDFIELD;
    concludeRound(defs, draft, events);
    return;
  }
  draft.oppPasses += 1;
  draft.oppChance += Math.min(draft.bal.DICE.OPP_CHANCE_CAP, Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_CHANCE_PER_RATING));
  moveBall(draft, -draft.bal.DICE.OPP_PASS_ADVANCE, events);
  events.push({ type: "OPP_PASS", passes: draft.oppPasses, oppChance: draft.oppChance, risk });
  const target = draft.bal.DICE.OPP_CHAIN_TARGET[draft.opp.style] ?? 3;
  if (draft.oppPasses >= target || draft.ball <= draft.bal.DICE.YOUR_BOX) {
    // their shot: worked chance vs your keeper, with a distance penalty mirrored from your side
    const zonePen = draft.bal.DICE.ZONE_DC_PENALTY[4 - zoneOf(draft.ball, draft.bal)] ?? 0;
    const dc = draft.ownKeeperDC + zonePen;
    const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
    const goal = roll + draft.oppChance >= dc;
    events.push({ type: "OPP_SHOT", roll, danger: draft.oppChance, dc, goal });
    if (goal) {
      draft.oppGoals += 1;
      events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals });
    }
    draft.ball = draft.bal.DICE.MIDFIELD;
    concludeRound(defs, draft, events);
  }
}
```

`shoot` (no box requirement; zone penalty prices distance; possession must be yours with at least one pass):

```ts
function shoot(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.possession !== "you") throw new Error("you don't have the ball");
  if (draft.passes < 1) throw new Error("work at least one pass first");
  if (draft.shotQuality <= 0) throw new Error("no chance built — bank some Chance first");
  const { dc } = shotEstimate(draft);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + draft.shotQuality >= dc;
  events.push({ type: "SHOT_TAKEN", roll, dc, quality: draft.shotQuality, goal });
  if (goal) {
    draft.playerGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
  }
  draft.shotQuality = 0;
  draft.ball = draft.bal.DICE.MIDFIELD;
  concludeRound(defs, draft, events);
}
```

`startRound` (after `draft.round += 1`): reset `passes`, `nextChanceBonus`, `nextRiskDelta`, `defenseCommit`, `oppPasses`, `oppChance` to 0; `draft.shotQuality = 0` (a chance not shot is gone — the recycle decision matters); set `draft.possession = draft.round % 2 === 1 ? "you" : "them"`; roll dice + draw hand as today; roll intent ONLY when `possession === "you"` (their defensive posture), else `draft.intent = null` and skip `INTENT_REVEALED`.

`endRound`: your possession → just `concludeRound` (safe recycle). Their possession → `oppPassAttempt` (stand off), which itself concludes when their chain ends; if it neither intercepts nor shoots, the round CONTINUES (do not conclude — the player gets another decision).

Action switch: `SHOOT` calls `shoot(defs, draft, events)` (no separate `concludeRound` call — it's inside). `END_ROUND` calls `endRound`. `ASSIGN_DIE`/`REROLL_DIE` unchanged wiring. `playableCards` gains the possession-role gate (defense cards only on their possession, attack cards only on yours) using `isDefenseCard`. `bestDieFor` unchanged (scaling detection: `progressFromDie`/`shotQualityFromDie` want high dice).

`createDiceMatch`: initialize the six new fields to 0; remove `buildUp/chance/cover` init.

- [ ] **Step 6: Rework the card pool in `src/data/diceCards.ts`**

Replace `diceEffects` and level text (keep ids/kinds/positions/rarities/slots except where noted):

| Card | Slot | diceEffects | Text |
|---|---|---|---|
| d_shortpass | min 2 | `[{ kind: "progressFromDie" }]` | "A pass: move the ball up by the die." |
| d_drivingrun | min 3 | `[{ kind: "progress", amount: 4 }]` | "Carry it forward 4." |
| d_flankrun | min 4 | `[{ kind: "progress", amount: 3 }, { kind: "draw", amount: 1 }]` | "Move 3, draw 1." |
| d_quickcombo | min 4 | `[{ kind: "progress", amount: 2 }, { kind: "shotQuality", amount: 2 }]` | "Move 2, +2 Chance." |
| d_sideways (NEW, replaces d_overlap) | max 3 | `[{ kind: "safePass", amount: 0.12 }, { kind: "progress", amount: 1 }]` | "Recycle: your next pass is 12% safer, move 1." |
| d_throughball | min 5 | `[{ kind: "setupNext", bonus: 4 }, { kind: "progress", amount: 2 }]` | "Split the line: next finisher +4, move 2." |
| d_counter | min 3 | `[{ kind: "progress", amount: 3 }, { kind: "shotQuality", amount: 3 }]` | "Break fast: move 3, +3 Chance." |
| d_finish | min 5 | `[{ kind: "shotQualityFromDie" }]` | "Chance = the die. Finish the move." |
| d_poacher | parity even | `[{ kind: "shotQuality", amount: 5 }]` | "+5 Chance." |
| d_cross | min 4 | `[{ kind: "setupNext", bonus: 5 }]` | "Whip it in: next finisher +5." |
| d_longshot | min 6 | `[{ kind: "shotQuality", amount: 8 }]` | "+8 Chance. Let it fly." |
| d_tackle | max 2 | `[{ kind: "defend", amount: 0.18 }]` | "Defending: +18% chance you win their next pass." |
| d_clearance | max 3 | `[{ kind: "defend", amount: 0.12 }]` | "Defending: +12% on their next pass." |
| d_keeper | any | `[{ kind: "defend", amount: 0.08 }, { kind: "draw", amount: 1 }]` | "Defending: +8%, draw 1." |

`d_overlap` is deleted; `d_sideways` (name "Sideways Pass", position MF, rarity common) replaces it in the pool. Starting deck (16): shortpass ×2, drivingrun ×2, sideways ×2, throughball ×1, finish ×2, poacher ×1, tackle ×3, clearance ×2, keeper ×1.

In `src/data/content.ts`, Canada's kit: `mutators: [{ kind: "oppRiskDelta", amount: 0.06 }]`, blurb: "Hard to play through. Opponents misplace more passes against you."

- [ ] **Step 7: Run the chain tests until green**

Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/dice.test.ts`
Expected: PASS. Then confirm `tsc` fallout is confined:
Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit 2>&1 | grep -oE 'src/[^(]+' | sort -u`
Expected: only `src/sim/strategies.ts`, `src/sim/funProbe.ts`, `src/ui/diceUx.ts`, `src/ui/screens/DiceMatchScreen.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/balance.ts src/core/match/dice.ts src/data/diceCards.ts src/data/content.ts test/dice.test.ts
git commit -m "Core: possession chains — pass-by-pass push-your-luck with mirrored defense

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Sim — chain bots + probe

**Files:**
- Modify: `src/sim/strategies.ts`
- Modify: `src/sim/funProbe.ts`
- Test: existing suite (`test/fullRun.test.ts`, `test/passives.test.ts` field refs if any)

**Interfaces:**
- Consumes: `interceptionRisk`, `oppInterceptionRisk`, `shotEstimate`, `playableCards`, `bestDieFor` from `src/core/match/dice`; state fields `passes/oppPasses/oppChance/defenseCommit/possession/shotQuality`.
- Produces: `makeGreedyBot/makeDefensiveBot/makePushLuckyBot/makeRandomBot` with unchanged `Bot` signatures; funProbe prints per-nation JSON including `passesPerChain`, `interceptedShare`, `counterGoals`, plus the existing `runWin/shotsPerMatch/goalsPerMatch/oppGoalsPerMatch/pctDead/avgRolesAvail`.

- [ ] **Step 1: Rewrite `diceAction`**

Replace the lane logic in `src/sim/strategies.ts` (keep PUSH_DECISION + Brazil reroll blocks):

```ts
function diceAction(
  content: ContentBundle,
  m: DiceMatchState,
  opts: { greed: number; riskTolerance: number; pushLead: number },
): DiceMatchAction {
  if (m.phase === "PUSH_DECISION") {
    const lead = m.playerGoals - m.oppGoals;
    if (lead >= opts.pushLead && m.extraRoundsPlayed < m.bal.MAX_EXTRA_ROUNDS) return { type: "EXTRA_TIME" };
    return { type: "TAKE_WIN" };
  }
  if (m.rerollDieLeft > 0) {
    const worst = m.dice.map((d, i) => ({ d, i })).filter((x) => !x.d.used && x.d.value === 1)[0];
    if (worst) return { type: "REROLL_DIE", dieIndex: worst.i };
  }
  const playable = playableCards(content.defs, m);

  if (m.possession === "them") {
    // commit defense while their chance threatens; otherwise stand off
    const threat = m.oppChance >= m.ownKeeperDC - 12;
    if (threat) {
      for (const c of m.hand) {
        if (!playable.has(c.uid)) continue;
        const idx = bestDieFor(content.defs, m, c.uid);
        if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
      }
    }
    return { type: "END_ROUND" };
  }

  // your chain: shoot when the estimate is good enough or the next pass is too hot
  const est = shotEstimate(m);
  const risk = interceptionRisk(m);
  const canShoot = m.passes >= 1 && m.shotQuality > 0;
  if (canShoot && (est.p >= opts.greed || risk >= opts.riskTolerance)) return { type: "SHOOT" };

  // order: setup > chance-when-developed > progress; else anything playable
  const byRole = (want: (def: CardDef) => boolean): DiceMatchAction | null => {
    for (const c of m.hand) {
      if (!playable.has(c.uid)) continue;
      const def = content.defs[c.defId]!;
      if (!want(def)) continue;
      const idx = bestDieFor(content.defs, m, c.uid);
      if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
    }
    return null;
  };
  const effs = (d: CardDef) => d.diceEffects ?? [];
  const pick =
    (m.passes >= 1 ? byRole((d) => effs(d).some((e) => e.kind === "setupNext")) : null) ??
    (m.passes >= 1 ? byRole((d) => effs(d).some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie")) : null) ??
    byRole((d) => effs(d).some((e) => e.kind === "progress" || e.kind === "progressFromDie" || e.kind === "safePass")) ??
    byRole(() => true);
  if (pick) return pick;
  if (canShoot) return { type: "SHOOT" };
  return { type: "END_ROUND" };
}
```

Strategy params: greedy `{ greed: 0.62, riskTolerance: 0.3, pushLead: 2 }`, defensive `{ greed: 0.5, riskTolerance: 0.22, pushLead: 99 }`, pushlucky `{ greed: 0.78, riskTolerance: 0.42, pushLead: 1 }`. `roleOf`/`rewardScore`: defend = has a `defend` effect; finish = `shotQuality*`/`setupNext`; else progress. `makeRandomBot`: on their possession alternate commit/stand-off by `(m.round + m.oppPasses) % 2`; on yours, SHOOT when `m.passes >= 2 && m.shotQuality > 0 && (m.round + m.passes) % 3 === 0`, else play any playable card via `bestDieFor`, else END_ROUND.

- [ ] **Step 2: Update `funProbe.ts`**

Fix compile: `ROLE_OF` from new effect kinds (as `roleOf` above); `inBox` metric → replace `boxFinishBlocked` with chain metrics. Track per match: `chains` (possessions with ≥1 pass), `passesTotal`, `intercepted` (CHAIN_INTERCEPTED byYou:false), `oppIntercepted` (byYou:true), `counterGoalsFor/Against` (COUNTER_SHOT goal by side). Emit in `summarize`: `passesPerChain: (passesTotal/chains).toFixed(2)`, `interceptedShare: pct of your chains ending intercepted`, `counterGoalsFor/Against per match`. Keep `runWin`, `shotsPerMatch` (SHOT_TAKEN + COUNTER_SHOT byYou), `goalsPerMatch`, `oppGoalsPerMatch` (from `m.oppGoals` at MATCH_END or GOAL_SCORED goals:0 count), `pctDead`, `avgRolesAvail`.

- [ ] **Step 3: Verify**

Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit 2>&1 | grep -oE 'src/[^(]+' | sort -u`
Expected: only `src/ui/diceUx.ts`, `src/ui/screens/DiceMatchScreen.tsx`.
Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run`
Expected: PASS (fullRun completes; fix any stale field refs in run-layer tests minimally and note them).
Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsx src/sim/funProbe.ts`
Expected: four nation lines; `passesPerChain` between 1.5 and 4.5; runWin not all 0%/100%; `pctDead` reported (target ~0%, tuned in Task 4). Record the numbers in the report.

- [ ] **Step 4: Commit**

```bash
git add src/sim/strategies.ts src/sim/funProbe.ts test/
git commit -m "Sim: chain-aware bots and probe (passes/chain, interceptions, counters)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: UI — the chain screen

**Files:**
- Modify: `src/ui/diceUx.ts` (rewrite: chain copy + glossary)
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/ui/components/ScorePopups.tsx`
- Modify: `src/ui/styles/board.css`
- Test: `test/diceUi.test.ts` (rewrite)

**Interfaces:**
- Consumes: `interceptionRisk`, `oppInterceptionRisk`, `shotEstimate` from core; events `PASS_COMPLETED/CHAIN_INTERCEPTED/COUNTER_SHOT/OPP_PASS/DEFENSE_COMMITTED`.
- Produces: `diceUx.ts` exports `CHAIN_GLOSSARY: Record<string, string>` (Chance, Risk, Recycle, Stand off, Counter) and `describeChainStatus(input: { possession: "you" | "them"; passes: number; shotQuality: number; riskPct: number; oppPasses: number; oppChance: number; shootPct: number }): string` returning one plain-language coaching line.

- [ ] **Step 1: Rewrite `diceUx.ts` + its test**

Delete `PendingCommitSummary/describePendingCommit/describePressureStatus/DecisionCoachInput/describeDecisionCoach/LANE_GLOSSARY`. New `describeChainStatus`: possession "you" & passes 0 → "Open the move — your first pass is always safe."; passes ≥1 → `"Chance ${shotQuality} · shot ${Math.round(shootPct*100)}% · next pass ${Math.round(riskPct*100)}% risk."`; possession "them" → `"They're on pass ${oppPasses} building a ${oppChance}-chance. Commit defense or stand off."`. `test/diceUi.test.ts`: three cases asserting those strings (write test first, watch it fail, implement, pass).

- [ ] **Step 2: Rewrite the match screen's middle**

`DiceMatchScreen.tsx`: remove pending-commit staging (card click plays immediately), decision coach panel, duel preview, lane badges. Keep: scoreboard, pitch track + ball token, dice tray + reroll (cascade/spin animations), match log if present (feed it PASS_COMPLETED/OPP_PASS/CHAIN_INTERCEPTED/COUNTER_SHOT text), push-decision modal.

Your possession: chain strip `data-testid="chain-strip"` (one chip per PASS_COMPLETED this possession — track via a `useRef` list keyed on ROUND_START reset), Chance badge (`shotQuality`), risk badge `data-testid="chain-risk"` showing `Math.round(interceptionRisk(m)*100)%` (hidden at 0), SHOOT button labeled `⚽ Shoot (${Math.round(shotEstimate(m).p*100)}%)` enabled when `m.passes >= 1 && m.shotQuality > 0`, END_ROUND labeled "Recycle possession". Each card button shows its risk pre-click: when `m.passes >= 1`, a small `${Math.round(interceptionRisk(m)*100)}%` chip on attack cards.

Their possession: mirror panel `data-testid="their-chain"` with their passes/oppChance, your `defenseCommit` as `+${Math.round(m.defenseCommit*100)}%`, defense cards playable, END_ROUND labeled "Stand off". Glossary: `<details className="glossary"><summary>How this works</summary>…CHAIN_GLOSSARY entries…</details>` (collapsible, collapsed by default — the spec's glossary decision).

- [ ] **Step 3: Popups**

`ScorePopups.tsx`: keep SHOT_TAKEN/OPP_SHOT reels and GOAL/CONCEDED (guard `GOAL_SCORED && e.goals > 0` stays). Remove the `INTENT_EXECUTED` and `DUEL_RESOLVED` branches. Add: `CHAIN_INTERCEPTED` → big "🚫 TACKLED!" (kind "concede") when `!byYou`, "🎯 WON IT!" (kind "info") when `byYou`; `COUNTER_SHOT` → reuse `ShotRoll` with `roll/bonus/dc`, then "⚡ COUNTER GOAL" / "🧤 SAVED" by outcome and side. CSS: `.chain-strip`, `.chain-chip`, `.risk-badge` (amber → red as risk climbs via a `data-hot` attr at ≥30%), `.their-chain` panel.

- [ ] **Step 4: Verify + browser smoke**

Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit && PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run && PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vite build`
Expected: all clean — the WHOLE tree compiles from here on.
Browser (dev server for this worktree runs at http://127.0.0.1:5174/ — if down, start `pnpm dev -- --port 5174` with the Node-22 PATH): drive a run with the gstack browse CLI (`$HOME/.claude/skills/gstack/browse/dist/browse`; one click per `js` call, sleep between). Verify: pass chips appear as you play cards, risk % climbs, SHOOT shows a live %, a possession ends on shoot, round 2 shows the their-chain panel and Stand off works, `console --errors` clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ test/diceUi.test.ts
git commit -m "UI: chain screen — pass chips, live risk %, shoot estimate, their-chain mirror

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Balance to spec targets + GAME.md + save version

**Files:**
- Modify: `src/core/balance.ts` (DICE values only), possibly `src/data/diceCards.ts` amounts and `src/data/content.ts` mutator magnitudes
- Modify: `GAME.md` (§2–§8 rewritten for chains), `src/core/run/run.ts` + `src/save/persistence.ts` + `src/core/types.ts` (`version: 3` → `version: 4` in all three)

**Interfaces:** consumes funProbe output; produces tuned `DEFAULT_BALANCE.DICE`.

- [ ] **Step 1: Measure, then tune one knob at a time**

Run the probe; drive toward the spec targets:
- greedy run wins **15–25% per nation** (no nation > 35% or < 10%)
- `passesPerChain` **2–4** vs balanced opposition; `interceptedShare` 15–35%
- `goalsPerMatch` 1–2.5; `oppGoalsPerMatch` **0.3–0.6** (their chains and counters must sometimes score); `pctDead` ≤ 2%
Primary knobs: `RISK_BASE_*`, `RISK_RAMP`, `DEVELOPMENT_GAIN`, `ZONE_DC_PENALTY`, `OPP_RISK_BASE`, `OPP_CHANCE_PER_RATING`, `OPP_CHAIN_TARGET`, card `defend` amounts. Change one, re-run, keep a log in the report. If a target is unreachable without making opponents toothless, stop and report DONE_WITH_CONCERNS with the trade-off.

- [ ] **Step 2: Rewrite GAME.md**

§2 "The match — Possession Chains": the loop exactly as shipped (pass-by-pass, first pass safe, visible risk, shoot anytime with distance penalty, recycle, interception → instant counter, their mirrored chain + stand off/commit). §3 round resolution deleted (no duel). §4 shooting/conceding with the zone-penalty table. §6 card table matching Task 1's final data. §7 nations (Canada oppRiskDelta wording). §8 key numbers from the tuned balance. §9 rough edges honestly (whatever the probe still shows).

- [ ] **Step 3: Bump the save version**

`version: 3` → `version: 4` in `src/core/types.ts` (RunState literal), `src/core/run/run.ts:68`, and `src/save/persistence.ts:23` (`parsed.version !== 4`). Old saves discard cleanly.

- [ ] **Step 4: Full verification + commit**

Run: `PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit && PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run && PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vite build && PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsx src/sim/funProbe.ts`
Expected: clean, all pass, probe within targets (final numbers in the commit message).

```bash
git add src/core/balance.ts src/data/ GAME.md src/core/types.ts src/core/run/run.ts src/save/persistence.ts
git commit -m "Chains: balance to spec targets; GAME.md rewrite; save v4

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** chain loop w/ instant per-pass resolution → T1 S5; first pass safe → `interceptionRisk` passes===0; shoot anytime w/ zone punt penalty → `shoot`/`shotEstimate` + ZONE_DC_PENALTY; interception loses whole Chance + instant counter (shallow-loss scarier) → `chainIntercepted`; mirrored defense w/ commit-or-stand-off → `assignDie` them-branch + `oppPassAttempt` + END_ROUND semantics; development curve + combos (setupNext/safePass/Cross→finisher) → T1 S5/S6; 6 alternating possessions, counter inside same possession → `startRound` parity + counters calling `concludeRound`; nations remap (Canada oppRiskDelta, USA counterSpring on your counter) → T1 S6 + mutator union; deletions (lanes, duel, pending-commit, coach, preview) → T1 S5 + T3; collapsible glossary → T3 S2; tuning targets → T4 S1; GAME.md + version → T4 S2–S3. Screamer's long-range specialization is intentionally NOT special-cased (v1 uses the flat +8; noted as follow-up in GAME.md §9). No other gaps.

**Placeholder scan:** clean — every code step has complete code; the two card-table steps carry exact values.

**Type consistency:** `interceptionRisk/oppInterceptionRisk/shotEstimate` signatures identical in T1 (definition), T2 (bot), T3 (UI). Effect kinds (`defend/safePass/setupNext`) match across engine (T1 S5), cards (T1 S6), bots (T2), probe (T2). Event shapes in T1 S2 match consumers in T2 S2 and T3 S3. `possession: "you" | "them"` semantics consistent. `applyDiceEffect` returns `number` (chance gained) — used only in the you-branch; the them-branch ignores it (defend/draw return 0).
