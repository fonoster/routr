# Asset build doc: flow

**Artifact:** `flow-dark.png`, `flow-light.png` (this folder)
**Used on:** `concepts/message-flow`
**Type:** diagram · flow (two lanes)
**Preset:** 1600 x 900, exported at 2x and quantized to 256 colors
**Diagram Kit version:** Routr v1 (`designs/docs.pen` → "Docs / Diagram Kit", fdbKR)
**Pencil node id:** `Y5VST` (dark), `BUIQD` (light) → "Docs / Message flow / Flow / Dark" and "… / Light"

> Regenerate from this doc. Do not edit the PNG. Change the spec or the kit, then re-export.

## One message

Every request goes EdgePort -> Dispatcher -> pre middlewares -> one processor -> post middlewares -> back to EdgePort, which sends SIP to the next hop.

## Sources

- mods/common/src/protos/processor.proto
- mods/dispatcher/src/processor.ts, run_middlewares.ts

## Node / edge spec

Request lane 1-5: SIP client, EdgePort (SIP -> MessageRequest), Dispatcher (first matchFunc wins), Middlewares (postProcessor false), Processor (route + alterations). Response lane 6-9: Middlewares (postProcessor true), Dispatcher, EdgePort (MessageResponse -> SIP), Next hop. Notes: MessageRequest fields, shared ProcessMessage contract, error responses skip post middlewares.

## Built from

Diagram/Node (sEKX6), Diagram/Node Accent (pifOQ), Diagram/Group (np3qG), Diagram/Pill (V8p0b), Diagram/Chip (PHmh8), Diagram/Arrow R (oSkeo), Diagram/Arrow D (AdWAH). Colors are `$rt-*` variables; the frame's `mode` theme (dark or light) picks the palette. Edges are 2px rectangles: `$rt-accent` for the signaling path, `$rt-edge` for the rest.

## Re-export

The light frame is a copy of the dark one with `theme: { mode: "light" }`. After changing the dark frame, delete the light frame and copy it again, then:

```js
Export(["Y5VST", "BUIQD"], "png", "<scratch dir>", { scale: 2 })
```

Rename to `flow-dark.png` / `flow-light.png`, copy here, and quantize (see `images/ASSETS.md`).
