import { useState } from "react";
import { levelStats, type ContentBundle, type RunAction, type RunState } from "../../core/types";
import { StickerCard } from "../components/StickerCard";

export function ShopScreen({
  run,
  content,
  dispatch,
  onBack,
}: {
  run: RunState;
  content: ContentBundle;
  dispatch: (a: RunAction) => void;
  onBack: () => void;
}) {
  const shop = run.shop;
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selected = run.deck.find((c) => c.uid === selectedUid) ?? null;
  const selectedDef = selected ? content.defs[selected.defId] : null;
  const canTrain =
    selected && selectedDef
      ? selected.level < Math.min(content.balance.TRAIN_MAX_LEVEL, selectedDef.levels.length - 1)
      : false;

  return (
    <main className="screen">
      <h1>Transfer market</h1>
      <p data-testid="resources">
        Budget {run.resources.budget} · Scout points {run.resources.scout}
      </p>

      {shop ? (
        <section>
          <h2>On the market</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="shop-cards">
            {shop.cards.map((slot, i) => (
              <div key={`${slot.defId}-${i}`} style={{ opacity: slot.sold ? 0.4 : 1 }}>
                <StickerCard def={content.defs[slot.defId]!} />
                <button type="button" className="btn"
                  data-testid={`buy-${i}`}
                  disabled={slot.sold || run.resources.budget < slot.price}
                  onClick={() => dispatch({ type: "BUY_CARD", index: i })}
                >
                  {slot.sold ? "Sold" : `Buy (${slot.price})`}
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn"
            data-testid="reroll-shop"
            disabled={run.resources.scout < shop.rerollScoutPrice}
            onClick={() => dispatch({ type: "REROLL_SHOP" })}
          >
            Reroll market ({shop.rerollScoutPrice} scout pt)
          </button>
        </section>
      ) : (
        <p>The market is closed.</p>
      )}

      <section>
        <h2>Your squad ({run.deck.length})</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="squad">
          {run.deck.map((c) => (
            <StickerCard
              key={c.uid}
              def={content.defs[c.defId]!}
              inst={c}
              selected={selectedUid === c.uid}
              onClick={() => setSelectedUid(selectedUid === c.uid ? null : c.uid)}
            />
          ))}
        </div>
        {selected && selectedDef && (
          <p>
            <button type="button" className="btn"
              data-testid="train-card"
              disabled={!canTrain || run.resources.budget < (shop?.trainPrice ?? Infinity)}
              onClick={() => dispatch({ type: "TRAIN_CARD", uid: selected.uid })}
            >
              Train {selectedDef.name}
              {canTrain
                ? ` → ${levelStats(selectedDef, selected.level + 1).text} (${shop?.trainPrice})`
                : " (max level)"}
            </button>{" "}
            <button type="button" className="btn"
              data-testid="release-card"
              disabled={
                run.deck.length <= content.balance.MIN_DECK_SIZE ||
                run.resources.budget < (shop?.releasePrice ?? Infinity)
              }
              onClick={() => {
                dispatch({ type: "RELEASE_CARD", uid: selected.uid });
                setSelectedUid(null);
              }}
            >
              Release ({shop?.releasePrice})
            </button>
          </p>
        )}
      </section>

      <button type="button" className="btn" data-testid="back-to-tournament" onClick={onBack}>
        Back to the tournament
      </button>
    </main>
  );
}
