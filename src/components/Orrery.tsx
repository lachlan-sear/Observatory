"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Change, Company, Sector } from "@/lib/types";
import { month, sectorColor, shortDate, STATUS_LABEL } from "@/lib/format";

/*
 * The orrery. One sun (the thesis), one orbit per sector, one planet riding
 * each orbit with its companies as moons, and a brass outer ring for exits.
 *
 * Every movement carries data:
 *  - moon size  = capital raised (log scale), hollow = awaiting its first check
 *  - teal pulse = a round recorded in this edition
 *  - brass trail = an exit recorded in this edition travelling from its sector
 *    out to the exits ring
 * One orchestrated entrance (orbits ink in, planets, moons, then the exit
 * travels), then slow, continuous orbiting. Reduced motion draws the final state.
 */

type Props = {
  sectors: Sector[];
  companies: Company[];
  changes: Change[];
  thesisName: string;
  hidden?: string[];
  compact?: boolean;
};

type Hit = { kind: "moon" | "planet" | "exit"; x: number; y: number; r: number; company?: Company; sector?: Sector };

const INK = "#0F1B2D";
const INK2 = "#37445A";
const LINE = "rgba(15,27,45,0.16)";
const BRASS = "#9C680A";
const TEAL = "#17796F";
const PAPER = "#EEF1F5";


const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function moonRadius(c: Company) {
  if (!c.raisedUsdM) return 2.6;
  return Math.max(2.3, Math.min(6.5, 1.8 + 1.4 * Math.log10(1 + c.raisedUsdM)));
}

const NONE: string[] = [];

export default function Orrery({ sectors, companies, changes, thesisName, hidden = NONE, compact = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<Hit[]>([]);
  const clockRef = useRef<number | null>(null); // survives data changes so the intro plays once
  const zoomRef = useRef({ target: null as string | null, last: null as string | null, k: 0 });
  const hoverRef = useRef<string | null>(null);
  const [hover, setHover] = useState<{ hit: Hit; x: number; y: number } | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [extraHidden, setExtraHidden] = useState<string[]>([]);

  // Embedding pages (the desks) can hide a reader's own portfolio:
  // ?hide=A,B on the embed URL, or postMessage({type:"observatory:hide", names:[...]}).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "observatory:hide" && Array.isArray(e.data.names)) {
        setExtraHidden(e.data.names.map((n: unknown) => String(n)));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const hiddenSet = useMemo(
    () => new Set([...hidden, ...extraHidden].map((n) => n.toLowerCase().trim())),
    [hidden, extraHidden],
  );
  const visible = useMemo(() => companies.filter((c) => !hiddenSet.has(c.name.toLowerCase())), [companies, hiddenSet]);
  const live = useMemo(() => visible.filter((c) => c.status !== "exited" && c.status !== "shut_down"), [visible]);
  const exits = useMemo(() => visible.filter((c) => c.status === "exited"), [visible]);
  const pulsing = useMemo(
    () => new Set(changes.filter((ch) => ch.kind === "round").map((ch) => ch.company.toLowerCase())),
    [changes],
  );
  const travelling = useMemo(
    () => new Set(changes.filter((ch) => ch.kind === "exit").map((ch) => ch.company.toLowerCase())),
    [changes],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return () => {};
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const n = sectors.length;
    const bySector = sectors.map((s) => live.filter((c) => c.sector === s.id));
    const phase0 = sectors.map((_, i) => -Math.PI / 2 + i * (Math.PI * 2 * 0.618) + 0.6);
    const exitHome = new Map(exits.map((c, i) => [c.name, (i / Math.max(1, exits.length)) * Math.PI * 2 + 2.2]));

    let raf = 0;
    let running = true;
    let last = performance.now();
    let clock = clockRef.current ?? (reduce ? 40 : 0); // seconds since load; reduced motion starts after the intro
    let orbitTime = 0;           // drives orbital motion; frozen while zoomed
    const pathTrail: Record<string, { x: number; y: number }[]> = {};

    const vis = new IntersectionObserver(([e]) => {
      running = e.isIntersecting && !document.hidden;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    vis.observe(wrap);
    const onVis = () => {
      running = !document.hidden;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    function frame(now: number) {
      if (!running || !ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      clockRef.current = clock;
      const z = zoomRef.current;
      z.k += ((z.target ? 1 : 0) - z.k) * Math.min(1, dt * 4);
      if (!reduce) orbitTime += dt * (1 - 0.92 * z.k);
      render();
      raf = requestAnimationFrame(frame);
    }

    // Draw text on the side that keeps it inside the plate.
    function label(text: string, x: number, y: number, preferRight: boolean, gap: number) {
      if (!ctx) return;
      const w = ctx.measureText(text).width;
      const right = preferRight ? x + gap + w <= W - 4 : !(x - gap - w >= 4);
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(text, right ? x + gap : x - gap, y);
    }

    function render() {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const narrow = W < 600;
      const TILT = narrow ? 0.8 : 0.56;   // nearer top-down on phones, where width is scarce
      const sizeK = narrow ? 0.78 : 1;
      const cx = W / 2;
      const cy = H / 2 + (compact ? 0 : H * 0.02);
      const maxRx = Math.min(W * (narrow ? 0.45 : 0.485), (H * 0.43) / TILT);
      const rxOf = (i: number) => maxRx * (n === 1 ? 0.55 : 0.32 + (0.82 - 0.32) * (i / (n - 1)));
      const exitRx = maxRx * 0.985;

      // Planet positions (needed before the camera so we can centre a zoomed planet).
      const planets = sectors.map((s, i) => {
        const rx = rxOf(i);
        const speed = 0.055 / Math.pow(i + 1, 0.8);
        const th = phase0[i] + orbitTime * speed;
        return { s, i, rx, th, x: cx + rx * Math.cos(th), y: cy + rx * TILT * Math.sin(th), depth: Math.sin(th) };
      });

      // Camera
      const z = zoomRef.current;
      // Keep the last focus while zooming back out, so the camera eases home.
      const focusId = z.target || (z.k > 0.01 ? z.last : null);
      const focus = planets.find((p) => p.s.id === focusId);
      const k = ease(z.k);
      const scale = 1 + k * (compact ? 1.8 : 2.2);
      const fx = focus ? focus.x : cx, fy = focus ? focus.y : cy;
      const tx = cx - fx * scale, ty = cy - fy * scale;
      const toScreen = (x: number, y: number) => ({ x: x * scale + tx, y: y * scale + ty });

      const hits: Hit[] = [];
      const t = clock;
      const orbitsIn = (i: number) => ease(clamp01((t - 0.15 - i * 0.12) / 1.0));
      const planetsIn = (i: number) => ease(clamp01((t - 0.7 - i * 0.12) / 0.6));
      const moonsIn = (i: number, j: number) => ease(clamp01((t - 1.3 - i * 0.18 - j * 0.04) / 0.45));

      // ---- Orbits (ink in as a sweep) ----
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const p = orbitsIn(i);
        if (p <= 0) continue;
        const dim = focus && focus.i !== i ? 1 - 0.65 * k : 1;
        ctx.strokeStyle = `rgba(15,27,45,${0.16 * dim})`;
        ctx.beginPath();
        const steps = 160;
        for (let s = 0; s <= steps * p; s++) {
          const a = -Math.PI / 2 + (s / steps) * Math.PI * 2;
          const q = toScreen(cx + rxOf(i) * Math.cos(a), cy + rxOf(i) * TILT * Math.sin(a));
          if (s === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
      // Exits ring: brass, dashed
      {
        const p = orbitsIn(n);
        if (p > 0) {
          ctx.save();
          ctx.setLineDash([2, 5]);
          ctx.strokeStyle = `rgba(156,104,10,${0.55 * (1 - 0.6 * k)})`;
          ctx.beginPath();
          const steps = 200;
          for (let s = 0; s <= steps * p; s++) {
            const a = -Math.PI / 2 + (s / steps) * Math.PI * 2;
            const q = toScreen(cx + exitRx * Math.cos(a), cy + exitRx * TILT * Math.sin(a));
            if (s === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          }
          ctx.stroke();
          ctx.restore();
          if (p >= 1 && !focus) {
            const q = toScreen(cx + exitRx * Math.cos(-0.55), cy + exitRx * TILT * Math.sin(-0.55));
            ctx.font = "500 12px Onest, system-ui, sans-serif";
            ctx.fillStyle = BRASS;
            label(`Exits ${exits.length}`, q.x, q.y - 6, true, 8);
          }
        }
      }

      // ---- Sun (the thesis) ----
      {
        const q = toScreen(cx, cy);
        const a = ease(clamp01(t / 0.6));
        ctx.globalAlpha = a * (1 - 0.6 * k);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 5.5 * Math.min(scale, 1.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 14 * Math.min(scale, 1.6), 0, Math.PI * 2);
        ctx.stroke();
        if (!focus && !narrow) {
          ctx.font = `400 ${compact ? 14 : 16}px Newsreader, Georgia, serif`;
          ctx.fillStyle = INK;
          ctx.textAlign = "center";
          ctx.fillText(thesisName, q.x, q.y + 34);
        }
        ctx.globalAlpha = 1;
      }

      // ---- Collect drawables, sort back-to-front by depth ----
      type D = { depth: number; draw: () => void };
      const queue: D[] = [];

      planets.forEach((pl) => {
        const color = sectorColor(sectors, pl.s.id);
        const appear = planetsIn(pl.i);
        if (appear <= 0) return;
        const dim = focus && focus.i !== pl.i ? 1 - 0.78 * k : 1;
        const depthScale = 0.86 + 0.14 * ((pl.depth + 1) / 2);
        const pr = (compact ? 9 : 11) * sizeK * depthScale * Math.min(scale, 2.1) * (0.4 + 0.6 * appear);
        const P = toScreen(pl.x, pl.y);
        const moons = bySector[pl.i];
        const localR = (17 + moons.length * 2.9) * depthScale * sizeK;

        queue.push({
          depth: pl.depth,
          draw: () => {
            ctx.globalAlpha = dim * appear;
            // the system's halo, so a planet and its moons read as one body
            ctx.fillStyle = color;
            ctx.globalAlpha = dim * appear * 0.07;
            ctx.beginPath();
            ctx.ellipse(P.x, P.y, localR * 1.25 * scale, localR * 0.95 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = dim * appear;
            // planet
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(P.x, P.y, pr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = PAPER;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineWidth = 1;
            hits.push({ kind: "planet", x: P.x, y: P.y, r: pr + 6, sector: pl.s });
            // moon orbit (local)
            ctx.strokeStyle = `rgba(15,27,45,${0.09})`;
            ctx.beginPath();
            ctx.ellipse(P.x, P.y, localR * scale, localR * 0.7 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
            // label
            const labelFocus = !!focus && focus.i === pl.i && k > 0.5;
            if (!labelFocus) {
              ctx.font = `500 ${compact ? 11.5 : 12.5}px Onest, system-ui, sans-serif`;
              ctx.fillStyle = INK2;
              ctx.textAlign = "center";
              ctx.fillText(`${pl.s.short || pl.s.name}  ${moons.length}`, P.x, P.y - localR * 0.7 * scale - 10);
            }
            // moons
            moons.forEach((c, j) => {
              const ma = moonsIn(pl.i, j);
              if (ma <= 0) return;
              const phi = (j / moons.length) * Math.PI * 2 + orbitTime * (0.16 - 0.006 * j) + pl.i;
              const mx = pl.x + localR * Math.cos(phi);
              const my = pl.y + localR * 0.7 * Math.sin(phi);
              const M = toScreen(mx, my);
              const mr = moonRadius(c) * sizeK * Math.min(Math.max(scale * 0.75, 1), 1.9) * ma;
              const pending = c.verifiedBy === "pending";
              const isHover = hoverRef.current === c.name;
              ctx.globalAlpha = dim * ma;
              if (pending) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
              } else {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr, 0, Math.PI * 2);
                ctx.fill();
              }
              if (c.status === "leader") {
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr + 3, 0, Math.PI * 2);
                ctx.stroke();
              }
              if (isHover) {
                ctx.strokeStyle = INK;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr + 4.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
              }
              // pulse for this edition's rounds
              if (!reduce && pulsing.has(c.name.toLowerCase()) && t > 3.2) {
                const cyc = ((t - 3.2 + j * 0.37) % 2.8) / 2.8;
                ctx.strokeStyle = `rgba(23,121,111,${0.7 * (1 - cyc) * dim})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr + 2 + cyc * 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
              } else if (reduce && pulsing.has(c.name.toLowerCase())) {
                ctx.strokeStyle = TEAL;
                ctx.beginPath();
                ctx.arc(M.x, M.y, mr + 4, 0, Math.PI * 2);
                ctx.stroke();
              }
              if (labelFocus || (focus == null && isHover)) {
                ctx.font = `500 ${labelFocus ? 12.5 : 12}px Onest, system-ui, sans-serif`;
                ctx.fillStyle = INK;
                label(c.name, M.x, M.y + 4, M.x > P.x, mr + 6);
              }
              hits.push({ kind: "moon", x: M.x, y: M.y, r: Math.max(mr, 4) + 5, company: c, sector: pl.s });
              ctx.globalAlpha = 1;
            });
            if (labelFocus) {
              ctx.font = "500 15px Newsreader, Georgia, serif";
              ctx.fillStyle = INK;
              ctx.textAlign = "center";
              ctx.fillText(pl.s.name, P.x, P.y - localR * 0.7 * scale - 18);
            }
            ctx.globalAlpha = 1;
          },
        });
      });

      // ---- Exits: settled on the brass ring, or travelling there this edition ----
      exits.forEach((c, j) => {
        const home = (exitHome.get(c.name) || 0) + orbitTime * 0.012;
        const hx = cx + exitRx * Math.cos(home);
        const hy = cy + exitRx * TILT * Math.sin(home);
        let x = hx, y = hy;
        const sIndex = sectors.findIndex((s) => s.id === c.sector);
        const travel = travelling.has(c.name.toLowerCase()) && !reduce;
        const start = 2.7 + j * 0.5;
        const dur = 2.6;
        let prog = 1;
        if (travel) {
          prog = ease(clamp01((t - start) / dur));
          const from = planets[sIndex] || planets[0];
          // a gentle outward arc from the sector's planet to its slot on the ring
          const mx = (from.x + hx) / 2 + (hy - from.y) * 0.25;
          const my = (from.y + hy) / 2 - (hx - from.x) * 0.25 * TILT - 30;
          const u = prog;
          x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * mx + u * u * hx;
          y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * my + u * u * hy;
          const trail = (pathTrail[c.name] ||= []);
          if (t > start && t < start + dur + 0.1) trail.push({ x, y });
          if (trail.length > 90) trail.shift();
        }
        if (t < (travel ? start : 2.2)) return;
        const depth = Math.sin(home);
        queue.push({
          depth,
          draw: () => {
            const dim = 1 - 0.65 * k;
            const trail = pathTrail[c.name];
            if (trail && trail.length > 1) {
              const fade = 1 - clamp01((t - (start + dur)) / 6);
              if (fade > 0) {
                for (let s = 1; s < trail.length; s++) {
                  const a = toScreen(trail[s - 1].x, trail[s - 1].y);
                  const b = toScreen(trail[s].x, trail[s].y);
                  ctx.strokeStyle = `rgba(156,104,10,${(s / trail.length) * 0.6 * fade * dim})`;
                  ctx.lineWidth = 1.4;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(b.x, b.y);
                  ctx.stroke();
                }
                ctx.lineWidth = 1;
              }
            }
            const E = toScreen(x, y);
            const r = moonRadius(c) + 0.5;
            ctx.globalAlpha = dim;
            ctx.fillStyle = BRASS;
            ctx.beginPath();
            ctx.arc(E.x, E.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = PAPER;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineWidth = 1;
            if (prog >= 1 && !focus) {
              const name = c.exit?.acquirer ? `${c.name} → ${c.exit.acquirer}` : c.name;
              ctx.font = "500 12px Onest, system-ui, sans-serif";
              ctx.fillStyle = BRASS;
              label(name, E.x, E.y + 4, E.x > cx, r + 7);
            }
            ctx.globalAlpha = 1;
            hits.push({ kind: "exit", x: E.x, y: E.y, r: r + 6, company: c });
          },
        });
      });

      queue.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());
      hitsRef.current = hits;
    }

    if (reduce) render();
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      vis.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sectors, live, exits, pulsing, travelling, thesisName, compact]);

  useEffect(() => {
    zoomRef.current.target = zoomed;
    if (zoomed) zoomRef.current.last = zoomed;
  }, [zoomed]);

  useEffect(() => draw(), [draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left, y = clientY - rect.top;
    let best: Hit | null = null, bestD = Infinity;
    for (const h of hitsRef.current) {
      const d = Math.hypot(h.x - x, h.y - y);
      // moons and exits win over planets when overlapping
      const bias = h.kind === "planet" ? 4 : 0;
      if (d < h.r && d + bias < bestD) {
        best = h;
        bestD = d + bias;
      }
    }
    return best ? { hit: best, x, y } : null;
  };

  const onMove = (e: React.PointerEvent) => {
    const p = pick(e.clientX, e.clientY);
    hoverRef.current = p?.hit.company?.name || null;
    setHover(p);
    if (canvasRef.current) canvasRef.current.style.cursor = p ? "pointer" : "default";
  };

  const onClick = (e: React.MouseEvent) => {
    const p = pick(e.clientX, e.clientY);
    if (!p) {
      if (zoomed) setZoomed(null);
      return;
    }
    if (p.hit.kind === "planet" && p.hit.sector) setZoomed(zoomed === p.hit.sector.id ? null : p.hit.sector.id);
    else if (p.hit.kind === "moon" && p.hit.sector && !zoomed) setZoomed(p.hit.sector.id);
    else setHover(p);
  };

  const zoomSector = sectors.find((s) => s.id === zoomed);
  const card = hover?.hit.company;
  const cardSector = hover?.hit.sector || sectors.find((s) => s.id === card?.sector);

  return (
    <div className={compact ? "orrery orrery--compact" : "orrery"} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerMove={onMove}
        onPointerLeave={() => {
          hoverRef.current = null;
          setHover(null);
        }}
        onClick={onClick}
        role="img"
        aria-label={`Orrery of ${visible.length} companies across ${sectors.length} sectors, with ${exits.length} exits on the outer ring. The full list is in the table below.`}
      />
      <div className="orrery-sectors" role="group" aria-label="Zoom into a sector">
        {sectors.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={zoomed === s.id}
            onClick={() => setZoomed(zoomed === s.id ? null : s.id)}
          >
            <span className="dot" style={{ background: sectorColor(sectors, s.id) }} aria-hidden />
            {s.short || s.name}
          </button>
        ))}
        {zoomed && (
          <button type="button" className="orrery-back" onClick={() => setZoomed(null)}>
            All orbits
          </button>
        )}
      </div>
      {zoomSector && !compact && <p className="orrery-zoomnote">{zoomSector.description}</p>}
      <div className="orrery-key" aria-hidden>
        <span><i className="k-fill" />Size is capital raised</span>
        <span><i className="k-ring" />Awaiting first check</span>
        <span><i className="k-pulse" />New round this edition</span>
        <span><i className="k-exit" />Exit</span>
      </div>
      {hover && card && (
        <div
          className="orrery-card"
          style={{
            left: Math.min(hover.x + 16, (wrapRef.current?.clientWidth || 0) - 300),
            top: Math.max(8, hover.y - 20),
          }}
          role="status"
        >
          <p className="oc-name">{card.name}</p>
          <p className="oc-meta">
            <span className="dot" style={{ background: card.status === "exited" ? "#9C680A" : sectorColor(sectors, card.sector) }} />
            {card.status === "exited" ? "Exited" : cardSector?.name}
            {card.geo ? `, ${card.geo}` : ""}
          </p>
          <p className="oc-desc">{card.description}</p>
          <dl>
            {card.stage && <><dt>Stage</dt><dd>{card.stage}</dd></>}
            {card.raised && <><dt>Raised</dt><dd>{card.raised}</dd></>}
            {card.lastRound?.amount && (
              <><dt>Last round</dt><dd>{card.lastRound.amount}{card.lastRound.date ? `, ${month(card.lastRound.date)}` : ""}</dd></>
            )}
            {card.exit?.acquirer && <><dt>Acquirer</dt><dd>{card.exit.acquirer}{card.exit.date ? `, ${month(card.exit.date)}` : ""}</dd></>}
            {card.status !== "tracking" && card.status !== "exited" && <><dt>Status</dt><dd>{STATUS_LABEL[card.status]}</dd></>}
          </dl>
          <p className="oc-check">
            {card.verifiedBy === "pending" ? "Awaiting its first weekly check" : `Checked against source ${shortDate(card.lastVerified)}`}
          </p>
        </div>
      )}
    </div>
  );
}
