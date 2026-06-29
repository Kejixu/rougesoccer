import { describe, expect, it } from "vitest";
import { LANE_GLOSSARY, describeDecisionCoach, describePendingCommit, describePressureStatus } from "../src/ui/diceUx";

describe("dice UX copy", () => {
  it("describes the exact card and die waiting for confirmation", () => {
    expect(
      describePendingCommit({
        cardName: "Short Pass",
        die: 5,
        buildUp: 5,
        chance: 0,
        cover: 0,
      }),
    ).toBe("Commit Short Pass with die 5: +5 Build-Up");
  });

  it("describes defending pressure in terms of cover and what gets through", () => {
    expect(describePressureStatus({ pressure: 12, cover: 5, finalBall: 8 })).toBe(
      "Under pressure: Cover absorbs 5 of 12. 7 pressure gets through; ball projects to 8.",
    );
  });

  it("recommends cover when pressure would reach your box", () => {
    expect(
      describeDecisionCoach({
        ball: 6,
        projectedBall: 6,
        finalBall: 3,
        theirBox: 16,
        shotQuality: 0,
        pressure: 12,
        cover: 2,
        chance: 0,
        chanceBanks: false,
      }),
    ).toEqual({
      state: "Danger",
      priority: "Add Cover",
      reason: "Their pressure projects into your box.",
    });
  });

  it("recommends build-up before the ball is deep enough", () => {
    expect(
      describeDecisionCoach({
        ball: 10,
        projectedBall: 12,
        finalBall: 12,
        theirBox: 16,
        shotQuality: 0,
        pressure: 4,
        cover: 6,
        chance: 0,
        chanceBanks: false,
      }),
    ).toEqual({
      state: "Building",
      priority: "Add Build-Up",
      reason: "You still need territory before Chance matters.",
    });
  });

  it("defines finishers as chance cards that only matter deep", () => {
    expect(LANE_GLOSSARY.finish).toBe("Finish cards add Chance only when the ball is projected into the final third or box.");
  });
});
