// Aggregation for sim runs: the numbers that prove (or disprove) the game is fun.

import type { Stage } from "../core/types";

export interface MatchRecord {
  stage: Stage;
  oppId: string;
  oppTier: number;
  playerGoals: number;
  oppGoals: number;
  result: "win" | "draw" | "loss";
}

export interface RunRecord {
  seed: string;
  result: "won" | "eliminated";
  stageReached: Stage;
  matches: MatchRecord[];
  cardsPicked: string[];
  finalDeckSize: number;
  actions: number;
}

export interface Report {
  strategy: string;
  runs: number;
  winRate: number;
  eliminationByStage: Record<string, number>;
  matchWinRate: number;
  nearLossRate: number; // |margin| <= 1 across decided matches — the "clock feels tense" metric
  minnowLossRate: number; // losses vs tier 4
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  cardStats: { defId: string; picks: number; winRateWhenPicked: number; delta: number }[];
}

export function aggregate(strategy: string, records: RunRecord[]): Report {
  const runs = records.length;
  const wins = records.filter((r) => r.result === "won").length;
  const winRate = wins / runs;

  const eliminationByStage: Record<string, number> = {};
  for (const r of records) {
    if (r.result === "eliminated") {
      eliminationByStage[r.stageReached] = (eliminationByStage[r.stageReached] ?? 0) + 1;
    }
  }

  const allMatches = records.flatMap((r) => r.matches);
  const decided = allMatches.filter((m) => m.result !== "draw");
  const nearLoss = allMatches.filter((m) => Math.abs(m.playerGoals - m.oppGoals) <= 1);
  const minnowMatches = allMatches.filter((m) => m.oppTier === 4);
  const minnowLosses = minnowMatches.filter((m) => m.result === "loss");

  const cardOutcome = new Map<string, { picks: number; winRuns: number }>();
  for (const r of records) {
    for (const defId of new Set(r.cardsPicked)) {
      const entry = cardOutcome.get(defId) ?? { picks: 0, winRuns: 0 };
      entry.picks += 1;
      if (r.result === "won") entry.winRuns += 1;
      cardOutcome.set(defId, entry);
    }
  }
  const cardStats = [...cardOutcome.entries()]
    .map(([defId, { picks, winRuns }]) => ({
      defId,
      picks,
      winRateWhenPicked: winRuns / picks,
      delta: winRuns / picks - winRate,
    }))
    .sort((a, b) => b.delta - a.delta);

  return {
    strategy,
    runs,
    winRate,
    eliminationByStage,
    matchWinRate: decided.length
      ? allMatches.filter((m) => m.result === "win").length / allMatches.length
      : 0,
    nearLossRate: allMatches.length ? nearLoss.length / allMatches.length : 0,
    minnowLossRate: minnowMatches.length ? minnowLosses.length / minnowMatches.length : 0,
    avgGoalsFor: allMatches.length
      ? allMatches.reduce((s, m) => s + m.playerGoals, 0) / allMatches.length
      : 0,
    avgGoalsAgainst: allMatches.length
      ? allMatches.reduce((s, m) => s + m.oppGoals, 0) / allMatches.length
      : 0,
    cardStats,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function formatReport(report: Report): string {
  const lines: string[] = [];
  lines.push(`\n=== ${report.strategy} (${report.runs} runs) ===`);
  lines.push(`run win rate        ${pct(report.winRate)}   (target 15-25% for greedy)`);
  lines.push(
    `eliminated at       ${Object.entries(report.eliminationByStage)
      .map(([s, n]) => `${s}:${n}`)
      .join("  ") || "-"}`,
  );
  lines.push(`match win rate      ${pct(report.matchWinRate)}`);
  lines.push(`near-loss rate      ${pct(report.nearLossRate)}   (target 40-50%: clock tension)`);
  lines.push(`minnow loss rate    ${pct(report.minnowLossRate)}   (target >5%: no free matches)`);
  lines.push(
    `avg score           ${report.avgGoalsFor.toFixed(2)} - ${report.avgGoalsAgainst.toFixed(2)}`,
  );
  lines.push(`card pick -> run-win delta:`);
  for (const c of report.cardStats) {
    lines.push(
      `  ${c.defId.padEnd(16)} picks ${String(c.picks).padStart(4)}  win ${pct(c.winRateWhenPicked).padStart(6)}  delta ${(c.delta >= 0 ? "+" : "") + pct(c.delta)}`,
    );
  }
  return lines.join("\n");
}
