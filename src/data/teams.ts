import type { TeamDef } from "../core/types";

// ============================================================================
// VERIFIED 2026 DRAW DATA — group letters are the real 2026 World Cup groups.
// Verified 2026-06-10 against two independent sources, which agree on all 12:
//   1. https://en.wikipedia.org/wiki/2026_FIFA_World_Cup (group stage tables)
//   2. https://www.bbc.com/sport/football/world-cup/table
// Full draw: A: MEX,RSA,KOR,CZE · B: CAN,BIH,QAT,SUI · C: BRA,MAR,HAI,SCO
//   D: USA,PAR,AUS,TUR · E: GER,CUW,CIV,ECU · F: NED,JPN,SWE,TUN
//   G: BEL,EGY,IRN,NZL · H: ESP,CPV,KSA,URU · I: FRA,SEN,IRQ,NOR
//   J: ARG,ALG,AUT,JOR · K: POR,COD,UZB,COL · L: ENG,CRO,GHA,PAN
// The 26-team pool includes all four teams in every playable nation's group;
// knockout opponents continue to come from the wider pool.
// ============================================================================
// Coaches are parody names by design (see plan: licensing). Ratings/styles are
// gameplay caricatures of each side's real-world identity, tuned by the sim.

export const TEAMS = [
  // ---- tier 1: the heavyweights ----
  { id: "bra", name: "Brazil", confed: "CONMEBOL", group: "C", tier: 1, attackRating: 20, style: "flair", coach: "Carlo Angelotti" },
  { id: "arg", name: "Argentina", confed: "CONMEBOL", group: "J", tier: 1, attackRating: 20, style: "balanced", coach: "Leo Scaloony" },
  { id: "fra", name: "France", confed: "UEFA", group: "I", tier: 1, attackRating: 20, style: "counter", coach: "Didier Deschomp" },
  { id: "esp", name: "Spain", confed: "UEFA", group: "H", tier: 1, attackRating: 19, style: "possession", coach: "Luis de la Fountain" },
  { id: "eng", name: "England", confed: "UEFA", group: "L", tier: 1, attackRating: 19, style: "balanced", coach: "Thomas Toochill" },
  // ---- tier 2: contenders ----
  { id: "ger", name: "Germany", confed: "UEFA", group: "E", tier: 2, attackRating: 17, style: "highpress", coach: "Julian Nagglesman" },
  { id: "por", name: "Portugal", confed: "UEFA", group: "K", tier: 2, attackRating: 17, style: "flair", coach: "Roberto Martinose" },
  { id: "ned", name: "Netherlands", confed: "UEFA", group: "F", tier: 2, attackRating: 16, style: "balanced", coach: "Ronald Koolman" },
  { id: "uru", name: "Uruguay", confed: "CONMEBOL", group: "H", tier: 2, attackRating: 16, style: "counter", coach: "Marcelo Bee-elsa" },
  { id: "mar", name: "Morocco", confed: "CAF", group: "C", tier: 2, attackRating: 16, style: "fortress", coach: "Walid Ragragoui" },
  { id: "tur", name: "Türkiye", confed: "UEFA", group: "D", tier: 2, attackRating: 14, style: "flair", coach: "Vincenzo Montellini" },
  // ---- tier 3: dangerous floaters ----
  { id: "jpn", name: "Japan", confed: "AFC", group: "F", tier: 3, attackRating: 14, style: "highpress", coach: "Hajime Moriyatsu" },
  { id: "usa", name: "United States", confed: "CONCACAF", group: "D", tier: 3, attackRating: 13, style: "highpress", coach: "Mauricio Pochettini" },
  { id: "mex", name: "Mexico", confed: "CONCACAF", group: "A", tier: 3, attackRating: 13, style: "balanced", coach: "Javier Agwirre" },
  { id: "kor", name: "South Korea", confed: "AFC", group: "A", tier: 3, attackRating: 13, style: "counter", coach: "Hong Myung-Go" },
  { id: "cze", name: "Czechia", confed: "UEFA", group: "A", tier: 3, attackRating: 12, style: "balanced", coach: "Ivan Hasheck" },
  { id: "sui", name: "Switzerland", confed: "UEFA", group: "B", tier: 3, attackRating: 13, style: "fortress", coach: "Murat Yakking" },
  { id: "sco", name: "Scotland", confed: "UEFA", group: "C", tier: 3, attackRating: 12, style: "highpress", coach: "Scott McTartan" },
  { id: "par", name: "Paraguay", confed: "CONMEBOL", group: "D", tier: 3, attackRating: 12, style: "fortress", coach: "Gustavo Alfajores" },
  { id: "aus", name: "Australia", confed: "AFC", group: "D", tier: 3, attackRating: 11, style: "balanced", coach: "Tony Popovicinity" },
  // ---- tier 4: the minnows ----
  { id: "can", name: "Canada", confed: "CONCACAF", group: "B", tier: 4, attackRating: 11, style: "counter", coach: "Jesse March" },
  { id: "rsa", name: "South Africa", confed: "CAF", group: "A", tier: 4, attackRating: 10, style: "balanced", coach: "Hugo Broose" },
  { id: "qat", name: "Qatar", confed: "AFC", group: "B", tier: 4, attackRating: 10, style: "fortress", coach: "Julen Lopetegoal" },
  { id: "nzl", name: "New Zealand", confed: "OFC", group: "G", tier: 4, attackRating: 9, style: "fortress", coach: "Darren Baze-Goalie" },
  { id: "bih", name: "Bosnia and Herzegovina", confed: "UEFA", group: "B", tier: 4, attackRating: 10, style: "counter", coach: "Savo Milo-Shows" },
  { id: "hai", name: "Haiti", confed: "CONCACAF", group: "C", tier: 4, attackRating: 8, style: "counter", coach: "Jean Goal-Pierre" },
] as const satisfies readonly TeamDef[];

export const TEAM_MAP: Record<string, TeamDef> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

/** Teams offered as player choices on the title screen. Dice mode: each has a
 * distinct identity (see NATION_DICE_KITS). Brazil is the showcase reroll nation. */
export const PLAYABLE_TEAM_IDS = ["bra", "usa", "mex", "can"] as const;
