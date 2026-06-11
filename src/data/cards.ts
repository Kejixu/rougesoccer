import type { CardDef, CardInstance } from "../core/types";

// The card pool: generic archetypes (the starting deck) plus parody stars.
// Parody names are deliberate — recognizable but not real (licensing).
// nationality references a team id from teams.ts (flag fallback / flavor).

export const CARD_DEFS = [
  // ======================== starting archetypes ========================
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
      { power: 12, text: "12 power. Opener: +4 power as your first card this round." },
      { power: 14, text: "14 power. Opener: +8 power as your first card this round." },
      { power: 17, text: "17 power. Opener: +12 power as your first card this round." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackCardCount", cmp: "lte", value: 1 },
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
      { power: 8, text: "8 power. Combo (ST): +0.25 mult if you played a ST this round." },
      { power: 10, text: "10 power. Combo (ST): +0.5 mult if you played a ST this round." },
      { power: 12, text: "12 power. Combo (ST): +0.75 mult if you played a ST this round." },
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
      { power: 5, text: "5 power. Combo (MF): +4 power if you played a MF this round." },
      { power: 6, text: "6 power. Combo (MF): +8 power if you played a MF this round." },
      { power: 8, text: "8 power. Combo (MF): +12 power if you played a MF this round." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackIncludesPosition", position: "MF" },
        op: { kind: "addPower", amount: 4 },
        scaling: "perLevel",
      },
    ],
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
    name: "Slide-Rule Pass",
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

  // ======================== parody legendaries ========================
  {
    id: "st_messy",
    kind: "player",
    name: "Lionel Messy",
    position: "ST",
    rarity: "legendary",
    nationality: "arg",
    flavor: "He walks. He sees everything. He scores anyway.",
    levels: [
      { power: 16, text: "16 power. x1.5 mult. Finds form: +4 power per goal." },
      { power: 19, text: "19 power. x1.5 mult. Finds form: +4 power per goal." },
      { power: 23, text: "23 power. x1.5 mult. Finds form: +4 power per goal." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "mulMult", amount: 1.5 } },
      { trigger: "onGoal", op: { kind: "gainFormPower", amount: 4 } },
    ],
  },
  {
    id: "st_mbappy",
    kind: "player",
    name: "Kylian Mbappy",
    position: "ST",
    rarity: "legendary",
    nationality: "fra",
    flavor: "Blink and the net is already bulging.",
    levels: [
      { power: 15, text: "15 power. x1.25 mult. Opener: +6 power as your first card this round." },
      { power: 18, text: "18 power. x1.25 mult. Opener: +12 power as your first card this round." },
      { power: 22, text: "22 power. x1.25 mult. Opener: +18 power as your first card this round." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "mulMult", amount: 1.25 } },
      {
        trigger: "onPlay",
        condition: { kind: "attackCardCount", cmp: "lte", value: 1 },
        op: { kind: "addPower", amount: 6 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "wg_vinny",
    kind: "player",
    name: "Vinny Junior",
    position: "WG",
    rarity: "legendary",
    nationality: "bra",
    flavor: "Dances past three, smiles at the fourth.",
    levels: [
      { power: 12, text: "12 power. Combo (ST): +0.5 mult if you played a ST this round." },
      { power: 14, text: "14 power. Combo (ST): +1.0 mult if you played a ST this round." },
      { power: 17, text: "17 power. Combo (ST): +1.5 mult if you played a ST this round." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackIncludesPosition", position: "ST" },
        op: { kind: "addMult", amount: 0.5 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "st_goalnaldo",
    kind: "player",
    name: "Cristiano Goalnaldo",
    position: "ST",
    rarity: "legendary",
    nationality: "por",
    flavor: "SIUUU.",
    levels: [
      { power: 14, text: "14 power. Clutch: +8 power while trailing." },
      { power: 17, text: "17 power. Clutch: +16 power while trailing." },
      { power: 21, text: "21 power. Clutch: +24 power while trailing." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "trailing" },
        op: { kind: "addPower", amount: 8 },
        scaling: "perLevel",
      },
    ],
  },

  // ======================== parody rares ========================
  {
    id: "mf_bellingjam",
    kind: "player",
    name: "Jude Bellingjam",
    position: "MF",
    rarity: "rare",
    nationality: "eng",
    levels: [
      { power: 10, text: "10 power. Finds form: +3 power per goal." },
      { power: 12, text: "12 power. Finds form: +3 power per goal." },
      { power: 15, text: "15 power. Finds form: +3 power per goal." },
    ],
    effects: [{ trigger: "onGoal", op: { kind: "gainFormPower", amount: 3 } }],
  },
  {
    id: "wg_yummal",
    kind: "player",
    name: "Lamine Yummal",
    position: "WG",
    rarity: "rare",
    nationality: "esp",
    levels: [
      { power: 9, text: "9 power. Draw 1. Combo (ST): +0.25 mult if you played a ST this round." },
      { power: 11, text: "11 power. Draw 1. Combo (ST): +0.5 mult if you played a ST this round." },
      { power: 14, text: "14 power. Draw 1. Combo (ST): +0.75 mult if you played a ST this round." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "draw", amount: 1 } },
      {
        trigger: "onPlay",
        condition: { kind: "attackIncludesPosition", position: "ST" },
        op: { kind: "addMult", amount: 0.25 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "mf_musicala",
    kind: "player",
    name: "Jamal Musicala",
    position: "MF",
    rarity: "rare",
    nationality: "ger",
    levels: [
      { power: 8, text: "8 power. +0.25 mult." },
      { power: 10, text: "10 power. +0.5 mult." },
      { power: 13, text: "13 power. +0.75 mult." },
    ],
    effects: [
      { trigger: "onPlay", op: { kind: "addMult", amount: 0.25 }, scaling: "perLevel" },
    ],
  },
  {
    id: "df_hakimmy",
    kind: "player",
    name: "Achraf Hakimmy",
    position: "DF",
    rarity: "rare",
    nationality: "mar",
    flavor: "A full-back who lives in the opponent's half.",
    levels: [
      { power: 6, defense: 6, text: "6 power. Deploy: -6 opponent clock per round." },
      { power: 7, defense: 8, text: "7 power. Deploy: -8 opponent clock per round." },
      { power: 9, defense: 10, text: "9 power. Deploy: -10 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "st_heunggoal",
    kind: "player",
    name: "Son Heung-Goal",
    position: "ST",
    rarity: "rare",
    nationality: "kor",
    levels: [
      { power: 11, text: "11 power. x1.25 mult." },
      { power: 13, text: "13 power. x1.25 mult." },
      { power: 16, text: "16 power. x1.25 mult." },
    ],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 1.25 } }],
  },
  {
    id: "wg_pulisick",
    kind: "player",
    name: "Christian Pulisick",
    position: "WG",
    rarity: "rare",
    nationality: "usa",
    flavor: "Captain America sells a lot of shirts.",
    levels: [
      { power: 9, text: "9 power. +5 budget per goal this attack scores." },
      { power: 11, text: "11 power. +5 budget per goal this attack scores." },
      { power: 13, text: "13 power. +5 budget per goal this attack scores." },
    ],
    effects: [
      { trigger: "onGoal", op: { kind: "gainResource", resource: "budget", amount: 5 } },
    ],
  },
  {
    id: "st_golmenez",
    kind: "player",
    name: "Santi Golmenez",
    position: "ST",
    rarity: "rare",
    nationality: "mex",
    levels: [
      { power: 10, text: "10 power. Closer: +5 power with 2 or fewer cards left in hand." },
      { power: 12, text: "12 power. Closer: +10 power with 2 or fewer cards left in hand." },
      { power: 15, text: "15 power. Closer: +15 power with 2 or fewer cards left in hand." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "handSize", cmp: "lte", value: 2 },
        op: { kind: "addPower", amount: 5 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "df_vandike",
    kind: "player",
    name: "Virgil van Dike",
    position: "DF",
    rarity: "rare",
    nationality: "ned",
    flavor: "Strikers bounce off. Politely.",
    levels: [
      { defense: 8, text: "Deploy: -8 opponent clock per round." },
      { defense: 10, text: "Deploy: -10 opponent clock per round." },
      { defense: 12, text: "Deploy: -12 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "gk_martinangel",
    kind: "player",
    name: "Emi Martinangel",
    position: "GK",
    rarity: "rare",
    nationality: "arg",
    flavor: "Does the thing with the dance. You know the thing.",
    levels: [
      { defense: 7, text: "Deploy: -7 opponent clock per round." },
      { defense: 9, text: "Deploy: -9 opponent clock per round." },
      { defense: 11, text: "Deploy: -11 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "wg_drivies",
    kind: "player",
    name: "Alphonso Drivies",
    position: "WG",
    rarity: "rare",
    nationality: "can",
    levels: [
      { power: 8, text: "8 power. Draw 1 after this attack." },
      { power: 10, text: "10 power. Draw 1 after this attack." },
      { power: 12, text: "12 power. Draw 1 after this attack." },
    ],
    effects: [{ trigger: "onPlay", op: { kind: "draw", amount: 1 } }],
  },
  {
    id: "mf_valgrinder",
    kind: "player",
    name: "Fede Valgrinder",
    position: "MF",
    rarity: "rare",
    nationality: "uru",
    levels: [
      { power: 9, text: "9 power. Clutch: +4 power while trailing." },
      { power: 11, text: "11 power. Clutch: +8 power while trailing." },
      { power: 13, text: "13 power. Clutch: +12 power while trailing." },
    ],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "trailing" },
        op: { kind: "addPower", amount: 4 },
        scaling: "perLevel",
      },
    ],
  },
  {
    id: "mf_kuboom",
    kind: "player",
    name: "Take Kuboom",
    position: "MF",
    rarity: "rare",
    nationality: "jpn",
    levels: [
      { power: 8, text: "8 power. x1.2 mult." },
      { power: 10, text: "10 power. x1.2 mult." },
      { power: 12, text: "12 power. x1.2 mult." },
    ],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 1.2 } }],
  },

  // ======================== tactics ========================
  {
    id: "tac_tikitaka",
    kind: "tactic",
    name: "Midfield Masterclass",
    rarity: "rare",
    levels: [{ text: "+0.75 mult on this attack." }],
    effects: [{ trigger: "onPlay", op: { kind: "addMult", amount: 0.75 } }],
  },
  {
    id: "tac_parkbus",
    kind: "tactic",
    name: "Park the Bus",
    rarity: "common",
    levels: [
      { defense: 5, text: "Deploy: -5 opponent clock per round." },
      { defense: 7, text: "Deploy: -7 opponent clock per round." },
      { defense: 9, text: "Deploy: -9 opponent clock per round." },
    ],
    effects: [],
  },
  {
    id: "tac_counterpress",
    kind: "tactic",
    name: "Counter Press",
    rarity: "rare",
    levels: [{ text: "+4 power. Draw 2 cards after this attack." }],
    effects: [
      { trigger: "onPlay", op: { kind: "addPower", amount: 4 } },
      { trigger: "onPlay", op: { kind: "draw", amount: 2 } },
    ],
  },
  {
    id: "tac_setpiece",
    kind: "tactic",
    name: "Set Piece Routine",
    rarity: "common",
    levels: [{ text: "Opener: +12 power on your next shot if played first this round." }],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackCardCount", cmp: "lte", value: 1 },
        op: { kind: "addPower", amount: 12 },
      },
    ],
  },

  // ======================== moments (once per match) ========================
  {
    id: "mom_bicycle",
    kind: "moment",
    name: "Bicycle Kick",
    rarity: "rare",
    exileOnPlay: true,
    levels: [{ text: "x2.5 mult on this attack. Once per match." }],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 2.5 } }],
  },
  {
    id: "mom_rocket",
    kind: "moment",
    name: "30-Yard Rocket",
    rarity: "common",
    exileOnPlay: true,
    levels: [{ text: "+20 power on this attack. Once per match." }],
    effects: [{ trigger: "onPlay", op: { kind: "addPower", amount: 20 } }],
  },
  {
    id: "mom_panenka",
    kind: "moment",
    name: "Panenka",
    rarity: "rare",
    exileOnPlay: true,
    levels: [{ text: "x2 mult. +1 scout point per goal scored. Once per match." }],
    effects: [
      { trigger: "onPlay", op: { kind: "mulMult", amount: 2 } },
      { trigger: "onGoal", op: { kind: "gainResource", resource: "scout", amount: 1 } },
    ],
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
