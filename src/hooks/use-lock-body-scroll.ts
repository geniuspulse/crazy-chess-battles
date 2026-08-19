"use client";

import { useEffect } from "react";

/**
 * Locks page scroll on <html>/<body> while the component using this hook
 * is mounted — used on the game screen so it behaves like a fixed, native
 * app view (chess.com-style) instead of a scrollable page.
 */
export function useLockBodyScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);
}
