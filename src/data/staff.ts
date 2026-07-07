// Backroom staff: the run's relic layer. One hire offered (pick 1 of 3) every
// time the player advances a stage. Same parody-name rule as players: the pun
// is the legal distance.

import type { StaffDef } from "../core/types";

export const STAFF_DEFS = [
  {
    id: "staff_setpiece",
    role: "Set-Piece Coach",
    name: "Gianni Deadball",
    rarity: "common",
    text: "Your first attack each round gets ×1.25 mult.",
    passive: { kind: "firstAttackMult", amount: 1.25 },
  },
  {
    id: "staff_fitness",
    role: "Fitness Guru",
    name: "Jurgen Kloppwork",
    rarity: "common",
    text: "Bank 2 extra unspent stamina between rounds.",
    passive: { kind: "carryCapBonus", amount: 2 },
  },
  {
    id: "staff_gkcoach",
    role: "Goalkeeping Coach",
    name: "Iker Catchillas",
    rarity: "common",
    text: "Start every round with 2 block.",
    passive: { kind: "blockPerRound", amount: 2 },
  },
  {
    id: "staff_commercial",
    role: "Commercial Director",
    name: "Flo Prezident",
    rarity: "common",
    text: "+10 budget for every match you win.",
    passive: { kind: "budgetOnWin", amount: 10 },
  },
  {
    id: "staff_psych",
    role: "Sports Psychologist",
    name: "Dr. Carlo Calmcelotti",
    rarity: "rare",
    text: "Scoring a goal refunds 1 stamina.",
    passive: { kind: "staminaOnGoal", amount: 1 },
  },
  {
    id: "staff_youth",
    role: "Youth Academy Scout",
    name: "Arsene Wengineer",
    rarity: "rare",
    text: "Cutting or releasing a player refunds 5 budget.",
    passive: { kind: "cutRefund", amount: 5 },
  },
  {
    id: "staff_analytics",
    role: "Analytics Department",
    name: "The xG Boys",
    rarity: "rare",
    text: "+1 scout point after every match.",
    passive: { kind: "scoutPerMatch", amount: 1 },
  },
  {
    id: "staff_legend",
    role: "Club Legend Ambassador",
    name: "Zlatan Ibrahimovich Himself",
    rarity: "legendary",
    text: "+1 stamina every round.",
    passive: { kind: "roundStamina", amount: 1 },
  },
] as const satisfies readonly StaffDef[];
