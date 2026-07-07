import type {
  ContentBundle,
  DiceMatchAction,
  DiceMatchState,
  RunAction,
  RunState,
} from "../core/types";

export interface Bot {
  name: string;
  matchAction(content: ContentBundle, match: DiceMatchState): DiceMatchAction;
  runAction(content: ContentBundle, run: RunState): RunAction;
}
