// Balance sim CLI: plays N full runs per strategy and prints the report.
//   pnpm sim --runs 1000 --strategy greedy --seed wc2026 --team usa

import { applyRunAction, createRun } from "../core/run/run";
import type { ContentBundle, RunState, Stage } from "../core/types";
import { makeContent } from "../data/content";
import { TEAM_MAP } from "../data/teams";
import type { Bot } from "./bot";
import { STRATEGIES } from "./strategies";
import { aggregate, formatReport, type MatchRecord, type RunRecord } from "./report";

export function simulateRun(
  content: ContentBundle,
  bot: Bot,
  seed: string,
  playerTeamId: string,
): RunRecord {
  let state: RunState = createRun(content, seed, playerTeamId);
  const matches: MatchRecord[] = [];
  const cardsPicked: string[] = [];
  let actions = 0;
  let stageReached: Stage = state.stage;

  for (let guard = 0; guard < 5000 && state.phase !== "DONE"; guard++) {
    actions++;
    stageReached = state.stage;

    if (state.phase === "MATCH" && state.activeMatch) {
      const before = state.activeMatch;
      const action = bot.matchAction(content, before);
      state = applyRunAction(content, state, { type: "MATCH_ACTION", action }).state;
      if (state.phase !== "MATCH" && state.lastMatch) {
        matches.push({
          stage: state.lastMatch.stage,
          oppId: state.lastMatch.oppId,
          oppTier: before.opp.tier,
          playerGoals: state.lastMatch.playerGoals,
          oppGoals: state.lastMatch.oppGoals,
          result: state.lastMatch.result,
          pushedRounds: state.lastMatch.pushedRounds,
        });
      }
    } else {
      const action = bot.runAction(content, state);
      if (action.type === "PICK_REWARD" && state.pendingReward) {
        const defId = state.pendingReward.defIds[action.index];
        if (defId) cardsPicked.push(defId);
      }
      state = applyRunAction(content, state, action).state;
    }
  }

  if (state.phase !== "DONE") throw new Error(`run ${seed} did not terminate`);
  return {
    seed,
    result: state.result === "won" ? "won" : "eliminated",
    stageReached,
    matches,
    cardsPicked,
    finalDeckSize: state.deck.length,
    actions,
  };
}

// ---------- CLI ----------

function parseArgs(argv: string[]): { runs: number; strategy: string; seed: string; team: string } {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  return {
    runs: Number(get("--runs", "200")),
    strategy: get("--strategy", "all"),
    seed: get("--seed", "wc2026"),
    team: get("--team", "usa"),
  };
}

function main(): void {
  const { runs, strategy, seed, team } = parseArgs(process.argv.slice(2));
  if (!TEAM_MAP[team]) throw new Error(`unknown team ${team}`);
  const content = makeContent();
  const names = strategy === "all" ? Object.keys(STRATEGIES) : [strategy];

  for (const name of names) {
    const factory = STRATEGIES[name];
    if (!factory) throw new Error(`unknown strategy ${name}`);
    const bot = factory();
    const records: RunRecord[] = [];
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) {
      records.push(simulateRun(content, bot, `${seed}-${i}`, team));
    }
    const elapsed = performance.now() - t0;
    console.log(formatReport(aggregate(name, records)));
    console.log(`(${elapsed.toFixed(0)}ms, ${(elapsed / runs).toFixed(2)}ms/run)`);
  }
}

const isCli = process.argv[1]?.endsWith("runSim.ts") ?? false;
if (isCli) main();
