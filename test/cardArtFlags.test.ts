import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { createDiceMatch } from "../src/core/match/dice";
import { createRun } from "../src/core/run/run";
import { seedRng } from "../src/core/rng";
import type { CardInstance, DiceMatchState, OppInfo, RunState } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import { TEAMS } from "../src/data/teams";
import { DiceMatchScreen } from "../src/ui/screens/DiceMatchScreen";
import { ResultScreen } from "../src/ui/screens/ResultScreen";
import { TitleScreen } from "../src/ui/screens/TitleScreen";
import { TournamentScreen } from "../src/ui/screens/TournamentScreen";

const SCOTLAND_FLAG = "\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}";
const OPP: OppInfo = {
  teamId: "hai",
  name: "Haiti",
  attackRating: 8,
  style: "counter",
  tier: 4,
};

function inst(defId: string, index: number, level: CardInstance["level"] = 0): CardInstance {
  return {
    uid: `visual-${defId}-${index}`,
    defId,
    level,
    formPower: 0,
    fatigued: false,
  };
}

function visualMatch(): DiceMatchState {
  const hand = [
    inst("d_shortpass", 0),
    inst("d_finish", 1, 1),
    inst("d_tackle", 2, 2),
  ];
  const match = createDiceMatch(DICE_CARD_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: hand,
    mutators: [],
    rng: seedRng("card-art-flags"),
    balance: DEFAULT_BALANCE,
  }).state;
  return {
    ...match,
    phase: "ROUND_ACTIVE",
    possession: "you",
    hand,
    dice: [
      { value: 2, used: false },
      { value: 5, used: false },
      { value: 1, used: false },
    ],
  };
}

function cardMarkup(html: string, defId: string): string {
  return html.match(new RegExp(`<button[^>]*data-testid="card-${defId}"[\\s\\S]*?</button>`))?.[0] ?? "";
}

function matchMarkup(): string {
  const content = makeContent();
  const match = visualMatch();
  const run = {
    ...createRun(content, "card-art-flags-run", "bra"),
    activeMatch: match,
  };
  const Screen = DiceMatchScreen as ComponentType<Record<string, unknown>>;
  return renderToStaticMarkup(
    createElement(Screen, {
      content,
      events: [],
      run,
      dispatch: () => undefined,
    }),
  );
}

describe("team flags", () => {
  it("gives all 26 teams a non-empty flag and maps the identity spot checks", () => {
    const teams = TEAMS as readonly (typeof TEAMS[number] & { flag?: string })[];
    const flag = (id: string) => teams.find((team) => team.id === id)?.flag;

    expect(teams).toHaveLength(26);
    for (const team of teams) {
      expect(team.flag, `${team.id} flag`).toBeTypeOf("string");
      expect(team.flag?.trim().length, `${team.id} flag length`).toBeGreaterThan(0);
    }
    expect(flag("bra")).toBe("🇧🇷");
    expect(flag("mex")).toBe("🇲🇽");
    expect(flag("usa")).toBe("🇺🇸");
    expect(flag("can")).toBe("🇨🇦");
    expect(flag("sco")).toBe(SCOTLAND_FLAG);
    expect(Array.from(flag("sco") ?? "")).toHaveLength(7);
  });

  it("shows flags on team select, scoreboard, tournament, and result surfaces", () => {
    const content = makeContent();
    const title = renderToStaticMarkup(
      createElement(TitleScreen, {
        hasSave: false,
        onNewRun: () => undefined,
        onContinue: () => undefined,
        onTutorial: () => undefined,
      }),
    );
    const match = matchMarkup();
    const tournamentRun = createRun(content, "flag-surfaces", "bra");
    const tournament = renderToStaticMarkup(
      createElement(TournamentScreen, {
        run: tournamentRun,
        content,
        dispatch: () => undefined,
        onOpenShop: () => undefined,
        onAbandon: () => undefined,
      }),
    );
    const resultRun = {
      ...tournamentRun,
      phase: "DONE",
      result: "eliminated",
    } satisfies RunState;
    const result = renderToStaticMarkup(
      createElement(ResultScreen, {
        run: resultRun,
        content,
        onNewRun: () => undefined,
      }),
    );

    for (const teamId of ["bra", "usa", "mex", "can"]) {
      expect(title).toContain(`data-team-flag="${teamId}"`);
    }
    expect(match).toContain('data-team-flag="bra"');
    expect(match).toContain('data-team-flag="hai"');
    for (const teamId of tournamentRun.groupTeamIds) {
      expect(tournament).toContain(`data-team-flag="${teamId}"`);
    }
    expect(tournament).toContain(`data-team-flag="${tournamentRun.nextOppId}"`);
    expect(result).toContain('data-team-flag="bra"');
  });
});

describe("dice card art", () => {
  it("keeps every role-family class and adds its matching football motif", () => {
    const html = matchMarkup();
    const progress = cardMarkup(html, "d_shortpass");
    const finish = cardMarkup(html, "d_finish");
    const defend = cardMarkup(html, "d_tackle");

    expect(progress).toContain("dice-card role-progress");
    expect(progress).toContain("dice-card-art--progress");
    expect(finish).toContain("dice-card role-finish");
    expect(finish).toContain("dice-card-art--finish");
    expect(defend).toContain("dice-card role-defend");
    expect(defend).toContain("dice-card-art--defend");
  });

  it("renders exact slot text inside the die glyph", () => {
    const html = matchMarkup();

    expect(cardMarkup(html, "d_shortpass")).toContain('class="dice-card-slot-label">2+</span>');
    expect(cardMarkup(html, "d_finish")).toContain('class="dice-card-slot-label">5+</span>');
    expect(cardMarkup(html, "d_tackle")).toContain('class="dice-card-slot-label">2-</span>');
  });

  it("renders a mini-pitch position badge on positioned cards", () => {
    const html = matchMarkup();

    expect(cardMarkup(html, "d_shortpass")).toContain('class="dice-card-position" data-position="MF"');
    expect(cardMarkup(html, "d_finish")).toContain('class="dice-card-position" data-position="ST"');
    expect(cardMarkup(html, "d_tackle")).toContain('class="dice-card-position" data-position="DF"');
  });

  it("renders one upgrade mark per card level", () => {
    const html = matchMarkup();
    const finish = cardMarkup(html, "d_finish");
    const defend = cardMarkup(html, "d_tackle");

    expect(finish).toContain('data-upgrade-level="1"');
    expect(finish.match(/dice-card-upgrade-pip/g)).toHaveLength(1);
    expect(defend).toContain('data-upgrade-level="2"');
    expect(defend.match(/dice-card-upgrade-pip/g)).toHaveLength(2);
  });
});
