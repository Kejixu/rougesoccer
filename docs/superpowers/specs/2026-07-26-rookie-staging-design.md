# Rookie staging — the screen reveals itself in the order the game teaches

Playtest feedback (2026-07-26): "why does it seem confusing for someone who
doesn't know how to play?"

Diagnosis: the match screen explains everything and stages nothing. ~15 novel
concepts (Chance, pressure, die slots, combos, DC, recycle, stand off, bank,
intent, draw/discard…) arrive simultaneously at equal visual weight. Every one
is annotated somewhere, but a new player needs a *sequence*, not a dashboard.
The game has no notion of "what does this player know yet" outside coach tips.

Fix: extend the coach-tip "seen" pattern from sentences to whole UI elements.
Secondary panels stay hidden until the game state first makes them relevant;
once revealed, they stay revealed forever (persisted). Veterans keep today's
screen; a fresh profile gets dice, cards, two buttons, and one objective line.

## A. Reveal system

Storage: same idiom as coach tips — localStorage flags, `ui.<key>` = "1",
read once at mount, guarded for `typeof localStorage === "undefined"`.

Reveal keys and their state triggers (all pure functions of `DiceMatchState`):

| Key | Element | Trigger (first time this is true) |
|---|---|---|
| `ui.chain` | chain-panel (your chain) | possession "you" && passes >= 1 |
| `ui.stats` | dice-stat-row | passes >= 1 \|\| shotQuality > 0 |
| `ui.intent` | intent-panel | passes >= 1 |
| `ui.theirchain` | their-chain panel | possession "them" && (oppPasses >= 1 \|\| defenseCommit > 0) |
| `ui.glossary` | ChainGlossary | round >= 2 |

Semantics:

- Element visible ⇔ key already revealed OR trigger true right now (reveal is
  immediate, not an effect-lag later). An effect persists newly-triggered keys.
- Export a pure `rookieReveals(state): UiRevealKey[]` (keys whose trigger is
  true for this state) — unit-testable.
- The tutorial shows everything: when the tutorial prop is active, staging is
  disabled entirely (the guided script references these panels). Do NOT touch
  `src/ui/tutorialScript.ts` / `test/tutorial.test.ts`.
- `markCoachTipsSeen()` in `App.tsx` (called on tutorial completion) also marks
  all `ui.*` keys — finishing the tutorial graduates you to the full screen.
- Testability: `DiceMatchScreen` takes an optional prop
  `initialRevealedUi?: readonly string[]` that overrides the storage read.
  Existing rendered-markup tests that assert staged panels pass all keys;
  new rookie tests pass `[]`.

## B. Objective line (everyone, always)

First element of the ROUND_ACTIVE fragment, above the dice tray — one small dim
sentence stating what this round is for, `data-testid="objective-line"`:

- corner: `Corner — one delivery, pick your best card.`
- your ball: `Your ball — pass to build a Chance, then shoot.`
- their ball: `Their ball — commit defenders to fight their passes, or stand off and bank dice.`

Styled like the tray hint (small, `--ink-dim`), full-width line, not a panel.

## C. Fresh profiles land on the tutorial

`TitleScreen`: when the profile is fresh (no `coach.*` and no `ui.*` flags in
localStorage — undefined localStorage counts as fresh), "Learn the game (5 min)"
renders first and keeps `btn--primary`; "Start the campaign" drops to plain
`btn`. Once anything is seen, today's order/emphasis returns. Pure helper +
localStorage read inside the screen, same guard idiom as the coach keys.

## Non-goals

- No mechanic changes, no engine changes, no copy rewrites of existing panels.
- No staging of card-level details (slots, position badges, combo tags) — cards
  are the inputs; they stay whole.
- No forced tutorial — the campaign button still works on a fresh profile.
