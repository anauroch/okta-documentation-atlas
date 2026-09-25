# Okta Docs Atlas

An interactive 3D map of [help.okta.com](https://help.okta.com/en-us/content/index.htm), showing the product doc sets, their sections and pages, and the release notes. A **Release radar** flags new and upcoming releases across Identity Engine, IGA, Classic Engine, Workflows, ISPM, Access Gateway, Managed MCP Server and Aerial.

Stack: Vite 5 · React 18 · TypeScript · Tailwind CSS 3 · [3d-force-graph](https://github.com/vasturiano/3d-force-graph). No backend, no secrets, no environment variables.

## Run locally

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # production build to dist/
```

Node 18 or later.

## Self-host with Docker + Cloudflare Tunnel

```bash
cp .env.example .env      # paste your Cloudflare Tunnel token
docker compose up -d --build
```

Full guide, including Cloudflare setup, Access and hardening: [DEPLOY.md](DEPLOY.md).

## Import into Lovable

1. Push this folder to a new GitHub repository (the repo root must be this folder, so `package.json` is at the top level).
2. In Lovable choose **New project → Import from GitHub**, authorise the Lovable GitHub App for that repo and select it.
3. Lovable installs dependencies and boots the preview. Publish from Lovable when it looks right.

If your Lovable workspace doesn't offer "Import from GitHub", create an empty Lovable project, connect it to GitHub (Lovable creates the repo), then replace that repo's contents with these files and push. Lovable syncs the change.

`LOVABLE.md` holds a short brief you can paste into Lovable chat so its agent knows how the project is organised before you ask for changes.

## Project layout

```
src/
  data/
    types.ts        Node, link and release types
    docsTree.ts     The documentation tree: products, sections, pages, release-notes pages
    releases.ts     Release radar entries + SNAPSHOT_DATE   ← edit this to refresh
  lib/
    releases.ts     Date logic (new / upcoming / relative text) and per-browser storage
  components/
    AtlasGraph.tsx  3D graph, HTML label layer, dot popovers, zoom controls, legend
    ReleaseRadar.tsx
    DetailCard.tsx
  pages/Index.tsx   Page layout and shared state
  index.css         Design tokens (light + dark) and component styles
```

## Updating the release radar

Release data is a snapshot in `src/data/releases.json`, not a live feed. The browser can't read help.okta.com directly because of CORS.

The data is **hash-locked**. `npm run build` first runs `scripts/check-data.mjs`, which:

- validates every entry: known product, an existing release-notes parent page, ISO dates, `https://help.okta.com` or `developer.okta.com` URLs, non-empty items, and no "shipped" date after the snapshot date;
- compares a SHA-256 of `releases.json` with `src/data/releases.lock`, and fails if the JSON changed without a new lock.

This exists because an AI editing agent once replaced the whole list with plausible but invented releases. To update:

1. Edit `releases.json`: add entries, flip `upcoming` entries that have shipped, bump `snapshotDate`.
2. Check each new or changed entry against its `url`.
3. Run `npm run data:lock`, then commit `releases.json` and `releases.lock` together.

A release counts as **New** when it shipped within the window the viewer picks (7, 14, 30 or 90 days). Read state and the window are stored per browser in `localStorage` (`oda-read`, `oda-win`). Values are validated on load, and the footer has **Clear saved preferences**.

## Privacy and security defaults

- **Fonts:** self-hosted (`@fontsource/*`). The site makes no third-party requests.
- **Tracking:** no cookies, analytics or tracking. `public/privacy.html` is the privacy notice; fill in the `[PLACEHOLDERS]`.
- **CSP:** production builds carry a CSP `<meta>` tag (see `vite.config.ts`). The Docker/nginx deployment also sends it as a header, with `frame-ancestors 'none'`.
- **Fallback and accessibility:** a list view mirrors the 3D map for keyboard and screen-reader users, and opens automatically when the browser has WebGL turned off.
- **Reduced motion:** turned on in the OS, it disables camera animation, link particles and auto-rotate.

## Adding pages to the map

In `src/data/docsTree.ts`, call `add(id, label, url, product, parentId)` for one page or `many(parentId, product, baseUrl, [[id, label, path], ...])` for a list. Ids must be unique, and a parent must be added before its children. Otherwise the build throws with the offending id.

## Data notes (snapshot 24 Sep 2026)

- The map covers the main sections, not every page (Identity Engine and Access Gateway have 500+ pages each).
- The Classic Engine 2026.09.0 production date is an estimate; the hub page's release table was out of date when this snapshot was taken.
- Aerial release notes give months only. The Managed MCP Server release notes have no dated entries yet.
- Some deep links use Okta's context-sensitive help redirect (`okta_help.htm?type=…&id=…`).
