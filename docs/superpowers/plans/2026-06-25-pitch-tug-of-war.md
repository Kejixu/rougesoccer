# Pitch Tug-of-War Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dice-mode's two disconnected tracks (your progress + an abstract opponent threat meter) with one shared ball on a full pitch, where possession decides whether you attack or defend, and conceding mirrors scoring.

**Architecture:** A single integer `ball` position (0 = your goal, `PITCH_LEN` = their goal) plus a `possession` flag drives the whole match. Attack cards push the ball up and build shot quality; defensive cards win it back, shove it up, or clear it. The opponent's telegraphed intent contests you when you hold the ball and advances/shoots when they hold it. Change is confined to the dice match model (`src/core/match/dice.ts`, dice types, dice cards, dice UI, dice sim); the run layer is untouched.

**Tech Stack:** TypeScript (strict), Vitest, React 19, Vite, pnpm. Pure deterministic core (no DOM/Math.random/Date in `src/core`).

## Global Constraints

- `src/core/**` and `src/data/**` must not import `react`, `document`, `window`, `localStorage`, `Math.random`, or `Date.now` (enforced by `test/boundaries.test.ts`). All randomness goes through `state.rng` via the existing `rand`/`rollDie` helpers in `dice.ts`.
- Real country names only; NO FIFA branding; parody names only. (No new names in this plan.)
- The run-layer contract is frozen: `settleMatch` and callers read only `playerGoals`, `oppGoals`, `hand`, `drawPile`, `discardPile`, `exile`, `earned`, `extraRoundsPlayed`, `result`, `rng`, and the match clock (`MATCH_ROUNDS`, extra time, push-your-luck, sudden death). Do not remove or rename these fields on `DiceMatchState`.
- Commit after every green step. Run `pnpm exec tsc --noEmit` and `pnpm exec vitest run` before each commit; both must pass.
- The combat engine (`src/core/match/engine.ts`, `MatchState`, `src/ui/components/ClockBar.tsx`) is a separate model — do NOT touch it. Only `DiceMatchState` and dice-mode files change.

---

### Task 1: Tug-of-war engine (state, constants, resolution)

The core rewrite. Replace `zone`/`progress`/`cover`/`oppClockPoints` semantics with `ball`/`possession`, rewrite movement, shooting, the opponent resolver, and add the opponent's shot. All new behavior is unit-tested in `test/dice.test.ts`.

**Files:**
- Modify: `src/core/balance.ts` (the `DICE` block of `BalanceConfig` type + `DEFAULT_BALANCE`)
- Modify: `src/core/types.ts` (`DiceMatchState`, `DiceEffect`, `DiceMutator`, `GameEvent`)
- Modify: `src/core/match/dice.ts` (movement, shoot, resolveIntent, startRound, createDiceMatch, applyDiceEffect, playableCards)
- Test: `test/dice.test.ts` (rewrite the zone/cover-based tests)

**Interfaces:**
- Produces (consumed by Tasks 2–6):
  - `DiceMatchState` gains `ball: number`, `possession: "you" | "them"`, `ownKeeperDC: number`; loses `zone`, `progress`, `cover`, `coverGainedThisRound`, `oppClockPoints`, `turnoverPending`.
  - `DiceEffect` gains `{ kind: "winPossession" }`, `{ kind: "pushBack"; steps: number }`, `{ kind: "clearance" }`; loses `{ kind: "cover" }`, `{ kind: "coverFromDie" }`.
  - `DiceMutator` gains `{ kind: "oppAdvanceDelta"; amount: number }`, `{ kind: "counterSpring"; amount: number }`; loses `{ kind: "coverPerRound" }`, `{ kind: "turnoverProgress" }`.
  - `GameEvent` gains `{ type: "POSSESSION_WON" }`, `{ type: "POSSESSION_LOST" }`, `{ type: "BALL_MOVED"; ball: number; toward: "yours" | "theirs" }`, `{ type: "BALL_CLEARED"; ball: number }`, `{ type: "OPP_SHOT"; roll: number; danger: number; dc: number; goal: boolean }`; loses `{ type: "COVER_GAINED_D" }`, `{ type: "PROGRESS_GAINED" }`, `{ type: "ZONE_ADVANCED" }`.
  - Exported helper `zoneOf(ball: number, bal: BalanceConfig): number` (0–4) for UI + finish gating.

- [ ] **Step 1: Update the `DICE` balance shape and values**

In `src/core/balance.ts`, replace the `DICE` field of the `BalanceConfig` interface and the `DEFAULT_BALANCE.DICE` object. Remove `ZONES`, `PROGRESS_PER_ZONE`, `BOX_ZONE`, `OPP_GOAL_THRESHOLD`, `THREAT_SCALE`. Add the pitch + opponent fields.

Interface block (replace the existing `DICE: { ... }` in the interface):

```ts
  DICE: {
    POOL_SIZE: number;
    DIE_FACES: number;
    HAND_SIZE: number;
    PITCH_LEN: number;        // 0 = your goal, PITCH_LEN = their goal
    MIDFIELD: number;         // kickoff / neutral center
    ZONE_WIDTH: number;       // 5 zones of this width, for UI + finish gating
    THEIR_BOX: number;        // ball >= this in your possession -> you may shoot
    YOUR_BOX: number;         // ball <= this in their possession -> they shoot
    STEAL_LINE: number;       // hold the ball when pressed only if ball >= this
    KEEPER_DC_BASE: number;   // their keeper, your shots roll vs it
    KEEPER_DC_PER_RATING: number;
    OWN_KEEPER_DC_BASE: number; // your keeper, their shots roll vs it
    SHOT_DIE: number;         // d20
    OPP_ADVANCE_SCALE: number; // intent points -> ball steps toward your goal
    OPP_DANGER_PER_RATING: number; // their shot quality vs your keeper
    SIT_DEEP_DC_BONUS: number;
  };
```

`DEFAULT_BALANCE.DICE` value (replace existing):

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
    STEAL_LINE: 12,
    KEEPER_DC_BASE: 9,
    KEEPER_DC_PER_RATING: 0.14,
    OWN_KEEPER_DC_BASE: 10,
    SHOT_DIE: 20,
    OPP_ADVANCE_SCALE: 0.35,
    OPP_DANGER_PER_RATING: 0.5,
    SIT_DEEP_DC_BONUS: 4,
  },
```

- [ ] **Step 2: Update the dice types**

In `src/core/types.ts`:

Replace the `DiceEffect` union's cover variants. The full union becomes:

```ts
export type DiceEffect =
  | { kind: "progress"; amount: number } // push the ball toward their goal
  | { kind: "progressFromDie" } // progress equal to the slotted die's value
  | { kind: "advance"; zones: number } // jump zones directly
  | { kind: "shotQuality"; amount: number; minZone?: number } // banked chance quality
  | { kind: "shotQualityFromDie"; minZone?: number }
  | { kind: "winPossession" } // tackle: flip the ball to you where it is
  | { kind: "pushBack"; steps: number } // shove the ball up-pitch, they keep it
  | { kind: "clearance" } // boot the ball back to midfield, they keep it
  | { kind: "draw"; amount: number };
```

Replace the `DiceMutator` union:

```ts
export type DiceMutator =
  | { kind: "rerollDie"; perRound: number } // Brazil: opt-in single-die reroll
  | { kind: "keeperDcDelta"; amount: number } // raises THEIR keeper (harder for you to score)
  | { kind: "poolDelta"; amount: number } // Mexico +1 die / Brazil -1
  | { kind: "oppAdvanceDelta"; amount: number } // Canada: negative = they advance fewer steps
  | { kind: "counterSpring"; amount: number }; // USA: won tackle springs the ball forward
```

In `DiceMatchState`, remove `zone`, `progress`, `cover`, `coverGainedThisRound`, `oppClockPoints`, `turnoverPending`. Add:

```ts
  ball: number; // 0 = your goal, bal.DICE.PITCH_LEN = their goal
  possession: "you" | "them";
  ownKeeperDC: number; // their shots roll vs this
```

In `GameEvent`, remove `COVER_GAINED_D`, `PROGRESS_GAINED`, `ZONE_ADVANCED`. Add:

```ts
  | { type: "POSSESSION_WON" }
  | { type: "POSSESSION_LOST" }
  | { type: "BALL_MOVED"; ball: number; toward: "yours" | "theirs" }
  | { type: "BALL_CLEARED"; ball: number }
  | { type: "OPP_SHOT"; roll: number; danger: number; dc: number; goal: boolean }
```

- [ ] **Step 3: Write the failing engine tests**

Replace the `dice roll`, `slotting dice`, `advancing and shooting`, and `defending` describe-blocks in `test/dice.test.ts` with possession-based tests. Keep the `dice slot fit`, `nation mutators` (Task 3 will adjust), and `match terminates` blocks but update field references. Add this new block:

```ts
describe("tug-of-war", () => {
  it("starts at midfield in your possession", () => {
    const m = start(["d_shortpass"]);
    expect(m.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD);
    expect(m.possession).toBe("you");
    expect(m.shotQuality).toBe(0);
  });

  it("a progress play pushes the ball toward their goal", () => {
    let m = start(Array.from({ length: 6 }, () => "d_shortpass"), "adv");
    const before = m.ball;
    const die = m.dice.find((d) => !d.used && d.value >= 2)!;
    const idx = m.dice.indexOf(die);
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand.find((c) => c.defId === "d_shortpass")!.uid, dieIndex: idx }).state;
    expect(m.ball).toBe(before + die.value);
  });

  it("you cannot shoot until the ball reaches their box", () => {
    const m = start(["d_finish"]);
    expect(m.ball).toBeLessThan(DEFAULT_BALANCE.DICE.THEIR_BOX);
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" })).toThrow();
  });
});
```

(Use the existing `start(defIds, seed, mutators)` helper. `playWith`/`inst` stay as-is. Tests that referenced `m.zone`/`m.progress`/`m.cover` must be rewritten to `m.ball`/`m.possession`; delete the `defending`/Clearance-cover test — Task 2 replaces it.)

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm exec vitest run test/dice.test.ts`
Expected: FAIL (compile errors on removed fields, or assertion failures on `ball`/`possession`).

- [ ] **Step 5: Rewrite movement + shooting helpers in `dice.ts`**

Replace `gainProgress`/`advanceZones` with ball movement, add `zoneOf`, and rewrite `applyDiceEffect` and `shoot`.

```ts
export function zoneOf(ball: number, bal: BalanceConfig): number {
  return Math.max(0, Math.min(4, Math.floor(ball / bal.DICE.ZONE_WIDTH)));
}

function moveBall(draft: DiceMatchState, steps: number, events: GameEvent[]): void {
  const next = Math.max(0, Math.min(draft.bal.DICE.PITCH_LEN, draft.ball + steps));
  draft.ball = next;
  events.push({ type: "BALL_MOVED", ball: next, toward: steps >= 0 ? "theirs" : "yours" });
}
```

`applyDiceEffect` (replace the body):

```ts
  switch (eff.kind) {
    case "progress":
      moveBall(draft, eff.amount, events);
      break;
    case "progressFromDie":
      moveBall(draft, dieValue, events);
      break;
    case "advance":
      moveBall(draft, eff.zones * draft.bal.DICE.ZONE_WIDTH, events);
      break;
    case "shotQuality":
      if (zoneOf(draft.ball, draft.bal) >= (eff.minZone ?? 0)) draft.shotQuality += eff.amount;
      break;
    case "shotQualityFromDie":
      if (zoneOf(draft.ball, draft.bal) >= (eff.minZone ?? 0)) draft.shotQuality += dieValue;
      break;
    case "winPossession":
      draft.possession = "you";
      moveBall(draft, mutatorSum(draft.mutators, "counterSpring"), events); // USA spring
      events.push({ type: "POSSESSION_WON" });
      break;
    case "pushBack":
      moveBall(draft, eff.steps, events);
      break;
    case "clearance":
      draft.ball = draft.bal.DICE.MIDFIELD;
      events.push({ type: "BALL_CLEARED", ball: draft.ball });
      break;
    case "draw":
      drawCards(draft, eff.amount, events);
      break;
  }
```

`shoot` (replace): require possession + box; on resolve, flip possession to them at midfield.

```ts
function shoot(draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.possession !== "you") throw new Error("you don't have the ball");
  if (draft.ball < draft.bal.DICE.THEIR_BOX) throw new Error("you must reach the box to shoot");
  if (draft.shotQuality <= 0) throw new Error("no shot quality — work a chance first");
  const dc = draft.keeperDC + (draft.intent?.kind === "sitDeep" ? draft.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const total = roll + draft.shotQuality;
  const goal = total >= dc;
  events.push({ type: "SHOT_TAKEN", roll, dc, quality: draft.shotQuality, goal });
  if (goal) {
    draft.playerGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
  }
  draft.shotQuality = 0;
  draft.possession = "them";
  draft.ball = draft.bal.DICE.MIDFIELD; // their kickoff / goal kick
}
```

- [ ] **Step 6: Add the opponent's shot and rewrite `resolveIntent`**

Add `oppShoot`, rewrite `resolveIntent` to be possession-aware. Delete `addOppPoints`.

```ts
function oppShoot(draft: DiceMatchState, events: GameEvent[]): void {
  const danger = Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_DANGER_PER_RATING);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + danger >= draft.ownKeeperDC;
  events.push({ type: "OPP_SHOT", roll, danger, dc: draft.ownKeeperDC, goal });
  if (goal) {
    draft.oppGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals }); // goals:0 marks a concede
  }
  draft.possession = "you"; // kickoff after a goal, or your keeper claims the save
  draft.ball = draft.bal.DICE.MIDFIELD;
}

function resolveIntent(draft: DiceMatchState, events: GameEvent[]): void {
  const intent = draft.intent;
  if (!intent) return;
  const etMult = draft.mode === "extratime" ? draft.bal.EXTRA_TIME_CLOCK_MULT : 1;

  if (draft.possession === "you") {
    // they contest: a press/attack wins the ball back unless you got it deep
    if ((intent.kind === "attack" || intent.kind === "counter") && draft.ball < draft.bal.DICE.STEAL_LINE) {
      draft.possession = "them";
      events.push({ type: "POSSESSION_LOST" });
    }
    if (intent.kind === "press") {
      draft.handPenalty = 1;
      draft.diePenalty = 1;
    }
  } else {
    // they have it: advance toward your goal, shoot if they reach your box
    const points = intent.kind === "attack" || intent.kind === "counter" ? intent.points : 4;
    const base = Math.round(points * draft.bal.DICE.OPP_ADVANCE_SCALE * etMult);
    const steps = Math.max(1, base + mutatorSum(draft.mutators, "oppAdvanceDelta"));
    moveBall(draft, -steps, events);
    if (draft.ball <= draft.bal.DICE.YOUR_BOX) oppShoot(draft, events);
  }
  events.push({ type: "INTENT_EXECUTED", intent, blocked: 0, points: 0, oppGoals: draft.oppGoals });
  draft.intent = null;
}
```

(Keep the `INTENT_EXECUTED` event so `ScorePopups` and tests that read it still type-check; `blocked`/`points` are now always 0.)

- [ ] **Step 7: Update `startRound` and `createDiceMatch`**

In `startRound`, delete the `cover`/`coverGainedThisRound` lines and the `turnoverPending` block (Cover and USA-turnover are gone). Keep the dice roll, reroll budget, hand draw, and intent roll.

In `createDiceMatch`, replace the removed fields in the initial state with:

```ts
    ball: cfg.balance.DICE.MIDFIELD,
    possession: "you",
    ownKeeperDC: cfg.balance.DICE.OWN_KEEPER_DC_BASE + passiveSumPlain(cfg.passives ?? [], "blockPerRound"),
```

Add a tiny pure helper (config passives aren't on `draft` yet at construction):

```ts
function passiveSumPlain(passives: PassiveEffect[], kind: PassiveEffect["kind"]): number {
  let total = 0;
  for (const p of passives) if (p.kind === kind && "amount" in p) total += p.amount;
  return total;
}
```

Remove `zone`, `progress`, `cover`, `coverGainedThisRound`, `oppClockPoints`, `turnoverPending` from the initializer.

- [ ] **Step 8: Gate `playableCards` and `SHOOT`/`shoot` by possession; gate die-fit unchanged**

A card is usable now only if its role matches possession. Add a helper and use it in `playableCards`:

```ts
function isDefenseCard(def: CardDef | undefined): boolean {
  return (def?.diceEffects ?? []).some(
    (e) => e.kind === "winPossession" || e.kind === "pushBack" || e.kind === "clearance",
  );
}

export function playableCards(defs: CardDefMap, state: DiceMatchState): Set<string> {
  const free = state.dice.filter((d) => !d.used).map((d) => d.value);
  const out = new Set<string>();
  for (const c of state.hand) {
    const def = defs[c.defId];
    const slot = def?.slot;
    if (!slot) continue;
    const roleOk = isDefenseCard(def) ? state.possession === "them" : state.possession === "you";
    if (roleOk && free.some((v) => dieFitsSlot(v, slot))) out.add(c.uid);
  }
  return out;
}
```

In `assignDie`, before applying effects, reject role-mismatched plays:

```ts
  const roleOk = isDefenseCard(def) ? draft.possession === "them" : draft.possession === "you";
  if (!roleOk) throw new Error("that card can't be played right now");
```

(`CardDef` is already imported via `CardDefMap`; add `CardDef` to the type import list from `../types`.)

- [ ] **Step 9: Run the engine tests to verify they pass**

Run: `pnpm exec vitest run test/dice.test.ts`
Expected: PASS (the `tug-of-war` block and updated existing tests). Fix any remaining `zone`/`cover` references in the test file.

- [ ] **Step 10: Typecheck the whole tree**

Run: `pnpm exec tsc --noEmit 2>&1 | head -30`
Expected: errors ONLY in `src/ui/screens/DiceMatchScreen.tsx`, `src/sim/strategies.ts`, `src/sim/funProbe.ts` (fixed in Tasks 4–5) and possibly `src/data/content.ts` (Task 3). No errors in `src/core/**`. Note them; do not fix yet.

- [ ] **Step 11: Commit**

```bash
git add src/core/balance.ts src/core/types.ts src/core/match/dice.ts test/dice.test.ts
git commit -m "Dice: tug-of-war engine — one ball, possession, mirrored shot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rework the card pool for possession

Turn the three defensive cards into the new effect types, remap finish-card `minZone` to the 5-zone pitch, and verify possession gating end-to-end.

**Files:**
- Modify: `src/data/diceCards.ts`
- Test: `test/dice.test.ts` (new `defending` block)

**Interfaces:**
- Consumes: `DiceEffect` `winPossession`/`pushBack`/`clearance` (Task 1); `zoneOf` zone indices (their third = 3, their box = 4).
- Produces: `d_tackle` → `winPossession`; `d_clearance` → `clearance`; `d_keeper` → `pushBack`; finish cards gated at zone 3/4.

- [ ] **Step 1: Write the failing defensive tests**

Add to `test/dice.test.ts`:

```ts
describe("defending", () => {
  function defendingState(defIds: string[], seed = "def") {
    let m = start(defIds, seed);
    m = { ...m, possession: "them", ball: 6 }; // they have it, near your third
    return m;
  }

  it("a Tackle wins possession back where the ball is", () => {
    let m = defendingState(["d_tackle", "d_tackle", "d_tackle", "d_tackle"]);
    const idx = m.dice.findIndex((d) => !d.used && d.value <= 2);
    if (idx >= 0) {
      const before = m.ball;
      m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: idx }).state;
      expect(m.possession).toBe("you");
      expect(m.ball).toBe(before); // no nation spring by default
    }
  });

  it("a Clearance boots the ball to midfield, they keep it", () => {
    let m = defendingState(["d_clearance", "d_clearance", "d_clearance", "d_clearance"]);
    const idx = m.dice.findIndex((d) => !d.used && d.value <= 3);
    if (idx >= 0) {
      m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: idx }).state;
      expect(m.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD);
      expect(m.possession).toBe("them");
    }
  });

  it("attack cards can't be played while defending", () => {
    const m = defendingState(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"]);
    const playable = playableCards(DICE_CARD_MAP, m);
    expect(playable.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run test/dice.test.ts -t defending`
Expected: FAIL (tackle still has `coverFromDie`, etc.).

- [ ] **Step 3: Rework the defensive cards**

In `src/data/diceCards.ts`, replace the three defensive card `diceEffects` and `levels.text`:

```ts
  // d_tackle (slot max 2): win possession
  { ...keep id/kind/name/position/rarity/slot: { kind: "max", value: 2 },
    diceEffects: [{ kind: "winPossession" }],
    levels: [{ text: "Defending, slot 2 or less: win the ball back." }], effects: [] },

  // d_clearance (slot max 3): clearance
  { ...slot: { kind: "max", value: 3 },
    diceEffects: [{ kind: "clearance" }],
    levels: [{ text: "Defending, slot 3 or less: boot the ball to midfield." }], effects: [] },

  // d_keeper (slot any -> keep, but now pushBack): shove them up-pitch
  { ...slot: { kind: "any" },
    diceEffects: [{ kind: "pushBack", steps: 4 }, { kind: "draw", amount: 1 }],
    levels: [{ text: "Defending, slot any die: push them back 4, draw 1." }], effects: [] },
```

(Edit the existing objects in place — keep their `id`, `kind`, `name`, `position`, `rarity`. Only `slot` stays/where noted, `diceEffects`, and `levels` change.)

- [ ] **Step 4: Remap finish-card zones to the full pitch**

The pitch is now 5 zones (0 your box … 4 their box). "Final third" = zone 3, "box" = zone 4. Update `minZone` in `src/data/diceCards.ts`:
- `d_throughball` shotQuality `minZone: 2` → `minZone: 3`
- `d_finish` shotQualityFromDie `minZone: 3` → `minZone: 4`
- `d_poacher` shotQuality `minZone: 3` → `minZone: 4`
- `d_cross` shotQuality `minZone: 2` → `minZone: 3`
- `d_longshot` shotQuality `minZone: 2` → `minZone: 3`
- `d_counter` shotQuality `minZone: 3` → `minZone: 4`

- [ ] **Step 5: Run defending tests + full dice suite**

Run: `pnpm exec vitest run test/dice.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/diceCards.ts test/dice.test.ts
git commit -m "Dice: defensive cards become tackle/clearance/pushback; finish zones remapped

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Nation identities for the new model

Replace the two Cover-based mutators with the press (USA) and resolute-defense (Canada) identities, and update content + the mutator tests.

**Files:**
- Modify: `src/data/content.ts` (`NATION_DICE_KITS`)
- Test: `test/dice.test.ts` (`nation mutators` block)

**Interfaces:**
- Consumes: `DiceMutator` `oppAdvanceDelta`/`counterSpring` (Task 1); `winPossession` spring + opponent advance (Task 1).
- Produces: USA `counterSpring`, Canada `oppAdvanceDelta`; Brazil/Mexico unchanged.

- [ ] **Step 1: Update the mutator tests**

In `test/dice.test.ts`, replace the `poolDelta adds dice; coverPerRound...` and the cover-related assertions with:

```ts
  it("USA counterSpring: a won tackle springs the ball forward", () => {
    let m = start(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "usa", [{ kind: "counterSpring", amount: 4 }]);
    m = { ...m, possession: "them", ball: 6 };
    const idx = m.dice.findIndex((d) => !d.used && d.value <= 2);
    if (idx >= 0) {
      m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: idx }).state;
      expect(m.possession).toBe("you");
      expect(m.ball).toBe(10); // 6 + 4 spring
    }
  });

  it("Canada oppAdvanceDelta: opponents advance fewer steps", () => {
    const plainSteps = (delta: number) => {
      let m = start(["d_clearance"], "can", delta ? [{ kind: "oppAdvanceDelta", amount: delta }] : []);
      m = { ...m, possession: "them", ball: 12, intent: { kind: "attack", points: 12 } };
      const after = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
      return 12 - after.ball;
    };
    expect(plainSteps(-2)).toBeLessThan(plainSteps(0));
  });
```

Keep the existing `keeperDcDelta` and `poolDelta` (dice-count) and Brazil-reroll tests; just delete the `coverPerRound`/cover assertions.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run test/dice.test.ts -t "nation mutators"`
Expected: FAIL.

- [ ] **Step 3: Update `NATION_DICE_KITS`**

In `src/data/content.ts`, replace the `usa` and `can` kits (keep `bra`, `mex`):

```ts
  usa: {
    identity: "The Press",
    blurb: "Hunt the ball high. Win a tackle and you spring straight into the counter.",
    mutators: [{ kind: "counterSpring", amount: 4 }],
  },
  can: {
    identity: "Resolute",
    blurb: "Hard to break down. Opponents claw forward a step at a time against you.",
    mutators: [{ kind: "oppAdvanceDelta", amount: -2 }],
  },
```

- [ ] **Step 4: Run mutator tests + typecheck**

Run: `pnpm exec vitest run test/dice.test.ts && pnpm exec tsc --noEmit 2>&1 | grep -c 'content.ts'`
Expected: dice tests PASS; `content.ts` error count `0`.

- [ ] **Step 5: Commit**

```bash
git add src/data/content.ts test/dice.test.ts
git commit -m "Dice: USA press-to-counter, Canada resolute defense (drop Cover mutators)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Sim strategies + balance probe

Teach the bots to defend and re-point the fun probe at `ball`/`possession`, so balance can be measured.

**Files:**
- Modify: `src/sim/strategies.ts`
- Modify: `src/sim/funProbe.ts`

**Interfaces:**
- Consumes: `playableCards` (possession-gated), `DiceMatchState.ball`/`possession`, `bestDieFor`.
- Produces: a greedy bot that defends when `possession === "them"` and attacks otherwise; a passing `pnpm sim` and `funProbe`.

- [ ] **Step 1: Rewrite `diceAction` for possession**

In `src/sim/strategies.ts`, replace `incomingThreat`/`roleOf` cover logic. New `roleOf` and decision:

```ts
function roleOf(def: CardDef): "defend" | "finish" | "progress" {
  const effs = def.diceEffects ?? [];
  if (effs.some((e) => e.kind === "winPossession" || e.kind === "pushBack" || e.kind === "clearance")) return "defend";
  if (effs.some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie")) return "finish";
  return "progress";
}
```

Replace the body of `diceAction` after the PUSH_DECISION + reroll blocks:

```ts
  const playable = playableCards(content.defs, m);

  if (m.possession === "them") {
    // win it back if we can; else clear/push when the ball is near our box
    const tackle = assignFor(content, m, playable, "defend");
    if (tackle) return tackle;
    return { type: "END_ROUND" };
  }

  const inBox = m.ball >= m.bal.DICE.THEIR_BOX;
  const dc = m.keeperDC + (m.intent?.kind === "sitDeep" ? m.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const shootThreshold = Math.max(opts.shootFloor, dc - 9);
  if (inBox) {
    if (m.shotQuality < shootThreshold) {
      const fin = assignFor(content, m, playable, "finish");
      if (fin) return fin;
    }
    if (m.shotQuality > 0) return { type: "SHOOT" };
  }
  const adv = assignFor(content, m, playable, "progress");
  if (adv) return adv;
  for (const c of m.hand) {
    if (!playable.has(c.uid)) continue;
    const idx = bestDieFor(content.defs, m, c.uid);
    if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
  }
  if (inBox && m.shotQuality > 0) return { type: "SHOOT" };
  return { type: "END_ROUND" };
```

Delete `incomingThreat` and its use. Update `makeRandomBot`'s `m.zone >= m.bal.DICE.BOX_ZONE` references to `m.ball >= m.bal.DICE.THEIR_BOX`, and add a possession guard so it only SHOOTs in your possession.

- [ ] **Step 2: Re-point `funProbe.ts`**

In `src/sim/funProbe.ts`: change `m.zone >= m.bal.DICE.BOX_ZONE` → `m.ball >= m.bal.DICE.THEIR_BOX`; the bite metrics (`rolesDoable`, `boxFinishBlocked`) keep working via `playableCards`. (The probe is a throwaway; minimal edits to compile and run.)

- [ ] **Step 3: Typecheck + run the sim**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20 && pnpm exec tsx src/sim/funProbe.ts 2>&1 | tail -4`
Expected: tsc clean; probe prints four nation lines with non-zero `shotsPerMatch` and run-win rates that are not all 0% or all 100%.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm exec vitest run`
Expected: PASS (fullRun completes; determinism holds). Fix any `fullRun.test.ts` assertions that referenced removed fields if they appear.

- [ ] **Step 5: Commit**

```bash
git add src/sim/strategies.ts src/sim/funProbe.ts
git commit -m "Dice sim: bots defend on turnover; probe reads ball/possession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Match UI — the full pitch

Render the shared pitch with a ball token, possession indicator, direction, both goals, and the opponent's shot; gate Shoot by possession.

**Files:**
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/ui/components/ScorePopups.tsx` (handle `OPP_SHOT`)
- Modify: `src/ui/styles/board.css`

**Interfaces:**
- Consumes: `DiceMatchState.ball`/`possession`/`ownKeeperDC`, `zoneOf`, `OPP_SHOT` event.

- [ ] **Step 1: Replace `PitchTrack` with a full-pitch ball track**

In `DiceMatchScreen.tsx`, rewrite `PitchTrack` to render 5 zones (Your Box · Your Third · Midfield · Their Third · Their Box) with goals at each end, place a ball token at `zoneOf(m.ball, m.bal)`, color it by `m.possession`, and show a direction arrow (→ when `possession==="you"`, ← when `"them"`). Replace the `inBox`/`m.zone`/`m.cover` reads:

```tsx
import { ZONE_NAMES, bestDieFor, zoneOf } from "../../core/match/dice";
// ...
const inBox = m.possession === "you" && m.ball >= m.bal.DICE.THEIR_BOX;
const ballZone = zoneOf(m.ball, m.bal);
```

Set `ZONE_NAMES` in `dice.ts` to `["Your Box", "Your Third", "Midfield", "Their Third", "Their Box"]`. Remove the `m.cover > 0` Cover badge. Add a possession badge: `{m.possession === "you" ? "● You on the ball" : "○ Defending"}`.

- [ ] **Step 2: Gate Shoot + relabel the action bar by possession**

The Shoot button stays but is disabled unless `inBox && m.shotQuality > 0`. When `m.possession === "them"`, the hand shows only defensive cards (already enforced by `playableCards`); the End-round button label becomes `End round — they advance` (or `they shoot` when `m.ball <= m.bal.DICE.YOUR_BOX`).

- [ ] **Step 3: Show the opponent's shot in `ScorePopups`**

In `src/ui/components/ScorePopups.tsx`, add an `OPP_SHOT` branch mirroring `SHOT_TAKEN`: a reel for `roll`, then `🧤 SAVED!` (your keeper) on `!goal` or `⚽ CONCEDED` on `goal`. Reuse the `ShotRoll` component with their `danger`/`dc`.

```tsx
} else if (e.type === "OPP_SHOT") {
  staged.push({ delay, popup: { id: nextId++, kind: e.goal ? "concede" : "info",
    node: <ShotRoll roll={e.roll} quality={e.danger} dc={e.dc} /> } });
  delay += 900;
  staged.push({ delay, popup: { id: nextId++, kind: e.goal ? "concede" : "goal",
    text: e.goal ? "⚽ CONCEDED" : "🧤 SAVED!" } });
  delay += 600;
}
```

(Guard the `GOAL_SCORED` branch so a concede — `goals === 0` — does not also fire "GOAL!": `if (e.type === "GOAL_SCORED" && e.goals > 0)`.)

- [ ] **Step 4: Pitch CSS**

In `board.css`, add a `.ball-token`, `.ball-token.theirs` (their color), a `.pitch-arrow`, and `.goal-end` markers. Keep the existing `.pitch-zone` styling. (Concrete rules: token is an absolutely-positioned dot inside the current zone; arrow is a unicode glyph colored by possession.)

- [ ] **Step 5: Browser smoke test**

Start/confirm dev server on 5199. Drive a run via the browse tool: pick USA, kick off, play to a shot, and force a defend phase (END_ROUND repeatedly until `possession==="them"`). Verify: ball token moves, possession badge flips, an `OPP_SHOT` reel appears when they reach your box, no console errors.

Run: `BROWSE="$HOME/.claude/skills/gstack/browse/dist/browse"; "$BROWSE" console --errors`
Expected: `(no console errors)`.

- [ ] **Step 6: Typecheck, test, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec vitest run
git add src/ui/screens/DiceMatchScreen.tsx src/ui/components/ScorePopups.tsx src/ui/styles/board.css src/core/match/dice.ts
git commit -m "Dice UI: full shared pitch, ball token, possession, opponent shot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Balance pass + save version bump

Tune the new constants so the greedy bot wins 15–25% of runs, conceding feels fair, and bump the save version so stale saves are discarded.

**Files:**
- Modify: `src/core/balance.ts` (DICE constants, via sim iteration)
- Modify: `src/core/types.ts` (`RunState.version`)
- Modify: `src/core/run/run.ts` (only if a `version` literal is set there)

**Interfaces:**
- Consumes: `funProbe`/`runSim` outputs.
- Produces: tuned constants; `RunState.version` incremented.

- [ ] **Step 1: Measure current balance**

Run: `pnpm exec tsx src/sim/funProbe.ts`
Record run-win %, `goalsPerMatch`, and a concede rate (add `oppGoalsPerMatch` to the probe if absent). Note which nations are out of the 15–25% band.

- [ ] **Step 2: Tune toward targets**

Adjust, re-measuring after each change (one knob at a time):
- Greedy too low everywhere → lower `OPP_ADVANCE_SCALE` or `OPP_DANGER_PER_RATING`, or raise `OWN_KEEPER_DC_BASE`.
- Games too easy → opposite.
- Too few shots → lower `THEIR_BOX` or raise progress; too many concedes → raise `OWN_KEEPER_DC_BASE`.
Target: greedy 15–25% run wins (Brazil may sit higher as the flair pick — acceptable, note it), `goalsPerMatch` 1.5–3, neither team shut out across a run.

- [ ] **Step 3: Bump the save version**

In `src/core/types.ts`, increment `RunState.version` (currently 2 → 3). Confirm the save/migrate path discards mismatched versions (no migration needed — dice saves are throwaway).

Run: `grep -rn "version: 2\|version === \|RUN_VERSION" src/core src/save`
Apply the bump wherever the literal `2` is written for a new run.

- [ ] **Step 4: Full verification**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec tsx src/sim/funProbe.ts | tail -4`
Expected: tsc clean, all tests pass, probe within targets.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts src/core/types.ts src/core/run/run.ts
git commit -m "Dice: balance the tug-of-war; bump save version

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Pitch single track → Task 1 (constants, `ball`, `zoneOf`). ✓
- Possession + round loop → Task 1 (`resolveIntent`, gating), Task 4 (bot). ✓
- Mirrored shooting/conceding + two-way keeper DC → Task 1 (`shoot`, `oppShoot`, `ownKeeperDC`). ✓
- Three defensive card types → Task 1 (effects) + Task 2 (cards). ✓
- Turnover keeps ball position; clearance to midfield concedes possession; save flips possession → Task 1 (`shoot`/`oppShoot`/`winPossession`/`clearance`). ✓
- Nation reinterpretation (USA counterSpring, Canada oppAdvanceDelta, drop coverPerRound/turnoverProgress) → Task 1 (mutator union) + Task 3 (kits). ✓
- Run-layer contract preserved → no run-layer task; Global Constraints + Task 6 version bump only. ✓
- UI full pitch + opponent shot → Task 5. ✓
- Testing plan (possession flips, clearance, save, opp advance/shoot, termination, determinism, balance) → Tasks 1–4, 6. ✓

**Placeholder scan:** Step 4 CSS in Task 5 is described rather than shown — acceptable (cosmetic, no logic); all logic steps include code. No TBD/TODO.

**Type consistency:** `winPossession`/`pushBack`/`clearance` used identically in types (Task 1), cards (Task 2), sim `roleOf` (Task 4). `counterSpring`/`oppAdvanceDelta` carry `amount` so the existing `mutatorSum` (reads `.amount`) works unchanged. `OPP_SHOT` event shape consistent between `oppShoot` (Task 1) and `ScorePopups` (Task 5). `zoneOf` signature identical across Tasks 1/5.

**Out of scope (unchanged from spec):** new attacking cards, visible difficulty-ramp UI, mutator parity pass, remaining nations.
