# Asset build doc: routing-types

**Artifact:** `routing-types-dark.png`, `routing-types-light.png` (this folder)
**Used on:** `concepts/routing`
**Type:** diagram · flow (five rows)
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `uuQsX` (dark), `e6qLOC` (light) → "Docs / Routing / Routing types / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

Connect picks one of five routing types from who calls and who is called.

## Sources

- CONNECT.md
- mods/connect/src/router.ts

## Node / edge spec

agent-to-agent: Agent -> Agent; agent-to-pstn: Agent -> Number + Trunk (egressPolicies) -> PSTN; from-pstn: PSTN -> Trunk + Number (aorLink) -> Agent or Peer; peer-to-pstn: Peer -> Number + Trunk (X-DOD-Number) -> PSTN; agent-to-peer: Agent -> Peer.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["uuQsX", "e6qLOC"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `routing-types-dark.png` / `routing-types-light.png`, copy here, and quantize (see `images/ASSETS.md`).
