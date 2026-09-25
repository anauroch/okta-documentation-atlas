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

Release data is a snapshot, not a live feed. The browser can't read help.okta.com directly because of CORS.

To refresh:

1. Add new entries at the top of `RELEASES` in `src/data/releases.ts`. The `parent` must be a release-notes page id from `docsTree.ts` (for example `rn-oie-prod`, `rn-oie-prev`, `rn-wf-prod`, `rn-ispm`).
2. Flip scheduled entries (`upcoming: true`) to shipped once they deploy, and add the next scheduled dates from the Identity Engine release notes hub.
3. Bump `SNAPSHOT_DATE`.

A release counts as **New** when it shipped within the window the viewer picks (7, 14, 30 or 90 days). Read and unread state is stored per browser in `localStorage`.

To make the radar update itself, the next step would be a small scheduled job (for example a Supabase Edge Function or GitHub Action) that fetches the release notes pages server-side, writes `releases.json`, and has the app load that file instead of the static module.

## Adding pages to the map

In `src/data/docsTree.ts`, call `add(id, label, url, product, parentId)` for one page or `many(parentId, product, baseUrl, [[id, label, path], ...])` for a list. Ids must be unique, and a parent must be added before its children. Otherwise the build throws with the offending id.

## Data notes (snapshot 24 Sep 2026)

- The map covers the main sections, not every page (Identity Engine and Access Gateway have 500+ pages each).
- The Classic Engine 2026.09.0 production date is an estimate; the hub page's release table was out of date when this snapshot was taken.
- Aerial release notes give months only. The Managed MCP Server release notes have no dated entries yet.
- Some deep links use Okta's context-sensitive help redirect (`okta_help.htm?type=…&id=…`).
