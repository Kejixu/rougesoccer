// Dice-mode card pool. Every card needs a die matching its `slot` to fire.
// Low dice (1-2) feed defenders, mid dice (3-4) move the ball, high dice (5-6)
// create and finish chances. No stamina — the dice pool is the action economy.

import type { CardDef, CardInstance } from "../core/types";

export const DICE_CARD_DEFS = [
  // ---- build-up: commit territory for round resolution (mid dice) ----
  {
    id: "d_shortpass",
    kind: "player",
    name: "Short Pass",
    position: "MF",
    rarity: "common",
    slot: { kind: "min", value: 2 },
    diceEffects: [{ kind: "progressFromDie" }],
    levels: [{ text: "Slot 2+: Build-Up = the die's value." }],
    effects: [],
  },
  {
    id: "d_drivingrun",
    kind: "player",
    name: "Driving Run",
    position: "MF",
    rarity: "common",
    slot: { kind: "min", value: 3 },
    diceEffects: [{ kind: "progress", amount: 4 }],
    levels: [{ text: "Slot 3+: +4 Build-Up (one zone)." }],
    effects: [],
  },
  {
    id: "d_flankrun",
    kind: "player",
    name: "Flank Run",
    position: "WG",
    rarity: "common",
    slot: { kind: "min", value: 4 },
    diceEffects: [
      { kind: "progress", amount: 3 },
      { kind: "draw", amount: 1 },
    ],
    levels: [{ text: "Slot 4+: +3 Build-Up, draw 1." }],
    effects: [],
  },
  {
    id: "d_quickcombo",
    kind: "player",
    name: "Quick Combo",
    position: "MF",
    rarity: "common",
    slot: { kind: "min", value: 4 },
    diceEffects: [
      { kind: "progress", amount: 2 },
      { kind: "draw", amount: 1 },
    ],
    levels: [{ text: "Slot 4+: +2 Build-Up, draw 1." }],
    effects: [],
  },
  {
    id: "d_throughball",
    kind: "player",
    name: "Through Ball",
    position: "MF",
    rarity: "rare",
    slot: { kind: "min", value: 5 },
    diceEffects: [
      { kind: "advance", zones: 1 },
      { kind: "shotQuality", amount: 2, minZone: 3 },
    ],
    levels: [{ text: "Slot 5+: +1 zone Build-Up; +2 Chance in the Final Third or Box." }],
    effects: [],
  },
  {
    id: "d_overlap",
    kind: "player",
    name: "Overlapping Run",
    position: "WG",
    rarity: "common",
    slot: { kind: "exact", value: 4 },
    diceEffects: [
      { kind: "progress", amount: 4 },
      { kind: "draw", amount: 1 },
    ],
    levels: [{ text: "Slot exactly 4: +4 Build-Up, draw 1." }],
    effects: [],
  },

  // ---- cover: reduce opponent pressure when the duel resolves ----
  {
    id: "d_tackle",
    kind: "player",
    name: "Last-Ditch Tackle",
    position: "DF",
    rarity: "common",
    slot: { kind: "max", value: 2 },
    diceEffects: [{ kind: "winPossession" }],
    levels: [{ text: "Slot 2 or less: strong Cover; USA adds counter Build-Up." }],
    effects: [],
  },
  {
    id: "d_clearance",
    kind: "player",
    name: "Clearance",
    position: "DF",
    rarity: "common",
    slot: { kind: "max", value: 3 },
    diceEffects: [{ kind: "clearance" }],
    levels: [{ text: "Slot 3 or less: +6 Cover." }],
    effects: [],
  },
  {
    id: "d_keeper",
    kind: "player",
    name: "Keeper Claims It",
    position: "GK",
    rarity: "rare",
    slot: { kind: "any" },
    diceEffects: [
      { kind: "pushBack", steps: 4 },
      { kind: "draw", amount: 1 },
    ],
    levels: [{ text: "Slot any die: +4 Cover, draw 1." }],
    effects: [],
  },

  // ---- chance: high dice into shot quality once the ball is deep ----
  {
    id: "d_finish",
    kind: "player",
    name: "Clinical Finish",
    position: "ST",
    rarity: "common",
    slot: { kind: "min", value: 5 },
    diceEffects: [{ kind: "shotQualityFromDie", minZone: 4 }],
    levels: [{ text: "In the Box, slot 5+: Chance = the die's value." }],
    effects: [],
  },
  {
    id: "d_poacher",
    kind: "player",
    name: "Poacher",
    position: "ST",
    rarity: "common",
    slot: { kind: "parity", even: true },
    diceEffects: [{ kind: "shotQuality", amount: 5, minZone: 4 }],
    levels: [{ text: "In the Box, slot an even die: +5 Chance." }],
    effects: [],
  },
  {
    id: "d_cross",
    kind: "player",
    name: "Whipped Cross",
    position: "WG",
    rarity: "common",
    slot: { kind: "min", value: 4 },
    diceEffects: [{ kind: "shotQuality", amount: 4, minZone: 3 }],
    levels: [{ text: "In the Final Third or Box, slot 4+: +4 Chance." }],
    effects: [],
  },
  {
    id: "d_longshot",
    kind: "player",
    name: "Screamer from Range",
    position: "ST",
    rarity: "rare",
    slot: { kind: "min", value: 6 },
    diceEffects: [{ kind: "shotQuality", amount: 8, minZone: 3 }],
    levels: [{ text: "Slot a 6 in the Final Third or Box: +8 Chance." }],
    effects: [],
  },
  {
    id: "d_counter",
    kind: "player",
    name: "Counter Attack",
    position: "ST",
    rarity: "rare",
    slot: { kind: "min", value: 3 },
    diceEffects: [
      { kind: "advance", zones: 1 },
      { kind: "shotQuality", amount: 3, minZone: 4 },
    ],
    levels: [{ text: "Slot 3+: +1 zone Build-Up; +3 Chance in the Box." }],
    effects: [],
  },
] as const satisfies readonly CardDef[];

export const DICE_CARD_MAP: Record<string, CardDef> = Object.fromEntries(
  DICE_CARD_DEFS.map((d) => [d.id, d]),
);

// The deck carries real cover (~40%) so pressure is always a live lane choice.
// Keeper takes any die, guaranteeing a safety valve.
const DICE_STARTING_LIST: { defId: string; count: number }[] = [
  // attack (progress + finish)
  { defId: "d_shortpass", count: 3 },
  { defId: "d_drivingrun", count: 2 },
  { defId: "d_flankrun", count: 1 },
  { defId: "d_throughball", count: 1 },
  { defId: "d_finish", count: 2 },
  { defId: "d_poacher", count: 1 },
  // defense (tackle / clear / keeper)
  { defId: "d_tackle", count: 3 },
  { defId: "d_clearance", count: 2 },
  { defId: "d_keeper", count: 1 },
];

export const DICE_STARTING_TEMPLATE: { defId: string; level: 0 | 1 | 2 }[] =
  DICE_STARTING_LIST.flatMap((e) =>
    Array.from({ length: e.count }, () => ({ defId: e.defId, level: 0 as const })),
  );

export function makeDiceStartingDeck(): CardInstance[] {
  return DICE_STARTING_TEMPLATE.map((c, i) => ({
    uid: `dstart-${i}`,
    defId: c.defId,
    level: c.level,
    formPower: 0,
    fatigued: false,
  }));
}
