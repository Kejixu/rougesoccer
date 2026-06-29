// Dice-mode card pool. Every card needs a die matching its `slot` to fire.
// Low dice (1-2) feed defenders, mid dice (3-4) move the ball, high dice (5-6)
// create and finish chances. No stamina — the dice pool is the action economy.

import type { CardDef, CardInstance } from "../core/types";

export const DICE_CARD_DEFS = [
  // ---- progress: move the ball up the pitch (mid dice) ----
  {
    id: "d_shortpass",
    kind: "player",
    name: "Short Pass",
    position: "MF",
    rarity: "common",
    slot: { kind: "min", value: 2 },
    diceEffects: [{ kind: "progressFromDie" }],
    levels: [{ text: "Slot 2+: Progress = the die's value." }],
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
    levels: [{ text: "Slot 3+: +4 Progress (one zone)." }],
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
    levels: [{ text: "Slot 4+: +3 Progress, draw 1." }],
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
    levels: [{ text: "Slot 4+: +2 Progress, draw 1." }],
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
    levels: [{ text: "Slot 5+: jump a zone; +2 Shot Quality in the Final Third or Box." }],
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
    levels: [{ text: "Slot exactly 4: +4 Progress, draw 1." }],
    effects: [],
  },

  // ---- defend: win possession or shove the ball back ----
  {
    id: "d_tackle",
    kind: "player",
    name: "Last-Ditch Tackle",
    position: "DF",
    rarity: "common",
    slot: { kind: "max", value: 2 },
    diceEffects: [{ kind: "winPossession" }],
    levels: [{ text: "Slot 2 or less: Win possession (tackle)." }],
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
    levels: [{ text: "Slot 3 or less: Boot the ball back to midfield." }],
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
    levels: [{ text: "Slot any die: Push the ball back 4 steps, draw 1." }],
    effects: [],
  },

  // ---- finish: high dice into shot quality (in the box) ----
  {
    id: "d_finish",
    kind: "player",
    name: "Clinical Finish",
    position: "ST",
    rarity: "common",
    slot: { kind: "min", value: 5 },
    diceEffects: [{ kind: "shotQualityFromDie", minZone: 4 }],
    levels: [{ text: "In the Box, slot 5+: Shot Quality = the die's value." }],
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
    levels: [{ text: "In the Box, slot an even die: +5 Shot Quality." }],
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
    levels: [{ text: "In the Final Third or Box, slot 4+: +4 Shot Quality." }],
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
    levels: [{ text: "Slot a 6 in the Final Third or Box: +8 Shot Quality." }],
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
    levels: [{ text: "Slot 3+: jump a zone; +3 Shot Quality in the Box." }],
    effects: [],
  },
] as const satisfies readonly CardDef[];

export const DICE_CARD_MAP: Record<string, CardDef> = Object.fromEntries(
  DICE_CARD_DEFS.map((d) => [d.id, d]),
);

// You now spend roughly half a match defending, so the deck carries a real
// defensive presence (~40%) — otherwise a defend possession with no defensive
// card in hand is a dead round. Keeper takes any die, guaranteeing an option.
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
