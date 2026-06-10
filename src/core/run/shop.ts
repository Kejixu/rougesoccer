// Between-match shop: card shelf priced by rarity, training and release slots.

import type { ContentBundle, Rarity, RunState, ShopState } from "../types";
import { rollCardOfRarity, rollRarity } from "./rewards";

function priceOf(content: ContentBundle, rarity: Rarity): number {
  return content.balance.SHOP_PRICES[rarity];
}

export function generateShop(draft: RunState, content: ContentBundle): ShopState {
  const cards: ShopState["cards"] = [];
  for (let i = 0; i < content.balance.SHOP_CARD_COUNT; i++) {
    const rarity = rollRarity(draft, content);
    const defId = rollCardOfRarity(draft, content, rarity);
    cards.push({ defId, price: priceOf(content, rarity), sold: false });
  }
  return {
    cards,
    trainPrice: content.balance.SHOP_PRICES.train,
    releasePrice: content.balance.SHOP_PRICES.release,
    rerollScoutPrice: content.balance.SHOP_PRICES.rerollScout,
  };
}

export function buyCard(draft: RunState, content: ContentBundle, index: number): void {
  if (!draft.shop) throw new Error("no shop available");
  const slot = draft.shop.cards[index];
  if (!slot) throw new Error(`no shop slot ${index}`);
  if (slot.sold) throw new Error("card already sold");
  if (draft.resources.budget < slot.price) throw new Error("not enough budget");
  draft.resources.budget -= slot.price;
  slot.sold = true;
  draft.deck.push({
    uid: `run-${draft.uidCounter++}`,
    defId: slot.defId,
    level: 0,
    formPower: 0,
    fatigued: false,
  });
  void content;
}

export function trainCard(draft: RunState, content: ContentBundle, uid: string): void {
  if (!draft.shop) throw new Error("no shop available");
  const price = draft.shop.trainPrice;
  if (draft.resources.budget < price) throw new Error("not enough budget");
  const card = draft.deck.find((c) => c.uid === uid);
  if (!card) throw new Error(`card ${uid} not in deck`);
  const def = content.defs[card.defId];
  if (!def) throw new Error(`unknown def ${card.defId}`);
  const maxLevel = Math.min(content.balance.TRAIN_MAX_LEVEL, def.levels.length - 1);
  if (card.level >= maxLevel) throw new Error(`${def.name} is already at max level`);
  draft.resources.budget -= price;
  card.level = (card.level + 1) as 0 | 1 | 2;
}

export function releaseCard(draft: RunState, content: ContentBundle, uid: string): void {
  if (!draft.shop) throw new Error("no shop available");
  const price = draft.shop.releasePrice;
  if (draft.resources.budget < price) throw new Error("not enough budget");
  if (draft.deck.length <= content.balance.MIN_DECK_SIZE)
    throw new Error("squad is at minimum size");
  const idx = draft.deck.findIndex((c) => c.uid === uid);
  if (idx === -1) throw new Error(`card ${uid} not in deck`);
  draft.resources.budget -= price;
  draft.deck.splice(idx, 1);
}

export function rerollShop(draft: RunState, content: ContentBundle): void {
  if (!draft.shop) throw new Error("no shop available");
  if (draft.resources.scout < draft.shop.rerollScoutPrice) throw new Error("not enough scout points");
  draft.resources.scout -= draft.shop.rerollScoutPrice;
  draft.shop = generateShop(draft, content);
}
