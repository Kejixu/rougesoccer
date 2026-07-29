import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { createDiceMatch } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { createRun } from "../src/core/run/run";
import type { CardInstance, DiceMatchState, OppInfo } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import * as MatchUi from "../src/ui/screens/DiceMatchScreen";
import * as TitleUi from "../src/ui/screens/TitleScreen";

const ALL_UI_REVEALS = [
  "ui.chain",
  "ui.stats",
  "ui.intent",
  "ui.theirchain",
  "ui.glossary",
] as const;

type RookieStagingExports = typeof MatchUi & {
  rookieReveals?: (state: DiceMatchState) => string[];
};

type TitleExports = typeof TitleUi & {
  isFreshProfile?: (storedKeys: readonly string[]) => boolean;
};

const rookieStaging = MatchUi as RookieStagingExports;
const titleUi = TitleUi as TitleExports;
const OPP: OppInfo = {
  teamId: "qat",
  name: "Qatar",
  attackRating: 12,
  style: "balanced",
  tier: 4,
};

function inst(defId: string, index: number): CardInstance {
  return {
    uid: `rookie-${defId}-${index}`,
    defId,
    level: 0,
    formPower: 0,
    fatigued: false,
  };
}

function rookieMatch(overrides: Partial<DiceMatchState> = {}): DiceMatchState {
  const match = createDiceMatch(DICE_CARD_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: [inst("d_shortpass", 0), inst("d_tackle", 1)],
    mutators: [],
    rng: seedRng("rookie-staging"),
    balance: DEFAULT_BALANCE,
  }).state;

  return {
    ...match,
    phase: "ROUND_ACTIVE",
    possession: "you",
    round: 1,
    passes: 0,
    shotQuality: 0,
    oppPasses: 0,
    defenseCommit: 0,
    ...overrides,
  };
}

function matchMarkup(
  overrides: Partial<DiceMatchState> = {},
  initialRevealedUi: readonly string[] = [],
): string {
  const content = makeContent();
  const match = rookieMatch(overrides);
  const run = {
    ...createRun(content, "rookie-staging-run", "usa"),
    activeMatch: match,
  };
  const Screen = MatchUi.DiceMatchScreen as ComponentType<Record<string, unknown>>;

  return renderToStaticMarkup(createElement(Screen, {
    content,
    events: [],
    run,
    dispatch: () => undefined,
    initialRevealedUi,
  }));
}

describe("rookie reveal triggers", () => {
  it.each([
    ["ui.chain", { possession: "you", passes: 0 }, { possession: "you", passes: 1 }],
    ["ui.stats", { passes: 0, shotQuality: 0 }, { passes: 1, shotQuality: 0 }],
    ["ui.intent", { passes: 0 }, { passes: 1 }],
    ["ui.theirchain", { possession: "them", oppPasses: 0, defenseCommit: 0 }, { possession: "them", oppPasses: 1, defenseCommit: 0 }],
    ["ui.glossary", { round: 1 }, { round: 2 }],
  ] as const)("turns %s on only when its trigger becomes true", (key, off, on) => {
    expect(rookieStaging.rookieReveals).toBeTypeOf("function");
    if (!rookieStaging.rookieReveals) return;

    expect(rookieStaging.rookieReveals(rookieMatch(off))).not.toContain(key);
    expect(rookieStaging.rookieReveals(rookieMatch(on))).toContain(key);
  });

  it("reveals stats when Chance rises even before a pass", () => {
    expect(rookieStaging.rookieReveals).toBeTypeOf("function");
    if (!rookieStaging.rookieReveals) return;

    expect(rookieStaging.rookieReveals(rookieMatch({ passes: 0, shotQuality: 0 }))).not.toContain("ui.stats");
    expect(rookieStaging.rookieReveals(rookieMatch({ passes: 0, shotQuality: 1 }))).toContain("ui.stats");
  });

  it("reveals their chain when a defender is committed before their first pass", () => {
    expect(rookieStaging.rookieReveals).toBeTypeOf("function");
    if (!rookieStaging.rookieReveals) return;

    expect(rookieStaging.rookieReveals(
      rookieMatch({ possession: "them", oppPasses: 0, defenseCommit: 0 }),
    )).not.toContain("ui.theirchain");
    expect(rookieStaging.rookieReveals(
      rookieMatch({ possession: "them", oppPasses: 0, defenseCommit: 0.1 }),
    )).toContain("ui.theirchain");
  });
});

describe("rookie match staging", () => {
  it("starts with only the core inputs, actions, and your-ball objective", () => {
    const html = matchMarkup();

    expect(html).not.toContain('data-testid="chain-panel"');
    expect(html).not.toContain('class="dice-stat-row"');
    expect(html).not.toContain('data-testid="shot-quality"');
    expect(html).not.toContain('data-testid="intent"');
    expect(html).not.toContain('data-testid="chain-glossary"');
    expect(html).not.toContain('data-testid="their-chain"');
    expect(html).toContain('data-testid="objective-line"');
    expect(html).toContain("Your ball — pass to build a Chance, then shoot.");
    expect(html).toContain('data-testid="dice-tray"');
    expect(html).toContain('data-testid="hand"');
    expect(html).toContain('data-testid="end-round"');
  });

  it("reveals the chain immediately when the first pass is in state", () => {
    expect(matchMarkup({ passes: 1 })).toContain('data-testid="chain-panel"');
  });

  it("renders every staged surface once all keys are revealed", () => {
    const yours = matchMarkup({ round: 1, possession: "you", passes: 0 }, ALL_UI_REVEALS);
    const theirs = matchMarkup(
      { round: 1, possession: "them", oppPasses: 0, defenseCommit: 0 },
      ALL_UI_REVEALS,
    );

    expect(yours).toContain('data-testid="chain-panel"');
    expect(yours).toContain('class="dice-stat-row"');
    expect(yours).toContain('data-testid="intent"');
    expect(yours).toContain('data-testid="chain-glossary"');
    expect(theirs).toContain('data-testid="their-chain"');
  });

  it("stages their chain and shows the defensive objective", () => {
    const hidden = matchMarkup({
      possession: "them",
      oppPasses: 0,
      defenseCommit: 0,
    });
    const revealed = matchMarkup({
      possession: "them",
      oppPasses: 1,
      defenseCommit: 0,
    });

    expect(hidden).not.toContain('data-testid="their-chain"');
    expect(hidden).toContain(
      "Their ball — commit defenders to fight their passes, or stand off and bank dice.",
    );
    expect(revealed).toContain('data-testid="their-chain"');
  });

  it("shows the corner objective when a delivery is active", () => {
    expect(matchMarkup({ corner: true })).toContain(
      "Corner — one delivery, pick your best card.",
    );
  });

  it("disables staging throughout the tutorial", () => {
    const content = makeContent();
    const Screen = MatchUi.DiceMatchScreen as ComponentType<Record<string, unknown>>;
    const html = renderToStaticMarkup(createElement(Screen, {
      content,
      events: [],
      match: rookieMatch(),
      playerName: "USA",
      onMatchAction: () => undefined,
      tutorial: {
        step: { title: "Test", why: "Test", lock: { kind: "next" } },
        stepIndex: 0,
        totalSteps: 1,
        onContinue: () => undefined,
        onSkip: () => undefined,
      },
      initialRevealedUi: [],
    }));

    expect(html).toContain('data-testid="chain-panel"');
    expect(html).toContain('class="dice-stat-row"');
    expect(html).toContain('data-testid="intent"');
    expect(html).toContain('data-testid="chain-glossary"');
  });
});

describe("fresh-profile title emphasis", () => {
  it("treats no coach or UI keys as fresh", () => {
    expect(titleUi.isFreshProfile).toBeTypeOf("function");
    if (!titleUi.isFreshProfile) return;

    expect(titleUi.isFreshProfile([])).toBe(true);
    expect(titleUi.isFreshProfile(["unrelated"])).toBe(true);
    expect(titleUi.isFreshProfile(["coach.dice"])).toBe(false);
    expect(titleUi.isFreshProfile(["ui.chain"])).toBe(false);
  });

  it("puts the primary tutorial before the plain campaign button without localStorage", () => {
    const html = renderToStaticMarkup(createElement(TitleUi.TitleScreen, {
      hasSave: false,
      onNewRun: () => undefined,
      onContinue: () => undefined,
      onTutorial: () => undefined,
    }));
    const tutorial = html.match(/<button[^>]*data-testid="start-tutorial"[^>]*>/)?.[0];
    const campaign = html.match(/<button[^>]*data-testid="start-run"[^>]*>/)?.[0];

    expect(html.indexOf("Learn the game (5 min)")).toBeLessThan(html.indexOf("Start the campaign"));
    expect(tutorial).toContain('class="btn btn--primary"');
    expect(campaign).toContain('class="btn"');
    expect(campaign).not.toContain("btn--primary");
  });
});
