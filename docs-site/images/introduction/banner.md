# Asset build doc: banner

**Artifact:** `banner-dark.png`, `banner-light.png` (this folder)
**Used on:** `introduction`
**Type:** diagram · banner 1600 x 600
**Preset:** 1600 x 600, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `YmAoP` (dark), `o8VhK3` (light) → "Docs / Introduction / Banner / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

Routr: the programmable SIP server for the cloud.

## Sources

- README.md
- docs/docs/overview/introduction.md

## Node / edge spec

Copy (eyebrow, title, lede) left; mini flow right: SIP traffic -> EdgePort -> Dispatcher -> Connect processor. Dark frame uses ./assets/pattern-hero.png; light hides it.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["YmAoP", "o8VhK3"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `banner-dark.png` / `banner-light.png`, copy here, and quantize (see `images/ASSETS.md`).
