import { dieFitsSlot, type CardDefMap, type DiceMatchState } from "../core/types";
import { isDefenseCard } from "../core/match/dice";
import { tutorialLockAllows, type TutorialLock } from "./tutorialScript";

/** The uids a die can actually drop on, from a dieDropInfo result. */
export function okDropUids(info: Map<string, "ok" | "locked">): Set<string> {
  return new Set([...info].filter(([, status]) => status === "ok").map(([uid]) => uid));
}

export function dieDropTargets(
  defs: CardDefMap,
  state: DiceMatchState,
  dieIndex: number,
  tutorialLock?: TutorialLock,
): Set<string> {
  return okDropUids(dieDropInfo(defs, state, dieIndex, tutorialLock));
}

export function dieDropInfo(
  defs: CardDefMap,
  state: DiceMatchState,
  dieIndex: number,
  tutorialLock?: TutorialLock,
): Map<string, "ok" | "locked"> {
  const out = new Map<string, "ok" | "locked">();
  const die = state.dice[dieIndex];
  if (!die || die.used) return out;

  for (const card of state.hand) {
    const def = defs[card.defId];
    const slot = def?.slot;
    if (!def || !slot || !dieFitsSlot(die.value, slot)) continue;
    if (tutorialLock && !tutorialLockAllows(tutorialLock, { kind: "playCard", defId: def.id })) continue;
    const defense = isDefenseCard(def);
    const possessionLocked =
      (state.possession === "you" && defense) || (state.possession === "them" && !defense);
    out.set(card.uid, possessionLocked ? "locked" : "ok");
  }

  return out;
}
