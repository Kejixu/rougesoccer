import { beforeEach, describe, expect, it } from "vitest";
import { createRun } from "../src/core/run/run";
import { makeContent } from "../src/data/content";
import { loadRun, saveRun } from "../src/save/persistence";

const storage = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
});

beforeEach(() => storage.clear());

describe("run persistence version 9", () => {
  it("discards version 8 saves", () => {
    const oldRun = { ...createRun(makeContent(), "old-save", "usa"), version: 8 };
    storage.set("rougesoccer:run:v8", JSON.stringify(oldRun));

    expect(loadRun()).toBeNull();

    storage.clear();
    storage.set("rougesoccer:run:v9", JSON.stringify(oldRun));
    expect(loadRun()).toBeNull();
  });

  it("round-trips a resumable version 9 run", () => {
    const run = createRun(makeContent(), "new-save", "usa");

    saveRun(run);

    expect(run.version).toBe(9);
    expect(storage.has("rougesoccer:run:v9")).toBe(true);
    expect(loadRun()).toEqual(run);
  });
});
