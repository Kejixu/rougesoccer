// Enforces the module dependency rule without ESLint: src/core and src/sim must
// stay headless — no React, no DOM globals, no storage, no imports from ui.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "react import", re: /from\s+["']react/ },
  { name: "document global", re: /\bdocument\./ },
  { name: "window global", re: /\bwindow\./ },
  { name: "localStorage", re: /\blocalStorage\b/ },
  { name: "ui import", re: /from\s+["'].*\/ui\// },
  { name: "Math.random", re: /\bMath\.random\b/ },
  { name: "Date.now", re: /\bDate\.now\b/ },
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("module boundaries", () => {
  for (const dir of ["src/core", "src/sim", "src/data"]) {
    it(`${dir} is headless and deterministic`, () => {
      for (const file of walk(join(process.cwd(), dir))) {
        const text = readFileSync(file, "utf8");
        for (const rule of FORBIDDEN) {
          expect(rule.re.test(text), `${file} contains forbidden ${rule.name}`).toBe(false);
        }
      }
    });
  }
});
