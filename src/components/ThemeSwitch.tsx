"use client";

import { useEffect, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/format";

const KEY = "observatory-theme";
const META: Record<ThemeId, string> = { paper: "#EEF1F5", deepspace: "#0b0b0d", discovery: "#f5f5f7" };

/** Paper, Deep Space or Discovery. Remembered in this browser; ?theme= on the address sets it too. */
export default function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeId>("paper");

  // Stay in step with the other switch on the page (top bar and footer).
  useEffect(() => {
    const read = () => setTheme((document.documentElement.dataset.theme as ThemeId) || "paper");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const choose = (t: ThemeId) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[t]);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  };

  return (
    <div className="theme-switch" role="group" aria-label="Look">
      {THEMES.map((t) => (
        <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => choose(t.id)}>
          {t.name}
        </button>
      ))}
    </div>
  );
}
