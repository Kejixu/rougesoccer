import type { CardDef, CardInstance } from "../core/types";

// Starter card pool (M1: 12 defs). Parody-star cards land in M5; these are the
// generic archetypes every squad starts from.

export const CARD_DEFS = [
  {
    id: "st_clinical",
    kind: "player",
    name: "Clinical Striker",
    position: "ST",
    rarity: "common",
    levels: [
      { power: 12, text: "12 power. Finds form: +3 power per goal this match." },
      { power: 14, text: "14 power. Finds form: +3 power per goal this match." },
      { power: 17, text: "17 power. Finds form: +3 power per goal this match." },
    ],
    effects: [{ trigger: "onGoal", op: { kind: "gainFormPower", amount: 3 } }],
  },
  {
    id: "st_poacher",
    kind: "player",
    name: "Poacher",
    position: "ST",
    rarity: "common",
    levels: [
      { power: 12, text: "12 power. +4 power in attacks of 2 or fewer cards." },
      { power: 14, text: "14 power. +8 power in attacks of 2 or fewer cards." },
      { power: 17, text: "17 power. +12 power in attacks of 2 or fewer cards." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackCardCount", cmp: "lte", value: 2 },
        op: { kind: "addPower", amount: 4 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "wg_flash",
    kind: "player",
    name: "Flash Winger",
    position: "WG",
    rarity: "common",
    levels: [
      { power: 8, text: "8 power. +0.25 mult if the attack includes a ST." },
      { power: 10, text: "10 power. +0.5 mult if the attack includes a ST." },
      { power: 12, text: "12 power. +0.75 mult if the attack includes a ST." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackIncludesPosition", position: "ST" },
        op: { kind: "addMult", amount: 0.25 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "mf_engine",
    kind: "player",
    name: "Box-to-Box Engine",
    position: "MF",
    rarity: "common",
    levels: [
      { power: 5, text: "5 power." },
      { power: 6, text: "6 power." },
      { power: 8, text: "8 power." },
    ],
    effects: [],
  },
  {
    id: "mf_metronome",
    kind: "player",
    name: "Midfield Metronome",
    position: "MF",
    rarity: "common",
    levels: [
      { power: 4, text: "4 power. +0.25 mult." },
      { power: 5, text: "5 power. +0.5 mult." },
      { power: 6, text: "6 power. +0.75 mult." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "addMult", amount: 0.25 }, scaling: "perLevel" },
    ],
  },
  {
    id: "df_stopper",
    kind: "player",
    name: "No-Nonsense Stopper",
    position: "DF",
    rarity: "common",
    levels: [
      { defense: 5, text: "Deploy: -5 opponent clock per round." },
      { defense: 6, text: "Deploy: -6 opponent clock per round." },
      { defense: 8, text: "Deploy: -8 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "df_sweeper",
    kind: "player",
    name: "Sweeper",
    position: "DF",
    rarity: "common",
    levels: [
      { defense: 4, power: 2, text: "2 power. Deploy: -4 opponent clock per round." },
      { defense: 5, power: 3, text: "3 power. Deploy: -5 opponent clock per round." },
      { defense: 7, power: 4, text: "4 power. Deploy: -7 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "gk_wall",
    kind: "player",
    name: "The Wall",
    position: "GK",
    rarity: "common",
    levels: [
      { defense: 6, text: "Deploy: -6 opponent clock per round." },
      { defense: 8, text: "Deploy: -8 opponent clock per round." },
      { defense: 10, text: "Deploy: -10 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "tac_through",
    kind: "tactic",
    name: "Through Ball",
    rarity: "common",
    levels: [{ text: "x1.5 mult on this attack." }],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 1.5 } }],
  },
  {
    id: "tac_longball",
    kind: "tactic",
    name: "Long Ball",
    rarity: "common",
    levels: [
      { text: "+8 power on this attack." },
      { text: "+16 power on this attack." },
      { text: "+24 power on this attack." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "addPower", amount: 8 }, scaling: "perLevel" },
    ],
  },
  {
    id: "tac_switch",
    kind: "tactic",
    name: "Switch Play",
    rarity: "common",
    levels: [{ text: "Draw 2 cards after this attack." }],
    effects: [{ trigger: "onPlay", op: { kind: "draw", amount: 2 } }],
  },
  {
    id: "mom_screamer",
    kind: "moment",
    name: "Screamer!",
    rarity: "rare",
    exileOnPlay: true,
    levels: [{ text: "x2 mult on this attack. Once per match." }],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 2 } }],
  },
] as const satisfies readonly CardDef[];

export const CARD_DEF_MAP: Record<string, CardDef> = Object.fromEntries(
  CARD_DEFS.map((d) => [d.id, d]),
);

const STARTING_DECK_LIST: { defId: string; count: number }[] = [
  { defId: "st_clinical", count: 1 },
  { defId: "st_poacher", count: 1 },
  { defId: "wg_flash", count: 1 },
  { defId: "mf_engine", count: 2 },
  { defId: "mf_metronome", count: 2 },
  { defId: "df_stopper", count: 2 },
  { defId: "df_sweeper", count: 2 },
  { defId: "gk_wall", count: 1 },
  { defId: "tac_through", count: 1 },
  { defId: "tac_longball", count: 1 },
  { defId: "tac_switch", count: 1 },
  { defId: "mom_screamer", count: 1 },
];

/** Flat template consumed by ContentBundle.startingDeck. */
export const STARTING_DECK_TEMPLATE: { defId: string; level: 0 | 1 | 2 }[] =
  STARTING_DECK_LIST.flatMap((entry) =>
    Array.from({ length: entry.count }, () => ({ defId: entry.defId, level: 0 as const })),
  );

export function makeStartingDeck(): CardInstance[] {
  return STARTING_DECK_TEMPLATE.map((c, i) => ({
    uid: `start-${i}`,
    defId: c.defId,
    level: c.level,
    formPower: 0,
    fatigued: false,
  }));
}
