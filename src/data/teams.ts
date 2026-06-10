import type { TeamDef } from "../core/types";

// ============================================================================
// UNVERIFIED DRAW DATA — group letters below are placeholders ("TBD").
// M5 task: verify the real 2026 group assignments against BOTH Wikipedia and
// FIFA.com (sources fetched 2026-06-10 disagreed); record source URLs + access
// date here before shipping. The engine only uses groups as labels, and the
// MVP group composition is drawn by tier, so gameplay is unaffected.
// ============================================================================
// Coaches are parody names by design (see plan: licensing). Ratings/styles are
// gameplay caricatures of each side's real-world identity, tuned by the sim.

export const TEAMS = [
  // ---- tier 1: the heavyweights ----
  { id: "bra", name: "Brazil", confed: "CONMEBOL", group: "TBD", tier: 1, attackRating: 20, style: "flair", coach: "Carlo Angelotti" },
  { id: "arg", name: "Argentina", confed: "CONMEBOL", group: "TBD", tier: 1, attackRating: 20, style: "balanced", coach: "Leo Scaloony" },
  { id: "fra", name: "France", confed: "UEFA", group: "TBD", tier: 1, attackRating: 20, style: "counter", coach: "Didier Deschomp" },
  { id: "esp", name: "Spain", confed: "UEFA", group: "TBD", tier: 1, attackRating: 19, style: "possession", coach: "Luis de la Fountain" },
  { id: "eng", name: "England", confed: "UEFA", group: "TBD", tier: 1, attackRating: 19, style: "balanced", coach: "Thomas Toochill" },
  // ---- tier 2: contenders ----
  { id: "ger", name: "Germany", confed: "UEFA", group: "TBD", tier: 2, attackRating: 17, style: "highpress", coach: "Julian Nagglesman" },
  { id: "por", name: "Portugal", confed: "UEFA", group: "TBD", tier: 2, attackRating: 17, style: "flair", coach: "Roberto Martinose" },
  { id: "ned", name: "Netherlands", confed: "UEFA", group: "TBD", tier: 2, attackRating: 16, style: "balanced", coach: "Ronald Koolman" },
  { id: "uru", name: "Uruguay", confed: "CONMEBOL", group: "TBD", tier: 2, attackRating: 16, style: "counter", coach: "Marcelo Bee-elsa" },
  { id: "mar", name: "Morocco", confed: "CAF", group: "TBD", tier: 2, attackRating: 16, style: "fortress", coach: "Walid Ragragoui" },
  // ---- tier 3: dangerous floaters ----
  { id: "jpn", name: "Japan", confed: "AFC", group: "TBD", tier: 3, attackRating: 14, style: "highpress", coach: "Hajime Moriyatsu" },
  { id: "usa", name: "United States", confed: "CONCACAF", group: "TBD", tier: 3, attackRating: 13, style: "highpress", coach: "Mauricio Pochettini" },
  { id: "mex", name: "Mexico", confed: "CONCACAF", group: "TBD", tier: 3, attackRating: 13, style: "balanced", coach: "Javier Agwirre" },
  { id: "kor", name: "South Korea", confed: "AFC", group: "TBD", tier: 3, attackRating: 13, style: "counter", coach: "Hong Myung-Go" },
  // ---- tier 4: the minnows ----
  { id: "can", name: "Canada", confed: "CONCACAF", group: "TBD", tier: 4, attackRating: 11, style: "counter", coach: "Jesse March" },
  { id: "rsa", name: "South Africa", confed: "CAF", group: "TBD", tier: 4, attackRating: 10, style: "balanced", coach: "Hugo Broose" },
  { id: "qat", name: "Qatar", confed: "AFC", group: "TBD", tier: 4, attackRating: 10, style: "fortress", coach: "Julen Lopetegoal" },
  { id: "nzl", name: "New Zealand", confed: "OFC", group: "TBD", tier: 4, attackRating: 9, style: "fortress", coach: "Darren Bazeley-Done" },
] as const satisfies readonly TeamDef[];

export const TEAM_MAP: Record<string, TeamDef> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

/** Teams offered as player choices on the title screen: one per tier band. */
export const PLAYABLE_TEAM_IDS = ["usa", "mex", "can"] as const;
