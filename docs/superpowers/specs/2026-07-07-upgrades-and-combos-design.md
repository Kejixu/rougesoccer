# Upgrades & Position Combos — depth per run, depth per turn

Status: APPROVED. Two systems in one slice: (1) make card training real (it is
currently a PAID NO-OP: the shop charges 25 budget for TRAIN_CARD but all 14 dice
cards have a single level), and (2) a soccer-native combo grammar on card positions.

## 1. Card upgrade levels (fixes the dead shop feature)

### Mechanism
`CardLevelStats` (types.ts) gains `diceEffects?: DiceEffect[]`. The dice engine
resolves a card's effects through its instance level:

```ts
function effectsFor(def: CardDef, level: number): DiceEffect[] {
  return levelStats(def, level).diceEffects ?? def.diceEffects ?? [];
}
```

Used in `assignDie` (both possession branches) in place of raw `def.diceEffects`.
Design rule: **upgrades strengthen amounts, never change a card's role or slot** —
so `isDefenseCard`, `bestDieFor`'s scaling detection, bot `roleOf`, and the UI role
classes may keep reading `def.diceEffects` (level 0) safely. Card text per level
already renders (`def.levels[min(level, …)].text`).

### Content — all 14 cards, levels 0/1/2 (level 0 = today's values)

| Card | L1 | L2 |
|---|---|---|
| Short Pass | die +1 move (`progressFromDie` + `progress 1`) | die +2 move |
| Driving Run | move 5 | move 6 |
| Flank Run | move 4, draw 1 | move 5, draw 1 |
| Quick Combo | move 3, +3 Chance | move 3, +4 Chance |
| Sideways Pass | 16% safer, move 1 | 20% safer, move 2 |
| Through Ball | setup +6, move 2 | setup +8, move 3 |
| Counter Attack | move 4, +4 Chance | move 4, +5 Chance |
| Clinical Finish | die +1 Chance (`shotQualityFromDie` + `shotQuality 1`) | die +2 Chance |
| Poacher | +7 Chance | +9 Chance |
| Whipped Cross | setup +7 | setup +9 |
| Screamer | +10 Chance | +12 Chance |
| Tackle | +24% intercept | +30% intercept |
| Clearance | +16% | +20% |
| Keeper Claims It | +12%, draw 1 | +12%, draw 2 |

Each level gets short text in the same voice as level 0. Shop training now does
what it advertises; `TRAIN_MAX_LEVEL: 2` already caps it.

## 2. Position combos — the worked-move grammar

Cards already carry positions. During YOUR possession, completing a pass whose
position forms a footballing link with the PREVIOUS completed pass grants a bonus:

| Link | Name (ticker/chip label) | Bonus |
|---|---|---|
| MF → WG | "Switch of play" | your NEXT pass risk −8% (`nextRiskDelta -= 0.08`) |
| WG → ST | "Delivered onto the run" | +3 Chance added to THIS card's chance gain |
| MF → ST | "Through the middle" | +2 Chance added to THIS card's chance gain |

Exactly these three; no chaining tables beyond one look-back. Mechanics:

- New state field `lastPassPosition: Position | null` on `DiceMatchState`; reset to
  null in `resetChain` (each possession starts fresh); set to the card's position
  after EVERY completed pass of yours (combo or not). Interceptions/defense never
  touch it. Save version 4 → 5 (three files, as before).
- Applied in `assignDie`'s your-possession branch: compute the link BEFORE applying
  effects; chance-type bonuses are added into the same `chanceGained` accounting so
  development/setup/combo all report through `PASS_COMPLETED`.
- `PASS_COMPLETED` gains `combo?: string` (the label) — shown as a highlighted chip
  tag and a ticker line ("Switch of play! next pass −8%").
- Pure helper exported for UI/bots: `comboFor(last: Position | null, next: Position):
  { label: string; chance: number; riskDelta: number } | null`.
- UI: attack cards show a small hint when a combo is live for them right now (e.g.
  a "combo" tag on ST cards after an MF pass). One new coach tip key `combo`
  (fires the first time a combo triggers): "A combo! Passes that flow like a real
  move — midfield wide, wing to striker — earn bonuses. Sequence your passes."
- Glossary entry "Combo" added.

## 3. Balance & guards

- After both systems land, run the probe and retune to the standing bands (greedy
  run wins: no nation > 35% or < 10%; deadAttackRounds ≤ 2%; oppGoals 0.3–0.7).
  Levers in order: RISK_BASE_*, OPP_CHANCE_PER_RATING, keeper DCs. One knob at a
  time with a log. Upgrades mostly affect LATER stages (shop budget), so expect
  modest early drift.
- Bots: `makeGreedyBot` may stay combo-naive (acceptable), but reward-scoring should
  value upgradeable rarity as before — no bot changes required beyond compiling.
- **The tutorial golden seed (`tutorial-109`) is a hard constraint.** Its cards are
  all level 0 and combos consume no RNG, so the story should survive (R3
  Driving Run→Poacher now triggers "Through the middle", a nice free beat — the
  step-7/8 copy may be lightly updated to mention it). If any tutorial regression
  assertion breaks, STOP and report; do not weaken the test and do not re-seed
  yourself.
- GAME.md: upgrades table (or per-card levels column), combo table, new key numbers,
  save v5 — same change.

## Acceptance

- tsc clean; vitest green including tutorial regression; vite build ok; probe within
  bands with a tuning log.
- Unit tests: `effectsFor` level resolution; each combo link fires (and non-links
  don't); `lastPassPosition` resets per possession; TRAIN_CARD now changes an
  instance's dice effects in play.
- Browser (controller): train a card in the shop and see its new text/effect; trigger
  each combo; combo coach tip fires once.
