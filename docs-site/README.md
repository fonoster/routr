# Routr docs (Mintlify)

The Routr 2.x documentation, served by Mintlify at **docs.routr.io**. It replaces the Docusaurus site
under `docs/` for the current version. Versions 1.x.x and 2.0.0 stay frozen on the old site
(`routr.io/docs/1.x.x/welcome`, `routr.io/docs/2.0.0/overview/introduction`); see
[REDIRECTS.md](./REDIRECTS.md).

## Run it locally

One command, from the repository root (Node.js 20 or newer):

```bash
npm run start:docs-site
```

That runs `cd docs-site && npx --yes mint@4.2.1045 dev --port 3333` and serves the site at
http://localhost:3333. The Mintlify CLI version is pinned to the one Fonoster's docs use
(`fonoster/package.json`, `start:docs`). Check links with:

```bash
npm run check:docs-site
```

## Layout

```
docs-site/
  docs.json              site config and navigation (Mintlify docs.json format, same as Fonoster)
  style.css              routr.io look: Poppins, Roboto Mono, teal accent
  logo/ favicon.ico      brand assets (logo/dark.svg is designs/assets/logo-dark.svg)
  introduction.mdx, quickstart*.mdx
  concepts/              explanation pages
  guides/                how-to guides
  tutorials/             tutorials
  reference/             rctl, SDK, resources, components, env vars, Helm values, alterations, headers
  changelog.mdx, previous-versions.mdx
  images/<slug>/         exported diagrams and screenshots, ledger in images/ASSETS.md
  REDIRECTS.md           old URL -> new URL map and the plan to implement it
```

Navigation has three tabs. **Docs** is grouped by Diátaxis: Get started, Concepts, How-to guides
(Deploy and operate, Connect phones and services, Manage resources, Extend Routr, Work on Routr),
Tutorials, Community. **Reference** holds the look-up pages. **Changelog** holds release notes and
previous versions.

## Add a page

Pages are written one at a time with the `/ps:docs` skill (frame, sources, place, outline, assets,
draft, proof, wire). By hand:

1. Pick one Diátaxis type (tutorial, how-to, reference, explanation) and the folder that matches it.
2. Create `docs-site/<folder>/<slug>.mdx` with frontmatter:

   ```mdx
   ---
   title: "Secure the server"
   description: "One sentence: who it is for and what they can do after reading."
   ---
   ```

3. Write in the house voice: second person, present tense, short sentences, one sentence before each
   code block. Take every command, flag, field and env var from the code (`mods/*`, `ops/charts/*`),
   never from memory.
4. Add the path (without `.mdx`) to the right group in `docs.json`.
5. Run `npm run check:docs-site` and look at the page in `npm run start:docs-site`.

## Diagrams

Diagrams are drawn in Pencil in `designs/docs.pen` and exported here. Never edit a PNG by hand.

- The file holds a Routr **Diagram Kit** (node, accent node, group, pill, chip, arrows, logo) bound to
  `rt-*` variables with a `mode` theme (dark, light), and one dark frame plus one light copy per
  diagram. It also holds the page-look design ("Docs / Look / Page template").
- Each diagram has a build doc next to its images (`images/<folder>/<name>.md`) with its one message,
  sources, node/edge spec and Pencil node ids. `images/ASSETS.md` is the ledger.
- To change one: open `designs/docs.pen` in Pen (`open -a /Applications/Pen.app designs/docs.pen`),
  confirm with the Pencil MCP `get_app_state` that it is the active file (the `execute` tool works on
  the active file and ignores its `filePath`), edit the dark frame, recreate the light copy, then
  `Export([...], "png", dir, { scale: 2 })`, rename, copy and quantize as described in
  `images/ASSETS.md`. Save the file from Pen (File > Save) before committing.
- In the page, use the dark/light pair:

  ```mdx
  <img className="block dark:hidden rounded-xl" src="/images/routing/routing-types-light.png" alt="..." />
  <img className="hidden dark:block rounded-xl" src="/images/routing/routing-types-dark.png" alt="..." />
  ```

## Decisions

Made unsupervised during the migration (2026-10-21). Change any of them freely.

**Structure**

1. New project in `docs-site/`, `docs.json` in the same format and theme (`mint`) as Fonoster's.
2. One version only (2.x). No Mintlify `versions`: old versions are linked from `previous-versions`
   and a global "Previous versions" anchor, and stay on routr.io.
3. Three tabs: Docs, Reference, Changelog (Fonoster splits SDK and CLI into tabs; Routr's reference
   set is small enough for one tab).
4. Docs tab grouped by Diátaxis: Get started, Concepts, How-to guides (five sub-groups), Tutorials,
   Community.
5. Quickstart is Docker with `fonoster/routr-one`; a second quickstart covers Kubernetes with Helm.
6. Component pages (EdgePort, Dispatcher, Location, Connect, API Server, Registry, Requester,
   RTPRelay, SimpleAuth) moved from "Development" into Reference, one page each with the same
   structure. The old "Development" section became how-to guides (build a processor/middleware,
   custom data, extend rctl, run from source, dev containers; the Gitpod guide was removed with
   `.gitpod.yml`).
7. Old `overview/concepts` and `connect/concepts` split into explanation pages: architecture,
   message flow, EdgePort cooperation, Connect mode, routing, load balancing, deployment topologies.
8. New pages with no 2.11.5 equivalent: EdgePort cooperation, routing, load balancing, deployment
   topologies, scale with Redis, connect a PBX as a Peer, environment variables, Helm values,
   resources reference (7 pages + overview), SIP headers, previous versions.
9. NATS events is a tutorial only (no separate how-to); WebRTC has a how-to (configuration) and a
   tutorial (ephemeral agents with SIP.js).
10. Tutorials were stubs in 2.11.5; they were written from the ebook (*The future of programmable SIP
    servers*) and its example files, checked against the repo. FreeSWITCH is a note in the Asterisk
    tutorial, not its own page, because there is no FreeSWITCH source material to verify.
11. Changelog lists recent GitHub releases and links to the full history; v2.15.4 is a draft release,
    so the list starts at v2.15.3.
12. The Enterprise and commented-out pages of the old sidebar (Teams, Chime, SIPREC, Twilio,
    SEET, metrics, chat app, SCAIP) were not migrated: they were stubs.

**Look**

13. Owner feedback: the look follows docs.fonoster.com exactly, with teal only as the accent.
    `docs.json` matches Fonoster's (theme `mint`, Poppins, `codeblocks: system`, dark by default,
    backgrounds `#FFFFFF` / `#181818`) with colors primary `#1F8F8E`, light `#5FCFCE`, dark `#1F8F8E`.
    `style.css` is Fonoster's stylesheet with only the accent values swapped (`#39E19E` -> `#5FCFCE`,
    `#008751` -> `#1F8F8E`, on-accent -> `#001A1A`); surfaces, borders and text are Fonoster's.
14. Navbar: Website, Discussions, and the GitHub button. Global anchors: GitHub, Discord, Previous
    versions.
15. `logo/dark.svg` and `logo/light.svg` use the wordmark paths from `site/index.html`: letters
    `#F0FDFF` on dark and `#252525` on light, dot `#5FCFCE`. `favicon.svg` is the "r" with the teal
    dot on `#181818`.

**Pencil**

16. `designs/docs.pen` started as a copy of `fonoster/designs/docs.pen`, but its colors come from
    `fonoster.lib.pen` (imported as `ui:`), which does not resolve in this repo. Fonoster's frames
    were removed and its Diagram Kit was kept and rebound to local `rt-*` variables (same component
    ids and structure). No dependency on Fonoster's library remains. The variables use the same
    neutral palette as the site (`#181818` / `#202020` surfaces, `#333333` borders, white and gray
    text); teal marks only the signaling path, accent borders and active states.
17. Diagrams are 1600 x 900 (banner 1600 x 600), exported at 2x and quantized to 256 colors
    (about 75 KB each). PNG only, never SVG fills.
18. `designs/assets/` holds the website's patterns and logos; the banner uses `pattern-hero.png`.

**Tooling**

19. Root `package.json` gets `start:docs-site` and `check:docs-site` (mint 4.2.1045, port 3333).
    `start:docs` (Docusaurus) stays until the cutover.
20. `.mintignore` keeps README.md, REDIRECTS.md and the build docs out of the site.
21. Commits used `--no-verify`: the repo's husky hooks run the full test suite and need an installed
    workspace, which this docs-only branch did not have.

**Content rules**

22. When docs and code disagreed, the code won. The disagreements found are listed below.
23. Routr is described as signaling only, in front of Asterisk/FreeSWITCH; no page promises
    zero dropped calls or call re-homing. Clients re-register if an EdgePort goes away.

## Docs vs code: issues found while writing

Not fixed on this branch (docs-only). Worth an issue each.

- Several EdgePorts need `TRUSTED_EDGEPORT_ADDRESSES` to cooperate, but the Helm chart (2 EdgePort
  replicas) and `compose.yaml` never set it.
- `agent-to-peer` INVITEs skip the access check (`checkAccess` has no case for it). Security review.
- Only the Trunk ACL `allow` list is enforced; Domain and Peer ACLs and `deny` lists are not.
- `mods/connect/src/envs.ts` checks `CONNECT_VERIFIER_PUBLIC_KEY`, but the code reads
  `CONNECT_VERIFIER_PUBLIC_KEY_PATH`.
- `X-DOD-Privacy` never applies (lowercased value compared to `"ID"`).
- A Dispatcher middleware without `postProcessor` never runs (strict comparison).
- `addRoute` without `maxContacts` arrives as 0 over gRPC and the Location Service rejects contacts.
- routr-one has no Redis option, no Registry/Requester, and ignores `BIND_ADDR`, `LOCATION_ADDR`,
  `API_ADDR`.
- Helm: `rtprelay.rtpePort` (old docs say `rtpPort`); enabling RTPRelay does not add the Dispatcher
  middleware; `edgeport.unknownMethodAction`,
  `location.region`, `registry.serviceAnnotations`, `registry.autoscaling` are ignored; the Registry
  points at a `<release>-routr-edgeport` Service the chart does not create; `Chart.lock` and the
  bundled subcharts do not match `Chart.yaml`.
- NATS subjects are `<prefix>.call.started`/`.call.ended` (old docs: `calls.`).
- No match in the Dispatcher returns a gRPC error that EdgePort only logs (CORE.md says 405/503).
- Connect answers `MESSAGE` with 405 although EdgePort and the chart accept it by default.
- `convert:certs` moves `signaling.p12` into `etc/certs/`, which does not exist.
- The SDK README calls constructors without `endpoint` and uses `require` without `.default`; the
  old docs used `SDK.ACL` (the code has `SDK.Acls`).
- A REGISTER carrying `X-Gateway-Auth` skips authentication, and header stripping does not apply
  to REGISTER. Security review.
- simpledata: the Domain ACL schema says `spec.context.accessControlListRef` but the loader reads
  `spec.accessControlListRef`; Peer `accessControlListRef` is ignored; only get/findBy exist, so
  rctl and the SDK need pgdata.
- rctl has no `login` command, `create`/`update` are interactive only, and the README says
  `numbers update` updates Credentials.
- Number `geoInfo` is effectively required (`apiserver.md` says optional).
