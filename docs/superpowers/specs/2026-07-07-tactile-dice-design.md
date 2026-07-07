# Tactile Dice — drag to play, visible pressure rolls

Status: APPROVED. Two changes with one goal: the dice should FEEL like the game's
energy, not checkboxes. (User model, confirmed: dice = energy with faces; cards =
what you spend it on; situations gate legality; dry dice end the turn.)

## 1. Drag dice onto cards (pointer-based, not HTML5 DnD)

- Unused dice become draggable via pointer events (pointerdown/move/up — works for
  mouse AND touch; also trivially testable with synthetic events, unlike native DnD).
- While dragging a die of value V: every card that would legally accept it lights up
  (`.drop-ok`), everything else dims. Legality = dieFitsSlot(V, slot) AND the card's
  possession role is playable AND (in tutorial mode) the tutorial lock allows it.
- Drop on a legal card → `ASSIGN_DIE` with THAT die index (not auto-pick). Drop
  anywhere else → the die snaps back, no action, no error toast.
- Existing interactions are kept as fallbacks: click-die-then-click-card, and
  click-card-auto-pick. Experienced players keep speed; the drag is the default
  tactile path.
- A pure helper for the legality (testable without DOM), e.g.
  `dieDropTargets(state, defs, dieIndex, tutorialLock?) -> Set<uid>`.
- Visuals: dragged die follows the pointer (transform, no layout thrash), slight
  scale-up, drop-ok cards pulse. Dice tray keeps the cascade/reroll animations.

## 2. Visible pressure rolls (the craps element)

The interception check stops being an invisible percentage and becomes a die you
watch land.

### Engine
- Quantize the check to a d20: pressure = `Math.round(risk * 20)` (0..13 given the
  0.65 cap). The pass is intercepted iff `d20roll <= pressure` where
  `d20roll = 1 + floor(rand * 20)` — SAME single rand consumption per check, so the
  rng stream length is unchanged.
- Applies to BOTH your pass checks and their pass checks (symmetric ritual).
- New events, emitted before the outcome events:
  - `PASS_CHALLENGED { roll: number; pressure: number; survived: boolean }` (yours;
    only when pressure > 0 — the free first pass stays silent)
  - `OPP_PASS_CHALLENGED { roll: number; pressure: number; survived: boolean }`
- `interceptionRisk`/`oppInterceptionRisk` keep returning the raw fraction; add
  `pressureOf(risk: number): number` (the round(risk*20)) so UI and engine agree.

### UI
- A quick pressure-roll reel (reuse the ShotRoll spin pattern, ~450ms) fires on each
  challenged pass: "🎲 14 vs pressure 4 — held off" / lands red on a tackle. Keep it
  snappy; it must not make chains feel slow.
- The risk badge shows both forms: "pressure 4 (20%)".
- Ticker lines: "Pressure roll: 14 vs 4 — safe." / "Pressure roll: 3 vs 4 — TACKLED."
- Their passes get the same reel in the their-chain panel (smaller/quieter).

### Guards
- Quantization slightly moves probabilities (5% steps). Re-run the probe; retune only
  if a band breaks (same bands: no nation > 35% or < 10%, deadAttack <= 2%, oppGoals
  0.3-0.7). Log any knob moved.
- **Tutorial golden seed (`tutorial-109`) is a hard constraint.** The rng stream is
  unchanged in length, but quantized thresholds could flip a borderline outcome. If
  any tutorial-regression assertion breaks: STOP and report the failing beat — the
  controller re-hunts the seed. Do not weaken the test.
- No state-shape changes; save version stays 5.
- GAME.md: pressure-roll explanation (replace bare % language where it describes the
  check), drag interaction mentioned in the UI notes, same change.

## Acceptance
- tsc clean; vitest green (engine PASS_CHALLENGED tests, pressureOf, dieDropTargets,
  tutorial regression); vite build ok; probe in bands.
- Browser (controller): drag a die onto a legal card and see it play; drag onto an
  illegal card and see it snap back; watch a pressure reel resolve both ways
  (safe + tackled); tutorial still completes with drags locked correctly.
