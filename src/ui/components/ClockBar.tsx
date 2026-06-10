// The opponent clock made visible: a fill bar toward their next goal, with a
// marker showing how far the next tick will push it.

import type { MatchState } from "../../core/types";

export function ClockBar({ match, defense }: { match: MatchState; defense: number }) {
  const threshold = match.bal.GOAL_THRESHOLD;
  const raw = Math.round(
    match.opp.attackRating * (match.mode === "extratime" ? match.bal.EXTRA_TIME_CLOCK_MULT : 1),
  );
  const perRound = Math.max(raw - defense, Math.ceil(raw * match.bal.CLOCK_FLOOR_RATIO));
  const pct = Math.min(100, (match.oppClockPoints / threshold) * 100);
  const nextPct = Math.min(100, ((match.oppClockPoints + perRound) / threshold) * 100);
  const hot = match.oppClockPoints + perRound >= threshold;

  return (
    <div className="clockbar-wrap" data-testid="clock">
      <span>
        {match.opp.name} build-up: +{perRound}/round
        {match.mode === "extratime" ? " (EXTRA TIME)" : ""}
      </span>
      <div className="clockbar">
        <div className={`clockbar-fill${hot ? " hot" : ""}`} style={{ width: `${pct}%` }} />
        <div className="tick" style={{ left: `${nextPct}%` }} />
      </div>
      <span>
        {match.oppClockPoints}/{threshold} · your defense {defense}
      </span>
    </div>
  );
}
