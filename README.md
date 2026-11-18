# Okta Docs Atlas

An unofficial, interactive 3D map of Okta's documentation. It holds two systems, linked by a jump gate in the map and a switch in the header:

- **Product docs** ([help.okta.com](https://help.okta.com/en-us/content/index.htm)): the product doc sets, their sections and pages, and the release notes. A **Release radar** flags new and upcoming releases.
- **Developer docs** ([developer.okta.com](https://developer.okta.com/)): guides, concepts, journeys, API docs, references, SDKs and release notes.

Live: https://okta-docs-atlas.lovable.app/

Not affiliated with Okta. Every node links to the original page; the map holds titles and links, not the documentation text.

## What's in the map (snapshot 17 Nov 2026)

| | Product docs | Developer docs |
|---|---|---|
| Source | help.okta.com | developer.okta.com sidebar navigation |
| Nodes | 280 (216 pages, 64 release entries) | 385 pages |
| Depth | Product, section, page | Two to three levels below each section |
| Tree last checked | 17 Oct 2026 (link check) | 14 Nov 2026 (first import) |
| Release data | 17 Nov 2026, 64 entries | Links to the release-notes pages only |

**Product docs**, pages per doc set: Identity Engine 52, Workflows 28, ISPM 28, Managed MCP Server 24, Access Gateway 22, Classic Engine 10, Aerial 10, Resources 6, plus 26 release-notes pages.

**Developer docs**, pages per section: Guides 263 (19 topics, grouped in the legend as sign-in and auth, AI and integrations, org and users, upgrade and deploy), Concepts 48, References 20, Release notes 15, Journeys 13, API docs 9, SDKs 9. The API reference itself isn't mapped page by page; the map links to its entry points.

**Release radar**, latest entry per line at the snapshot:

| Line | Latest | Date |
|---|---|---|
| Identity Engine | 2026.46.0 Production, 2026.46.0 Preview | 16 Nov, 12 Nov |
| Classic Engine | 2026.46.0 Production, 2026.46.0 Preview | 16 Nov, 12 Nov |
| Identity Governance | 2026.46.0 | 11 Nov |
| Privileged Access | 2026.46.0 Preview | 12 Nov |
| Workflows | 2026.46.0 Production, 2026.46.0 Preview | 17 Nov, 12 Nov |
| Managed MCP Server | 2026.45.1 (EA) | 11 Nov |
| ISPM | Announcement | 4 Nov |
| Access Gateway | 2026.45.0 | 3 Nov |
| Aerial | 2026.46.0 | 12 Nov |

Scheduled at the snapshot: Identity Engine 2026.47.1 Preview (18 Nov) and 2026.47.1 Production (30 Nov). The radar covers 1 Mar 2026 onward and is refreshed about twice a month; each refresh is reviewed by a person before it is committed. Notes on sources and gaps are under [Data notes](#data-notes-snapshot-17-nov-2026).

## Stack

Vite 5 · React 18 · TypeScript · Tailwind CSS 3 · [3d-force-graph](https://github.com/vasturiano/3d-force-graph). No backend, no secrets, no environment variables. The live site is published through Lovable from Lovable's own copy of the project, so it can differ from this repo in small ways.

## Run locally

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # production build to dist/
```

Node 18 or later.

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
    devTree.ts      The developer.okta.com tree (second system), from that site's sidebar navigation
    systems.ts      The two systems (help.okta.com, developer.okta.com) and node lookup across both
    releases.ts     Release radar entries + SNAPSHOT_DATE   ← edit this to refresh
  lib/
    releases.ts     Date logic (new / upcoming / relative text) and per-browser storage
  components/
    AtlasGraph.tsx  3D graph, HTML label layer, dot popovers, zoom controls, legend
    spaceFx.ts      Optional space scenery and detailed nodes (the header's Effects switch)
    jumpGate.ts     The jump gate that links the two systems in the 3D map
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

A release counts as **New** when it shipped within the window the viewer picks (7, 14, 30 or 90 days). Read state, the window, the last-visit date and the effects switch are stored per browser in `localStorage` (`oda-read`, `oda-win`, `oda-seen`, `oda-fx`). Values are validated on load, and the footer has **Clear saved preferences**.

## Privacy and security defaults

- **Fonts:** self-hosted (`@fontsource/*`). The site makes no third-party requests.
- **Tracking:** the app itself sets no cookies and does no tracking. Hosting on Lovable adds platform analytics (`~flock.js`, `__l5e/events.js`, `session-id` cookie); `public/privacy.html` describes them. Fill in its `[PLACEHOLDERS]`, and either switch the analytics off in Lovable or add consent.
- **CSP:** production builds carry a CSP `<meta>` tag (see `vite.config.ts`). Hosts that allow response headers should also send it as a header, with `frame-ancestors 'none'`.
- **Fallback and accessibility:** a list view mirrors the 3D map for keyboard and screen-reader users, and opens automatically when the browser has WebGL turned off.
- **Reduced motion:** turned on in the OS, it disables camera animation, link particles and auto-rotate, holds the space scenery still, and makes the switch between the two systems instant.

## Adding pages to the map

**Product docs:** in `src/data/docsTree.ts`, call `add(id, label, url, product, parentId)` for one page or `many(parentId, product, baseUrl, [[id, label, path], ...])` for a list. Ids must be unique, and a parent must be added before its children. Otherwise the build throws with the offending id.

**Developer docs:** in `src/data/devTree.ts`, each section is a list of rows `[depth, label, path, legendGroup?]` in sidebar order. A row's parent is the nearest row above it with a smaller depth. Ids are derived from the path (`d-<slug>`).

## Data notes (snapshot 17 Nov 2026)

Product docs:

- The map covers the main sections, not every page (Identity Engine and Access Gateway have 500+ pages each). Direct help.okta.com links were last status-checked on 17 Oct 2026; four that returned 404 were fixed or removed. Links through `okta_help.htm?id=…` resolve in the browser and weren't status-checked.
- All 37 distinct release-note URLs in the radar were fetched on 18 Nov 2026 and resolve.
- From October 2026, Okta versions use year.week instead of year.month: 2026.10.0 became 2026.41.0. Weekly updates keep the `.1`, `.2` suffix.
- Okta now publishes per-version pages for Identity Engine, Classic Engine, Workflows and Access Gateway, and per-announcement pages for ISPM. Radar entries link to those, so the links no longer roll over. Okta keeps no Preview notes once a version is superseded, so older Preview entries link to the Production page of the same version.
- Identity Governance, Privileged Access, Managed MCP Server and Aerial have no version pages. Their entries link to pages that show only the latest release.
- Production and Preview notes for the same version can differ either way: 2026.44.0 Production dropped features the Preview had, and 2026.46.0 Production added Device-Bound SSO and Platform SSO features the Preview notes didn't list. The two entries are listed separately.
- Identity Governance notes before 2026.46.0 carry no dates; those entries use the date of the matching Identity Engine release. Aerial entries before 2026.41.0 show the month only.
- The Classic Engine 2026.09.0 production date is an estimate.

Developer docs:

- The tree was read from developer.okta.com's own sidebar navigation on 14 Nov 2026. Links were not status-checked one by one.
- Guides go two levels below each of the 19 topics; deeper pages and per-language variants of a guide are left out, and a guide links to one variant.
- The four Guides groups in the legend are this project's own grouping, not Okta's.
- The Release radar covers Product docs only. In the Developer docs system, the release-notes node links to developer.okta.com's own release-notes pages.
