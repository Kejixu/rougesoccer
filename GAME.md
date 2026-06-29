# RogueSoccer — how it actually plays (current build)

This describes the game **as the code plays it today** on the Momentum Duel branch,
not older design intent. It is the shared reference: if something here is wrong or
feels off, that is the thing to change. Source of truth = `src/core/match/dice.ts`,
`src/core/balance.ts` (`DICE`), `src/data/diceCards.ts`, `src/data/content.ts`,
`src/core/run/`.

> Theme: FIFA World Cup 2026, real countries + verified groups, parody player/coach
> names, NO FIFA branding. Inspirations: Slay the Spire, Dawncaster, Balatro, Dicey Dungeons.

---

## 1. The shape of a run

One run = one World Cup campaign with the team you pick.

- **Group stage:** a 3-team mini-group — you play **2 matches**, the other two teams
  play each other once (simulated). Top of the group advances; otherwise the run ends.
- **Knockout:** R32 → R16 → QF → SF → **Final** (single elimination).
- Between matches: **rewards** (pick a card), a **shop** (buy/upgrade/remove cards),
  and **staff hires** (passive perks) each time you advance a stage.
- Difficulty ramps every stage (`STAGE_CLOCK_MULT`: GROUP 1.1 → FINAL 2.3), which
  scales each opponent's rating, keeper, and pressure.

Playable nations today: **Brazil, USA, Mexico, Canada** (each bends the dice rules).

---

## 2. The match — Momentum Duel

A match is a **five-round dice-and-card duel for momentum** on one shared pitch.

```
 YOUR GOAL                    midfield                    THEIR GOAL
   │  Your Box │ Your Third │  kickoff  │ Their Third │ Their Box │
   0 ─────────────────────────── ball ───────────────────────────► 20
   YOUR_BOX=4                                      THEIR_BOX=16
```

- The ball is a single integer position (0 = your goal, 20 = their goal). Kickoff is
  **midfield (10)**.
- Each round rolls a pool of **5 d6 dice** and draws up to **4 cards**.
- A card needs a die that fits its slot. Slotting the die spends it and commits the
  card into one or more round lanes.
- Cards are no longer locked by possession phase. Attack, chance, and defensive cards
  can all be useful in the same round.

The three round lanes:

- **Build-Up:** converts into pitch movement when the round resolves. It is not
  one-for-one movement; current tuning uses about two thirds of Build-Up as steps.
- **Chance:** becomes Shot Quality when the resolved ball is in the Final Third or Box.
- **Cover:** reduces the opponent's pressure before they can move the ball toward your goal.
- **Shot Quality:** banked finishing power. Once the ball is in their box, it adds to
  the d20 shot roll.
- **Finish cards:** Chance cards. They do not help early build-up unless they also
  have a Build-Up effect; they add Chance only once the ball is projected deep enough.

This is the core decision: spend high dice on progress, chance, or safety. A round
should rarely be dead because every tactical role can be committed if a die fits.

The match screen must make the loop legible:

- The lane badges show the current committed Build-Up, Chance, and Cover.
- Clicking a card stages a pending play first; the player confirms with **Commit**
  after seeing exactly which die and lane changes will be used.
- The decision coach labels the current tactical state and priority: build territory,
  add chance, cover danger, or shoot.
- The duel preview shows the expected ball movement, chance banking, cover absorbed,
  and any opponent push before you resolve the round.
- The match log explains the last few actions in plain language, including what each
  card added and how the duel resolved.

---

## 3. Resolving a round

At the start of a round, the opponent reveals an **intent**: attack, counter, press,
or sit deep.

During the round:

- Progress cards add **Build-Up**.
- Finish cards add **Chance** if the current or projected ball position is deep enough.
- Defensive cards add **Cover**.
- Draw effects still draw immediately.

When you press **Resolve duel**:

1. Build-Up converts into pitch steps and moves the ball forward.
2. Chance becomes banked **Shot Quality** if the ball is in the Final Third or Box.
3. The opponent intent resolves. Cover subtracts from attack/counter pressure before
   pressure is converted into backward ball movement. This pressure can push the ball
   toward your goal even if you started the round with initiative.
4. If the opponent reaches your box, they shoot.
5. The hand and dice clear, and the next round starts unless the match result is due.

---

## 4. Shooting and conceding

- **You shoot:** if the ball is in their box (`ball >= 16`) and Shot Quality > 0,
  `d20 + Shot Quality >= their keeper DC` is a goal. The shot ends the round.
- **They shoot:** if opponent pressure pushes the ball into your box (`ball <= 4`),
  `d20 + their danger >= your keeper DC` is a goal.
- Any shot resets the ball to midfield and flips initiative.

---

## 5. How a match ends

After round 5 (regulation):

- **Leading →** push-your-luck: **bank the win**, or **extra time**. Extra-time
  pressure hits 2x harder, but each round survived in the lead pays budget + scout.
- **Tied →** a **draw** in the group, or **sudden death** in a knockout. After three
  sudden-death rounds, the match goes to a penalty shootout roll.
- **Trailing →** loss / elimination.

---

## 6. The card pool (dice cards)

Low dice tend to make Cover, mid dice make Build-Up, and high dice make Chance. The
important change is that cards contribute to lanes first; movement and pressure
happen together when the duel resolves.

| Card | Slot | Role | Effect |
|---|---|---|---|
| Short Pass | 2+ | build-up | Build-Up = die value |
| Driving Run | 3+ | build-up | +4 Build-Up |
| Flank Run | 4+ | build-up | +3 Build-Up, draw 1 |
| Quick Combo | 4+ | build-up | +2 Build-Up, draw 1 |
| Overlapping Run | =4 | build-up | +4 Build-Up, draw 1 |
| Through Ball | 5+ | build-up/chance | +1 zone Build-Up, +2 Chance deep |
| Counter Attack | 3+ | build-up/chance | +1 zone Build-Up, +3 Chance in box |
| Clinical Finish | 5+ | chance | Chance = die value in box |
| Poacher | even | chance | +5 Chance in box |
| Whipped Cross | 4+ | chance | +4 Chance in final third or box |
| Screamer | 6 | chance | +8 Chance in final third or box |
| Last-Ditch Tackle | 2- | cover | strong Cover; USA adds Build-Up |
| Clearance | 3- | cover | +6 Cover |
| Keeper Claims It | any | cover | +4 Cover, draw 1 |

**Starting deck (16 cards, ~40% defense):** Short Pass x3, Driving Run x2, Flank Run,
Through Ball, Clinical Finish x2, Poacher, Tackle x3, Clearance x2, Keeper.

---

## 7. Nation identities

- **Brazil — "Joga Bonito":** 4 dice instead of 5, but reroll one die each round;
  harder opponent keeper. Flair over volume.
- **Mexico — "La Ola":** an extra die each round; slightly harder keeper. Win on volume.
- **USA — "The Press":** tackles add counter Build-Up. Win safety and territory together.
- **Canada — "Resolute":** opponents advance 2 fewer steps against you. Hard to break down.

---

## 8. Key numbers (`balance.ts → DICE`)

Pool 5 dice · d6 · hand 4 · 5 regulation rounds · pitch 0-20 · midfield 10 · Build-Up
scale 0.65 · their
box 16 · your box 4 · their keeper DC 9 + rating x 0.14 (cap 18) · your keeper DC 14 ·
shot d20 · opponent danger rating x 0.08 (cap 6) · opponent pressure scale 0.20.

---

## 9. Known rough edges

- **Balance needs a fresh pass:** Momentum Duel changes dead-round frequency and shot
  timing, so previous win-rate numbers are no longer authoritative.
- **Possession language is now "initiative":** some variable names still say
  `possession` for compatibility, but the player-facing loop is lane allocation.
- **Chance gating is deliberately strict:** finish cards only add Chance once the
  current or projected ball position is deep enough. If this still feels dead, the
  next lever is weaker off-zone chance rather than more hand size.
