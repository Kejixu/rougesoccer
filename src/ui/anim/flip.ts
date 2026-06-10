// Minimal FLIP: measure children keyed by data-uid before render, invert the
// delta after, play to identity via WAAPI. Makes hand reflow (draws, plays,
// discards) glide instead of teleport.

import { useLayoutEffect, useRef } from "react";

export function useFlip(containerRef: React.RefObject<HTMLElement | null>, dep: unknown): void {
  const positions = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = new Map<string, DOMRect>();
    for (const el of container.querySelectorAll<HTMLElement>("[data-uid]")) {
      const uid = el.dataset.uid;
      if (!uid) continue;
      const rect = el.getBoundingClientRect();
      next.set(uid, rect);
      const prev = positions.current.get(uid);
      if (prev) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        if (dx !== 0 || dy !== 0) {
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
            { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
          );
        }
      } else {
        // newly drawn card: slide in from the right edge
        el.animate(
          [
            { transform: "translateX(60px) rotate(6deg)", opacity: 0 },
            { transform: "translateX(0) rotate(0)", opacity: 1 },
          ],
          { duration: 280, easing: "ease-out" },
        );
      }
    }
    positions.current = next;
  }, [containerRef, dep]);
}
