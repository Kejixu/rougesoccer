# Possession Chain — push-your-luck passages of play

Status: APPROVED (design). Branch: `feature/momentum-duel`.

## Problem

Momentum Duel made rounds legible, but committing cards into lanes is the same
decision repeated: to attack you fill the Build-Up bucket three times, nothing
visible happens per play, and all consequence defers to "Resolve duel". Multiple
plays per round are fine (StS, Dicey, Balatro all do it); plays that are
*interchangeable and feedback-free* are not.

## The design (decided with the user)

Replace lane-filling with a **possession chain**: you build a passage of play one
pass at a time, the shot you're constructing visibly grows, and every extra pass
raises the chance the defense takes the ball. Chaining sequence chosen over
one-big-play; risk driven by **greed** (chain length), with **opponent pressure as
the baseline dial**; defense is the **mirror** (the opponent chains, you break it
up) — all three picked explicitly by the user.

Core loop of one attacking possession:

1. Roll dice, draw hand (as today: 5 dice, hand 4).
2. **Play a card + fitting die = one pass.** The pass resolves IMMEDIATELY: the
   ball advances up the pitch, **Chance** (your building shot) grows, and the
   move develops (combo state). No pending-commit step, no end-of-round lane dump.
3. **After the first pass, every further pass risks interception.** The risk is
   visible before you click: `base(opponent pressure) + ramp × (passes beyond the
   first)`. The first pass is always safe — you can't bust on the deal.
4. **At any point you may SHOOT** — `d20 + Chance vs keeper DC + zone penalty`
   (box +0, their third +3, midfield +6 — a first-pass shot is a hopeful punt,
   a worked chance is earned).
5. **Intercepted → the whole banked Chance is lost**, and the opponent springs an
   **instant counter**: one quick shot-chance roll against your keeper, modified
   by where the ball was lost (lose it high = mild; lose it near midfield with
   your shape committed = dangerous). One fast, scary beat — not a full possession.
6. Shot (either outcome) or interception ends the possession.

The decision that makes it fun, every possession: *"I've got a decent chance —
cash it, or one more pass for a great one and risk the lot?"*

### Defense — the mirror (user chose the mirror over passive Cover)

On their possession, **the opponent chains visibly** pass-by-pass, with their
Chance and their risk meter on screen. You roll dice as normal; **your defensive
cards (Tackle / Clearance / Keeper) commit dice to raise their interception risk**
before their next pass check. Their AI greed is style-driven (possession teams
chain long, counter teams punt early; press styles set YOUR base risk high when
you attack). If you win the ball, YOU get the instant counter beat (plus nation
bonuses). If their chain completes, they shoot vs your keeper. Defense becomes
hopeful — "break up the move" — instead of soaking a pressure number.

### Match structure

- Regulation = **6 possessions**, alternating kickoff (you first). Tunable.
- An interception's instant counter is part of the SAME possession; afterwards the
  schedule simply moves to the next possession. No possession is skipped or added.
- Ball position persists on the pitch; kickoffs restart at midfield; turnovers
  happen where the ball is.
- End-of-match rules unchanged: leading → push-your-luck extra time; tied → draw
  (group) / sudden death → shootout (knockout). Run layer untouched.

### Combos — load-bearing, not garnish (sim-proven)

EV analysis (scratch sim, 2026-07-07) showed flat per-pass gains stall optimal
chains at 1–2 passes; **growing gains (the move develops: ~2,3,4,5,6…) stretch
chains to 3–4 with razor-thin EV gaps (0.01–0.08) at the stop point** — real
tension, no dominant strategy. Against an 8%-risk parked bus the optimal line is
a patient 4-pass 90% chance; against a 25% press it's a 1-pass punt vs a
coin-flip gamble. So:

- Base development curve: each completed pass raises the NEXT pass's Chance gain.
- Card combos layer on top: **Through Ball** boosts the next finisher;
  **Sideways Pass** (new card) adds little Chance but LOWERS the next risk check
  (recycle possession); **Cross → Header** pairing (Header strong only right
  after a Cross); **Screamer** is the long-range punt specialist (ignores part of
  the zone penalty).

### Nations (remapped, same mutator machinery)

- **Brazil** rerollDie: unchanged — chase the die your next pass needs.
- **Mexico** poolDelta +1: more dice = longer possible chains.
- **USA counterSpring**: interceptions YOU win start the counter with bonus
  Chance — The Press, literally.
- **Canada** (rename `oppAdvanceDelta` semantics): opponents suffer +base
  interception risk when chaining against you — hard to play through.

### What gets deleted / kept

- **Delete:** lane buckets (`buildUp/chance/cover` as round totals), duel
  resolution + `DUEL_RESOLVED`, pressure-pushback model, pending-commit UI,
  decision coach, duel preview.
- **Keep:** dice slots + hand economy, the pitch and ball, keeper DC formulas,
  extra time / sudden death / shootout, the full run layer contract
  (`playerGoals/oppGoals/piles/earned/result/rng`), staff passives where they map.
- **UI:** chain strip (the passes of the move so far), climbing Chance meter,
  climbing Risk meter, SHOOT always-on with live win% estimate, mirrored display
  for their possession, big INTERCEPTED / counter beats in the popups. Match log
  stays. Glossary shrinks to the new, smaller vocabulary (collapsible).

### Tuning targets (sim-enforced via funProbe + a new chain probe)

- Optimal stop at 2–4 passes vs balanced pressure; EV gap at stop < 0.1.
- First-pass shot ≈ 25–35% from the box-adjacent zones; worked 4-pass chance ≥ 75%.
- Greedy-bot run wins 15–25% per nation; dead rounds ~0%; opponent scores
  0.3–0.5/match (their chains must sometimes finish).
- Interception feel-bad guard: zero possessions end with no player action taken.

### Starting numbers (all tunable)

`RISK_BASE` by style 8–25% · `RISK_RAMP` +6%/pass · counter shot ≈ 0.15–0.2 xG
equivalent · development curve gains 2,3,4,5,6 · zone DC penalty 0/+3/+6 ·
keeper DCs and stage ramp unchanged from current build.
