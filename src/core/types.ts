import type { RngState } from "./rng";
import type { BalanceConfig } from "./balance";

// ---------- primitives ----------

export type Position = "GK" | "DF" | "MF" | "WG" | "ST";
export type Rarity = "common" | "rare" | "legendary";
export type CardKind = "player" | "tactic" | "moment";
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
  | { kind: "trailing" };

// Escape hatch for mechanics the data ops can't express. Keys are a closed
// union so every script is statically known to the engine.
export type ScriptKey =
  | "capMultAt2x" // fortress: total attack mult is clamped to 2
  | "burstClockOnFailedAttack" // counter: clock burst when your attack scores 0
  | "forceRandomDiscard1" // possession: lose a random card each round
  | "shrinkHand1"; // highpress: hand size -1 all match

export type EffectOp =
  | { kind: "addPower"; amount: number }
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
  text: string;
}

export interface CardDef {
  id: string;
  kind: CardKind;
  name: string;
  position?: Position; // player cards only
  rarity: Rarity;
  levels: CardLevelStats[]; // index = upgrade level, length 1..3
  effects: EffectDef[];
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
  oppClockPoints: number; // remainder carries between rounds; GOAL_THRESHOLD pts = 1 goal
  multCap: number | null; // set by fortress style
  handSizeMod: number; // set by highpress style
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exile: CardInstance[];
  deployed: CardInstance[]; // persistent defenders
  playsLeft: number;
  discardsLeft: number;
  extraRoundsPlayed: number;
  suddenDeathRoundsPlayed: number;
  earned: { budget: number; scout: number }; // collected by the run layer at match end
  result: MatchResult;
  rng: RngState;
}

export type MatchAction =
  | { type: "ATTACK"; cardUids: string[] }
  | { type: "DEFEND"; cardUids: string[] }
  | { type: "DISCARD"; cardUids: string[] }
  | { type: "END_ROUND" }
  | { type: "EXTRA_TIME" }
  | { type: "TAKE_WIN" };

// ---------- events (the UI/animation channel; sim ignores them) ----------

export type GameEvent =
  | { type: "MATCH_START"; opp: OppInfo }
  | { type: "ROUND_START"; round: number; mode: MatchMode }
  | { type: "CARDS_DRAWN"; uids: string[] }
  | { type: "PILE_RESHUFFLED" }
  | { type: "CARD_PLAYED"; uid: string; as: "attack" | "defend" }
  | { type: "SHOT_VALUE"; basePower: number; mult: number; value: number; playName: string }
  | { type: "GOAL_SCORED"; goals: number; total: number }
  | { type: "FORM_GAINED"; uid: string; amount: number; formPower: number }
  | { type: "CARD_FATIGUED"; uids: string[] }
  | { type: "CARDS_DISCARDED"; uids: string[]; forced: boolean }
  | { type: "CLOCK_TICK"; points: number; totalPoints: number; oppGoals: number }
  | { type: "CLOCK_BURST"; points: number } // counter style
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

export type RunPhase = "IDLE" | "MATCH" | "REWARD" | "DONE";

export interface RewardOffer {
  defIds: string[];
}

export interface RunState {
  version: 1;
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
  resources: { budget: number; scout: number };
  activeMatch: MatchState | null;
  pendingReward: RewardOffer | null;
  shop: ShopState | null;
  usedTeamIds: string[]; // already faced; excluded from knockout draws
  result: "active" | "won" | "eliminated";
  rng: RngState;
}

export type RunAction =
  | { type: "START_MATCH" }
  | { type: "MATCH_ACTION"; action: MatchAction }
  | { type: "PICK_REWARD"; index: number }
  | { type: "SKIP_REWARD" }
  | { type: "BUY_CARD"; index: number }
  | { type: "TRAIN_CARD"; uid: string }
  | { type: "RELEASE_CARD"; uid: string }
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
  teams: TeamDef[];
  styles: Record<StyleId, StyleDef>;
  plays: PlayDef[];
  startingDeck: { defId: string; level: 0 | 1 | 2 }[];
  balance: BalanceConfig;
}
