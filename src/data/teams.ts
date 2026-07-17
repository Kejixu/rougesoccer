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
  { id: "bra", name: "Brazil", flag: "🇧🇷", confed: "CONMEBOL", group: "C", tier: 1, attackRating: 20, style: "flair", coach: "Carlo Angelotti" },
  { id: "arg", name: "Argentina", flag: "🇦🇷", confed: "CONMEBOL", group: "J", tier: 1, attackRating: 20, style: "balanced", coach: "Leo Scaloony" },
  { id: "fra", name: "France", flag: "🇫🇷", confed: "UEFA", group: "I", tier: 1, attackRating: 20, style: "counter", coach: "Didier Deschomp" },
  { id: "esp", name: "Spain", flag: "🇪🇸", confed: "UEFA", group: "H", tier: 1, attackRating: 19, style: "possession", coach: "Luis de la Fountain" },
  { id: "eng", name: "England", flag: "\u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}", confed: "UEFA", group: "L", tier: 1, attackRating: 19, style: "balanced", coach: "Thomas Toochill" },
  // ---- tier 2: contenders ----
  { id: "ger", name: "Germany", flag: "🇩🇪", confed: "UEFA", group: "E", tier: 2, attackRating: 17, style: "highpress", coach: "Julian Nagglesman" },
  { id: "por", name: "Portugal", flag: "🇵🇹", confed: "UEFA", group: "K", tier: 2, attackRating: 17, style: "flair", coach: "Roberto Martinose" },
  { id: "ned", name: "Netherlands", flag: "🇳🇱", confed: "UEFA", group: "F", tier: 2, attackRating: 16, style: "balanced", coach: "Ronald Koolman" },
  { id: "uru", name: "Uruguay", flag: "🇺🇾", confed: "CONMEBOL", group: "H", tier: 2, attackRating: 16, style: "counter", coach: "Marcelo Bee-elsa" },
  { id: "mar", name: "Morocco", flag: "🇲🇦", confed: "CAF", group: "C", tier: 2, attackRating: 16, style: "fortress", coach: "Walid Ragragoui" },
  { id: "tur", name: "Türkiye", flag: "🇹🇷", confed: "UEFA", group: "D", tier: 2, attackRating: 14, style: "flair", coach: "Vincenzo Montellini" },
  // ---- tier 3: dangerous floaters ----
  { id: "jpn", name: "Japan", flag: "🇯🇵", confed: "AFC", group: "F", tier: 3, attackRating: 14, style: "highpress", coach: "Hajime Moriyatsu" },
  { id: "usa", name: "United States", flag: "🇺🇸", confed: "CONCACAF", group: "D", tier: 3, attackRating: 13, style: "highpress", coach: "Mauricio Pochettini" },
  { id: "mex", name: "Mexico", flag: "🇲🇽", confed: "CONCACAF", group: "A", tier: 3, attackRating: 13, style: "balanced", coach: "Javier Agwirre" },
  { id: "kor", name: "South Korea", flag: "🇰🇷", confed: "AFC", group: "A", tier: 3, attackRating: 13, style: "counter", coach: "Hong Myung-Go" },
  { id: "cze", name: "Czechia", flag: "🇨🇿", confed: "UEFA", group: "A", tier: 3, attackRating: 12, style: "balanced", coach: "Ivan Hasheck" },
  { id: "sui", name: "Switzerland", flag: "🇨🇭", confed: "UEFA", group: "B", tier: 3, attackRating: 13, style: "fortress", coach: "Murat Yakking" },
  { id: "sco", name: "Scotland", flag: "\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}", confed: "UEFA", group: "C", tier: 3, attackRating: 12, style: "highpress", coach: "Scott McTartan" },
  { id: "par", name: "Paraguay", flag: "🇵🇾", confed: "CONMEBOL", group: "D", tier: 3, attackRating: 12, style: "fortress", coach: "Gustavo Alfajores" },
  { id: "aus", name: "Australia", flag: "🇦🇺", confed: "AFC", group: "D", tier: 3, attackRating: 11, style: "balanced", coach: "Tony Popovicinity" },
  // ---- tier 4: the minnows ----
  { id: "can", name: "Canada", flag: "🇨🇦", confed: "CONCACAF", group: "B", tier: 4, attackRating: 11, style: "counter", coach: "Jesse March" },
  { id: "rsa", name: "South Africa", flag: "🇿🇦", confed: "CAF", group: "A", tier: 4, attackRating: 10, style: "balanced", coach: "Hugo Broose" },
  { id: "qat", name: "Qatar", flag: "🇶🇦", confed: "AFC", group: "B", tier: 4, attackRating: 10, style: "fortress", coach: "Julen Lopetegoal" },
  { id: "nzl", name: "New Zealand", flag: "🇳🇿", confed: "OFC", group: "G", tier: 4, attackRating: 9, style: "fortress", coach: "Darren Baze-Goalie" },
  { id: "bih", name: "Bosnia and Herzegovina", flag: "🇧🇦", confed: "UEFA", group: "B", tier: 4, attackRating: 10, style: "counter", coach: "Savo Milo-Shows" },
  { id: "hai", name: "Haiti", flag: "🇭🇹", confed: "CONCACAF", group: "C", tier: 4, attackRating: 8, style: "counter", coach: "Jean Goal-Pierre" },
] as const satisfies readonly TeamDef[];

export const TEAM_MAP: Record<string, TeamDef> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

/** Teams offered as player choices on the title screen. Dice mode: each has a
 * distinct identity (see NATION_DICE_KITS). Brazil is the showcase reroll nation. */
export const PLAYABLE_TEAM_IDS = ["bra", "usa", "mex", "can"] as const;
