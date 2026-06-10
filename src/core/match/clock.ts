// Opponent clock: each round the opponent accrues points; GOAL_THRESHOLD points
// = 1 goal, remainder carries. Defense reduces the rate but a floor guarantees
// the opponent always scores at least CLOCK_FLOOR_RATIO of their rate — there
// is no full shutout, so every match has a timer.

export interface ClockTickInput {
  attackRating: number;
  clockMult: number; // 1 in regulation, EXTRA_TIME_CLOCK_MULT in extra time
  defense: number;
  currentPoints: number;
  goalThreshold: number;
  floorRatio: number;
}

export interface ClockTickResult {
  effectiveRate: number;
  newPoints: number;
  oppGoalsScored: number;
}

export function clockTick(input: ClockTickInput): ClockTickResult {
  const raw = Math.round(input.attackRating * input.clockMult);
  const effectiveRate = Math.max(raw - input.defense, Math.ceil(raw * input.floorRatio));
  let points = input.currentPoints + effectiveRate;
  const oppGoalsScored = Math.floor(points / input.goalThreshold);
  points -= oppGoalsScored * input.goalThreshold;
  return { effectiveRate, newPoints: points, oppGoalsScored };
}
