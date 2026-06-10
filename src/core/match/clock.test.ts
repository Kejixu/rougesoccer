import { describe, expect, it } from "vitest";
import { clockTick } from "./clock";

const base = { clockMult: 1, currentPoints: 0, goalThreshold: 25, floorRatio: 0.2 };

describe("clockTick", () => {
  it("undefended: full rate accrues", () => {
    const r = clockTick({ ...base, attackRating: 14, defense: 0 });
    expect(r.effectiveRate).toBe(14);
    expect(r.newPoints).toBe(14);
    expect(r.oppGoalsScored).toBe(0);
  });

  it("crossing the threshold scores and carries the remainder", () => {
    const r = clockTick({ ...base, attackRating: 14, defense: 0, currentPoints: 14 });
    expect(r.oppGoalsScored).toBe(1);
    expect(r.newPoints).toBe(3);
  });

  it("defense reduces the rate", () => {
    const r = clockTick({ ...base, attackRating: 14, defense: 10 });
    expect(r.effectiveRate).toBe(4);
  });

  it("the floor prevents a full shutout", () => {
    const r = clockTick({ ...base, attackRating: 10, defense: 20 });
    expect(r.effectiveRate).toBe(2); // ceil(10 * 0.2)
  });

  it("extra time multiplies the rate before defense", () => {
    const r = clockTick({ ...base, attackRating: 20, defense: 6, clockMult: 1.5 });
    expect(r.effectiveRate).toBe(24); // round(30) - 6
  });

  it("a big tick can score multiple goals", () => {
    const r = clockTick({ ...base, attackRating: 60, defense: 0 });
    expect(r.oppGoalsScored).toBe(2);
    expect(r.newPoints).toBe(10);
  });
});
