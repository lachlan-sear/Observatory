"use client";
import { useEffect } from "react";

/** Turns ?hide=A,B on the embed URL into the same message a host page would send. */
export default function HideFromQuery() {
  useEffect(() => {
    const names = new URLSearchParams(window.location.search).get("hide");
    if (names) window.postMessage({ type: "observatory:hide", names: names.split(",").map((n) => n.trim()) }, window.location.origin);
  }, []);
  return null;
}
