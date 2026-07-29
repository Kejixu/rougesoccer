# RogueSoccer - how it actually plays (current build)

This describes the game **as the code plays it today** on the Full Time branch,
not older design intent. It is the shared reference: if something here is wrong or
feels off, that is the thing to change. Source of truth = `src/core/match/dice.ts`,
`src/core/balance.ts` (`DICE`), `src/data/diceCards.ts`, `src/data/content.ts`,
`src/core/run/`.

> Theme: FIFA World Cup 2026, real countries + verified groups, parody player/coach
> names, NO FIFA branding. Inspirations: Slay the Spire, Dawncaster, Balatro, Dicey Dungeons.

---

## 1. The shape of a run

One run = one World Cup campaign with the team you pick.

- **Group stage:** a real 4-team group - you play **3 matches**, one against every
  groupmate. After each match, the other two teams' fixture is simulated, so the
  four-team table evolves across all three matchdays. The top 2 advance; a
  third-place finish is compared with 11 seeded third-place records and advances
  if ranked among the best 8 of 12. Fourth place, or a bottom-four third, ends the run.
- **Knockout:** R32 -> R16 -> QF -> SF -> **Final** (single elimination).
- Between matches: **rewards** (pick a card), a **shop** (buy/upgrade/remove cards),
  and **staff hires** (passive perks) each time you advance a stage.
- Run saves are version **9**. Older saved runs are discarded on load.
- Difficulty ramps every stage (`STAGE_CLOCK_MULT`: GROUP 1.1 -> FINAL 2.4), which
  scales each opponent's rating, keeper, and attack threat.

Playable nations today: **Brazil, USA, Mexico, Canada** (each bends the dice rules).

---

## 2. The match - Possession Chains

A match is a **six-round dice-and-card match** on one shared pitch. Odd rounds are
your possession; even rounds are their possession.

```
 YOUR GOAL                    midfield                    THEIR GOAL
   |  Your Box | Your Third |  kickoff  | Their Third | Their Box |
   0 --------------------------- ball ----------------------------> 20
   YOUR_BOX=4                                      THEIR_BOX=16
```

- The ball is a single integer position (0 = your goal, 20 = their goal). Kickoff is
  **midfield (10)**.
- Each round rolls a pool of **5 d6 dice**. Your hand persists between rounds and
  refills toward **4 cards**, always drawing at least 1 fresh card when below the
  hard cap of **5**.
  After an opponent possession, up to **2 unused defensive dice** carry into your
  next attack as extra dice with the same values.
- A card needs a die that fits its slot. You can drag a die onto a legal card or use
  the click fallbacks; slotting the die spends that exact die and resolves the pass
  immediately.
- Your first completed pass in a possession is always safe. Later passes show an
  interception pressure before you commit.
- You can **shoot anytime after one completed pass**. Shooting spends your banked
  Chance against a distance penalty based on where the ball is; 0-Chance punts are
  legal but low percentage. If cards are staged on the dock, **Play & Shoot** resolves
  each staged pass in order before taking the shot; an interception or possession
  change during that sequence cancels the shot.
- You can **recycle** with `END_ROUND`: **Play & Recycle** resolves each staged pass
  in order, then ends the possession safely with no shot and no counter. An
  interception or possession change during the sequence cancels the recycle.

The two your-ball action verbs are **Play & Shoot · Play & Recycle**. Every staged
move chooses its ending up front: the dock resolves once, then either shoots or
recycles. With an empty dock, the same buttons are plain **Shoot** and **Recycle
possession**. There is no attack-side run-only action or mid-possession second wave;
cards drawn during a flush stay in the persistent hand for a later round. During
their possession, **Commit defense** still resolves staged defenders without ending
the round, so defensive cards can be committed in multiple waves.

Your possession is push-your-luck:

1. Play progress/setup/finish cards as passes.
2. Completed passes move the ball, bank Chance, set up the next finisher, or reduce
   the next pass pressure.
3. If a later pass is intercepted, all banked Chance is lost and the opponent gets
   one instant counter shot.
4. Shoot when the current Chance and field position look worth cashing in.

Their possession mirrors the same rhythm:

1. Defensive cards are the only cards you can play.
2. Playing a defender commits interception pressure against their next pass.
3. Ending the round is a legal **stand off**: you do not commit a defender, their
   next pass happens undefended, and unused dice can bank into your next attack.
4. If you intercept them, you get one instant counter shot.
5. If they complete enough passes for their style, or reach your box, they shoot.

Their possession shows a live "their shot ~N%" readout (single-source with the
engine's oppShotEstimate), and the pre-match screen shows the opponent's tier,
effective rating, keeper DC, and the stage heat multiplier — difficulty is visible,
not just felt. The match UI uses an inputs-first column: the thin scoreboard and
urgent corner/coach teaching lead into dice, hand, and actions, followed by chain
context and stats, then the pitch, opponent intent, glossary, and persistent ticker.

The pitch replays passes and counter attacks event-by-event in step with the staged
match popups. While a die is active, a fitting card blocked by the current possession
stays visible and says why; tutorial-locked cards keep the plain dim treatment.
With an empty attack dock, Recycle is cold while passes are cheap and playable dice
remain, then gains an endorsed glow once pressure makes stopping smart. Unspent
attack dice visibly fizzle when the possession ends, while unused defensive dice
keep their Fresh Legs banking treatment.

The scoreboard shows the full possession schedule as a six-slot strip instead of a
separate “Round X of 6” label: odd rounds are filled gold number pills for your
attacks, even rounds are outlined red number pills for their attacks, completed
rounds dim, and the current pill enlarges beside **YOUR BALL** or **THEIR BALL**.
Extra-time possessions append distinct pills with an **ET** tag as they begin. Each possession
flip gets a short, pointer-transparent handover banner ("YOUR BALL" / "THEIR BALL"),
and their possessions shift the board into the existing red defending palette. The
strip is the single primary possession indicator; the direction arrow remains a
secondary field-orientation cue.

Every team carries a Unicode flag (`flag` on `TeamDef`) shown via the `TeamFlag`
component in team select, the match scoreboard, the group table, matchday fixtures,
opponent panels, and results — England/Scotland use tag-sequence flags with a
bordered three-letter fallback where those don't render. Cards carry a visual role
identity (`DiceCardArt`): green run-line motifs for passes, gold goal-trajectory
motifs for finishers, red block motifs for defense — plus the die slot drawn as a
die glyph, a mini-pitch position badge (MF/WG/ST) that makes combos scannable, and
chevron pips for upgrade levels. All interaction states (drop targets, lock badges,
docked die chips, hot/cold shoot) render on top of the art unchanged.

Opponent intent copy describes your passing posture in chain mode:

- Press: "They press high — every pass is riskier (27% base)"
- Sit deep: "They sit deep — easy to keep the ball (10% base), harder to finish (+4 DC)"
- Attack/counter: "They play it balanced — 17% base risk"

The ticker keeps the latest match events visible (pressure rolls, passes for both
teams, interceptions, counters, shot roll math, goals/saves, and possession
changes). A one-time `coach.schedule` tip explains that possessions alternate like
innings and that tackles, interceptions, and counters fight for the ball within each
round. Coach tips are stored as `coach.schedule`, `coach.possession`, `coach.risk`,
`coach.dice`, `coach.chance`, `coach.punt`, `coach.defense`, `coach.combo`,
`coach.corner`, and `coach.rattled` once dismissed.

Fresh profiles progressively reveal the secondary match UI: your chain, stats, and
opponent intent appear after the first pass (stats also appear when Chance rises);
their chain appears after their first pass or a defensive commitment; and the
glossary appears in round 2. These reveals persist per profile, while the tutorial
always shows the complete screen. Every active round has a small objective line
above the dice for a corner, your ball, or their ball; on a fresh title screen,
**Learn the game (5 min)** is the first primary action and the still-available
campaign action is secondary until any coach or UI flag has been seen.

---

## 3. Round rhythm

There is no lane duel or delayed resolve step. Each die assignment is the action.

- **Your rounds:** attack cards are playable; defensive cards wait for their
  possession.
- **Their rounds:** defensive cards are playable; attack cards wait for your
  possession.
- **Fresh legs:** when their possession ends, the highest unused dice values carry
  into your next attack, capped at 2. Committing defenders spends dice now; standing
  off can bank them for later.
- **Draw effects** happen immediately.
- **Persistent hand:** unplayed cards stay in hand when a possession ends. At the
  next round start, draw toward `HAND_SIZE`, but always draw at least 1 card when
  below `HAND_SIZE + 1`; that extra slot is the hard cap. `drawBonus` remains
  relative to `HAND_SIZE`.
- Persistence makes the possession schedule a planning tool: hold a finisher for
  the attack where you expect to reach their box, or hold tackles for the upcoming
  opponent possession shown on the strip.
- **Setup effects** (`setupNext`) bank a bonus for the next Chance-gaining card.
- **Safe-pass effects** reduce your next interception pressure.
- **Position combos** reward passes that flow like a real football move. Only the
  previous completed pass matters, and combo state resets every possession.
- **Pressure rolls** make challenged passes visible: raw interception risk is
  quantized to d20 pressure with `round(risk * 20)`, and the pass survives when the
  d20 roll is higher than pressure. The first pass of your possession is still free.
- **Interceptions** immediately end the possession after the counter shot.
- **Shots** normally end the possession and reset the ball to midfield. A close save
  can instead leave the same possession live for one corner delivery.

At the end of a possession, unplayed hand cards persist, dice clear, and the next
round starts unless the match has reached a result, knockout extra time, or a
shootout. Played cards still go to discard (or exile when specified).

---

## 4. Shooting and conceding

Your shot:

```
d20 + Shot Quality >= their keeper DC + zone penalty + sit-deep bonus - rattled bonus
```

Their shot:

```
d20 + Opponent Chance >= your keeper DC + mirrored zone penalty
```

Counter shots are one-roll chances after an interception. Your counter uses
`COUNTER_CHANCE` (1) plus any nation bonus; their counter uses their per-pass Chance gain
and is scarier if you lost the ball in your own half.

The opponent panel shows the constant keeper DC. Distance and sit-deep pressure are
priced only into the Shoot button's live percentage. When the keeper is rattled, its
badge shows the temporary -2 DC and `shotEstimate` includes it in the live percentage.

### Set pieces and the rattled keeper

Only a missed player `SHOOT` can start a set piece. Let
`margin = dc - (d20 + Shot Quality)`:

- A miss by 4 or less earns a corner. Chance resets to 0, the ball stays put, and
  the possession remains live.
- A miss by 2 or less also rattles the keeper. Your next regular shot or player
  counter gets -2 DC once, then the flag clears whether that shot scores or misses.
  The flag persists across possessions until used.
- A corner allows exactly one fitting attack card and unused die. Its normal Chance,
  development, setup, movement, and combo effects resolve, then a headed shot fires
  automatically. The header always ends the possession and cannot earn another
  corner. A close header can re-rattle the keeper.
- `Clear it` ends a corner without a card or shot when there is no useful delivery.
- Player counter misses, opponent shots, and opponent counters do not create corners
  or rattle states. Symmetric opponent set pieces are future work.

Zone penalties:

| Ball zone | Position | Shot DC penalty |
|---|---:|---:|
| Your box | 0-3 | +6 |
| Your third | 4-7 | +6 |
| Midfield | 8-11 | +6 |
| Their third | 12-15 | +3 |
| Their box | 16-20 | +0 |

---

## 5. How a match ends

After round 6 (regulation):

- **Leading ->** the full-time whistle: **win** immediately.
- **Tied ->** a **draw** in the group, or **extra time (golden goal)** in a knockout.
  The first goal wins; if three alternating extra-time possessions stay scoreless,
  the match goes to a penalty shootout roll.
- **Trailing ->** loss / elimination.

---

## 6. The card pool (dice cards)

Attack cards advance the chain or build Chance during your possession. Defensive
cards raise their interception risk during the opponent possession.

| Card | Slot | Role | Effect |
|---|---|---|---|
| Short Pass | 2+ | progress | L0 die move; L1 die+1 move; L2 die+2 move |
| Driving Run | 3+ | progress | L0 move 4; L1 move 5; L2 move 6 |
| One-Two | 2+ | progress | L0 move 2, draw 1; L1 move 3, draw 1; L2 move 3, draw 1, +1 Chance |
| Flank Run | 4+ | progress | L0 move 3, draw 1; L1 move 4, draw 1; L2 move 5, draw 1 |
| Quick Combo | 4+ | progress/finish | L0 move 2, +2 Chance; L1 move 3, +3; L2 move 3, +4 |
| Sideways Pass | 3- | safety | L0 next pass 12% safer, move 1; L1 16% safer, move 1; L2 20% safer, move 2 |
| Through Ball | 5+ | setup/progress | L0 next finisher +4, move 2; L1 +6, move 2; L2 +8, move 3 |
| Counter Attack | 3+ | progress/finish | L0 move 3, +3 Chance; L1 move 4, +4; L2 move 4, +5 |
| Clinical Finish | 5+ | finish | L0 Chance = die; L1 die+1; L2 die+2 |
| Poacher | even | finish | L0 +5 Chance; L1 +7; L2 +9 |
| Whipped Cross | 4+ | setup | L0 next finisher +5; L1 +7; L2 +9 |
| Screamer from Range | 6 | finish | L0 +8 Chance; L1 +10; L2 +12 |
| Last-Ditch Tackle | 2- | defend | L0 +18% intercept; L1 +24%; L2 +30% |
| Clearance | 3- | defend | L0 +12% intercept; L1 +16%; L2 +20% |
| Keeper Claims It | any | defend | L0 +8%, draw 1; L1 +12%, draw 1; L2 +12%, draw 2 |
| Sweeper Keeper | 3- | defend | L0 +12%, draw 1; L1 +16%, draw 1; L2 +16%, draw 2 |

Chance cards gain extra value as the move develops:

```
Chance gained = base card value + setup bonus + completed passes * DEVELOPMENT_GAIN
```

Upgrades never change a card's slot or role. Training in the shop costs budget and
raises one card instance to a maximum of level 2.

Position combos on your completed passes:

| Link | Label | Bonus |
|---|---|---|
| MF -> WG | Switch of play | next pass risk -8% |
| WG -> ST | Delivered onto the run | +3 Chance on this pass |
| MF -> ST | Through the middle | +2 Chance on this pass |

**Starting deck (17 cards):** Short Pass x3, Driving Run x2, Sideways Pass x2,
Through Ball, Clinical Finish x2, Poacher, Tackle x3, Clearance x2, Keeper.

---

## 7. Nation identities

- **Brazil - "Joga Bonito":** 4 dice instead of 5, but reroll one die each round;
  opponent keeper DC +2. Flair over volume.
- **Mexico - "La Ola":** an extra die each round; opponent keeper DC +2. Win on volume.
- **USA - "The Press":** instant counters get +1 above the universal counter bonus.
  Win the ball and the counter is a real threat - counters are the identity, ~0.47
  goals/match versus ~0.31-0.36 for the other nations. Sits at the top of the
  win-rate band (35%) as an approachable pick.
- **Canada - "Resolute":** opponents have +4% interception risk per pass against you;
  the opposing keeper gains +1 DC. Hard to play through, with a small finishing tax to
  keep the defensive identity inside the win-rate band.

---

## 8. Key numbers (`balance.ts -> DICE`)

Pool 5 dice - carry max 2 - d6 - hand 4 - 6 regulation rounds - up to 3 golden-goal
extra-time possessions in tied knockouts - pitch 0-20 - midfield 10 - their box 16 -
your box 4.

Shot math:

- Their keeper DC: `min(18, 11 + rating * 0.14) + nation keeper delta`
- Your keeper DC: `15`
- Shot die: d20
- Sit-deep bonus to their keeper: +4
- Zone DC penalty: `[6, 6, 6, 3, 0]`
- Corner window: missed player shots by 4 or less
- Rattled window: missed player shots by 2 or less; next player shot gets -2 DC

Your chain:

- Risk base: press 27%, balanced 17%, sit deep 10%
- Risk ramp: +6% per completed pass after the first
- Risk cap: 65%
- Visible pressure: `round(risk * 20)` on a d20; tackled on `roll <= pressure`
- Development gain: +1 Chance per completed pass
- Position combo bonuses: MF -> WG next pass risk -8%; WG -> ST +3 Chance; MF -> ST +2 Chance
- Train max level: 2
- Counter chance: +1 before nation bonuses
- Opponent shallow counter bonus: +3 if you lose it in your half

Their chain:

- Opponent base interception risk: 8%
- Opponent risk ramp: +5% per completed pass
- Visible pressure: same d20 pressure roll as your challenged passes
- Opponent pass advance: 2 steps toward your goal
- Opponent Chance gain: `round(rating * 0.03)`, capped at 6 per pass
- Opponent chain targets: balanced 3, possession 4, flair 4, fortress 2, counter 2,
  highpress 3

Latest probe target readout:

- Run wins: Brazil 20%, Mexico 25%, USA 30%, Canada 25%
- Passes per chain: 2.06-2.15
- Intercepted share: 19-22%
- Goals per match: 1.2-1.5 for you, 0.5-0.6 for opponents
- Dead attack rounds: 0-1%
- Stand-off-only defensive rounds: 18-26% (informational; standing off is legal)
- Corners per match: 0.25-0.36
- Rattled conversions per match: 0.06-0.08

Set-piece value initially pushed Mexico to 40% run wins and Canada to 38%. The one
balance knob moved was `KEEPER_DC_BASE`, 10 -> 11; the figures above are the rerun.

---

## 9. Known rough edges

- **Set pieces are player-side only:** close opponent misses do not currently create
  corners or rattle your keeper. A symmetric version is future work.

- **Chains still sit near the floor:** passes per chain are just over 2. Attempts to
  lower risk ramp did not meaningfully create 2.5-3 pass chains and moved win rates
  around, so this ships as a conservative balance.
- **Counters are still prominent for identity picks:** player counter goals sit roughly
  0.31 for Brazil, 0.27 for Mexico, 0.49 for USA, and 0.26 for Canada.
- **Screamer's long-range specialization is not special-cased:** it is currently a
  flat +8 Chance card; distance is handled only by the shared zone penalty table.
