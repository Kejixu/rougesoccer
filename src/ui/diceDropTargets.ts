import { dieFitsSlot, type CardDefMap, type DiceMatchState } from "../core/types";
import { tutorialLockAllows, type TutorialLock } from "./tutorialScript";

function isDefenseCard(def: CardDefMap[string] | undefined): boolean {
  return (def?.diceEffects ?? []).some((e) => e.kind === "defend");
}

export function dieDropTargets(
  defs: CardDefMap,
  state: DiceMatchState,
  dieIndex: number,
  tutorialLock?: TutorialLock,
): Set<string> {
  const out = new Set<string>();
  const die = state.dice[dieIndex];
  if (!die || die.used) return out;

  for (const card of state.hand) {
    const def = defs[card.defId];
    const slot = def?.slot;
    if (!def || !slot || !dieFitsSlot(die.value, slot)) continue;
    const defense = isDefenseCard(def);
    if (state.possession === "you" && defense) continue;
    if (state.possession === "them" && !defense) continue;
    if (tutorialLock && !tutorialLockAllows(tutorialLock, { kind: "playCard", defId: def.id })) continue;
    out.add(card.uid);
  }

  return out;
}
