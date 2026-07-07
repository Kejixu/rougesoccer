// Dice-mode card pool. Every card needs a die matching its `slot` to fire.
// Attack cards advance or build Chance during your chain; defensive cards raise
// their interception risk during the opponent chain.

import type { CardDef, CardInstance } from "../core/types";

export const DICE_CARD_DEFS = [
  {
    id: "d_shortpass",
    kind: "player",
    name: "Short Pass",
    position: "MF",
    rarity: "common",
    slot: { kind: "min", value: 2 },
    diceEffects: [{ kind: "progressFromDie" }],
    levels: [{ text: "A pass: move the ball up by the die." }],
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
    levels: [{ text: "Carry it forward 4." }],
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
    levels: [{ text: "Move 3, draw 1." }],
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
      { kind: "shotQuality", amount: 2 },
    ],
    levels: [{ text: "Move 2, +2 Chance." }],
    effects: [],
  },
  {
    id: "d_sideways",
    kind: "player",
    name: "Sideways Pass",
    position: "MF",
    rarity: "common",
    slot: { kind: "max", value: 3 },
    diceEffects: [
      { kind: "safePass", amount: 0.12 },
      { kind: "progress", amount: 1 },
    ],
    levels: [{ text: "Recycle: your next pass is 12% safer, move 1." }],
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
      { kind: "setupNext", bonus: 4 },
      { kind: "progress", amount: 2 },
    ],
    levels: [{ text: "Split the line: next finisher +4, move 2." }],
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
      { kind: "progress", amount: 3 },
      { kind: "shotQuality", amount: 3 },
    ],
    levels: [{ text: "Break fast: move 3, +3 Chance." }],
    effects: [],
  },
  {
    id: "d_finish",
    kind: "player",
    name: "Clinical Finish",
    position: "ST",
    rarity: "common",
    slot: { kind: "min", value: 5 },
    diceEffects: [{ kind: "shotQualityFromDie" }],
    levels: [{ text: "Chance = the die. Finish the move." }],
    effects: [],
  },
  {
    id: "d_poacher",
    kind: "player",
    name: "Poacher",
    position: "ST",
    rarity: "common",
    slot: { kind: "parity", even: true },
    diceEffects: [{ kind: "shotQuality", amount: 5 }],
    levels: [{ text: "+5 Chance." }],
    effects: [],
  },
  {
    id: "d_cross",
    kind: "player",
    name: "Whipped Cross",
    position: "WG",
    rarity: "common",
    slot: { kind: "min", value: 4 },
    diceEffects: [{ kind: "setupNext", bonus: 5 }],
    levels: [{ text: "Whip it in: next finisher +5." }],
    effects: [],
  },
  {
    id: "d_longshot",
    kind: "player",
    name: "Screamer from Range",
    position: "ST",
    rarity: "rare",
    slot: { kind: "min", value: 6 },
    diceEffects: [{ kind: "shotQuality", amount: 8 }],
    levels: [{ text: "+8 Chance. Let it fly." }],
    effects: [],
  },
  {
    id: "d_tackle",
    kind: "player",
    name: "Last-Ditch Tackle",
    position: "DF",
    rarity: "common",
    slot: { kind: "max", value: 2 },
    diceEffects: [{ kind: "defend", amount: 0.18 }],
    levels: [{ text: "Defending: +18% chance you win their next pass." }],
    effects: [],
  },
  {
    id: "d_clearance",
    kind: "player",
    name: "Clearance",
    position: "DF",
    rarity: "common",
    slot: { kind: "max", value: 3 },
    diceEffects: [{ kind: "defend", amount: 0.12 }],
    levels: [{ text: "Defending: +12% on their next pass." }],
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
      { kind: "defend", amount: 0.08 },
      { kind: "draw", amount: 1 },
    ],
    levels: [{ text: "Defending: +8%, draw 1." }],
    effects: [],
  },
] as const satisfies readonly CardDef[];

export const DICE_CARD_MAP: Record<string, CardDef> = Object.fromEntries(DICE_CARD_DEFS.map((d) => [d.id, d]));

const DICE_STARTING_LIST: { defId: string; count: number }[] = [
  { defId: "d_shortpass", count: 3 },
  { defId: "d_drivingrun", count: 2 },
  { defId: "d_sideways", count: 2 },
  { defId: "d_throughball", count: 1 },
  { defId: "d_finish", count: 2 },
  { defId: "d_poacher", count: 1 },
  { defId: "d_tackle", count: 3 },
  { defId: "d_clearance", count: 2 },
  { defId: "d_keeper", count: 1 },
];

export const DICE_STARTING_TEMPLATE: { defId: string; level: 0 | 1 | 2 }[] = DICE_STARTING_LIST.flatMap((e) =>
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
