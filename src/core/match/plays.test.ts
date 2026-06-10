import { describe, expect, it } from "vitest";
import { classifyAttack, DEFAULT_PLAYS, FALLBACK_PLAY_NAME } from "./plays";
import type { AttackCard } from "./scoring";
import type { CardDef, CardInstance, Position } from "../types";

let uid = 0;
function card(position?: Position, kind: CardDef["kind"] = "player"): AttackCard {
  const def: CardDef = {
    id: `t-${position ?? kind}-${uid}`,
    kind,
    name: "t",
    position,
    rarity: "common",
    levels: [{ power: 10, text: "" }],
    effects: [],
  };
  const inst: CardInstance = {
    uid: `u${uid++}`,
    defId: def.id,
    level: 0,
    formPower: 0,
    fatigued: false,
  };
  return { inst, def };
}

const classify = (cards: AttackCard[]) => classifyAttack(cards, DEFAULT_PLAYS);

describe("play classifier", () => {
  it("classifies the play table like a poker hand evaluator", () => {
    expect(classify([card("ST")]).name).toBe("Solo Run");
    expect(classify([card("MF"), card("MF")]).name).toBe("One-Two");
    expect(classify([card("MF"), card("ST")]).name).toBe("Through Ball");
    expect(classify([card("WG"), card("ST")]).name).toBe("Counter Attack"); // exact-2 beats Wing Play
    expect(classify([card("WG"), card("ST"), card("MF")]).name).toBe("Wing Play");
    expect(classify([card("DF"), card("WG")]).name).toBe("The Overlap");
    expect(classify([card("MF"), card("MF"), card("MF")]).name).toBe("Tiki-Taka");
    expect(classify([card("ST"), card("WG"), card("MF"), card("DF")]).name).toBe(
      "Total Football",
    );
  });

  it("higher-mult play wins when several match", () => {
    // DF + WG + ST: Wing Play (1.5) and Overlap (1.75) both match
    const r = classify([card("DF"), card("WG"), card("ST")]);
    expect(r.name).toBe("The Overlap");
  });

  it("tactics and moments don't shape the play", () => {
    const r = classify([card("WG"), card("ST"), card(undefined, "tactic")]);
    expect(r.name).toBe("Counter Attack"); // still exactly 2 PLAYER cards
  });

  it("unstructured attacks fall back to x1", () => {
    const r = classify([card("ST"), card("ST")]); // two strikers: no play for that
    expect(r.play).toBeNull();
    expect(r.mult).toBe(1);
    expect(r.name).toBe(FALLBACK_PLAY_NAME);
  });

  it("empty plays table means every attack is a punt", () => {
    expect(classifyAttack([card("WG"), card("ST")], []).mult).toBe(1);
  });
});
