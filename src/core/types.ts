import type { RngState } from "./rng";
import type { BalanceConfig } from "./balance";

// ---------- primitives ----------

export type Position = "GK" | "DF" | "MF" | "WG" | "ST";
export type Rarity = "common" | "rare" | "legendary";
export type CardKind = "player" | "tactic" | "moment" | "gameplan";
export type StyleId =
  | "possession"
  | "flair"
  | "fortress"
  | "counter"
  | "highpress"
  | "balanced";

// ---------- effect DSL ----------

export type Trigger =
  | "onPlay" // fires when the card is part of an ATTACK
  | "onGoal" // fires per goal the attack scored
  | "onDiscard"
  | "onRoundStart" // style-level
  | "onMatchStart" // style-level
  | "onAttackResolve"; // style-level, after goals are known

export type Cmp = "lte" | "gte";

export type Condition =
  | { kind: "attackIncludesPosition"; position: Position }
  | { kind: "attackCardCount"; cmp: Cmp; value: number }
  | { kind: "handSize"; cmp: Cmp; value: number }
  | { kind: "leading" }
  | { kind: "trailing" }
  | { kind: "oppIntent"; intent: "attack" | "sitDeep" | "press" | "counter" }; // their telegraphed move this round

// Escape hatch for mechanics the data ops can't express. Keys are a closed
// union so every script is statically known to the engine.
export type ScriptKey =
  | "capMultAt2x" // fortress: total attack mult is clamped to 2
  | "burstClockOnFailedAttack" // counter: clock burst when your attack scores 0
  | "forceRandomDiscard1" // possession: lose a random card each round
  | "shrinkHand1"; // highpress: hand size -1 all match

export type EffectOp =
  | { kind: "addPower"; amount: number }
  | { kind: "addPowerPerCardPlayed"; amount: number } // swarm scaling: x cards already played this round
  | { kind: "addMult"; amount: number } // additive: mult += amount
  | { kind: "mulMult"; amount: number } // multiplicative: mult *= amount
  | { kind: "draw"; amount: number }
  | { kind: "gainFormPower"; amount: number } // in-match growth, resets after match
  | { kind: "gainResource"; resource: "budget" | "scout"; amount: number }
  | { kind: "scripted"; key: ScriptKey };

export interface EffectDef {
  trigger: Trigger;
  condition?: Condition;
  op: EffectOp;
  scaling?: "perLevel"; // amount *= (level + 1)
}

// ---------- passives (gameplans & staff) ----------
// One closed vocabulary shared by gameplan cards (active for the rest of the
// match once played, Dawncaster enchantments) and staff hires (active for the
// whole run, Slay-the-Spire relics). The match engine evaluates the first
// group; the run layer evaluates the rest and the engine ignores them.

export type PassiveEffect =
  // match-level
  | { kind: "blockOnPosition"; position: Position; amount: number } // playing that position grants block
  | { kind: "powerToPosition"; position: Position; amount: number } // that position's attacks hit harder
  | { kind: "firstAttackMult"; amount: number } // first attack card each round gets x mult
  | { kind: "blockPerRound"; amount: number } // free block at round start
  | { kind: "roundStamina"; amount: number } // extra stamina each round
  | { kind: "drawBonus"; amount: number } // bigger hand each round
  | { kind: "carryCapBonus"; amount: number } // bank more unspent stamina
  | { kind: "staminaOnGoal"; amount: number } // scoring refunds stamina
  // run-level (staff only)
  | { kind: "budgetOnWin"; amount: number }
  | { kind: "cutRefund"; amount: number } // cutting/releasing a card pays this back
  | { kind: "scoutPerMatch"; amount: number };

/** A backroom hire: a permanent run-wide passive, picked when you advance a stage. */
export interface StaffDef {
  id: string;
  name: string; // parody name: "Pep Guardiola's Clipboard"
  role: string; // "Set-Piece Coach" — shown as the card title
  rarity: Rarity;
  text: string;
  passive: PassiveEffect;
}

/** A playable nation's class kit (Slay-the-Spire characters): its own starting
 * deck, a permanent identity passive, and exclusive cards in the pool. */
export interface NationKit {
  identity: string; // "The Press Machine"
  blurb: string; // sales pitch on the title screen
  passive: PassiveEffect;
  passiveText: string;
  startingDeck: { defId: string; level: 0 | 1 | 2 }[];
}

// ---------- dice mode (Dicey-Dungeons-style) ----------
// Each round you roll a pool of dice and slot them into cards. A card needs a
// die matching its slot to activate. The randomness is the roll; the skill is
// allocation. Pure data — the dice engine interprets it.

export type DieSlot =
  | { kind: "any" } // any die activates it
  | { kind: "min"; value: number } // die >= value (attacking/finishing dice)
  | { kind: "max"; value: number } // die <= value (defensive/control dice)
  | { kind: "exact"; value: number }
  | { kind: "parity"; even: boolean };

export type DiceEffect =
  | { kind: "progress"; amount: number } // move the ball toward their goal now
  | { kind: "progressFromDie" } // progress equal to the slotted die's value
  | { kind: "shotQuality"; amount: number } // grow the chain's banked Chance
  | { kind: "shotQualityFromDie" }
  | { kind: "safePass"; amount: number } // recycle: lower your NEXT interception check
  | { kind: "setupNext"; bonus: number } // the next chance effect gains +bonus
  | { kind: "defend"; amount: number } // their possession: raise their interception risk
  | { kind: "draw"; amount: number };

/** Does a rolled die value satisfy a card's slot requirement? */
export function dieFitsSlot(value: number, slot: DieSlot): boolean {
  switch (slot.kind) {
    case "any":
      return true;
    case "min":
      return value >= slot.value;
    case "max":
      return value <= slot.value;
    case "exact":
      return value === slot.value;
    case "parity":
      return value % 2 === 0 === slot.even;
  }
}

/** Convert a raw interception fraction into the visible d20 pressure target. */
export function pressureOf(risk: number): number {
  return Math.max(0, Math.min(20, Math.round(risk * 20)));
}

// ---------- nation dice mutators (the variety hook) ----------
// Each playable nation bends a dice rule. Setup-time mutators (poolDelta,
// keeperDcDelta) apply once; rerollDie grants a per-round action;
// oppRiskDelta makes their passes easier to pick; counterSpring boosts your instant counters.

export type DiceMutator =
  | { kind: "rerollDie"; perRound: number } // Brazil: opt-in single-die reroll
  | { kind: "keeperDcDelta"; amount: number } // raises THEIR keeper (harder for you to score)
  | { kind: "poolDelta"; amount: number } // Mexico +1 die / Brazil -1
  | { kind: "oppRiskDelta"; amount: number } // Canada: their passes are riskier
  | { kind: "counterSpring"; amount: number }; // USA: bonus on your instant counter shot

export interface NationDiceKit {
  identity: string; // "Joga Bonito"
  blurb: string; // shown on the title screen
  mutators: DiceMutator[];
}

/** Human-readable slot requirement, shown on the card. */
export function slotLabel(slot: DieSlot): string {
  switch (slot.kind) {
    case "any":
      return "any";
    case "min":
      return `${slot.value}+`;
    case "max":
      return `${slot.value}-`;
    case "exact":
      return `=${slot.value}`;
    case "parity":
      return slot.even ? "even" : "odd";
  }
}

// ---------- plays (the "poker hands" of an attack) ----------

export type PlayPattern =
  | { kind: "soloRun" } // exactly 1 player card
  | {
      kind: "positions";
      need: Partial<Record<Position, number>>; // minimum counts
      anyOf?: Position[]; // at least one of these also present
      exact?: number; // exactly this many player cards
    }
  | { kind: "minPosition"; position: Position; count: number }
  | { kind: "distinct"; count: number }; // N different positions

export interface PlayDef {
  id: string;
  name: string; // splashed on screen: "WING PLAY!"
  baseMult: number; // the play's multiplier tier
  blurb: string; // human description of the pattern, shown in the legend
  match: PlayPattern;
}

// ---------- cards ----------

export interface CardLevelStats {
  power?: number; // base shot points when committed to an attack
  defense?: number; // clock reduction while deployed
  diceEffects?: DiceEffect[]; // dice-mode effects at this level; defaults to CardDef.diceEffects
  text: string;
}

export interface CardDef {
  id: string;
  kind: CardKind;
  name: string;
  position?: Position; // player cards only
  cost?: number; // stamina cost override; defaults via cardCost()
  rarity: Rarity;
  levels: CardLevelStats[]; // index = upgrade level, length 1..3
  effects: EffectDef[];
  passive?: PassiveEffect; // gameplan cards: persists for the match once played
  exclusiveTo?: string; // playable teamId: only that nation sees it in rewards/shops
  slot?: DieSlot; // dice mode: the die this card needs to activate
  diceEffects?: DiceEffect[]; // dice mode: what it does when a matching die is slotted
  exileOnPlay?: boolean; // "moment" cards: one use per match
  portrait?: string; // asset slot; undefined = flag + silhouette placeholder
  nationality?: string; // teamId, for flag fallback
  flavor?: string;
}

export type CardDefMap = Record<string, CardDef>;

export interface CardInstance {
  uid: string; // unique within a run
  defId: string;
  level: 0 | 1 | 2;
  formPower: number; // in-match growth; reset when the match ends
  fatigued: boolean; // played during extra time; sits out the next match
}

/** Stats for a card at its current level (clamped to the def's defined levels). */
export function levelStats(def: CardDef, level: number): CardLevelStats {
  const idx = Math.min(level, def.levels.length - 1);
  // levels is guaranteed non-empty by content validation
  return def.levels[idx]!;
}

/** Stamina cost: strikers are expensive, moments are free flourishes. */
export function cardCost(def: CardDef): number {
  if (def.cost !== undefined) return def.cost;
  if (def.kind === "moment") return 0;
  if (def.kind === "tactic" || def.kind === "gameplan") return 1;
  return def.position === "ST" ? 2 : 1;
}

// ---------- teams ----------

export interface TeamDef {
  id: string;
  name: string;
  confed: string;
  group: string; // "A".."L", real 2026 draw
  tier: 1 | 2 | 3 | 4; // 1 = elite
  attackRating: number; // base clock points per round
  style: StyleId;
  coach: string; // parody coach name
}

export interface OppInfo {
  teamId: string;
  name: string;
  attackRating: number; // already includes the style's clock multiplier
  style: StyleId;
  tier: 1 | 2 | 3 | 4;
}

// ---------- intents (the opponent's telegraphed move each round) ----------

export type Intent =
  | { kind: "attack"; points: number; big?: boolean } // they build toward a goal
  | { kind: "sitDeep"; amount: number } // they absorb your shot points this round
  | { kind: "press" } // your next hand is 1 smaller
  | { kind: "counter"; points: number }; // hits only if you played <2 attack cards

// ---------- match ----------

export type MatchPhase = "ROUND_ACTIVE" | "PUSH_DECISION" | "DONE";
export type MatchMode = "regulation" | "extratime" | "suddendeath";
export type MatchContext = "group" | "knockout";
export type MatchResult = "pending" | "win" | "draw" | "loss";

export interface MatchState {
  phase: MatchPhase;
  mode: MatchMode;
  context: MatchContext;
  opp: OppInfo;
  styleEffects: EffectDef[];
  plays: PlayDef[];
  bal: BalanceConfig;
  round: number; // 1-based; keeps counting through extra time / sudden death
  playerGoals: number;
  oppGoals: number;
  playerShotPoints: number; // your meter: GOAL_THRESHOLD pts = 1 goal, remainder carries
  oppClockPoints: number; // their meter, filled by executed attack intents
  stamina: number; // energy this round
  block: number; // absorbs this round's incoming intent, then expires
  pendingMult: number; // tactic buffs applied to your next attack card
  pendingFlat: number; // flat bonus applied to your next attack card
  sitDeepPool: number; // their parry pool this round (absorbs your shot points)
  handPenalty: number; // press effect: next round draws this many fewer
  intent: Intent | null;
  intentStep: number;
  playedThisRound: { uid: string; position?: Position; isAttack: boolean }[];
  multCap: number | null; // fortress legacy cap on a single card's mult
  activePassives: PassiveEffect[]; // staff (from match start) + gameplans played
  gameplansPlayed: string[]; // defIds active this match (gameplans are unique)
  mulliganUsed: boolean; // one free hand redraw per match
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exile: CardInstance[];
  extraRoundsPlayed: number;
  suddenDeathRoundsPlayed: number;
  earned: { budget: number; scout: number }; // collected by the run layer at match end
  result: MatchResult;
  rng: RngState;
}

export type MatchAction =
  | { type: "PLAY_CARD"; uid: string }
  | { type: "MULLIGAN" } // once per match: redraw the whole hand
  | { type: "END_ROUND" }
  | { type: "EXTRA_TIME" }
  | { type: "TAKE_WIN" };

// ---------- events (the UI/animation channel; sim ignores them) ----------

export type GameEvent =
  | { type: "MATCH_START"; opp: OppInfo }
  | { type: "ROUND_START"; round: number; mode: MatchMode }
  | { type: "CARDS_DRAWN"; uids: string[] }
  | { type: "PILE_RESHUFFLED" }
  | { type: "CARD_PLAYED"; uid: string; as: "attack" | "defend"; cost: number }
  | { type: "SHOT_VALUE"; basePower: number; mult: number; value: number; playName: string }
  | { type: "GOAL_SCORED"; goals: number; total: number }
  | { type: "BLOCK_GAINED"; amount: number; total: number }
  | { type: "INTENT_REVEALED"; intent: Intent }
  | {
      type: "INTENT_EXECUTED";
      intent: Intent;
      blocked: number;
      points: number; // what got through
      oppGoals: number;
    }
  | { type: "FORM_GAINED"; uid: string; amount: number; formPower: number }
  | { type: "GAMEPLAN_SET"; uid: string; defId: string } // persistent for the match
  | { type: "MULLIGAN_USED"; uids: string[] } // the redrawn hand
  // ---- dice mode ----
  | { type: "DICE_ROLLED"; dice: number[] }
  | { type: "DICE_CARRIED"; values: number[] }
  | { type: "DIE_ASSIGNED"; uid: string; die: number }
  | { type: "PASS_CHALLENGED"; roll: number; pressure: number; survived: boolean }
  | { type: "OPP_PASS_CHALLENGED"; roll: number; pressure: number; survived: boolean }
  // Legacy UI-only variants retained until the Task 3 UI rewrite removes old lane popups.
  | { type: "LANE_COMMITTED"; uid: string; cardName: string; die: number; buildUp: number; chance: number; cover: number }
  | {
      type: "DUEL_RESOLVED";
      buildUp: number;
      chance: number;
      cover: number;
      ballFrom: number;
      ballAfterBuildUp: number;
      ballAfterOpponent: number;
      pressure: number;
      absorbed: number;
      gotThrough: number;
      shotQualityGained: number;
    }
  | {
      type: "PASS_COMPLETED";
      uid: string;
      cardName: string;
      passes: number;
      chanceGained: number;
      shotQuality: number;
      risked: number;
      combo?: string;
    }
  | { type: "CHAIN_INTERCEPTED"; byYou: boolean; passes: number; chanceLost: number }
  | { type: "COUNTER_SHOT"; byYou: boolean; roll: number; bonus: number; dc: number; goal: boolean }
  | { type: "OPP_PASS"; passes: number; oppChance: number; risk: number }
  | { type: "DEFENSE_COMMITTED"; uid: string; cardName: string; die: number; amount: number; total: number }
  | { type: "DIE_REROLLED"; dieIndex: number; from: number; to: number }
  | { type: "BALL_MOVED"; ball: number; toward: "yours" | "theirs" }
  | { type: "OPP_SHOT"; roll: number; danger: number; dc: number; goal: boolean }
  | { type: "SHOT_TAKEN"; roll: number; dc: number; quality: number; goal: boolean; corner?: true }
  | { type: "CORNER_EARNED"; margin: number }
  | { type: "KEEPER_RATTLED" }
  | { type: "CARD_FATIGUED"; uids: string[] }
  | { type: "CARDS_DISCARDED"; uids: string[]; forced: boolean }
  | { type: "PUSH_DECISION"; playerGoals: number; oppGoals: number }
  | { type: "EXTRA_TIME_START"; round: number }
  | { type: "ET_SURVIVED"; budget: number; scout: number }
  | { type: "SUDDEN_DEATH_START" }
  | { type: "SHOOTOUT"; playerRoll: number; oppRoll: number; won: boolean }
  | {
      type: "MATCH_END";
      result: Exclude<MatchResult, "pending">;
      playerGoals: number;
      oppGoals: number;
    };

export interface MatchStep {
  state: MatchState;
  events: GameEvent[];
}

// ---------- dice match (the active match loop on this build) ----------

export interface Die {
  value: number;
  used: boolean;
  carried?: boolean;
}

export interface DiceMatchState {
  phase: MatchPhase;
  mode: MatchMode;
  context: MatchContext;
  opp: OppInfo;
  bal: BalanceConfig;
  round: number;
  ball: number; // 0 = your goal, bal.DICE.PITCH_LEN = their goal
  possession: "you" | "them";
  ownKeeperDC: number; // their shots roll vs this
  passes: number; // completed passes in your current chain
  lastPassPosition: Position | null; // previous completed pass in your current chain
  nextChanceBonus: number; // banked by setupNext, consumed by the next chance effect
  nextRiskDelta: number; // banked by safePass, consumed by your next interception check
  defenseCommit: number; // risk you've committed against THEIR chain this possession
  oppPasses: number;
  oppChance: number;
  shotQuality: number;
  keeperRattled: boolean; // persists until your next regular or counter shot resolves
  corner: boolean; // one attack-card delivery remains in this possession
  playerGoals: number;
  oppGoals: number;
  keeperDC: number;
  dice: Die[];
  carriedDice: number[];
  intent: Intent | null;
  intentStep: number;
  diePenalty: number;
  handPenalty: number;
  mutators: DiceMutator[]; // the nation's identity, active all match
  rerollDieLeft: number; // per-round budget (Brazil)
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exile: CardInstance[];
  activePassives: PassiveEffect[];
  extraRoundsPlayed: number;
  suddenDeathRoundsPlayed: number;
  earned: { budget: number; scout: number };
  result: MatchResult;
  rng: RngState;
}

export type DiceMatchAction =
  | { type: "ASSIGN_DIE"; uid: string; dieIndex: number }
  | { type: "REROLL_DIE"; dieIndex: number } // Brazil: opt-in single-die reroll
  | { type: "SHOOT" }
  | { type: "END_ROUND" };

export interface DiceMatchStep {
  state: DiceMatchState;
  events: GameEvent[];
}

export interface DiceMatchConfig {
  opp: OppInfo;
  styleEffects: EffectDef[];
  plays: PlayDef[];
  context: MatchContext;
  deck: CardInstance[];
  passives?: PassiveEffect[];
  mutators?: DiceMutator[]; // nation identity
  rng: RngState;
  balance: BalanceConfig;
}

// ---------- styles ----------

export interface StyleDef {
  id: StyleId;
  name: string;
  blurb: string; // shown on the opponent panel
  clockMult: number; // baked into OppInfo.attackRating at matchup build
  effects: EffectDef[];
}

// ---------- run / campaign ----------

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";

export const STAGE_ORDER: readonly Stage[] = ["GROUP", "R32", "R16", "QF", "SF", "FINAL"];

export interface GroupRow {
  teamId: string; // the player's own row uses their chosen teamId
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

export interface FixtureResult {
  matchday: number;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface ShopState {
  cards: { defId: string; price: number; sold: boolean }[];
  trainPrice: number;
  releasePrice: number;
  drillPrice: number; // make a gameplan permanent (removes the card)
  rerollScoutPrice: number;
}

export interface KnockoutRecord {
  stage: Stage;
  oppId: string;
  playerGoals: number;
  oppGoals: number;
  result: "win" | "loss";
}

export interface PlayerMatchRecord {
  stage: Stage;
  oppId: string;
  playerGoals: number;
  oppGoals: number;
  result: "win" | "draw" | "loss";
  pushedRounds: number;
}

export type RunPhase = "IDLE" | "MATCH" | "STAFF" | "REWARD" | "DONE";

export interface RewardOffer {
  defIds: string[];
}

export interface StaffOffer {
  staffIds: string[]; // pick 1; offered when you advance a stage
}

export interface RunState {
  version: 8;
  seed: string;
  playerTeamId: string;
  stage: Stage;
  matchIndexInStage: number; // group: 0..2; knockout: always 0
  phase: RunPhase;
  groupTeamIds: string[]; // 3 AI teams in the player's group
  groupTable: GroupRow[];
  groupFixtures: FixtureResult[];
  groupOpponentOrder: string[]; // matchday order of the player's 3 group games
  tiebreak: Record<string, number>; // seeded random tiebreak per team
  knockoutHistory: KnockoutRecord[];
  lastMatch: PlayerMatchRecord | null;
  nextOppId: string | null;
  scouted: boolean; // paid to reveal the next opponent's profile
  deck: CardInstance[];
  uidCounter: number;
  staff: string[]; // hired StaffDef ids — permanent run passives
  drilled: string[]; // gameplan defIds made permanent (card was removed)
  resources: { budget: number; scout: number };
  activeMatch: DiceMatchState | null;
  pendingReward: RewardOffer | null;
  pendingStaff: StaffOffer | null;
  shop: ShopState | null;
  usedTeamIds: string[]; // already faced; excluded from knockout draws
  result: "active" | "won" | "eliminated";
  rng: RngState;
}

export type RunAction =
  | { type: "START_MATCH" }
  | { type: "MATCH_ACTION"; action: DiceMatchAction }
  | { type: "PICK_REWARD"; index: number }
  | { type: "SKIP_REWARD" }
  | { type: "CUT_CARD"; uid: string } // reward-screen alternative: trim the squad for free
  | { type: "PICK_STAFF"; index: number }
  | { type: "SKIP_STAFF" }
  | { type: "BUY_CARD"; index: number }
  | { type: "TRAIN_CARD"; uid: string }
  | { type: "RELEASE_CARD"; uid: string }
  | { type: "DRILL_CARD"; uid: string } // imbue: gameplan becomes a run passive, card removed
  | { type: "REROLL_SHOP" }
  | { type: "SCOUT_OPPONENT" };

export interface RunStep {
  state: RunState;
  events: GameEvent[]; // match events when the action was a MATCH_ACTION
}

/** Everything the core run layer needs to know about content, injected by the
 * driver (sim/UI). Keeps core free of imports from src/data. */
export interface ContentBundle {
  defs: CardDefMap;
  cardPool: CardDef[]; // cards that can appear in rewards/shops
  staffPool: StaffDef[]; // hires offered on stage advance
  teams: TeamDef[];
  styles: Record<StyleId, StyleDef>;
  plays: PlayDef[];
  startingDeck: { defId: string; level: 0 | 1 | 2 }[]; // fallback when a nation has no kit
  nationStars?: Record<string, string>; // playable teamId -> star card defId
  nationKits?: Record<string, NationKit>; // playable teamId -> class kit (combat mode)
  nationDiceKits?: Record<string, NationDiceKit>; // playable teamId -> dice identity
  balance: BalanceConfig;
}
