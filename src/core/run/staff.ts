// Staff hires: the run's relic layer. Offered pick-1-of-N every time the
// player advances a stage (group qualification, then each knockout win).
// Drilled gameplans (imbued at the shop) join staff as permanent passives.

import { nextFloat } from "../rng";
import type { ContentBundle, PassiveEffect, RunState, StaffOffer } from "../types";

function rand(draft: RunState): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

/** Pick N distinct unowned staff. Returns null when the pool is exhausted. */
export function rollStaffOffer(draft: RunState, content: ContentBundle): StaffOffer | null {
  const pool = content.staffPool.filter((s) => !draft.staff.includes(s.id));
  if (pool.length === 0) return null;
  const picks: string[] = [];
  const candidates = [...pool];
  const n = Math.min(content.balance.STAFF_OFFER_SIZE, candidates.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand(draft) * candidates.length);
    picks.push(candidates[idx]!.id);
    candidates.splice(idx, 1);
  }
  return { staffIds: picks };
}

/** Every passive active from kickoff: the nation's class identity, hired
 * staff, and drilled gameplans. */
export function runPassives(content: ContentBundle, state: RunState): PassiveEffect[] {
  const passives: PassiveEffect[] = [];
  const kit = content.nationKits?.[state.playerTeamId];
  if (kit) passives.push(kit.passive);
  for (const id of state.staff) {
    const def = content.staffPool.find((s) => s.id === id);
    if (def) passives.push(def.passive);
  }
  for (const defId of state.drilled) {
    const def = content.defs[defId];
    if (def?.passive) passives.push(def.passive);
  }
  return passives;
}

/** Sum the amounts of one run-level passive kind (budgetOnWin, cutRefund, …). */
export function runPassiveSum(
  content: ContentBundle,
  state: RunState,
  kind: PassiveEffect["kind"],
): number {
  let total = 0;
  for (const p of runPassives(content, state)) {
    if (p.kind === kind && "amount" in p) total += p.amount;
  }
  return total;
}
