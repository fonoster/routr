# Asset build doc: overview

**Artifact:** `overview-dark.png`, `overview-light.png` (this folder)
**Used on:** `concepts/architecture`
**Type:** diagram · component / architecture
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `v0dRvR` (dark), `RwO6B` (light) → "Docs / Architecture / Overview / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

Routr is a stateful SIP edge (EdgePorts) in front of stateless gRPC services: the Dispatcher, middlewares, processors, and the data services behind them.

## Sources

- CORE.md
- mods/one/src/runner.ts
- compose.yaml
- ops/charts/connect/templates

## Node / edge spec

Clients (softphones, WebRTC, PBXs, carriers) -> EDGE group (EdgePort 01, 02) -> Message Dispatcher -> PROCESSING group (middlewares RTPRelay, SimpleAuth; processors Connect, yours). Muted: processing -> Location Service, API Server; RTPRelay -> RTPEngine; Registry -> EdgePort. Pills: UDP/TCP/TLS/WS/WSS, gRPC, lookups and resources.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["v0dRvR", "RwO6B"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `overview-dark.png` / `overview-light.png`, copy here, and quantize (see `images/ASSETS.md`).
