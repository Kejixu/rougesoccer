// Assembles the ContentBundle that the core run layer is driven with.
// Sim and UI both import from here; core never imports from src/data.
//
// This build runs DICE MODE: makeContent() returns the dice card pool. The old
// Slay-the-Spire combat bundle is still available as makeCombatContent() so the
// combat engine's own tests keep a content source.

import type { ContentBundle, StaffDef } from "../core/types";
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
