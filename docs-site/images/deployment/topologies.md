# Asset build doc: topologies

**Artifact:** `topologies-dark.png`, `topologies-light.png` (this folder)
**Used on:** `concepts/deployment-topologies`
**Type:** diagram · component / comparison
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `iqHO6` (dark), `fSZgB` (light) → "Docs / Deployment / Topologies / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

Same services, two packages: routr-one on Docker, routr-connect Helm chart on Kubernetes.

## Sources

- Dockerfile
- mods/one/src/runner.ts
- ops/charts/connect/values.yaml and templates

## Node / edge spec

Docker group: routr-one (EdgePort, Dispatcher, Connect, Location, API Server, PostgreSQL, RTPRelay optional), RTPEngine optional, data volume. Kubernetes group: EdgePort StatefulSet; Dispatcher, Connect, Location, API Server, RTPRelay (Deployment + autoscaling), Requester + Registry; PostgreSQL and Redis subcharts.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["iqHO6", "fSZgB"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `topologies-dark.png` / `topologies-light.png`, copy here, and quantize (see `images/ASSETS.md`).
