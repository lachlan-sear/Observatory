# The Observatory

A map of the companies in an investment thesis, drawn as an orrery and kept
current by [thesis-agent](https://github.com/lachlan-sear/thesis-agent)'s
weekly run. **[observatory.lachlansear.com](https://observatory.lachlansear.com)**

- **The sun** is the thesis. Each **orbit** is a sector named in the thesis
  file, and each **planet** carries its companies as moons.
- **Moon size** is capital raised, on a log scale. A hollow moon is a company
  awaiting its first check.
- **A teal pulse** marks a round recorded in this edition.
- **The brass ring** holds exits. A company that exited this edition travels
  there from its sector on load.
- Below the map: this edition's changes (each linked to its source), the
  orbits, where the money sits, where the companies are built, exits, a
  sortable list of every company, the method, and the archive of editions.

## Data

The page reads one file, `data/observatory.json`, published by thesis-agent.
It revalidates hourly, so a Monday run shows up within the hour without a
redeploy. If the fetch fails, it serves `src/data/snapshot.json` and says so
on the page.

| Env var | Purpose |
|---|---|
| `OBSERVATORY_DATA_URL` | Where to read `observatory.json`. Default: the reference instance's raw GitHub URL. |
| `OBSERVATORY_DATA_TOKEN` | Read-only GitHub token. Only needed if your engine repo is private. |
| `OBSERVATORY_FRAME_ANCESTORS` | Sites allowed to frame `/embed`. Default: lachlanbuilds.com. |
| `NEXT_PUBLIC_ENGINE_URL` | The engine link in "Run it on your thesis". |

To run it for your own fund, set `OBSERVATORY_DATA_URL` to your fork's file.
Nothing in the code is specific to one thesis.

## Looks

Three themes, switched from the top bar or the footer and remembered per browser:
**Paper** (the default), and **Deep Space** and **Discovery** from Lachie's TV
design system (Jost titles, Inter, IBM Plex Mono readouts, a Gargantua sun,
2049 haze). `?theme=deepspace` on any address sets it; `NEXT_PUBLIC_DEFAULT_THEME`
changes the default for everyone.

## Embedding (the desks)

`/embed` shows the orrery and the company list with no page chrome. It may be
framed only by the hosts in `OBSERVATORY_FRAME_ANCESTORS`. A host page can
hide a reader's own portfolio in either of two ways:

```html
<iframe src="https://observatory.lachlansear.com/embed?hide=Acme,Example"></iframe>
<script>
  frame.contentWindow.postMessage({ type: "observatory:hide", names: ["Acme"] }, "*");
</script>
```

`/api/observatory` returns the same JSON, with CORS open.

## Develop

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build
```

Next.js 16 (App Router), React 19 and a 2D canvas, with no chart or 3D
libraries. The type is Newsreader and Onest, and the colour tokens match the
desks. Motion follows `prefers-reduced-motion`, and the animation pauses
off-screen and in background tabs.
