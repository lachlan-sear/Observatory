"use client";
import { useEffect } from "react";

/* Tells a host page (the desks) how tall the embed is, so its iframe can fit
   the content instead of scrolling inside itself, and that it is ready for a hide list. */
export default function EmbedHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    const send = () =>
      window.parent.postMessage({ type: "observatory:height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    // Hydrated: ask the host for the names to hide (an iframe's load event can fire before React listens).
    window.parent.postMessage({ type: "observatory:ready" }, "*");
    return () => ro.disconnect();
  }, []);
  return null;
}
