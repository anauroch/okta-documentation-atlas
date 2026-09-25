# Brief for the Lovable agent

Paste this into Lovable chat after importing the repo.

---

This project is **Okta Docs Atlas**, a single-page React + Vite + TypeScript + Tailwind app. It renders an interactive 3D force graph of the help.okta.com documentation with a "Release radar" side panel.

How it is organised:

- All content is static data in `src/data/`. `docsTree.ts` builds the node/link graph with `add()` and `many()` helpers. `releases.json` holds the reviewed release entries and `snapshotDate` (hash-locked by `scripts/check-data.mjs`); `releases.ts` only re-exports them with types. Don't move this data into components.
- `src/components/AtlasGraph.tsx` wraps the `3d-force-graph` library imperatively inside a single `useEffect`. The graph instance, the HTML label overlay and the popover positioning run in a `requestAnimationFrame` loop that reads the latest props through `propsRef`. Keep that pattern: re-creating the graph on every render resets the camera and layout.
- Styling uses CSS custom properties defined in `src/index.css` (light tokens on `:root`, dark tokens under `prefers-color-scheme: dark` and `[data-theme="dark"]`). Tailwind utility colors map to the same tokens in `tailwind.config.ts`. Use the tokens for any new color.
- Fonts: Archivo (display), IBM Plex Sans (body), IBM Plex Mono (data), self-hosted through `@fontsource/*` imports in `src/main.tsx`. Don't load fonts from Google or any other CDN.
- Per-viewer state (read releases, "new" window) lives in `localStorage` through `store` in `src/lib/releases.ts`. No backend.

Constraints:

- Never edit `src/data/releases.json` or `src/data/releases.lock`. Release data must come from help.okta.com and be reviewed by a person; the build fails on unreviewed changes. If a request needs new release entries, stop and ask the owner to provide them with source URLs.
- Don't add analytics, tracking, cookies or third-party scripts, fonts or images. They'd break the CSP and the privacy notice.
- Keep `3d-force-graph` pinned at 1.80.0.
- The dev server runs on port 8080 and `@/` resolves to `src/`.
- External links open in a new tab with `rel="noopener noreferrer"`.
