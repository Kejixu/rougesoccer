// Post-match reward offers: pick 1 of N cards, rarity weights shift by stage.

import { nextFloat } from "../rng";
import type { ContentBundle, Rarity, RewardOffer, RunState } from "../types";

function rand(draft: RunState): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

export function rollRarity(draft: RunState, content: ContentBundle): Rarity {
  const weights = content.balance.REWARD_RARITY_WEIGHTS[draft.stage];
  const total = weights.common + weights.rare + weights.legendary;
  const roll = rand(draft) * total;
  if (roll < weights.common) return "common";
  if (roll < weights.common + weights.rare) return "rare";
  return "legendary";
}

export function rollCardOfRarity(draft: RunState, content: ContentBundle, rarity: Rarity): string {
  let pool = content.cardPool.filter((c) => c.rarity === rarity);
  if (pool.length === 0) pool = content.cardPool;
  if (pool.length === 0) throw new Error("card pool is empty");
  return pool[Math.floor(rand(draft) * pool.length)]!.id;
}

export function rollRewardOffer(draft: RunState, content: ContentBundle, picks: number): RewardOffer {
  const defIds: string[] = [];
  for (let i = 0; i < picks; i++) {
    defIds.push(rollCardOfRarity(draft, content, rollRarity(draft, content)));
  }
  return { defIds };
}
