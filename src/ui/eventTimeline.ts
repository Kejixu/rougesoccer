import type { GameEvent } from "../core/types";

export interface StagedEvent {
  delay: number;
  event: GameEvent;
}

function popupDuration(event: GameEvent): number {
  switch (event.type) {
    case "SHOT_VALUE":
      return 450 + 550;
    case "SHOT_TAKEN":
      return 900 + (event.goal ? 0 : 600);
    case "PASS_CHALLENGED":
    case "OPP_PASS_CHALLENGED":
      return 520;
    case "CORNER_EARNED":
    case "KEEPER_RATTLED":
    case "CHAIN_INTERCEPTED":
    case "SUDDEN_DEATH_START":
      return 600;
    case "OPP_SHOT":
    case "COUNTER_SHOT":
      return 900 + 600;
    case "GOAL_SCORED":
      return event.goals > 0 ? 650 : 0;
    case "MATCH_END":
    case "SHOOTOUT":
      return 800;
    default:
      return 0;
  }
}

export function stageEvents(events: GameEvent[]): StagedEvent[] {
  let delay = 0;
  return events.map((event) => {
    const staged = { delay, event };
    delay += popupDuration(event);
    return staged;
  });
}
