import type { Company, ObservatoryData, Sector } from "@/lib/types";
import { domain, longDate, month, nextMonday, raisedLabel, sectorVar, shortDate, usd } from "@/lib/format";

/* ---------- Money: one row per orbit, each company a dot on a log scale ---------- */

export function MoneyStrip({ companies, sectors }: { companies: Company[]; sectors: Sector[] }) {
  const W = 1000, padL = 170, padR = 30, top = 20;
  const min = 1, max = 3000;
  const x = (m: number) => padL + ((Math.log10(Math.max(min, m)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * (W - padL - padR);
  const ticks = [1, 10, 100, 1000];
  // Label every company: lanes above and below the line, first lane that has room.
  const LANES = [-14, 28, -38, 52, -62, 76];
  const charW = 7.4;
  const rows = sectors.map((s) => {
    const list = companies
      .filter((c) => c.sector === s.id && c.raisedUsdM)
      .sort((a, b) => (a.raisedUsdM || 0) - (b.raisedUsdM || 0));
    const used: [number, number][][] = LANES.map(() => []);
    const placed = list.map((c) => {
      const cx = x(c.raisedUsdM!);
      const w = c.name.length * charW;
      let lx = Math.min(Math.max(cx, padL + w / 2), W - padR - w / 2 + 20);
      let lane = 0;
      for (; lane < LANES.length; lane++) {
        const [l, r] = [lx - w / 2 - 6, lx + w / 2 + 6];
        if (!used[lane].some(([a, b]) => l < b && r > a)) break;
      }
      if (lane === LANES.length) { lane = LANES.length - 1; lx = cx; }
      used[lane].push([lx - w / 2 - 6, lx + w / 2 + 6]);
      return { c, cx, lx, lane };
    });
    const lanesUsed = Math.max(0, ...placed.map((p) => p.lane));
    const above = Math.max(18, ...placed.filter((p) => LANES[p.lane] < 0).map((p) => -LANES[p.lane] + 14));
    const below = Math.max(26, ...placed.filter((p) => LANES[p.lane] > 0).map((p) => LANES[p.lane] + 6));
    return { s, placed, above, below, lanesUsed,
      pending: companies.filter((c) => c.sector === s.id && !c.raisedUsdM && c.status !== "exited").length };
  });
  let y = top;
  const layout = rows.map((r) => { const cy = y + r.above; y = cy + r.below + 14; return { ...r, cy }; });
  const H = y + 24;
  return (
    <figure className="money">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Capital raised per company by orbit, on a logarithmic scale from one million to three billion dollars">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 28} className="grid" />
            <text x={x(t)} y={H - 8} textAnchor="middle" className="tick">{t >= 1000 ? `$${t / 1000}B` : `$${t}M`}</text>
          </g>
        ))}
        {layout.map(({ s, placed, cy, pending }) => (
          <g key={s.id}>
            <text x={0} y={cy + 5} className="row-label">{s.short}</text>
            {pending > 0 && <text x={0} y={cy + 22} className="row-sub">{pending} without figures</text>}
            <line x1={padL} x2={W - padR} y1={cy} y2={cy} className="baseline" />
            {placed.map(({ c, cx, lx, lane }) => {
              const exited = c.status === "exited";
              const dy = LANES[lane];
              return (
                <g key={c.name}>
                  {(Math.abs(dy) > 28 || Math.abs(lx - cx) > 4) && (() => {
                    // run the leader to the near edge of the label, not through it
                    const w = c.name.length * charW;
                    const ex = Math.min(Math.max(cx, lx - w / 2), lx + w / 2);
                    return <line x1={cx} y1={cy + (dy < 0 ? -7 : 7)} x2={ex} y2={cy + dy + (dy < 0 ? 5 : -13)} className="leader" />;
                  })()}
                  {c.raisedBasis === "latest_round" ? (
                    <circle cx={cx} cy={cy} r={5.5} style={{ fill: "var(--paper)", stroke: exited ? "var(--brass)" : sectorVar(s.id) }} strokeWidth={2}>
                      <title>{`${c.name}: ${raisedLabel(c)} (latest round only)`}</title>
                    </circle>
                  ) : (
                    <circle cx={cx} cy={cy} r={exited ? 6.5 : 6} style={{ fill: exited ? "var(--brass)" : sectorVar(s.id), stroke: "var(--paper)" }} strokeWidth={1.5}>
                      <title>{`${c.name}: ${raisedLabel(c)} raised${exited ? " (exit)" : ""}`}</title>
                    </circle>
                  )}
                  <text x={lx} y={cy + dy} textAnchor="middle" className={exited ? "dot-label exited" : "dot-label"}>{c.name}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <figcaption>Total disclosed capital raised, converted to dollars at approximate rates for placement only. Hollow dots are the latest round alone, where earlier rounds aren&apos;t yet totalled; brass dots are exits. Hover a dot for the figure as reported.</figcaption>
      <ul className="money-list" aria-label="Capital raised by company">
        {sectors.map((s) => (
          <li key={s.id}>
            <span className="ml-sector"><span className="dot" style={{ background: sectorVar(s.id) }} aria-hidden />{s.short}</span>
            <span className="ml-items">
              {companies.filter((c) => c.sector === s.id && c.raisedUsdM)
                .sort((a, b) => (b.raisedUsdM || 0) - (a.raisedUsdM || 0))
                .map((c) => `${c.name} ${raisedLabel(c)}`).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ---------- Where: cities by count ---------- */

export function Where({ companies: all, sectors }: { companies: Company[]; sectors: Sector[] }) {
  const companies = all.filter((c) => c.status !== "exited" && c.status !== "shut_down");
  const byCity = new Map<string, Company[]>();
  companies.forEach((c) => {
    const k = c.geo || "Unknown";
    byCity.set(k, [...(byCity.get(k) || []), c]);
  });
  const rows = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const maxN = rows[0]?.[1].length || 1;
  const europe = companies.filter((c) => !/, US$|Israel/.test(c.geo || "")).length;
  return (
    <div className="where">
      <p className="lede-sm">
        {europe} of {companies.length} are built in the UK or Europe. London leads with {byCity.get("London, UK")?.length || 0}.
      </p>
      <ol className="bars">
        {rows.map(([city, list]) => (
          <li key={city}>
            <span className="bar-label">{city.replace(", UK", "").replace(", US", ", US")}</span>
            <span className="bar-track" aria-hidden>
              {list.map((c) => (
                <span key={c.name} className="bar-seg" title={c.name}
                  style={{ width: `${100 / maxN}%`, background: c.status === "exited" ? "var(--brass)" : sectorVar(c.sector) }} />
              ))}
            </span>
            <span className="bar-n">{list.length}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- This edition ---------- */

export function ThisEdition({ data }: { data: ObservatoryData }) {
  const e = data.edition;
  if (!e) return <p>The first weekly run hasn&apos;t published yet.</p>;
  return (
    <div className="edition">
      {e.note && <p className="lede-sm">{e.note}</p>}
      <ol className="changes">
        {data.changes.map((c) => (
          <li key={c.company + c.kind}>
            <span className={`kind kind-${c.kind}`}>{c.kind === "exit" ? "Exit" : c.kind === "round" ? "Round" : c.kind === "shutdown" ? "Shut down" : "Note"}</span>
            <span className="ch-head">{c.headline}</span>
            <span className="ch-meta">
              <span className="dot" style={{ background: c.kind === "exit" ? "var(--brass)" : sectorVar(c.sector) }} aria-hidden />
              {month(c.date)}
              {c.source && <> <a href={c.source} target="_blank" rel="noreferrer">{domain(c.source)}</a></>}
            </span>
          </li>
        ))}
      </ol>
      <p className="fine">
        {e.kind === "seed"
          ? `Checked by hand on ${longDate(e.date)}. Weekly checks take over once the scheduled run is switched on.`
          : e.kind === "manual"
            ? `All ${e.checked} companies checked by hand on ${longDate(e.date)}, each change matched to its source. The scheduled run takes over from ${longDate(nextMonday(e.date))}.`
            : `${e.checked} companies checked on ${longDate(e.date)}; ${e.applied} changes applied, ${e.held} held for a human because their source didn't say so.`}
      </p>
    </div>
  );
}

/* ---------- Orbits ---------- */

export function Orbits({ companies, sectors }: { companies: Company[]; sectors: Sector[] }) {
  return (
    <div className="orbits">
      {sectors.map((s) => {
        const list = companies.filter((c) => c.sector === s.id && c.status !== "exited");
        const cap = list.reduce((a, c) => a + (c.raisedUsdM || 0), 0);
        return (
          <article key={s.id} className="orbit">
            <h3><span className="dot" style={{ background: sectorVar(s.id) }} aria-hidden />{s.name}</h3>
            <p>{s.description}</p>
            <p className="orbit-facts">
              {list.length} companies{cap > 0 && `, ${usd(cap)} raised`}
            </p>
            <p className="orbit-names">{list.map((c) => c.name).join(", ")}</p>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- Exits ---------- */

export function Exits({ companies }: { companies: Company[] }) {
  const exits = companies.filter((c) => c.status === "exited");
  if (!exits.length) return <p className="lede-sm">No exits recorded yet. When the weekly run finds one, the company moves to the brass ring.</p>;
  return (
    <ul className="exits">
      {exits.map((c) => (
        <li key={c.name}>
          <span className="ex-name">{c.name}</span>
          <span className="ex-arrow" aria-hidden>to</span>
          <span className="ex-acq">{c.exit?.acquirer || "Undisclosed"}</span>
          <span className="ex-meta">
            {c.exit?.type === "ipo" ? "Listing" : "Acquisition"}
            {c.exit?.state === "announced" ? ", agreed and pending completion" : c.exit?.state ? `, ${c.exit.state}` : ""}, {month(c.exit?.date)}. {c.exit?.value && c.exit.value !== "Not disclosed" ? `${c.exit.value}. ` : "Terms not disclosed. "}
            {c.exit?.source && <a href={c.exit.source} target="_blank" rel="noreferrer">{domain(c.exit.source)}</a>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Method ---------- */

export function Method({ data }: { data: ObservatoryData }) {
  const live = data.companies.filter((c) => c.status !== "exited");
  const pending = live.filter((c) => c.verifiedBy === "pending").length;
  return (
    <div className="method">
      <ol className="flow">
        <li>
          <h4>One interests file</h4>
          <p>A belief, the orbits, the signals worth trusting, how to score, and any companies to leave off. Swap the file and every step below re-orients.</p>
        </li>
        <li>
          <h4>Refresh, each week</h4>
          <p>Each tracked company is searched for a new round, an exit or a shutdown since it was last checked. Pending names get their first figures.</p>
        </li>
        <li>
          <h4>Source check</h4>
          <p>A change is applied only if the page it cites states the amount or the acquirer right next to the company&apos;s name. Anything else is held for a person{data.heldForReview ? `; ${data.heldForReview} are held now` : ""}.</p>
        </li>
        <li>
          <h4>Scout and radar</h4>
          <p>Web searches shaped by the interests file, plus up to twelve other sources (some need a free key), find new candidates and score them on its rubric. They go to an inbox, never straight into the map.</p>
        </li>
        <li>
          <h4>Publish</h4>
          <p>The tracker and a dated edition are committed to the repository. This page reads them within the hour.</p>
        </li>
      </ol>
      <dl className="method-facts">
        <div><dt>Schedule</dt><dd>{data.method.schedule}</dd></div>
        {data.audit && (
          <div><dt>Figures matched to their source</dt><dd>{data.audit.passed} of {data.audit.checked}, {shortDate(data.audit.date)}{data.audit.unreadable ? ` (${data.audit.unreadable} source${data.audit.unreadable === 1 ? "" : "s"} couldn't be fetched)` : ""}</dd></div>
        )}
        {pending > 0 && <div><dt>Awaiting first check</dt><dd>{pending} of {live.length}</dd></div>}
        <div><dt>Lenses applied to new candidates</dt><dd>{data.thesis.lenses.join(", ")}</dd></div>
        <div><dt>Data published</dt><dd>{shortDate(data.generatedAt)}</dd></div>
      </dl>
    </div>
  );
}

export function Editions({ data }: { data: ObservatoryData }) {
  return (
    <ol className="editions" reversed>
      {data.editions.map((e) => (
        <li key={e.number}>
          <span className="ed-no">Edition {e.number}</span>
          <span className="ed-date">{longDate(e.date)}</span>
          <span className="ed-sum">{e.kind === "seed" ? "Re-oriented to the current thesis" : e.kind === "manual" ? `${e.checked} checked by hand, ${e.applied} changes` : `${e.checked} checked, ${e.applied} applied, ${e.held} held`}</span>
          {e.headlines.length > 0 && <span className="ed-heads">{e.headlines.join(". ")}.</span>}
        </li>
      ))}
    </ol>
  );
}
