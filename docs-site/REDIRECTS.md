# Redirect plan: routr.io/docs to docs.routr.io

> **Done (2026-10).** docs.routr.io is live and the Docusaurus source (`docs/`) is deleted. The
> frozen 2.0.0 and 1.x.x pages, their `assets/` and `img/` files stay on the `gh-pages`
> branch as built; `.github/workflows/gh-pages.yaml` no longer builds them and deploys with
> `keep_files`, writing only the website and the redirect stubs. The plan below is kept for history.

The 2.x docs move from Docusaurus (served by GitHub Pages at `routr.io/docs/...`) to Mintlify at
`docs.routr.io`. Versions 1.x.x and 2.0.0 stay frozen on the old site. This file is the homework to
do when docs.routr.io goes live.

## What the old site serves today

- Docusaurus `baseUrl: "/"`, docs at `/docs/`. The current version is labeled and served at
  `/docs/2.11.5/...` (`docs/docusaurus.config.js`, `versions.current.path`).
- Frozen versions from `docs/versions.json`: `/docs/2.0.0/...` and `/docs/1.x.x/...`.
- `@docusaurus/plugin-client-redirects` already maps `/docs`, `/docs/overview/introduction`,
  `/docs/contributing`, `/docs/community`, `/docs/development/introduction` to `/docs/2.11.5/...`.
- Checked on 2026-10-21: `https://routr.io/docs/2.0.0/overview/introduction` and
  `https://routr.io/docs/1.x.x/welcome` answer 200. `https://routr.io/docs/2.0.0` and
  `https://routr.io/docs/1.x.x` (no page) answer 404, so links to old versions must point at a page.
  `docs.routr.io` does not resolve yet (DNS and the Mintlify custom domain are still to do).

## URL map (2.11.5 and unversioned)

Every row applies to both `/docs/2.11.5/<old>` and `/docs/<old>` (the unversioned form some links
use). New paths are relative to `https://docs.routr.io`.

| Old path (`/docs/2.11.5/...`) | New path | Note |
| --- | --- | --- |
| *(root)* `/docs`, `/docs/2.11.5` | `/introduction` | |
| `overview/introduction` | `/introduction` | |
| `overview/architecture` | `/concepts/architecture` | |
| `overview/concepts` | `/concepts/architecture` | Split across architecture, message-flow and the component references |
| `overview/deploy-with-docker` | `/guides/deploy-with-docker` | |
| `development/introduction` | `/guides/run-from-source` | |
| `development/quick-start` | `/guides/run-from-source` | |
| `development/development-mode-with-gitpod` | `/guides/develop-with-dev-containers` | Gitpod support was removed; dev containers replace it |
| `development/components/overview` | `/concepts/architecture` | |
| `development/components/edgeport` | `/reference/components/edgeport` | |
| `development/components/dispatcher` | `/reference/components/dispatcher` | |
| `development/components/location` | `/reference/components/location` | |
| `development/components/registry` | `/reference/components/registry` | |
| `development/components/requester` | `/reference/components/requester` | |
| `development/components/rtprelay` | `/reference/components/rtprelay` | |
| `development/components/apiserver` | `/reference/components/apiserver` | |
| `development/components/simpleauth` | `/reference/components/simpleauth` | |
| `development/alterations/overview` | `/reference/alterations-api` | |
| `development/alterations/methods` | `/reference/alterations-api` | |
| `development/building-a-processor` | `/guides/build-a-processor` | |
| `development/building-a-middleware` | `/guides/build-a-middleware` | |
| `development/custom-data-with-the-apiserver` | `/guides/custom-data-with-the-apiserver` | |
| `development/extending-the-ctl` | `/guides/extend-rctl` | |
| `development/testing-with-seet` | `/guides/run-from-source` | Stub page, not in the old sidebar |
| `development/metrics-events-logs-and-traces` | `/tutorials/call-events-with-nats` | Stub page, not in the old sidebar |
| `development/building-a-chat-application` | `/guides/build-a-processor` | Stub page, not in the old sidebar |
| `development/building-a-scaip-processor` | `/guides/build-a-processor` | Stub page, not in the old sidebar |
| `development/orchestration-with-docker` | `/guides/deploy-with-docker` | Stub page, not in the old sidebar |
| `development/orchestration-with-kubernetes` | `/guides/deploy-on-kubernetes` | Stub page, not in the old sidebar |
| `connect/introduction` | `/concepts/connect-mode` | |
| `connect/concepts` | `/concepts/routing` | The old page described the routing types |
| `connect/quick-start/docker` | `/quickstart` | |
| `connect/quick-start/kubernetes` | `/quickstart-kubernetes` | |
| `connect/command-line/overview` | `/guides/manage-resources-with-rctl` | |
| `connect/command-line/ctl` | `/reference/rctl` | |
| `connect/nodesdk/overview` | `/guides/manage-resources-with-the-sdk` | |
| `connect/nodesdk/sdk` | `/reference/sdk` | |
| `connect/home-or-office-setup` | `/guides/home-or-office-setup` | |
| `connect/webrtc-support` | `/guides/enable-webrtc` | |
| `connect/securing-the-server` | `/guides/secure-the-server` | |
| `connect/sending-call-events-to-nats` | `/tutorials/call-events-with-nats` | |
| `tutorials/load-balancing-asterisk-with-routr` | `/tutorials/load-balancing-asterisk` | |
| `tutorials/intercom-system-with-routr-and-kubernetes` | `/tutorials/intercom-on-kubernetes` | |
| `tutorials/deploying-to-civo-with-helm` | `/guides/deploy-on-kubernetes` | The Civo tutorial was removed; the cloud load balancer steps live in the Kubernetes guide |
| `tutorials/ephemeral-agents-in-the-browser` | `/tutorials/ephemeral-agents-in-the-browser` | |
| `community` | `/community` | |
| `contributing` | `/contributing` | |
| `faqs` | `/faqs` | |
| `changelog` | `/changelog` | |

## How to implement

GitHub Pages has no server-side redirects, so there are two layers.

### 1. Old host: HTML stubs on routr.io (GitHub Pages)

Change `.github/workflows/gh-pages.yaml` so the `out/` directory keeps the frozen versions and
replaces every 2.11.5 page with a redirect stub:

1. Stop building the `current` (2.11.5) version in Docusaurus. Either keep building Docusaurus with
   only the versioned docs (set `onlyIncludeVersions: ["2.0.0", "1.x.x"]` and `lastVersion: "2.0.0"`
   in `docusaurus.config.js`), or build once more and commit the static output of `/docs/2.0.0` and
   `/docs/1.x.x` to the `gh-pages` branch, then stop rebuilding them. The first keeps search and
   the version dropdown working; the second freezes them for good. Recommended: the first, done in
   one PR together with the stubs.
2. Add a small script (for example `.scripts/docs-redirect-stubs.js`) that reads the table above
   (keep it as JSON next to the script) and writes, for each old path, both
   `out/docs/2.11.5/<old>/index.html` and `out/docs/<old>/index.html` with:

   ```html
   <!doctype html>
   <meta charset="utf-8">
   <title>Routr docs moved</title>
   <link rel="canonical" href="https://docs.routr.io/NEW">
   <meta http-equiv="refresh" content="0; url=https://docs.routr.io/NEW">
   <meta name="robots" content="noindex">
   <p>The Routr docs moved to <a href="https://docs.routr.io/NEW">docs.routr.io/NEW</a>.</p>
   ```

3. Write `out/docs/index.html` and `out/docs/2.11.5/index.html` the same way, pointing at
   `https://docs.routr.io/introduction`.
4. Remove the `@docusaurus/plugin-client-redirects` entries that target `/docs/2.11.5/...`; the stubs
   replace them.
5. In `site/index.html`, change the "Docs" links to `https://docs.routr.io`.

Run the stub script after `npm run build` in the workflow's "Build and populate out directory"
step, before `cp -a site/assets/* out/site-assets`. Keep the `charts/` copy as is: the Helm repo
lives on the same `gh-pages` branch at `routr.io/charts`.

### 2. New host: Mintlify `redirects` in docs.json

Mintlify serves redirects for paths on docs.routr.io. Add them only for renamed pages that people
may hit on the new host with the old slug (for example someone rewriting the host by hand). One
entry per old slug, with wildcard support for the versioned prefix:

```json
"redirects": [
  { "source": "/docs/2.11.5/:slug*", "destination": "/introduction" },
  { "source": "/overview/introduction", "destination": "/introduction" },
  { "source": "/overview/architecture", "destination": "/concepts/architecture" },
  { "source": "/connect/quick-start/docker", "destination": "/quickstart" },
  { "source": "/connect/command-line/ctl", "destination": "/reference/rctl" },
  { "source": "/connect/nodesdk/sdk", "destination": "/reference/sdk" }
]
```

`docs.json` ships with `"redirects": []` today. Generate the full list from the same JSON the stub
script uses (old path without the `/docs/2.11.5` prefix as `source`), so both layers stay in sync.

## What stays frozen

- `docs/versioned_docs/version-1.x.x/**` and `docs/versioned_sidebars/version-1.x.x-sidebars.json`,
  served at `https://routr.io/docs/1.x.x/...` (entry page: `/docs/1.x.x/welcome`).
- `docs/versioned_docs/version-2.0.0/**` and `docs/versioned_sidebars/version-2.0.0-sidebars.json`,
  served at `https://routr.io/docs/2.0.0/...` (entry page: `/docs/2.0.0/overview/introduction`).
- `docs/static/img/**` (the frozen pages reference it).
- `routr.io/charts/**` (Helm repository on the `gh-pages` branch).

No content edits to those trees, only the build and redirect changes above. The 2.11.5 Docusaurus
source (`docs/docs/**`, `docs/sidebars.js`) can be deleted after the stubs ship and the new site
is live.

## Checklist

- [ ] Point `docs.routr.io` (CNAME) at Mintlify and add the custom domain in the Mintlify dashboard.
- [ ] Connect the Mintlify GitHub app to `fonoster/routr` with `docs-site/` as the docs root.
- [x] Stub script shipped (`.scripts/docs-redirect-stubs.js` + `docs-redirects.json`); the Pages workflow runs it only once `https://docs.routr.io/introduction` answers. After go-live, run the workflow and verify 10 random old URLs land on the new page.
- [x] `redirects` in `docs.json` generated from the shared map (unversioned, `/docs/...` and `/docs/2.11.5/...` sources).
- [ ] Update links in `README.md`, `mods/*/README.md`, `ops/charts/connect/README.md` and the
      website to docs.routr.io.
- [ ] Update the Algolia crawler (or drop it; Mintlify has search).
