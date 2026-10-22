# Asset build doc: resources

**Artifact:** `resources-dark.png`, `resources-light.png` (this folder)
**Used on:** `concepts/connect-mode`
**Type:** diagram · entity relationship
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `TDPvG` (dark), `EJlv4` (light) → "Docs / Connect mode / Resources / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

The seven Connect resources point at each other by ref.

## Sources

- CONNECT.md
- mods/connect/src/access.ts
- mods/connect/src/router.ts

## Node / edge spec

Domain group (Agents) <- aorLink - Number; Domain egressPolicies -> Number; Number -> Trunk (trunkRef); Domain, Peer -> Credentials; Trunk -> Credentials; Domain, Trunk -> ACL (accessControlListRef). Note: Connect enforces the Trunk ACL allow list today.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["TDPvG", "EJlv4"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `resources-dark.png` / `resources-light.png`, copy here, and quantize (see `images/ASSETS.md`).
