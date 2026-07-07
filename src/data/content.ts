// Assembles the ContentBundle that the core run layer is driven with.
// Sim and UI both import from here; core never imports from src/data.
//
// This build runs DICE MODE: makeContent() returns the dice card pool. The old
// Slay-the-Spire combat bundle is still available as makeCombatContent() so the
// combat engine's own tests keep a content source.

import type { ContentBundle, NationDiceKit, StaffDef } from "../core/types";
import type { BalanceConfig } from "../core/balance";
import { ACTIVE_BALANCE } from "./balance";
import { CARD_DEFS, CARD_DEF_MAP, STARTING_DECK_TEMPLATE } from "./cards";
import { DICE_CARD_DEFS, DICE_CARD_MAP, DICE_STARTING_TEMPLATE } from "./diceCards";
import { NATION_KITS } from "./kits";
import { ACTIVE_PLAYS } from "./plays";
import { STAFF_DEFS } from "./staff";
import { STYLES } from "./styles";
import { TEAMS } from "./teams";

// Each playable nation starts with its real star in the squad (combat mode only).
export const NATION_STARS: Record<string, string> = {
  usa: "wg_pulisick",
  mex: "st_golmenez",
  can: "wg_drivies",
};

// Staff whose passive has a meaning in the dice loop (others are combat-only).
const DICE_PASSIVE_KINDS = new Set([
  "blockPerRound",
  "drawBonus",
  "roundStamina",
  "budgetOnWin",
  "cutRefund",
  "scoutPerMatch",
]);
const DICE_STAFF: StaffDef[] = STAFF_DEFS.filter((s) => DICE_PASSIVE_KINDS.has(s.passive.kind));

// Nation identities — the variety hook. Each bends a dice rule. Brazil is the
// showcase (interactive reroll); the others differ at setup time.
export const NATION_DICE_KITS: Record<string, NationDiceKit> = {
  bra: {
    identity: "Joga Bonito",
    blurb: "Flair over volume: one fewer die, but reroll one die every round to make it count.",
    mutators: [
      { kind: "rerollDie", perRound: 1 },
      { kind: "poolDelta", amount: -1 },
      // only a slight keeper bump: with one fewer die Brazil is already fragile under
      // the stronger opponent pressure, so its shots shouldn't be much harder too.
      { kind: "keeperDcDelta", amount: 1 },
    ],
  },
  mex: {
    identity: "La Ola",
    blurb: "An extra die every round. Win on sheer volume — the keeper braces for it.",
    mutators: [
      { kind: "poolDelta", amount: 1 },
      { kind: "keeperDcDelta", amount: 2 },
    ],
  },
  usa: {
    identity: "The Press",
    blurb: "Hunt the ball high. Win a tackle and you spring straight into the counter.",
    mutators: [{ kind: "counterSpring", amount: 2 }],
  },
  can: {
    identity: "Resolute",
    blurb: "Hard to play through. Opponents misplace more passes against you.",
    mutators: [{ kind: "oppRiskDelta", amount: 0.06 }],
  },
};

export function makeContent(balance: BalanceConfig = ACTIVE_BALANCE): ContentBundle {
  return {
    defs: DICE_CARD_MAP,
    cardPool: [...DICE_CARD_DEFS],
    staffPool: DICE_STAFF,
    teams: [...TEAMS],
    styles: STYLES,
    plays: ACTIVE_PLAYS,
    startingDeck: DICE_STARTING_TEMPLATE,
    // dice mode uses one shared starting deck; nation identity comes later
    nationStars: undefined,
    nationKits: undefined,
    nationDiceKits: NATION_DICE_KITS,
    balance,
  };
}

export function makeCombatContent(balance: BalanceConfig = ACTIVE_BALANCE): ContentBundle {
  return {
    defs: CARD_DEF_MAP,
    cardPool: [...CARD_DEFS],
    staffPool: [...STAFF_DEFS],
    teams: [...TEAMS],
    styles: STYLES,
    plays: ACTIVE_PLAYS,
    startingDeck: STARTING_DECK_TEMPLATE,
    nationStars: NATION_STARS,
    nationKits: NATION_KITS,
    balance,
  };
}
