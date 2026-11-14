import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AtlasGraphHandle, Mode } from "@/components/AtlasGraph";
import ReleaseRadar from "@/components/ReleaseRadar";
import DetailCard from "@/components/DetailCard";
import ListView from "@/components/ListView";
import { ATLASES, nodeById, otherSystem, systemOf } from "@/data/systems";
import { RELEASES } from "@/data/releases";
import type { ProductKey, SystemId } from "@/data/types";
import { rollLastVisit, store, WINDOW_CHOICES } from "@/lib/releases";

// three.js is ~1.4 MB: load it only when the map view is shown
const AtlasGraph = lazy(() => import("@/components/AtlasGraph"));

type View = "map" | "list";

const snapLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RELEASE_IDS = new Set(RELEASES.map((r) => r.id));

// Read once per page load: the previous visit date, then today's date is stored for next time.
const LAST_VISIT = rollLastVisit();

/** Phones get the list view first: the 3D map is hard to use on a small touch screen. */
const isNarrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 760px)").matches;

/** Node id from the URL hash (#r-oie-1012, #d-guides), if it names a node in either system. */
const hashId = () => { const h = decodeURIComponent(location.hash.slice(1)); return h && nodeById(h) ? h : null; };

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export default function Index() {
  const graph = useRef<AtlasGraphHandle>(null);
  const webgl = useMemo(hasWebGL, []);
  const [view, setView] = useState<View>(webgl && !isNarrow() ? "map" : "list");
  const [mode, setMode] = useState<Mode>("all");
  const [hidden, setHidden] = useState<Set<ProductKey>>(new Set());
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [winDays, setWinDaysState] = useState<number>(() => store.getChoice("oda-win", WINDOW_CHOICES, 14));
  const [read, setReadState] = useState<Set<string>>(() => new Set(store.getIds("oda-read", RELEASE_IDS)));
  const [selectedId, setSelectedId] = useState(() => hashId() ?? "root");
  // which documentation system is on screen; a deep link decides the starting one
  const [system, setSystem] = useState<SystemId>(() => systemOf(hashId() ?? "root") ?? "help");
  const systemRef = useRef(system); systemRef.current = system;
  const atlas = ATLASES[system], other = ATLASES[otherSystem(system)];
  const { nodes: NODES, links: LINKS } = atlas;
  /** slide of the map panel during a jump: "out-left" | "in-right" | "out-right" | "in-left" */
  const [slide, setSlide] = useState("");
  const [arrive, setArrive] = useState(false);
  const jumping = useRef(false);
  const [cleared, setCleared] = useState(false);
  // space background and detailed nodes: on by default, off restores the plain map
  const [fx, setFxState] = useState<boolean>(() => store.get<unknown>("oda-fx", true) !== false);
  const setFx = (on: boolean) => { setFxState(on); store.set("oda-fx", on); };

  const setWinDays = (n: number) => { setWinDaysState(n); store.set("oda-win", n); };
  const setRead = (s: Set<string>) => { setReadState(s); store.set("oda-read", [...s]); };

  const select = useCallback((id: string, fly = false) => {
    setSelectedId(id);
    // opening a shipped release counts as reading it
    const n = nodeById(id);
    if (n?.rel && !n.rel.upcoming) setReadState((prev) => {
      if (prev.has(id)) return prev;
      const s = new Set(prev); s.add(id); store.set("oda-read", [...s]); return s;
    });
    if (fly) graph.current?.flyTo(id);
  }, []);

  // Deep links: keep the URL hash in sync with the selection so it can be shared,
  // and react when someone pastes or edits a hash.
  useEffect(() => {
    const want = selectedId === "root" ? "" : `#${selectedId}`;
    if (location.hash !== want) history.replaceState(null, "", want || location.pathname + location.search);
  }, [selectedId]);
  useEffect(() => {
    const open = () => {
      const id = hashId(); if (!id) return;
      const sys = systemOf(id);
      if (sys && sys !== systemRef.current) { setArrive(false); setSystem(sys); } // a pasted link switches systems without the animation
      select(id);
      document.getElementById(`rel-${id}`)?.scrollIntoView({ block: "nearest" });
      // the 3D map is lazy-loaded: wait for it before flying to the node
      const tryGraph = (n: number) => {
        if (graph.current) { graph.current.flyTo(id); graph.current.openPopover(id); }
        else if (n < 40) setTimeout(() => tryGraph(n + 1), 250);
      };
      tryGraph(0);
    };
    open(); // initial load: the graph retries until the layout has positions
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [select]);

  // debounced search that flies to the first hit
  useEffect(() => {
    const t = setTimeout(() => {
      const q = queryInput.trim().toLowerCase();
      setQuery(q);
      const hit = q && ATLASES[systemRef.current].nodes.find((n) => n.label.toLowerCase().includes(q));
      if (hit) select(hit.id, true);
    }, 220);
    return () => clearTimeout(t);
  }, [queryInput, select]);

  /**
   * Switch systems. Product docs sits on the left and Developer docs on the right, so going to
   * Developer docs moves the view left and coming back moves it right. With effects on, the camera
   * first flies through the jump gate.
   */
  const jump = useCallback(async (to: SystemId) => {
    if (to === systemRef.current || jumping.current) return;
    jumping.current = true;
    const dir = to === "dev" ? "left" : "right";
    const animate = view === "map" && !reducedMotion();
    if (animate) { await graph.current?.jumpOut(); setSlide("out-" + dir); await wait(360); }
    setArrive(animate); setSystem(to); setSelectedId(ATLASES[to].root); setHidden(new Set()); setMode("all"); setQueryInput("");
    if (animate) { setSlide(dir === "left" ? "in-right" : "in-left"); await wait(560); setSlide(""); }
    jumping.current = false;
  }, [view]);

  const toggleProduct = (k: ProductKey) => setHidden((h) => { const s = new Set(h); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  const clearPreferences = () => {
    store.clearAll();
    setReadState(new Set());
    setWinDaysState(14);
    setFxState(true);
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
          <span className="snap">{atlas.host} · snapshot {snapLabel(atlas.snapshot)}</span>
        </div>
        <div className="controls">
          <div className="seg sys" role="group" aria-label="Documentation system">
            {(["help", "dev"] as SystemId[]).map((k) => (
              <button key={k} aria-pressed={system === k} onClick={() => jump(k)}>{ATLASES[k].name}</button>
            ))}
          </div>
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
              placeholder={atlas.searchHint} aria-label="Search the map" />
          </div>
          {view === "map" && (
            <label className="switch" title="Space background, animation and detailed nodes. Off shows the plain map.">
              <input type="checkbox" role="switch" checked={fx} onChange={(e) => setFx(e.target.checked)} />
              <span className="track" aria-hidden="true" />
              Effects
            </label>
          )}
          {view === "map" && <button className="btn" onClick={() => graph.current?.fit()}>Reset view</button>}
        </div>
      </header>

      <div className="main">
        {view === "map" ? (
          <div className={"stagewrap " + slide}>
          <Suspense fallback={<section className="stage" aria-busy="true"><p className="loading">Loading 3D map…</p></section>}>
            <AtlasGraph key={system} ref={graph} atlas={atlas} otherName={other.name} onJump={() => jump(otherSystem(system))} arrive={arrive} mode={mode} hidden={hidden} query={query} winDays={winDays} read={read}
              selectedId={selectedId} onSelect={(id) => select(id)} onToggleProduct={toggleProduct} fx={fx} />
          </Suspense>
          </div>
        ) : (
          <ListView atlas={atlas} hidden={hidden} query={query} winDays={winDays} read={read} selectedId={selectedId}
            onSelect={(id) => select(id)}
            note={webgl ? undefined : "This browser has WebGL turned off, so the 3D map is unavailable. The same pages are listed below."} />
        )}

        <aside className="side">
          {system === "help" ? (
            <ReleaseRadar winDays={winDays} setWinDays={setWinDays} read={read} setRead={setRead} hidden={hidden} lastVisit={LAST_VISIT}
              onShow={(id) => (view === "map" ? showOnMap(id) : select(id))} />
          ) : (
            <div className="card">
              <span className="eyebrow">Developer release notes</span>
              <p className="text-[13px] text-ink-2 my-1.5">API and SDK release notes live on developer.okta.com, one page per product and year.</p>
              <ul className="kids">
                {atlas.childrenOf("d-relnotes").filter((c) => c.level === 2 && !/archive/i.test(c.label)).map((c) => (
                  <li key={c.id}><button onClick={() => (view === "map" ? showOnMap(c.id) : select(c.id))}>› {c.label}</button></li>
                ))}
              </ul>
            </div>
          )}
          <DetailCard atlas={atlas} id={atlas.byId[selectedId] ? selectedId : atlas.root} winDays={winDays}
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
        <span>Unofficial project. Not affiliated with or endorsed by Okta, Inc. Okta is a trademark of Okta, Inc. Content links to {atlas.host}.</span>
        <span className="foot-links">
          <a href="/privacy.html">Privacy</a>
          <button onClick={clearPreferences}>{cleared ? "Preferences cleared" : "Clear saved preferences"}</button>
        </span>
      </footer>
    </div>
  );
}
