"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures a container element and returns the largest square size that
 * fits within both its width and height — used to size the chessboard so
 * it never forces the page to scroll, on any screen size.
 */
export function useBoardSize(maxSize = 600, minSize = 220) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(maxSize);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const fit = Math.floor(Math.min(rect.width, rect.height));
      if (fit > 0) {
        setSize(Math.max(minSize, Math.min(maxSize, fit)));
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [maxSize, minSize]);

  return { containerRef, size };
}
