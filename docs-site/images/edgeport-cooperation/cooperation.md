# Asset build doc: cooperation

**Artifact:** `cooperation-dark.png`, `cooperation-light.png` (this folder)
**Used on:** `concepts/edgeport-cooperation`
**Type:** diagram · flow with numbered steps
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `QkXZx` (dark), `WrUXr` (light) → "Docs / EdgePort cooperation / Cooperation / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

An INVITE that lands on edgeport-01 for an endpoint connected to edgeport-02 is forwarded there with a Route header and X-Edgeport-Ref.

Footnote text: "Peer EdgePorts must be in trustedEdgePortAddresses (the Helm chart lists its own). No SIP load balancer is needed. If an EdgePort goes away, its clients re-register through another one."

## Sources

- internal/connect/request.go (`toPeerEdgePort`)
- mods/processor/src/alterations.ts and pkg/processor, the functions Connect applies toward
  the peer (`/reference/alterations-api#dialogs-across-edgeports`): addSelfVia,
  addSelfRecordRouteToPeer, addRouteToNextHop, addRouteToPeerEdgePortOwnAddress,
  addXEdgePortRef, decreaseMaxForwards
- internal/location (the route's edgePortRef)
- connect.yaml `spec.trustedEdgePortAddresses` (Helm: `connect.trustedEdgePortAddresses`,
  the EdgePorts' headless Service by default)

## Node / edge spec

1 Alice -> edgeport-01; 2 MessageRequest -> Connect; 3 Connect -> Location (bob -> edgeport-02); 4 response adds Route to edgeport-02; 5 INVITE + Route + X-Edgeport-Ref -> edgeport-02; 6 edgeport-02 -> Connect (trusted peer, no new routing); 7 -> Bob over the existing connection.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["QkXZx", "WrUXr"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `cooperation-dark.png` / `cooperation-light.png`, copy here, and quantize (see `images/ASSETS.md`).
