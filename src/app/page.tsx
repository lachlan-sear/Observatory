import Orrery from "@/components/Orrery";
import CompanyTable from "@/components/CompanyTable";
import { Editions, Exits, Method, MoneyStrip, Orbits, ThisEdition, Where } from "@/components/Report";
import { getObservatory } from "@/lib/data";
import { sectorStyles } from "@/lib/format";
import { longDate, nextMonday, usd } from "@/lib/format";
import ThemeSwitch from "@/components/ThemeSwitch";

export const revalidate = 3600;

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "https://github.com/lachlan-sear/thesis-agent";
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);

export default async function Page() {
  const { data, live } = await getObservatory();
  const { thesis, companies, edition } = data;
  const active = companies.filter((c) => c.status !== "exited" && c.status !== "shut_down");
  const exits = companies.filter((c) => c.status === "exited");
  const capital = active.reduce((a, c) => a + (c.raisedUsdM || 0), 0);
  const pendingExits = exits.filter((c) => c.exit?.state === "announced").length;
  const cap = (n: number) => word(n).charAt(0).toUpperCase() + word(n).slice(1);
  const exitSentence = exits.length === 0
    ? "No exits yet."
    : pendingExits === exits.length
      ? `${cap(exits.length)} ${exits.length === 1 ? "has" : "have"} agreed to be acquired this year.`
      : `${cap(exits.length)} exited or agreed to be acquired this year.`;
  const ranked = [...active].sort((a, b) => (b.raisedUsdM || 0) - (a.raisedUsdM || 0));
  const topTwo = ranked.slice(0, 2);
  const topShare = capital ? Math.round(((topTwo[0]?.raisedUsdM || 0) + (topTwo[1]?.raisedUsdM || 0)) / capital * 100) : 0;
  const firstSentence = thesis.coreBelief.split(/(?<=\.)\s/)[0];
  const rest = thesis.coreBelief.slice(firstSentence.length).trim();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: sectorStyles(data.thesis.sectors) }} />
      <a className="skip" href="#companies">Skip to the company list</a>
      <header className="topbar">
        <div className="wrap topbar-in">
          <a className="wordmark" href="#top">The Observatory</a>
          <nav aria-label="Sections">
            <a href="#edition">This edition</a>
            <a href="#orbits">Orbits</a>
            <a href="#capital">Capital</a>
            <a href="#companies">Companies</a>
            <a href="#method">Method</a>
          </nav>
          <ThemeSwitch />
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-a">
              <p className="byline">A thesis map by {thesis.fund.replace(/^Reference instance \((.*)\)$/, "$1")}</p>
              <h1>{thesis.name}</h1>
              <p className="belief">{firstSentence}</p>
            </div>
            <div className="hero-b">
              {rest && <p className="belief-more">{rest}</p>}
              <p className="ledger">
                {active.length} companies across {word(thesis.sectors.length)} orbits, at least {usd(capital)} raised between
                them. {exitSentence}
              </p>
              {edition && (
                <p className="stamp">
                  <span className={live ? "live" : "snap"} aria-hidden />
                  Edition {edition.number}, {longDate(edition.date)}.{" "}
                  {edition.kind === "seed" ? "Checked by hand; weekly checks start once the scheduled run is switched on." : `Next check ${longDate(nextMonday(edition.date))}.`}
                  {!live && " Showing the bundled snapshot; the live data couldn't be reached."}
                </p>
              )}
            </div>
            <div className="hero-plate">
              <Orrery sectors={thesis.sectors} companies={companies} changes={data.changes} thesisName={thesis.name} editionDate={edition?.date} />
            </div>
          </div>
        </section>

        <section id="edition" className="band">
          <div className="wrap split">
            <div className="split-head">
              <h2>This edition</h2>
              <p>What changed since the last check, each line linked to the page that says so.</p>
            </div>
            <ThisEdition data={data} />
          </div>
        </section>

        <section id="orbits" className="band">
          <div className="wrap">
            <div className="split-head wide">
              <h2>The orbits</h2>
              <p>Each orbit is a sector in the thesis file. A fund with a different thesis gets different planets.</p>
            </div>
            <Orbits companies={companies} sectors={thesis.sectors} />
          </div>
        </section>

        <section id="capital" className="band">
          <div className="wrap split">
            <div className="split-head">
              <h2>Where the money sits</h2>
              <p>
                {topTwo.length === 2
                  ? `${topTwo[0].name} and ${topTwo[1].name} hold ${topShare}% of the capital recorded on the map. The log scale keeps the seed and Series A companies, where the thesis is aimed, readable beside them.`
                  : "Each dot is a company, placed by capital raised on a log scale."}
              </p>
            </div>
            <MoneyStrip companies={companies} sectors={thesis.sectors} />
          </div>
          <div className="wrap split">
            <div className="split-head">
              <h3>Where they&apos;re built</h3>
            </div>
            <Where companies={companies} sectors={thesis.sectors} />
          </div>
          <div className="wrap split">
            <div className="split-head">
              <h3>Exits</h3>
            </div>
            <Exits companies={companies} />
          </div>
        </section>

        <section id="companies" className="band">
          <div className="wrap">
            <div className="split-head wide">
              <h2>Every company</h2>
              <p>Sort any column. Open a row for the note, the investors and the sources.</p>
            </div>
            <CompanyTable companies={companies} sectors={thesis.sectors} />
            {data.candidates.length > 0 ? (
              <div className="radar">
                <h3>On the radar</h3>
                <p className="fine">Scout&apos;s shortlist from the latest run. Candidates are reviewed by a person before they join the map.</p>
                <ul>
                  {data.candidates.slice(0, 8).map((c) => (
                    <li key={c.name}><strong>{c.name}</strong> {c.oneLiner} <span className="muted">Scored {c.score}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="fine radar-empty">Scout&apos;s first shortlist of new candidates arrives with the first scheduled run.</p>
            )}
          </div>
        </section>

        <section id="method" className="band">
          <div className="wrap split">
            <div className="split-head">
              <h2>How it stays current</h2>
              <p>The model proposes; the source decides. A change is applied only when the page it cites says so, and anything else waits for me to check.</p>
            </div>
            <Method data={data} />
          </div>
          <div className="wrap split">
            <div className="split-head">
              <h3>Make your own map</h3>
            </div>
            <div className="fork">
              <p>
                Everything here comes from one file of interests. If you&apos;d like a map of your own, fork the engine,
                add a model key (Anthropic, OpenAI or OpenRouter), rewrite <code>config/thesis.yaml</code> with your own
                orbits, and point a copy of this page at your fork&apos;s <code>data/observatory.json</code>.
              </p>
              <p><a className="primary" href={ENGINE_URL}>thesis-agent on GitHub</a></p>
            </div>
          </div>
          <div className="wrap split">
            <div className="split-head">
              <h3>Editions</h3>
            </div>
            <Editions data={data} />
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <p>Built by <a href="https://www.linkedin.com/in/lachlan-sear-41b84b131/">Lachlan Sear</a>. Figures are public reports, linked at source; nothing here is investment advice.</p>
          <ThemeSwitch />
        </div>
      </footer>
    </>
  );
}
