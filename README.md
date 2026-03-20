# The Observatory

A live, interactive solar system mapping 47 companies across European and US venture — built to visualise deal flow the way an investor actually thinks about it.

**[→ observatory.lachlansear.com](https://observatory.lachlansear.com)**

---

## What This Is

The Observatory is a Three.js visualisation that renders my deal flow tracker as a solar system. Each planet represents a sector — Vertical AI, Horizontal AI, AI Infrastructure, Deep Tech & Defence — and the companies I'm tracking orbit as moons. Benchmark-tier companies glow gold. Click a planet to zoom into a vertical. Click a moon to see the company.

The data is pulled live from a separate tracker API, so the Observatory updates automatically whenever the underlying pipeline changes. One source of truth, two interfaces — a sortable table for analysis, a solar system for pattern recognition.

## Why I Built It

Most deal flow trackers are spreadsheets. They're useful for sorting and filtering but they flatten the landscape into rows. You lose the shape of the market — which verticals are crowded, where the gaps are, how companies cluster geographically.

The Observatory exists to see the landscape rather than just read it. It's the visual layer over a thesis I've been developing on vertical AI in regulated industries — the argument that the same AI problem recurs across healthcare, legal, dental, and veterinary, and that domain expertise and regulatory complexity create moats that horizontal wrappers can't replicate.

## The Thesis

**Same Problem, Different Waiting Room** — vertical AI companies win in regulated industries not through better models, but through deeper domain integration, proprietary data flywheels, and the compliance burden that keeps generalist competitors out.

→ [Read the full thesis on lachlansear.com](https://lachlansear.com/same-problem-different-waiting-room)

## Architecture

- **Frontend**: Next.js, Three.js, deployed on Vercel
- **Data**: Fetched at runtime from a public API endpoint on the tracker
- **Design system**: Lora serif headings, IBM Plex Sans body, dark space aesthetic with gold (#D4A574) for Benchmark-tier companies

## Related

- [lachlansear.com](https://lachlansear.com) — Investment writing, case studies, thesis development
- [tracker.lachlansear.com](https://tracker.lachlansear.com) — Full deal flow tracker (access on request)

---

Built by [Lachlan Sear](https://www.linkedin.com/in/lachlan-sear-41b84b131/).
