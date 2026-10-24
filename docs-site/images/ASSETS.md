# Docs assets

Every diagram under `docs-site/images/` is drawn in `designs/docs.pen` and exported here as a dark/light
PNG pair. Screenshots copied from the old Docusaurus site (`docs/static/img`) are marked as such.

| Asset | Page | Pencil frame | Size | Build doc |
| ----- | ---- | ------------ | ---- | --------- |
| `architecture/overview-dark.png`, `overview-light.png` | `concepts/architecture` | "Docs / Architecture / Overview / Dark" (v0dRvR), "… / Light" (RwO6B) | 1600 x 900, 2x | `images/architecture/overview.md` |
| `message-flow/flow-dark.png`, `flow-light.png` | `concepts/message-flow` | "Docs / Message flow / Flow / Dark" (Y5VST), "… / Light" (BUIQD) | 1600 x 900, 2x | `images/message-flow/flow.md` |
| `edgeport-cooperation/cooperation-dark.png`, `cooperation-light.png` | `concepts/edgeport-cooperation` | "Docs / EdgePort cooperation / Cooperation / Dark" (QkXZx), "… / Light" (WrUXr) | 1600 x 900, 2x | `images/edgeport-cooperation/cooperation.md` |
| `connect-mode/resources-dark.png`, `resources-light.png` | `concepts/connect-mode` | "Docs / Connect mode / Resources / Dark" (TDPvG), "… / Light" (EJlv4) | 1600 x 900, 2x | `images/connect-mode/resources.md` |
| `routing/routing-types-dark.png`, `routing-types-light.png` | `concepts/routing` | "Docs / Routing / Routing types / Dark" (uuQsX), "… / Light" (e6qLOC) | 1600 x 900, 2x | `images/routing/routing-types.md` |
| `load-balancing/algorithms-dark.png`, `algorithms-light.png` | `concepts/load-balancing` | "Docs / Load balancing / Algorithms / Dark" (Nm75k), "… / Light" (Y44C9) | 1600 x 900, 2x | `images/load-balancing/algorithms.md` |
| `deployment/topologies-dark.png`, `topologies-light.png` | `concepts/deployment-topologies` | "Docs / Deployment / Topologies / Dark" (iqHO6), "… / Light" (fSZgB) | 1600 x 900, 2x | `images/deployment/topologies.md` |
| `introduction/banner-dark.png`, `banner-light.png` | `introduction` | "Docs / Introduction / Banner / Dark" (YmAoP), "… / Light" (o8VhK3) | 1600 x 600, 2x | `images/introduction/banner.md` |

Screenshots reused from `docs/static/img` (not in Pencil): `quickstart/*`, `home-or-office-setup/*`,
`secure-the-server/*`, `call-events-with-nats/*`.

Terminal screens of `rctl trace replay` (`record-and-replay/*`, page `guides/record-and-replay-calls`) are
rendered from the viewer's own painter on the corpus recordings `seet-agent-1001` and `seet-agent-1002`
(SIPconnect 1.1 test 1.3.1), at 120 columns, dark palette except `ladder-light.png`. `replay.gif` is the
960x540 cut of the trace viewer reel. The screens follow `designs/trace-viewer.pen`.

## Diagram Kit

`designs/docs.pen` → "Docs / Diagram Kit" (fdbKR), Routr v1. Reusable components: Diagram/Node (sEKX6),
Diagram/Node Accent (pifOQ), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo),
Diagram/Arrow D (AdWAH), Diagram/Group (np3qG), Brand/Logo (pGzyo, from `designs/assets/logo-dark.svg`).
Type: Poppins for labels, Roboto Mono for pills and chips (same as routr.io).

Variables (`mode` theme, dark / light):

| Variable | Dark | Light | Use |
| --- | --- | --- | --- |
| `rt-bg` | `#181818` | `#FFFFFF` | diagram frame |
| `rt-surface` | `#202020` | `#F4F4F4` | node fill |
| `rt-group` | `#1C1C1C` | `#FAFAFA` | group fill |
| `rt-border` | `#333333` | `#E8E8E8` | borders |
| `rt-text` | `#FFFFFF` | `#252525` | titles |
| `rt-text-muted` | `#C2C2C2` | `#6B6B6B` | sub-labels, notes |
| `rt-accent` | `#5FCFCE` | `#1F8F8E` | signaling path, accent nodes |
| `rt-accent-soft` | `#202020` | `#F4F4F4` | accent node fill, chips (neutral; the accent is the border) |
| `rt-on-accent` | `#001A1A` | `#FFFFFF` | text on accent |
| `rt-edge` | `#6B6B6B` | `#C2C2C2` | secondary edges |
| `rt-warn` | `#F5B85A` | `#B4690E` | warning callout |

The page look (topbar, tabs, sidebar, content, code block, callouts, table of contents) is in
"Docs / Look / Page template / Dark" (V66XIE) and "… / Light" (yaHbg). `docs.json` and `style.css` follow it.

## Export recipe

1. With `designs/docs.pen` active in Pen, run `Export([...ids], "png", "<scratch dir>", { scale: 2 })`
   through the Pencil MCP `execute` tool.
2. Rename each `<nodeId>.png` to `<name>-dark.png` / `<name>-light.png` and copy it into its folder.
3. Quantize to keep pages light (about 75 KB per image instead of 350 KB):

   ```bash
   python3 -c "from PIL import Image; import sys; [Image.open(f).convert('RGBA').quantize(256, method=Image.Quantize.FASTOCTREE).save(f, optimize=True) for f in sys.argv[1:]]" images/*/*-dark.png images/*/*-light.png
   ```
