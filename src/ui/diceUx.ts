export interface PendingCommitSummary {
  cardName: string;
  die: number;
  buildUp: number;
  chance: number;
  cover: number;
}

export const LANE_GLOSSARY = {
  buildUp: "Build-Up is territory pressure. It converts into pitch movement when you resolve the duel.",
  chance: "Chance becomes Shot Quality only if the ball is projected into the final third or box.",
  cover: "Cover cancels opponent pressure before it pushes the ball toward your goal.",
  shotQuality: "Shot Quality is banked finishing power. In their box, it adds to your d20 shot.",
  finish: "Finish cards add Chance only when the ball is projected into the final third or box.",
} as const;

export function describePendingCommit(summary: PendingCommitSummary): string {
  const parts = [];
  if (summary.buildUp) parts.push(`+${summary.buildUp} Build-Up`);
  if (summary.chance) parts.push(`+${summary.chance} Chance`);
  if (summary.cover) parts.push(`+${summary.cover} Cover`);
  return `Commit ${summary.cardName} with die ${summary.die}: ${parts.join(", ") || "no lane change"}`;
}

export function describePressureStatus({
  pressure,
  cover,
  finalBall,
}: {
  pressure: number;
  cover: number;
  finalBall: number;
}): string {
  if (pressure <= 0) return "No immediate pressure.";
  const absorbed = Math.min(cover, pressure);
  const through = Math.max(0, pressure - cover);
  if (through === 0) return `Under pressure: Cover absorbs all ${pressure}.`;
  return `Under pressure: Cover absorbs ${absorbed} of ${pressure}. ${through} pressure gets through; ball projects to ${finalBall}.`;
}

export interface DecisionCoachInput {
  ball: number;
  projectedBall: number;
  finalBall: number;
  theirBox: number;
  shotQuality: number;
  pressure: number;
  cover: number;
  chance: number;
  chanceBanks: boolean;
}

export interface DecisionCoachCopy {
  state: "Danger" | "Building" | "Chance" | "Ready";
  priority: string;
  reason: string;
}

export function describeDecisionCoach(input: DecisionCoachInput): DecisionCoachCopy {
  if (input.finalBall <= 4 && input.pressure > input.cover) {
    return {
      state: "Danger",
      priority: "Add Cover",
      reason: "Their pressure projects into your box.",
    };
  }
  if (input.projectedBall >= input.theirBox && input.shotQuality > 0) {
    return {
      state: "Ready",
      priority: "Shoot",
      reason: "You are in the box with Shot Quality banked.",
    };
  }
  if (input.projectedBall >= input.theirBox || input.chanceBanks) {
    return {
      state: "Chance",
      priority: "Add Chance",
      reason: "The ball is deep enough for finishers to matter.",
    };
  }
  return {
    state: "Building",
    priority: "Add Build-Up",
    reason: "You still need territory before Chance matters.",
  };
}
