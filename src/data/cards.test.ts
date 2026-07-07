import { describe, expect, it } from "vitest";
import type { CardDef } from "../core/types";
import { CARD_DEFS as CARD_DEFS_CONST, CARD_DEF_MAP, STARTING_DECK_TEMPLATE } from "./cards";

const CARD_DEFS: readonly CardDef[] = CARD_DEFS_CONST;
import { TEAM_MAP, TEAMS } from "./teams";
import { STYLES } from "./styles";
import { levelStats } from "../core/types";

describe("content cross-references", () => {
  it("card ids are unique", () => {
    expect(new Set(CARD_DEFS.map((c) => c.id)).size).toBe(CARD_DEFS.length);
  });

  it("levels arrays have 1-3 entries", () => {
    for (const c of CARD_DEFS) {
      expect(c.levels.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.levels.length, c.id).toBeLessThanOrEqual(3);
    }
  });

  it("every nationality points at a real team", () => {
    for (const c of CARD_DEFS) {
      if (c.nationality) expect(TEAM_MAP[c.nationality], `${c.id} -> ${c.nationality}`).toBeDefined();
    }
  });

  it("every playable card does something (power, defense, effect, or passive)", () => {
    for (const c of CARD_DEFS) {
      const s = levelStats(c, 0);
      const useful =
        (s.power ?? 0) > 0 ||
        (s.defense ?? 0) > 0 ||
        c.effects.length > 0 ||
        c.passive !== undefined;
      expect(useful, c.id).toBe(true);
    }
  });

  it("every gameplan card has a passive, and only gameplans do", () => {
    for (const c of CARD_DEFS) {
      expect(c.passive !== undefined, c.id).toBe(c.kind === "gameplan");
    }
  });

  it("starting deck only references real cards", () => {
    for (const entry of STARTING_DECK_TEMPLATE) {
      expect(CARD_DEF_MAP[entry.defId], entry.defId).toBeDefined();
    }
  });

  it("every team's style is defined and groups are real 2026 letters", () => {
    for (const t of TEAMS) {
      expect(STYLES[t.style], t.id).toBeDefined();
      expect("ABCDEFGHIJKL".includes(t.group), `${t.id} group ${t.group}`).toBe(true);
    }
  });

  it("team ids are unique", () => {
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length);
  });
});
