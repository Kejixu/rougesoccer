import type { ContentBundle, MatchAction, MatchState, RunAction, RunState } from "../core/types";

export interface Bot {
  name: string;
  matchAction(content: ContentBundle, match: MatchState): MatchAction;
  runAction(content: ContentBundle, run: RunState): RunAction;
}
