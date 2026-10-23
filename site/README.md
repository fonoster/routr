# routr.io

The marketing site. Plain HTML + CSS + JS, the same approach as fonoster.com, deployed to GitHub Pages by `.github/workflows/gh-pages.yaml` together with the docs build (everything in `site/` except this README).

- Designs: `designs/website.pen` (frames: Home / Desktop, Home / Mobile, 404 / Desktop, Share Image, Components, Color Palette). The site is coded from them.
- Pages: `index.html` (home) and `404.html` (absolute paths, since GitHub Pages serves it at any missing URL; it replaces the one the docs build writes).
- Docs live at `/docs`, built by Docusaurus from `docs/` in the same workflow. The docs build writes `assets/` with hashed file names, so the site's `assets/css`, `assets/js` and `assets/img` merge into the same folder without collisions.
- SEO: canonical + Open Graph tags (`assets/img/og.png`, exported from the "Share Image" frame in Pencil). `robots.txt` and `sitemap.xml` come from the docs build.
- Analytics: Google Analytics `G-JX93S6PKN4` in every page head (same property as the docs).

## Preview locally

```sh
python3 -m http.server 8080 -d site
# open http://localhost:8080/
```

## Structure

| Path | What |
| --- | --- |
| `assets/css/v1.css` | The fonoster.com foundation (tokens, nav, atmosphere, numbers, pipeline, code windows, deploy cards, final CTA, footer, reveal) followed by Routr's own sections. Teal accent tokens override the green ones. |
| `assets/js/v1.js` | Preferences (theme), nav, reveals, odometers, typed terminals, and the three Routr boards listed below |
| `assets/js/notice.js` | The notice bar above the nav: automatic release announcements, star count, on/off |
| `assets/img/icons.svg` | Lucide icon sprite (ISC), from `lucide-static@0.453.0`, plus the symbols Routr adds at the end |
| `assets/img/fonoster-*.{png,svg}` | Fonoster wordmark for the dark and light themes |

## Notice bar

The strip above the nav comes from `assets/js/notice.js`. It has two modes, picked with `NOTICE.mode` at the top of the file:

- `release` (default): announces the latest GitHub release with no manual step. The script reads `github.com/fonoster/routr/releases/latest`, shows "Routr vX.Y.Z is out. Published N days ago. See the release notes →" while the release is younger than `NOTICE.maxAgeDays` (45), and links to the release page. The response is cached in `localStorage` for an hour so repeat visits draw the bar before the nav. The same call refreshes the GitHub star count in the nav (`[data-stars]`). If the API is unreachable on a first visit, the bar stays hidden.
- `static`: a hand-written message from `NOTICE.static` (lead, text, cta, link). In `text`, `[...]` is hidden on phones.
- `show: false` hides it on every page.

Every page loads the file as the first thing in `<body>`, so the bar is drawn before the nav. Keep it that way when adding a page.

## Motion

Same rules as fonoster.com:

1. **One ambient loop per screen at most.** Everything else plays once, or on hover.
2. **Only `transform`, `opacity`, and the light wave's mask position.** The boards also toggle colors on chips and dots.
3. **Pause what you can't see.** Loops stop offscreen and in background tabs.
4. **`prefers-reduced-motion: reduce`** turns off loops and reveals and shows the final state.
5. **Teal stays reserved for CTAs and the active node.** Status colors (green ok, red down) appear only inside the boards.

| # | Where | What | Trigger | Timing |
| --- | --- | --- | --- | --- |
| 1 | Hero, final CTA, 404 | A single soft line of light sweeps across the dot grid | Once 0.8s after load, then repeats; paused offscreen | Heroes: 4.5s sweep every 12s. Final CTA: 2.2s every 10s |
| 2 | Hero SIP trace | The INVITE prints line by line and the path chip it reaches lights up, Softphone → Trunk; after 200 OK it holds, then replays | Loop, paused offscreen | 420ms per line, 3.2s hold |
| 3 | Numbers row | Odometer roll of each digit | Once, on enter | 1.4s, 80ms stagger |
| 4 | Architecture flow | A pulse travels Endpoints → EdgePort → Dispatcher → Middlewares → Processor, lighting each step | Loop, paused offscreen | 6s cycle |
| 5 | Connect window | The terminal types `rctl numbers create -f number.yaml`, then prints `✔ number-01 created` | Once, on enter | 28ms/char |
| 6 | Scale hop board | The log prints line by line while the active EdgePort/service chip lights up, ending on 1002 | Once, on enter | 450ms per line |
| 7 | Resilience failover board | edgeport-02 goes red, status turns amber and "2 / 3", the four events print, then the pod comes back green and "3 / 3" | Once, on enter | 0.6s, 1.4s, 2.2s, 3.2s |
| 8 | Programmable window | The terminal types `npm run start:echo`, then prints the listening line | Once, on enter | 28ms/char |
| 9 | Section content | Fade up 12px, staggered | Once, on enter | 600ms, 60ms stagger |
| 10 | Buttons, cards, links | Lift 1–2px, brighten, arrow nudge | Hover / focus | 150ms |
| 11 | Nav | Background blur and divider fade in after scrolling | Scroll | 240ms |

## Open items

- "Get started", "Learn more about Connect" and "Build a Processor" point at `/docs`; deep-link them once the docs URLs settle (the current docs are versioned under `/docs/2.11.5/...`).
- The light theme works but hasn't been reviewed by design.
- Keep the shared foundation of `v1.css` in sync with fonoster.com by hand when its tokens or components change.
