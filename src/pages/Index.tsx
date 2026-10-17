import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AtlasGraphHandle, Mode } from "@/components/AtlasGraph";
import ReleaseRadar from "@/components/ReleaseRadar";
import DetailCard from "@/components/DetailCard";
import ListView from "@/components/ListView";
import { LINKS, NODES } from "@/data/docsTree";
import { RELEASES, SNAPSHOT_DATE } from "@/data/releases";
import type { ProductKey } from "@/data/types";
import { store, WINDOW_CHOICES } from "@/lib/releases";

// three.js is ~1.4 MB: load it only when the map view is shown
const AtlasGraph = lazy(() => import("@/components/AtlasGraph"));

type View = "map" | "list";

const snapLabel = new Date(SNAPSHOT_DATE + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const RELEASE_IDS = new Set(RELEASES.map((r) => r.id));

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export default function Index() {
  const graph = useRef<AtlasGraphHandle>(null);
  const webgl = useMemo(hasWebGL, []);
  const [view, setView] = useState<View>(webgl ? "map" : "list");
  const [mode, setMode] = useState<Mode>("all");
  const [hidden, setHidden] = useState<Set<ProductKey>>(new Set());
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [winDays, setWinDaysState] = useState<number>(() => store.getChoice("oda-win", WINDOW_CHOICES, 14));
  const [read, setReadState] = useState<Set<string>>(() => new Set(store.getIds("oda-read", RELEASE_IDS)));
  const [selectedId, setSelectedId] = useState("root");
  const [cleared, setCleared] = useState(false);

  const setWinDays = (n: number) => { setWinDaysState(n); store.set("oda-win", n); };
  const setRead = (s: Set<string>) => { setReadState(s); store.set("oda-read", [...s]); };

  const select = useCallback((id: string, fly = false) => {
    setSelectedId(id);
    // opening a shipped release counts as reading it
    const n = NODES.find((x) => x.id === id);
    if (n?.rel && !n.rel.upcoming) setReadState((prev) => {
      if (prev.has(id)) return prev;
      const s = new Set(prev); s.add(id); store.set("oda-read", [...s]); return s;
    });
    if (fly) graph.current?.flyTo(id);
  }, []);

  // debounced search that flies to the first hit
  useEffect(() => {
    const t = setTimeout(() => {
      const q = queryInput.trim().toLowerCase();
      setQuery(q);
      const hit = q && NODES.find((n) => n.label.toLowerCase().includes(q));
      if (hit) select(hit.id, true);
    }, 220);
    return () => clearTimeout(t);
  }, [queryInput, select]);

  const toggleProduct = (k: ProductKey) => setHidden((h) => { const s = new Set(h); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  const clearPreferences = () => {
    store.clearAll();
    setReadState(new Set());
    setWinDaysState(14);
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  };

  const cnt = (k: string) => NODES.filter((n) => n.kind === k).length;
  const showOnMap = (id: string) => { select(id, true); graph.current?.openPopover(id); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Okta Docs Atlas</h1>
          <span className="unofficial" title="Not affiliated with or endorsed by Okta, Inc.">Unofficial</span>
          <span className="snap">help.okta.com · snapshot {snapLabel}</span>
        </div>
        <div className="controls">
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === "map"} onClick={() => setView("map")} disabled={!webgl}
              title={webgl ? undefined : "3D map needs WebGL, which this browser has turned off"}>Map</button>
            <button aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          </div>
          {view === "map" && (
            <div className="seg" role="group" aria-label="Layer">
              {([["all", "All"], ["docs", "Docs"], ["rn", "Release notes"]] as [Mode, string][]).map(([k, l]) => (
                <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
              ))}
            </div>
          )}
          <div className="search">
            <input id="q" type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search pages, e.g. MCP, realms, DBSSO" aria-label="Search the map" />
          </div>
          {view === "map" && <button className="btn" onClick={() => graph.current?.fit()}>Reset view</button>}
        </div>
      </header>

      <div className="main">
        {view === "map" ? (
          <Suspense fallback={<section className="stage" aria-busy="true"><p className="loading">Loading 3D map…</p></section>}>
            <AtlasGraph ref={graph} mode={mode} hidden={hidden} query={query} winDays={winDays} read={read}
              selectedId={selectedId} onSelect={(id) => select(id)} onToggleProduct={toggleProduct} />
          </Suspense>
        ) : (
          <ListView hidden={hidden} query={query} winDays={winDays} read={read} selectedId={selectedId}
            onSelect={(id) => select(id)}
            note={webgl ? undefined : "This browser has WebGL turned off, so the 3D map is unavailable. The same pages are listed below."} />
        )}

        <aside className="side">
          <ReleaseRadar winDays={winDays} setWinDays={setWinDays} read={read} setRead={setRead} hidden={hidden}
            onShow={(id) => (view === "map" ? showOnMap(id) : select(id))} />
          <DetailCard id={selectedId} winDays={winDays}
            onSelect={(id) => (view === "map" ? showOnMap(id) : select(id))} />
          <div className="card">
            <span className="eyebrow">Map contents</span>
            <div className="stats mt-1.5">
              <span>{cnt("doc")} doc pages</span>
              <span>{cnt("rnhub") + cnt("rnpage")} release-note pages</span>
              <span>{cnt("release")} release entries</span>
              <span>{LINKS.length} links</span>
            </div>
          </div>
        </aside>
      </div>

      <footer className="foot">
        <span>Unofficial project. Not affiliated with or endorsed by Okta, Inc. Okta is a trademark of Okta, Inc. Content links to help.okta.com.</span>
        <span className="foot-links">
          <a href="/privacy.html">Privacy</a>
          <button onClick={clearPreferences}>{cleared ? "Preferences cleared" : "Clear saved preferences"}</button>
        </span>
      </footer>
    </div>
  );
}
