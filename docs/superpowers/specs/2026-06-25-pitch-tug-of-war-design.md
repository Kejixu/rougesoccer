# Pitch Tug-of-War — defense as the mirror of attack

Status: APPROVED (design). Branch: `dice-mode`.

## Problem

Defense currently feels like a bolted-on side minigame. Your attack is one track
(push the ball Build-up → Midfield → Final Third → Box) while the opponent's
threat is a *separate abstract number* you tamp down by slotting low dice into
Tackle/Clearance to build a "Cover" stat. Two disconnected things happen at once,
and "absorb the threat number" is not how soccer feels.

## Goal

Make defense the same verb as attack, in the other direction: **one ball, one
pitch, a tug-of-war over field position.** Conceding becomes the mirror of
scoring. This is a change to the *match model only* — the run layer (settle, shop,
staff, group/bracket) is preserved.

Decided with the user:
- One shared ball on a full pitch (not two mirrored tracks, not positional Cover).
- Turnovers can **win the ball back** (counter), **slow** the advance, or **clear**
  it — three distinct defensive card types.
- On a turnover **the ball stays where it is and flips direction.**
- A **save flips possession** to the defending side.
- A **clearance gives up possession** (you cleared your lines, didn't win it).

## The model

### Pitch — a single shared track

```
 YOUR GOAL                    midfield                    THEIR GOAL
   │  Your Box │ Your Third │  ◯ kickoff  │ Their Third │ Their Box │
   0 ─────────────────────────── ball ───────────────────────────► MAX
        ◄── they push it this way      you push it this way ──►
```

A single integer **ball position** `ball` in `0..MAX`. Midfield (`MAX/2`) is the
kickoff/neutral center. Your plays push `ball` up toward `MAX` (their goal); when
they have possession their advance pushes it down toward `0` (your goal).

- `ball >= THEIR_BOX` in your possession → you may SHOOT.
- `ball <= YOUR_BOX` in their possession → they SHOOT on your keeper.

Exact distances (`MAX`, `THEIR_BOX`, `YOUR_BOX`, zone widths, advance amounts)
live in `balance.ts → DICE` so the sim can tune them. Zone names for the UI:
Your Box · Your Third · Midfield · Their Third · Their Box.

### Possession + the round loop

New match state: **`possession: "you" | "them"`**. The existing rhythm is kept —
you play dice, then the opponent resolves their telegraphed intent — but its
meaning depends on who holds the ball.

**You have possession:**
- Your plays advance `ball` toward their goal and build `shotQuality` (the
  existing progress/finish cards, largely unchanged but operating on `ball`).
- The opponent's intent is a *contest* (e.g. "High Press — they'll try to win it
  back"). At END_ROUND they roll to dispossess; if they win, possession flips to
  them **at the current `ball`** (losing it deep in attack is safe; losing it in
  your own third is dangerous).
- `ball >= THEIR_BOX` → SHOOT enabled.

**They have possession:**
- At END_ROUND their intent advances `ball` toward your goal by an amount derived
  from their attackRating (scaled by stage clock, as today).
- Your plays this round are defensive (see card types).
- `ball <= YOUR_BOX` and not stopped → they SHOOT on your keeper.

The old `cover` / `coverGainedThisRound` / abstract threat-meter path is **deleted**.

### Shooting and conceding mirror each other

- **You shoot:** `ball >= THEIR_BOX` + `shotQuality > 0` → `d20 + shotQuality vs
  theirKeeperDC` → goal or save.
- **They shoot:** `ball <= YOUR_BOX` → `d20 + theirDanger vs yourKeeperDC` →
  concede or your keeper saves. `theirDanger` accrues as they advance unopposed
  (or is derived from attackRating); tuned in `balance.ts`.
- A **save flips possession** to the defending side (goal kick / keeper claim).
- A **goal** restarts at midfield, conceding team kicks off.

This makes **keeper DC a two-way stat** — staff/upgrades that buy defense finally
matter — and conceding reads as the exact inverse of scoring.

### How you regain possession

- A **Tackle** card that lands flips the ball to you.
- Your keeper **saving** their shot.
- **Kickoff** at midfield after you concede.

## Cards

### Three defensive card types (new effect kinds)

- **Tackle → `winPossession`.** Win a duel, flip the ball to you at the current
  position. The counter-attack.
- **Block / contain → `pushBack`.** They keep the ball but advance less this round,
  or are shoved back N steps. Weathering the storm.
- **Clearance → `clearance`.** Set `ball` back to midfield. Relieves danger,
  concedes possession.

New `DiceEffect` variants: `{ kind: "winPossession" }`, `{ kind: "pushBack";
steps: number }`, `{ kind: "clearance" }`. The opponent-advance resolver is new in
`dice.ts`.

### Existing card mapping

- **Attack/progress** (shortpass, drivingrun, flankrun, quickcombo, throughball,
  overlap, counter): unchanged — advance `ball` when you have possession. Playable
  only in your possession.
- **Finish** (finish, poacher, cross, longshot): unchanged — build `shotQuality`
  near their box.
- **Defense** (tackle, clearance, keeper): reworked into the three types above.
  Keeper → save bonus / `+keeperDC` this round and claims possession on a save.

Slot requirements keep the low/mid/high → defend/progress/finish mapping and the
hand-of-4 "bite" tuning already in place. Cards are role-gated by possession:
attack cards are dead when defending and vice-versa, which deepens the posture
pressure the dice already create.

## Nation identities

- **Brazil "Joga Bonito"** (`rerollDie`, `poolDelta`, `keeperDcDelta`): untouched.
- **Mexico "La Ola"** (`poolDelta`, `keeperDcDelta`): untouched.
- **USA "The Press"**: `turnoverProgress` is reinterpreted/replaced — winning a
  tackle springs you forward (bonus advance on the counter), or tackles are easier
  to land. Now literally a pressing identity.
- **Canada "Resolute"**: `coverPerRound` is removed (Cover is gone). Replaced with
  a defensive identity — opponents advance fewer steps against you and/or your
  keeper DC is higher.

`DiceMutator` union changes (concrete):
- **Remove** `coverPerRound` (Cover no longer exists).
- **Add** `{ kind: "oppAdvanceDelta"; steps: number }` — negative steps = opponents
  advance fewer steps per push (Canada).
- **Replace** `turnoverProgress` with `{ kind: "counterSpring"; steps: number }` —
  on a won tackle, the ball jumps `steps` further up the pitch toward their goal
  (USA's press-to-counter). Magnitudes tuned via sim.

## What stays untouched (run-layer contract)

`settleMatch` and the run layer read: `playerGoals`, `oppGoals`, `hand`,
`drawPile`, `discardPile`, `exile`, `earned`, `extraRoundsPlayed`, `result`,
`rng`, plus the match clock (`MATCH_ROUNDS`, extra time, push-your-luck, sudden
death). All of these are preserved. Goals still drive everything; only how a goal
(for or against) is produced changes.

## UI

`DiceMatchScreen` pitch track becomes the full 5-zone shared pitch with:
- a **ball token** at `ball`, a **possession indicator** (your color vs theirs),
  and a **direction arrow**;
- your goal and their goal at the ends;
- the intent panel reframed: in your possession it shows how they'll contest; in
  their possession it shows how far/where they'll push.

The dice tray, reroll, shoot, and end-round controls are unchanged. Shoot is
enabled by `ball >= THEIR_BOX` in your possession; a new implicit "they shoot"
resolution fires when `ball <= YOUR_BOX` in their possession.

## Sim / strategies

`src/sim/strategies.ts` `diceAction` is updated: when defending, prefer
`winPossession` if a turnover is winnable, else `pushBack`/`clearance` by danger;
when attacking, the existing advance/finish/shoot logic. `roleOf` extended for the
new effect kinds. The `funProbe` bite metrics carry over (posture is now also
attack-vs-defend gated by possession).

## Testing

- Unit (`test/dice.test.ts`): possession flips on a landed tackle; clearance resets
  ball to midfield and concedes possession; save flips possession; opponent advance
  on their intent; they shoot and can score when `ball <= YOUR_BOX`; mirror of the
  player shot; match still terminates and produces win/draw/loss.
- Run (`test/fullRun.test.ts`): full campaign still completes; settle still reads
  goals; determinism holds.
- Balance: greedy run-win 15–25% target retained after retuning advance/DC
  constants; `funProbe` posture/bite stays healthy; opponents are not unbeatable
  nor trivial.

## Out of scope (follow-ups)

- New attacking cards beyond reworking the existing defensive three.
- Visible difficulty ramp UI (keeper DC climb / opponent tier badge).
- Mutator balance parity pass (Brazil still strongest — tracked separately).
- Remaining nations (Italy/Korea/Argentina).
