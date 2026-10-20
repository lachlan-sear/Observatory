"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company, Sector } from "@/lib/types";
import { domain, month, raisedLabel, sectorVar, shortDate, STATUS_LABEL } from "@/lib/format";

type Key = "name" | "sector" | "stage" | "raised" | "last" | "geo" | "checked";
const STAGE_ORDER = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D", "Series E", "Series F",
  "Late stage", "Growth", "Acquired", "Public"];

const NONE: string[] = [];

export default function CompanyTable({ companies, sectors, hidden = NONE }: { companies: Company[]; sectors: Sector[]; hidden?: string[] }) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "raised", dir: -1 });
  const [extraHidden, setExtraHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "observatory:hide" && Array.isArray(e.data.names)) setExtraHidden(e.data.names.map(String));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const rows = useMemo(() => {
    const hide = new Set([...hidden, ...extraHidden].map((n) => n.toLowerCase()));
    const needle = q.trim().toLowerCase();
    const val = (c: Company, k: Key): string | number => {
      switch (k) {
        case "name": return c.name.toLowerCase();
        case "sector": return sectors.findIndex((s) => s.id === c.sector);
        case "stage": { const i = STAGE_ORDER.indexOf(c.stage || ""); return i < 0 ? -1 : i; }
        case "raised": return c.raisedUsdM ?? -1;
        case "last": return c.exit?.date || c.lastRound?.date || "";
        case "geo": return (c.geo || "").toLowerCase();
        case "checked": return c.lastVerified || "";
      }
    };
    return companies
      .filter((c) => !hide.has(c.name.toLowerCase()))
      .filter((c) => sector === "all" || (sector === "exited" ? c.status === "exited" : c.sector === sector && c.status !== "exited"))
      .filter((c) => !needle || [c.name, c.description, c.geo, ...(c.investors || [])].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = val(a, sort.key), y = val(b, sort.key);
        return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * sort.dir;
      });
  }, [companies, sectors, hidden, extraHidden, q, sector, sort]);

  const th = (key: Key, label: string, cls = "") => (
    <th scope="col" className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "raised" || key === "last" || key === "checked" ? -1 : 1 }))}>
        {label}
        <span className="sort" aria-hidden>{sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="table-wrap">
      <div className="table-tools">
        <div className="chips" role="group" aria-label="Filter by orbit">
          {[{ id: "all", short: "All" }, ...sectors, { id: "exited", short: "Exits" }].map((s) => (
            <button key={s.id} type="button" aria-pressed={sector === s.id} onClick={() => setSector(s.id)}>
              {s.id !== "all" && (
                <span className="dot" style={{ background: s.id === "exited" ? "var(--brass)" : sectorVar(s.id) }} aria-hidden />
              )}
              {"short" in s ? s.short : ""}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Search companies, investors or cities</span>
          <input type="search" placeholder="Search companies, investors, cities" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {th("name", "Company")}
              {th("sector", "Orbit", "hide-s")}
              {th("stage", "Stage")}
              {th("raised", "Raised", "num")}
              {th("last", "Latest event", "hide-s")}
              {th("geo", "Based in", "hide-m")}
              {th("checked", "Checked", "hide-m")}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const ev = c.exit?.acquirer
                ? { text: `${c.exit.state === "announced" ? "Agreed sale to" : "Acquired by"} ${c.exit.acquirer}`, date: c.exit.date, src: c.exit.source }
                : c.lastRound?.amount
                ? { text: `${c.lastRound.amount}${c.lastRound.round ? ` ${c.lastRound.round}` : ""}`, date: c.lastRound.date, src: c.lastRound.source }
                : null;
              const isOpen = open === c.id;
              return (
                <tr key={c.id} className={isOpen ? "open" : ""}>
                  <td className="co">
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
                      <span className="dot" style={{ background: c.status === "exited" ? "var(--brass)" : sectorVar(c.sector) }} aria-hidden />
                      <span className="co-name">{c.name}</span>
                    </button>
                    <span className="co-desc">{c.description}</span>
                    {isOpen && (
                      <div className="co-more">
                        {c.note && <p>{c.note}</p>}
                        {c.investors?.length > 0 && <p><span className="lbl">Investors</span> {c.investors.join(", ")}</p>}
                        {c.aliases && c.aliases.length > 0 && <p><span className="lbl">Also known as</span> {c.aliases.join(", ")}</p>}
                        {c.status !== "tracking" && <p><span className="lbl">Status</span> {c.status === "exited" && c.exit?.state === "announced" ? "Being acquired" : STATUS_LABEL[c.status]}</p>}
                        <p>
                          {c.website && <a href={c.website} target="_blank" rel="noreferrer">{domain(c.website)}</a>}
                          {c.writeUp && <> <a href={c.writeUp} target="_blank" rel="noreferrer">My write-up</a></>}
                          {c.sources?.slice(0, 3).map((u) => (
                            <span key={u}> <a href={u} target="_blank" rel="noreferrer">Source: {domain(u)}</a></span>
                          ))}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="hide-s">{sectors.find((s) => s.id === c.sector)?.short}</td>
                  <td>{c.stage || <span className="muted">Not yet checked</span>}</td>
                  <td className="num" title={c.raisedBasis === "latest_round" ? "Latest round only; earlier rounds not yet totalled" : c.raisedBasis === "estimate" ? "Estimate" : undefined}>{c.raised ? raisedLabel(c) : <span className="muted">–</span>}</td>
                  <td className="hide-s">
                    {ev ? (
                      <>
                        {ev.src ? <a href={ev.src} target="_blank" rel="noreferrer">{ev.text}</a> : ev.text}
                        {ev.date && <span className="muted">, {month(ev.date)}</span>}
                      </>
                    ) : <span className="muted">–</span>}
                  </td>
                  <td className="hide-m">{c.geo}</td>
                  <td className="hide-m">{c.verifiedBy === "pending" ? <span className="muted">Pending</span> : shortDate(c.lastVerified)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">No companies match. Clear the search or pick another orbit.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
