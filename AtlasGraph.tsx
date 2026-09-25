import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import { BY_ID, LINKS, NODES, PRODUCTS, pathOf } from "@/data/docsTree";
import type { AtlasLink, AtlasNode, ProductKey } from "@/data/types";
import { isHot, isNew, isUpcoming } from "@/lib/releases";

export type Mode = "all" | "docs" | "rn";

export interface AtlasGraphProps {
  mode: Mode;
  hidden: Set<ProductKey>;
  query: string;
  winDays: number;
  read: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleProduct: (k: ProductKey) => void;
}
export interface AtlasGraphHandle {
  flyTo: (id: string) => void;
  openPopover: (id: string) => void;
  fit: () => void;
}

const NEAR = 170; // camera distance under which section/page labels appear

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = any;

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const nodeOf = (x: string | AtlasNode) => (typeof x === "string" ? BY_ID[x] : x);

const AtlasGraph = forwardRef<AtlasGraphHandle, AtlasGraphProps>(function AtlasGraph(props, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const graphEl = useRef<HTMLDivElement>(null);
  const labelsEl = useRef<HTMLDivElement>(null);
  const popEl = useRef<HTMLDivElement>(null);
  const zoomLvl = useRef<HTMLSpanElement>(null);
  const graph = useRef<Graph>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [popId, setPopId] = useState<string | null>(null);
  const popIdRef = useRef<string | null>(null);
  popIdRef.current = popId;
  const [rotating, setRotating] = useState(false);

  const lblEls = useRef<Record<string, HTMLDivElement>>({});
  const current = useRef<AtlasNode[]>([]);
  const fitDist = useRef<number | null>(null);

  /* ---------- predicates reading the latest props ---------- */
  const visible = (n: AtlasNode) => {
    const p = propsRef.current;
    if (p.hidden.has(n.prod) && n.id !== "root") return false;
    const rn = n.kind === "release" || n.kind === "rnpage" || n.kind === "rnhub";
    if (p.mode === "docs" && rn) return false;
    if (p.mode === "rn" && !(rn || n.id === "root")) return false;
    return true;
  };
  const matches = (n: AtlasNode) => !!propsRef.current.query && n.label.toLowerCase().includes(propsRef.current.query);
  const hot = (n: AtlasNode) => n.kind === "release" && !!n.rel && isHot(n.rel, propsRef.current.winDays, propsRef.current.read);

  const nodeSize = (n: AtlasNode) => {
    if (n.id === "root") return 22;
    if (n.level === 1) return 10;
    if (n.kind === "release") return hot(n) ? 7 : 3;
    if (n.kind === "rnpage") return 3;
    return n.level === 2 ? 4 : 1.6;
  };
  const nodeColor = (n: AtlasNode) => {
    const p = propsRef.current;
    if (n.kind === "release" && n.rel) {
      if (isUpcoming(n.rel)) return css("--up");
      if (isNew(n.rel, p.winDays)) return p.read.has(n.id) ? "#B98A4A" : css("--new");
      return "#7A8699";
    }
    if (p.query && !matches(n)) return css("--link");
    return PRODUCTS[n.prod].color;
  };

  /* ---------- label layer ---------- */
  const rebuildLabels = () => {
    const box = labelsEl.current; if (!box) return;
    const sel = propsRef.current.selectedId;
    const set: AtlasNode[] = [];
    NODES.forEach((n) => {
      if (!visible(n)) return;
      n._near = !(n.level <= 1 || hot(n) || n.id === sel || matches(n));
      set.push(n);
    });
    current.current = set;
    const keep = new Set(set.map((n) => n.id));
    Object.keys(lblEls.current).forEach((id) => { if (!keep.has(id)) { lblEls.current[id].remove(); delete lblEls.current[id]; } });
    set.forEach((n) => {
      let d = lblEls.current[n.id];
      if (!d) {
        d = document.createElement("div");
        d.addEventListener("click", () => { propsRef.current.onSelect(n.id); setPopId(n.id); });
        box.appendChild(d); lblEls.current[n.id] = d;
      }
      const h = hot(n);
      d.className = "lbl " + (n._near ? "l3" : n.level === 0 ? "l0" : n.level === 1 ? "l1" : "") + (h ? " rel" : "") +
        (!n._near && (matches(n) || (n.id === sel && !h && n.level > 1)) ? " hit" : "");
      d.textContent = n.kind === "release" && n.rel ? `${PRODUCTS[n.prod].name} ${n.rel.ver}` : n.label;
      d.style.color = n.level === 1 && n.prod !== "res" ? PRODUCTS[n.prod].color : "";
    });
  };

  const refreshGraph = () => {
    const G = graph.current; if (!G) return;
    G.nodeColor(G.nodeColor()).nodeVal(G.nodeVal()).linkColor(G.linkColor()).linkWidth(G.linkWidth())
      .linkDirectionalParticles(G.linkDirectionalParticles()).nodeVisibility(G.nodeVisibility()).linkVisibility(G.linkVisibility());
  };

  const flyTo = (id: string) => {
    const G = graph.current; const n = BY_ID[id]; if (!G || !n || n.x == null) return;
    const d = n.level === 0 ? 520 : n.level === 1 ? 330 : 150;
    const r = Math.hypot(n.x, n.y!, n.z!) || 1;
    G.cameraPosition({ x: n.x * (1 + d / r), y: n.y! * (1 + d / r), z: n.z! * (1 + d / r) }, n, 900);
  };
  const fit = () => { setPopId(null); graph.current?.zoomToFit(800, 30); };
  const dolly = (f: number) => {
    const G = graph.current; if (!G) return;
    const cam = G.camera().position, t = G.controls().target || { x: 0, y: 0, z: 0 };
    G.cameraPosition({ x: t.x + (cam.x - t.x) * f, y: t.y + (cam.y - t.y) * f, z: t.z + (cam.z - t.z) * f }, t, 350);
  };

  useImperativeHandle(ref, () => ({ flyTo, openPopover: (id) => setPopId(id), fit }));

  /* ---------- mount once ---------- */
  useEffect(() => {
    const el = graphEl.current!, stage = stageRef.current!;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const target = (l: AtlasLink) => nodeOf(l.target);
    const G: Graph = new (ForceGraph3D as unknown as new (el: HTMLElement, cfg: object) => Graph)(el, { controlType: "orbit" })
      .backgroundColor("rgba(0,0,0,0)")
      .showNavInfo(false)
      .cooldownTicks(160)
      .graphData({ nodes: NODES, links: LINKS })
      .nodeId("id")
      .nodeVal(nodeSize)
      .nodeColor(nodeColor)
      .nodeOpacity(0.95)
      .nodeResolution(14)
      .nodeLabel((n: AtlasNode) => `<div class="tip">${esc(n.label)}</div>`)
      .nodeVisibility(visible)
      .linkVisibility((l: AtlasLink) => visible(nodeOf(l.source)) && visible(target(l)))
      .linkColor((l: AtlasLink) => (hot(target(l)) ? css("--new") : css("--link")))
      .linkWidth((l: AtlasLink) => (hot(target(l)) ? 1.2 : target(l).level === 1 ? 0.8 : 0))
      .linkOpacity(0.55)
      .linkDirectionalParticles((l: AtlasLink) => (hot(target(l)) ? 4 : 0))
      .linkDirectionalParticleWidth(2.4)
      .linkDirectionalParticleSpeed(0.012)
      .linkDirectionalParticleColor(() => css("--new"))
      .onNodeClick((n: AtlasNode) => { propsRef.current.onSelect(n.id); setPopId(n.id); })
      .onNodeHover((n: AtlasNode | null) => { el.style.cursor = n ? "pointer" : ""; })
      .onBackgroundClick(() => setPopId(null));
    G.d3Force("link").distance((l: AtlasLink) => { const t = target(l); return t.level === 1 ? 90 : t.kind === "release" ? 26 : t.level === 2 ? 40 : 18; });
    G.d3Force("charge").strength((n: AtlasNode) => (n.level <= 1 ? -260 : -30));
    let fitted = false;
    G.onEngineStop(() => {
      if (fitted) return; fitted = true; G.zoomToFit(900, 30);
      setTimeout(() => { const c = G.camera().position, t = G.controls().target || { x: 0, y: 0, z: 0 }; fitDist.current = Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z); }, 1000);
    });
    graph.current = G;

    const resize = () => { const r = stage.getBoundingClientRect(); G.width(r.width).height(r.height); };
    const ro = new ResizeObserver(resize); ro.observe(stage); resize();

    let raf = 0;
    const tick = () => {
      const cam = G.camera().position; const box = labelsEl.current!;
      current.current.forEach((n) => {
        const d = lblEls.current[n.id]; if (!d || n.x == null) return;
        const c = G.graph2ScreenCoords(n.x, n.y, n.z);
        const inside = c.x > -40 && c.y > -20 && c.x < box.clientWidth + 40 && c.y < box.clientHeight + 20;
        const close = !n._near || Math.hypot(cam.x - n.x, cam.y - n.y!, cam.z - n.z!) < NEAR;
        d.style.display = inside && close ? "" : "none"; d.style.left = c.x + "px"; d.style.top = c.y + "px";
      });
      const pid = popIdRef.current, pop = popEl.current;
      if (pid && pop) {
        const n = BY_ID[pid];
        if (n && n.x != null) {
          const c = G.graph2ScreenCoords(n.x, n.y, n.z);
          const w = box.clientWidth, h = box.clientHeight, pw = pop.offsetWidth;
          const left = c.x + pw + 30 > w ? Math.max(4, c.x - pw - 28) : c.x;
          pop.style.left = left + "px";
          pop.style.top = Math.min(Math.max(c.y, pop.offsetHeight / 2 + 6), h - pop.offsetHeight / 2 - 6) + "px";
        }
      }
      const t = G.controls().target || { x: 0, y: 0, z: 0 };
      const dist = Math.hypot(cam.x - t.x, cam.y - t.y, cam.z - t.z);
      if (fitDist.current && zoomLvl.current) zoomLvl.current.textContent = `zoom ${Math.round((fitDist.current / dist) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const retheme = () => refreshGraph();
    const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", retheme);
    const mo = new MutationObserver(retheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    rebuildLabels();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener("change", retheme); mo.disconnect();
      G._destructor?.(); graph.current = null;
      Object.values(lblEls.current).forEach((d) => d.remove()); lblEls.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- react to prop changes ---------- */
  useEffect(() => { rebuildLabels(); refreshGraph(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode, props.hidden, props.query, props.winDays, props.read, props.selectedId]);

  useEffect(() => {
    const c = graph.current?.controls(); if (!c) return;
    c.autoRotate = rotating; c.autoRotateSpeed = 0.8;
  }, [rotating]);

  const pop = popId ? BY_ID[popId] : null;

  return (
    <section ref={stageRef} className="stage" aria-label="3D documentation map">
      <div ref={graphEl} className="absolute inset-0" />
      <div ref={labelsEl} className="labels" />
      <div className="hint">Drag to orbit · scroll to zoom · click any dot to open its page</div>

      <div className="zoom" aria-label="Zoom controls">
        <div className="grp">
          <button onClick={() => dolly(0.7)} title="Zoom in" aria-label="Zoom in">+</button>
          <button onClick={() => dolly(1.4)} title="Zoom out" aria-label="Zoom out">−</button>
          <button onClick={fit} title="Fit whole map" aria-label="Fit whole map">⤢</button>
          <button onClick={() => setRotating((r) => !r)} title="Auto-rotate" aria-label="Auto-rotate" aria-pressed={rotating}>⟳</button>
        </div>
        <select id="z-focus" aria-label="Fly to product" value=""
          onChange={(e) => { const id = e.target.value; if (id) { props.onSelect(id); flyTo(id); setPopId(id); } }}>
          <option value="">Fly to…</option>
          {NODES.filter((n) => n.level === 1).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <span className="lvl" ref={zoomLvl}>zoom 100%</span>
      </div>

      <div ref={popEl} className="pop" hidden={!pop}>
        {pop && (
          <>
            <button className="x" onClick={() => setPopId(null)} aria-label="Close">×</button>
            <div className="t">{pop.kind === "release" && pop.rel ? `${PRODUCTS[pop.prod].name} ${pop.rel.ver} · ${pop.rel.chan}` : pop.label}</div>
            <div className="p">{pathOf(pop)}</div>
            <div className="u">{pop.url.replace(/^https?:\/\//, "")}</div>
            <div>
              <a className="go" href={pop.url} target="_blank" rel="noopener noreferrer">{pop.kind === "release" ? "Read release notes ↗" : "Open page ↗"}</a>
              <button className="more" onClick={() => flyTo(pop.id)}>Zoom here</button>
            </div>
          </>
        )}
      </div>

      <Legend hidden={props.hidden} onToggle={props.onToggleProduct} />
    </section>
  );
});

function Legend({ hidden, onToggle }: { hidden: Set<ProductKey>; onToggle: (k: ProductKey) => void }) {
  return (
    <div className="legend">
      {(Object.keys(PRODUCTS) as ProductKey[]).filter((k) => k !== "root" && k !== "rn").map((k) => (
        <button key={k} className="chip" aria-pressed={!hidden.has(k)} onClick={() => onToggle(k)}>
          <i style={{ background: PRODUCTS[k].color }} />{PRODUCTS[k].name}
        </button>
      ))}
      <span className="chip static"><i style={{ background: "var(--new)" }} />New release <i style={{ background: "var(--up)", marginLeft: 6 }} />Upcoming</span>
    </div>
  );
}

export default AtlasGraph;
