// Nation class kits — Slay-the-Spire characters. Picking your host nation
// changes how the game plays: a permanent identity passive, a starting deck
// built around it, and signature cards (exclusiveTo in cards.ts) seeded into
// rewards and shops only for that nation.

import type { NationKit } from "../core/types";

export const NATION_KITS: Record<string, NationKit> = {
  usa: {
    identity: "The Press Machine",
    blurb:
      "Suffocate them in midfield. Every midfielder presses, and won balls turn into attacks.",
    passive: { kind: "blockOnPosition", position: "MF", amount: 2 },
    passiveText: "Every midfielder you play grants 2 block.",
    startingDeck: [
      { defId: "st_clinical", level: 0 },
      { defId: "st_poacher", level: 0 },
      { defId: "mf_engine", level: 0 },
      { defId: "mf_engine", level: 0 },
      { defId: "mf_metronome", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "df_stopper", level: 0 },
      { defId: "df_stopper", level: 0 },
      { defId: "gk_wall", level: 0 },
      { defId: "usa_press_trap", level: 0 },
      { defId: "tac_through", level: 0 },
      { defId: "gp_gegenpress", level: 0 },
      { defId: "mom_screamer", level: 0 },
    ],
  },
  mex: {
    identity: "La Ola",
    blurb:
      "Wave after wave of quick passes. The more cards you play in a round, the harder they hit.",
    passive: { kind: "drawBonus", amount: 1 },
    passiveText: "Draw 1 extra card every round.",
    startingDeck: [
      { defId: "wg_flash", level: 0 },
      { defId: "wg_flash", level: 0 },
      { defId: "mf_metronome", level: 0 },
      { defId: "mf_metronome", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "mex_ola", level: 0 },
      { defId: "df_stopper", level: 0 },
      { defId: "df_sweeper", level: 0 },
      { defId: "gk_wall", level: 0 },
      { defId: "tac_switch", level: 0 },
      { defId: "tac_through", level: 0 },
      { defId: "gp_overlap", level: 0 },
      { defId: "mom_screamer", level: 0 },
    ],
  },
  can: {
    identity: "On the Break",
    blurb:
      "Soak the pressure, then hit the space at full sprint. First attacks and counters hit harder.",
    passive: { kind: "firstAttackMult", amount: 1.2 },
    passiveText: "Your first attack each round hits ×1.2.",
    startingDeck: [
      { defId: "st_poacher", level: 0 },
      { defId: "st_clinical", level: 0 },
      { defId: "wg_flash", level: 0 },
      { defId: "can_breakaway", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "academy_prospect", level: 0 },
      { defId: "df_stopper", level: 0 },
      { defId: "df_sweeper", level: 0 },
      { defId: "gk_wall", level: 0 },
      { defId: "tac_parkbus", level: 0 },
      { defId: "tac_through", level: 0 },
      { defId: "gp_lowblock", level: 0 },
      { defId: "mom_screamer", level: 0 },
    ],
  },
};
