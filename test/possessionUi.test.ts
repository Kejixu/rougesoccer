import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { applyDiceAction, createDiceMatch } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { createRun } from "../src/core/run/run";
import type { CardInstance, DiceMatchAction, DiceMatchState, GameEvent, OppInfo } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import * as MatchUi from "../src/ui/screens/DiceMatchScreen";

type Owner = "you" | "them";

interface Handover {
  round: number;
  owner: Owner;
  title: string;
  subtitle: string;
}

type PossessionExports = typeof MatchUi & {
  PossessionStrip?: ComponentType<{ currentRound: number; matchRounds: number }>;
  HandoverBanner?: ComponentType<{ handover: Handover }>;
  handoverForRoundStart?: (events: readonly GameEvent[], previousOwner: Owner) => Handover | null;
  shootButtonLabel?: (
    match: Pick<DiceMatchState, "possession" | "passes">,
    dockedCount: number,
    shotProbability: number,
  ) => string;
  shootButtonDisabled?: (
    match: Pick<DiceMatchState, "corner" | "possession" | "passes">,
    dockedCount: number,
    running: boolean,
    tutorialAllowed: boolean,
  ) => boolean;
  recycleButtonLabel?: (
    match: Pick<DiceMatchState, "corner" | "possession">,
    dockedCount: number,
  ) => string;
  recycleAdvice?: (
    defs: typeof DICE_CARD_MAP,
    state: DiceMatchState,
  ) => { tone: "cold" | "hot" | "neutral"; sub: string | null };
  unspentAttackDice?: (state: DiceMatchState) => number[];
  runDockedPlay?: (options: {
    queue: readonly { uid: string; dieIndex: number }[];
    initialMatch: DiceMatchState;
    getLatestMatch: () => DiceMatchState | null;
    dispatch: (action: DiceMatchAction) => void;
    thenShoot?: boolean;
    thenEndRound?: boolean;
    isRunning?: () => boolean;
    schedule?: (callback: () => void, delay: number) => unknown;
    onFinish?: () => void;
  }) => void;
};

const possessionUi = MatchUi as PossessionExports;
const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `possession-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

function matchScreenMarkup(possession: Owner, round: number): string {
  const content = makeContent();
  const match = {
    ...createDiceMatch(DICE_CARD_MAP, {
      opp: OPP,
      styleEffects: [],
      plays: [],
      context: "group",
      deck: [inst("d_shortpass", 0), inst("d_tackle", 1)],
      mutators: [],
      rng: seedRng("possession-ui"),
      balance: DEFAULT_BALANCE,
    }).state,
    possession,
    round,
  };
  const Screen = MatchUi.DiceMatchScreen as ComponentType<Record<string, unknown>>;

  return renderToStaticMarkup(createElement(Screen, {
    content,
    events: [],
    match,
    playerName: "USA",
    onMatchAction: () => undefined,
    tutorial: {
      step: { title: "Test", why: "Test", lock: { kind: "next" } },
      stepIndex: 0,
      totalSteps: 1,
      onContinue: () => undefined,
      onSkip: () => undefined,
    },
  }));
}

function liveMatchScreenMarkup(
  possession: Owner,
  round: number,
  overrides: Partial<DiceMatchState> = {},
): string {
  const content = makeContent();
  const match = {
    ...createDiceMatch(DICE_CARD_MAP, {
      opp: OPP,
      styleEffects: [],
      plays: [],
      context: "group",
      deck: [inst("d_shortpass", 20), inst("d_tackle", 21)],
      mutators: [],
      rng: seedRng("possession-controls"),
      balance: DEFAULT_BALANCE,
    }).state,
    possession,
    round,
    ...overrides,
  };
  const run = { ...createRun(content, "possession-controls-run", "usa"), activeMatch: match };
  const Screen = MatchUi.DiceMatchScreen as ComponentType<Record<string, unknown>>;

  return renderToStaticMarkup(createElement(Screen, {
    content,
    events: [],
    run,
    dispatch: () => undefined,
  }));
}

describe("possession strip", () => {
  it("renders the six-round alternating schedule and marks the current round", () => {
    const html = matchScreenMarkup("them", 4);

    expect(html).toContain('data-testid="possession-strip"');
    expect(html.match(/data-owner="you"/g)).toHaveLength(3);
    expect(html.match(/data-owner="them"/g)).toHaveLength(3);
    expect(html).toContain('data-round="4"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("THEIR BALL");
    expect(html).toContain("possession-pill");
    expect(html).not.toContain("possession-marker");
    expect(html).not.toContain("Round 4 of 6");
    expect(html).not.toContain('data-testid="match-status"');
  });

  it("appends an extra-time slot when another round begins", () => {
    const html = matchScreenMarkup("you", 7);

    expect(html.match(/data-owner="(?:you|them)"/g)).toHaveLength(7);
    expect(html).toContain('data-round="7"');
    expect(html).toContain('data-owner="you"');
    expect(html).toContain('class="possession-extra-time-tag">ET</span>');
    expect(html).toContain("YOUR BALL");
  });

  it("shows one owner chip after the pills instead of a legend", () => {
    const yours = matchScreenMarkup("you", 1);
    expect(yours).toContain('class="possession-now you"');
    expect(yours).toContain("YOUR BALL");
    expect(yours).not.toContain("possession-legend");

    const theirs = matchScreenMarkup("them", 2);
    expect(theirs).toContain('class="possession-now them"');
    expect(theirs).toContain("THEIR BALL");
  });
});

describe("possession controls", () => {
  it("renders match inputs before pitch output and ticker", () => {
    const html = liveMatchScreenMarkup("you", 1);
    const renderedSurfaceOrder = [...html.matchAll(/data-testid="(dice-tray|hand|pitch)"/g)]
      .map((match) => match[1]);
    const screenSource = MatchUi.DiceMatchScreen.toString();

    expect(renderedSurfaceOrder).toEqual(["dice-tray", "hand", "pitch"]);
    expect(screenSource.indexOf("PitchTrack")).toBeLessThan(screenSource.indexOf("MatchTicker"));
  });

  it("renders the one-die-per-card rule inside the dice tray", () => {
    const html = liveMatchScreenMarkup("you", 1);
    const trayStart = html.indexOf('<div class="dice-tray" data-testid="dice-tray">');
    const trayEnd = html.indexOf("</div>", trayStart);

    expect(trayStart).toBeGreaterThanOrEqual(0);
    expect(html.slice(trayStart, trayEnd)).toContain("1 die plays 1 card");
  });

  it("shows only Play & Shoot and Recycle on a normal player possession", () => {
    const html = liveMatchScreenMarkup("you", 1);

    expect(html).not.toContain('data-testid="run-play"');
    expect(html).not.toContain('data-testid="commit-defense"');
    expect(html).not.toContain("Run play");
    expect(html).toContain("⚽ Shoot");
    expect(html).toContain("↩ Recycle possession");
  });

  it("keeps the dock runner as Commit defense on their possession", () => {
    const html = liveMatchScreenMarkup("them", 2);

    expect(html).toContain('data-testid="commit-defense"');
    expect(html).toContain("🛡 Commit defense (0)");
    expect(html).toContain("Stand off (bank");
    expect(html).not.toContain('data-testid="shoot"');
  });

  it("keeps the corner controls unchanged", () => {
    const html = liveMatchScreenMarkup("you", 1, { corner: true });

    expect(html).toContain('data-testid="run-play"');
    expect(html).toContain("▶ Take the corner");
    expect(html).toContain("Clear it");
    expect(html).not.toContain('data-testid="shoot"');
  });

  it("marks empty-dock Recycle cold when a cheap legal attack play remains", () => {
    const attack = inst("d_shortpass", 30);
    const html = liveMatchScreenMarkup("you", 1, {
      passes: 1,
      intent: { kind: "attack", points: 1 },
      hand: [attack],
      dice: [{ value: 2, used: false }],
    });
    const button = html.match(/<button[^>]*data-testid="end-round"[^>]*>.*?<\/button>/)?.[0];

    expect(button).toContain('data-cold="true"');
    expect(button).toContain('data-testid="recycle-advice"');
    expect(button).toContain("1 die unspent — passes are cheap right now");
  });

  it("leaves their-possession Stand off without recycle tone attributes", () => {
    const html = liveMatchScreenMarkup("them", 2);
    const button = html.match(/<button[^>]*data-testid="end-round"[^>]*>.*?<\/button>/)?.[0];

    expect(button).toContain("Stand off (bank");
    expect(button).not.toContain("data-cold");
    expect(button).not.toContain("data-hot");
  });
});

describe("recycle advice", () => {
  it("endorses stopping at the same 30% pressure threshold as the chain badge", () => {
    expect(possessionUi.recycleAdvice).toBeTypeOf("function");
    if (!possessionUi.recycleAdvice) return;
    const state = {
      ...playAndShootMatch("recycle-advice-hot"),
      passes: 2,
      intent: { kind: "press" } as const,
    };

    expect(possessionUi.recycleAdvice(DICE_CARD_MAP, state)).toEqual({
      tone: "hot",
      sub: "smart stop — pressure 7 (33%)",
    });
  });

  it("warns about one unspent die when a low-risk attack card fits", () => {
    expect(possessionUi.recycleAdvice).toBeTypeOf("function");
    if (!possessionUi.recycleAdvice) return;
    const attack = inst("d_shortpass", 31);
    const state = {
      ...playAndShootMatch("recycle-advice-singular"),
      passes: 1,
      intent: { kind: "attack", points: 1 } as const,
      hand: [attack],
      dice: [
        { value: 2, used: false },
        { value: 6, used: true },
      ],
    };

    expect(possessionUi.recycleAdvice(DICE_CARD_MAP, state)).toEqual({
      tone: "cold",
      sub: "1 die unspent — passes are cheap right now",
    });
  });

  it("counts all unused dice in the plural warning when any attack card fits", () => {
    expect(possessionUi.recycleAdvice).toBeTypeOf("function");
    if (!possessionUi.recycleAdvice) return;
    const attack = inst("d_shortpass", 32);
    const state = {
      ...playAndShootMatch("recycle-advice-plural"),
      passes: 1,
      intent: { kind: "attack", points: 1 } as const,
      hand: [attack],
      dice: [
        { value: 2, used: false },
        { value: 1, used: false },
      ],
    };

    expect(possessionUi.recycleAdvice(DICE_CARD_MAP, state)).toEqual({
      tone: "cold",
      sub: "2 dice unspent — passes are cheap right now",
    });
  });

  it("stays neutral with only defense cards or no fitting attack die", () => {
    expect(possessionUi.recycleAdvice).toBeTypeOf("function");
    if (!possessionUi.recycleAdvice) return;
    const defense = inst("d_tackle", 33);
    const attack = inst("d_shortpass", 34);
    const base = {
      ...playAndShootMatch("recycle-advice-neutral"),
      passes: 1,
      intent: { kind: "attack", points: 1 } as const,
    };

    expect(possessionUi.recycleAdvice(DICE_CARD_MAP, {
      ...base,
      hand: [defense],
      dice: [{ value: 2, used: false }],
    })).toEqual({ tone: "neutral", sub: null });
    expect(possessionUi.recycleAdvice(DICE_CARD_MAP, {
      ...base,
      hand: [attack],
      dice: [{ value: 1, used: false }],
    })).toEqual({ tone: "neutral", sub: null });
  });
});

describe("unspent attack dice", () => {
  it("returns unused die values from a player possession", () => {
    expect(possessionUi.unspentAttackDice).toBeTypeOf("function");
    if (!possessionUi.unspentAttackDice) return;
    const state = {
      ...playAndShootMatch("unspent-attack"),
      dice: [
        { value: 6, used: false },
        { value: 4, used: true },
        { value: 2, used: false },
      ],
    };

    expect(possessionUi.unspentAttackDice(state)).toEqual([6, 2]);
  });

  it("returns no waste framing for their possession or an all-used attack roll", () => {
    expect(possessionUi.unspentAttackDice).toBeTypeOf("function");
    if (!possessionUi.unspentAttackDice) return;
    const state = {
      ...playAndShootMatch("unspent-none"),
      dice: [
        { value: 5, used: true },
        { value: 3, used: true },
      ],
    };

    expect(possessionUi.unspentAttackDice({ ...state, possession: "them" })).toEqual([]);
    expect(possessionUi.unspentAttackDice(state)).toEqual([]);
  });
});

describe("possession handover", () => {
  it("derives and renders the right banner when ROUND_START flips possession", () => {
    expect(possessionUi.handoverForRoundStart).toBeTypeOf("function");
    expect(possessionUi.HandoverBanner).toBeTypeOf("function");
    if (!possessionUi.handoverForRoundStart || !possessionUi.HandoverBanner) return;

    const handover = possessionUi.handoverForRoundStart(
      [{ type: "ROUND_START", round: 2, mode: "regulation" }],
      "you",
    );
    expect(handover).toEqual({
      round: 2,
      owner: "them",
      title: "ROUND 2 — THEIR BALL",
      subtitle: "Commit tackles or stand off",
    });
    if (!handover) return;

    const html = renderToStaticMarkup(createElement(possessionUi.HandoverBanner, { handover }));
    expect(html).toContain('data-testid="possession-handover"');
    expect(html).toContain("ROUND 2 — THEIR BALL");
    expect(html).toContain("Commit tackles or stand off");
  });

  it("does not create a banner when possession does not flip", () => {
    expect(possessionUi.handoverForRoundStart).toBeTypeOf("function");
    if (!possessionUi.handoverForRoundStart) return;

    expect(
      possessionUi.handoverForRoundStart(
        [{ type: "ROUND_START", round: 3, mode: "regulation" }],
        "you",
      ),
    ).toBeNull();
  });
});

describe("possession mode", () => {
  it("adds mode-defending to the match root exactly during their possession", () => {
    expect(matchScreenMarkup("them", 2)).toContain('<main class="board mode-defending">');
    expect(matchScreenMarkup("you", 3)).toContain('<main class="board">');
    expect(matchScreenMarkup("you", 3)).not.toContain("mode-defending");
  });
});

function playAndShootMatch(seed: string): DiceMatchState {
  const first = inst("d_shortpass", 10);
  const second = inst("d_shortpass", 11);
  const match = createDiceMatch(DICE_CARD_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: [first, second],
    mutators: [],
    rng: seedRng(seed),
    balance: DEFAULT_BALANCE,
  }).state;
  return {
    ...match,
    phase: "ROUND_ACTIVE",
    possession: "you",
    passes: 0,
    corner: false,
    hand: [first, second],
    dice: [
      { value: 6, used: false },
      { value: 6, used: false },
    ],
    rng: seedRng(seed),
  };
}

function findSecondPassInterception(): DiceMatchState {
  for (let i = 0; i < 500; i += 1) {
    const initial = playAndShootMatch(`play-and-shoot-interception-${i}`);
    const first = applyDiceAction(DICE_CARD_MAP, initial, {
      type: "ASSIGN_DIE",
      uid: initial.hand[0]!.uid,
      dieIndex: 0,
    });
    const second = applyDiceAction(DICE_CARD_MAP, first.state, {
      type: "ASSIGN_DIE",
      uid: initial.hand[1]!.uid,
      dieIndex: 1,
    });
    if (second.events.some((event) => event.type === "CHAIN_INTERCEPTED")) return initial;
  }
  throw new Error("Expected to find a deterministic second-pass interception seed");
}

describe("Play & Shoot", () => {
  it("flushes every docked pass in order, then shoots exactly once", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    let current = playAndShootMatch("play-and-shoot-success");
    const queue = current.hand.map((card, dieIndex) => ({ uid: card.uid, dieIndex }));
    const actions: DiceMatchAction[] = [];
    const events: GameEvent[] = [];
    const delays: number[] = [];

    possessionUi.runDockedPlay({
      queue,
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => {
        actions.push(action);
        const result = applyDiceAction(DICE_CARD_MAP, current, action);
        current = result.state;
        events.push(...result.events);
      },
      thenShoot: true,
      schedule: (callback, delay) => {
        delays.push(delay);
        callback();
      },
    });

    expect(events.filter((event) => event.type === "PASS_COMPLETED").map((event) => event.uid)).toEqual(
      queue.map((play) => play.uid),
    );
    expect(actions.map((action) => action.type)).toEqual(["ASSIGN_DIE", "ASSIGN_DIE", "SHOOT"]);
    expect(actions.filter((action) => action.type === "SHOOT")).toHaveLength(1);
    expect(delays).toEqual([700, 700]);
  });

  it("does not shoot after an interception during the flush", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    let current = findSecondPassInterception();
    const queue = current.hand.map((card, dieIndex) => ({ uid: card.uid, dieIndex }));
    const actions: DiceMatchAction[] = [];
    const events: GameEvent[] = [];

    possessionUi.runDockedPlay({
      queue,
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => {
        actions.push(action);
        const result = applyDiceAction(DICE_CARD_MAP, current, action);
        current = result.state;
        events.push(...result.events);
      },
      thenShoot: true,
      schedule: (callback) => callback(),
    });

    expect(events.some((event) => event.type === "CHAIN_INTERCEPTED")).toBe(true);
    expect(actions.some((action) => action.type === "SHOOT")).toBe(false);
  });

  it("stops the queue and does not shoot after a round or phase change", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    let current = playAndShootMatch("play-and-shoot-round-change");
    const queue = current.hand.map((card, dieIndex) => ({ uid: card.uid, dieIndex }));
    const actions: DiceMatchAction[] = [];

    possessionUi.runDockedPlay({
      queue,
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => {
        actions.push(action);
        const result = applyDiceAction(DICE_CARD_MAP, current, action);
        current = { ...result.state, round: result.state.round + 1, phase: "DONE" };
      },
      thenShoot: true,
      schedule: (callback) => callback(),
    });

    expect(actions.map((action) => action.type)).toEqual(["ASSIGN_DIE"]);
  });

  it("does not shoot when the flushed queue completes without a pass", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    const current = playAndShootMatch("play-and-shoot-no-pass");
    const actions: DiceMatchAction[] = [];

    possessionUi.runDockedPlay({
      queue: [{ uid: "not-in-hand", dieIndex: 99 }],
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => actions.push(action),
      thenShoot: true,
      schedule: (callback) => callback(),
    });

    expect(actions).toEqual([]);
  });

  it("uses Play & Shoot only while cards are docked", () => {
    expect(possessionUi.shootButtonLabel).toBeTypeOf("function");
    if (!possessionUi.shootButtonLabel) return;
    const match = playAndShootMatch("play-and-shoot-label");

    expect(possessionUi.shootButtonLabel(match, 3, 0.62)).toBe("⚽ Play & Shoot (3) — 62%");
    expect(possessionUi.shootButtonLabel({ ...match, passes: 1 }, 0, 0.62)).toBe("⚽ Shoot — 62%");
    expect(possessionUi.shootButtonLabel(match, 0, 0.62)).toBe("⚽ Shoot — 62% — make a pass first");
  });

  it("plain shoot still dispatches SHOOT exactly once after one completed pass", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    const current = { ...playAndShootMatch("plain-shoot"), passes: 1 };
    const actions: DiceMatchAction[] = [];

    possessionUi.runDockedPlay({
      queue: [],
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => actions.push(action),
      thenShoot: true,
      schedule: (callback) => callback(),
    });

    expect(actions.map((action) => action.type)).toEqual(["SHOOT"]);
  });

  it("allows a loaded zero-pass shot but preserves empty-dock and running gates", () => {
    expect(possessionUi.shootButtonDisabled).toBeTypeOf("function");
    if (!possessionUi.shootButtonDisabled) return;
    const match = playAndShootMatch("play-and-shoot-disabled");

    expect(possessionUi.shootButtonDisabled(match, 0, false, true)).toBe(true);
    expect(possessionUi.shootButtonDisabled(match, 2, false, true)).toBe(false);
    expect(possessionUi.shootButtonDisabled(match, 2, true, true)).toBe(true);
    expect(possessionUi.shootButtonDisabled({ ...match, corner: true }, 2, false, true)).toBe(true);
    expect(possessionUi.shootButtonDisabled(match, 2, false, false)).toBe(true);
  });
});

describe("Play & Recycle", () => {
  it("flushes every docked pass in order, then ends the round exactly once", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    let current = playAndShootMatch("play-and-recycle-success");
    const queue = current.hand.map((card, dieIndex) => ({ uid: card.uid, dieIndex }));
    const actions: DiceMatchAction[] = [];

    possessionUi.runDockedPlay({
      queue,
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => {
        actions.push(action);
        current = applyDiceAction(DICE_CARD_MAP, current, action).state;
      },
      thenEndRound: true,
      schedule: (callback) => callback(),
    });

    expect(actions.map((action) => action.type)).toEqual(["ASSIGN_DIE", "ASSIGN_DIE", "END_ROUND"]);
    expect(actions.filter((action) => action.type === "END_ROUND")).toHaveLength(1);
  });

  it("does not end the round after an interception during the flush", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    let current = findSecondPassInterception();
    const queue = current.hand.map((card, dieIndex) => ({ uid: card.uid, dieIndex }));
    const actions: DiceMatchAction[] = [];

    possessionUi.runDockedPlay({
      queue,
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => {
        actions.push(action);
        current = applyDiceAction(DICE_CARD_MAP, current, action).state;
      },
      thenEndRound: true,
      schedule: (callback) => callback(),
    });

    expect(actions.some((action) => action.type === "END_ROUND")).toBe(false);
  });

  it("does not end the round if the fire-time round, phase, or possession guard fails", () => {
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.runDockedPlay) return;
    const guardChanges: Partial<DiceMatchState>[] = [
      { round: 2 },
      { phase: "DONE" },
      { possession: "them" },
    ];

    for (const change of guardChanges) {
      let current = playAndShootMatch(`play-and-recycle-guard-${JSON.stringify(change)}`);
      const queue = [{ uid: current.hand[0]!.uid, dieIndex: 0 }];
      const actions: DiceMatchAction[] = [];

      possessionUi.runDockedPlay({
        queue,
        initialMatch: current,
        getLatestMatch: () => current,
        dispatch: (action) => {
          actions.push(action);
          current = { ...applyDiceAction(DICE_CARD_MAP, current, action).state, ...change };
        },
        thenEndRound: true,
        schedule: (callback) => callback(),
      });

      expect(actions.map((action) => action.type)).toEqual(["ASSIGN_DIE"]);
    }
  });

  it("uses loaded and plain recycle labels and keeps plain END_ROUND behavior", () => {
    expect(possessionUi.recycleButtonLabel).toBeTypeOf("function");
    expect(possessionUi.runDockedPlay).toBeTypeOf("function");
    if (!possessionUi.recycleButtonLabel || !possessionUi.runDockedPlay) return;
    const current = playAndShootMatch("plain-recycle");
    const actions: DiceMatchAction[] = [];

    expect(possessionUi.recycleButtonLabel(current, 2)).toBe("↩ Play & Recycle (2)");
    expect(possessionUi.recycleButtonLabel(current, 0)).toBe("↩ Recycle possession");
    possessionUi.runDockedPlay({
      queue: [],
      initialMatch: current,
      getLatestMatch: () => current,
      dispatch: (action) => actions.push(action),
      thenEndRound: true,
      schedule: (callback) => callback(),
    });
    expect(actions.map((action) => action.type)).toEqual(["END_ROUND"]);
  });
});
