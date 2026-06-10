// Assembles the ContentBundle that the core run layer is driven with.
// Sim and UI both import from here; core never imports from src/data.

import type { ContentBundle } from "../core/types";
import type { BalanceConfig } from "../core/balance";
import { ACTIVE_BALANCE } from "./balance";
import { CARD_DEFS, CARD_DEF_MAP, STARTING_DECK_TEMPLATE } from "./cards";
import { STYLES } from "./styles";
import { TEAMS } from "./teams";

export function makeContent(balance: BalanceConfig = ACTIVE_BALANCE): ContentBundle {
  return {
    defs: CARD_DEF_MAP,
    cardPool: [...CARD_DEFS],
    teams: [...TEAMS],
    styles: STYLES,
    startingDeck: STARTING_DECK_TEMPLATE,
    balance,
  };
}
