# Interop recordings

`interop/` is a curated list of known interoperability tests: real calls with well-known far ends,
one folder per far end (named as the corpus `<far-end>` token, for example `whatsapp`). Each folder
holds the recordings and a `manifest.yaml`, sanitized and named as described in
[etc/corpus/README.md](../etc/corpus/README.md). `npm run compat` replays every one of them on each
pull request, so a change that breaks a known interconnect fails the build.

Which interop case each recording proves, and the evidence kept per far end, live in
fonoster/fonoster: the
[interop cases](https://github.com/fonoster/fonoster/blob/main/mods/conformance/catalog/areas/interop.md)
and the
[interop evidence](https://github.com/fonoster/fonoster/blob/main/docs/interop-evidence.md).

A recording is added by a pull request that adds the sanitized file and its `manifest.yaml` entry.
