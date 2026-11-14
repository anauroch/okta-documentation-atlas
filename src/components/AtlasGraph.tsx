import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";
import type { Atlas, AtlasLink, AtlasNode, ProductKey } from "@/data/types";
import { isHot, isNew, isUpcoming, weekOf } from "@/lib/releases";
import { animateNode, buildNode, createSpace, styleNode, type NodeLook, type SpaceFx } from "@/components/spaceFx";
import { createGate, GATE_R, type JumpGate } from "@/components/jumpGate";

export type Mode = "all" | "docs" | "rn";

export interface AtlasGraphProps {
  /** the documentation system to draw; the component is remounted when it changes */
  atlas: Atlas;
  /** menu name of the other system, shown on the jump gate */
  otherName: string;
  /** the gate or its label was clicked */
  onJump: () => void;
  /** mounted as the far side of a jump: lay the map out up front and pull the camera back from the gate */
  arrive: boolean;
  mode: Mode;
  hidden: Set<ProductKey>;
  query: string;
  winDays: number;
  read: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleProduct: (k: ProductKey) => void;
  /** space background and detailed nodes; off renders the plain map */
  fx: boolean;
}
export interface AtlasGraphHandle {
  flyTo: (id: string) => void;
  openPopover: (id: string) => void;
  fit: () => void;
  /** flies the camera into the jump gate; resolves when the view is covered and the systems can be swapped */
  jumpOut: () => Promise<void>;
}

/** Where each system's gate sits and which way it faces. Product docs has it on the right, Developer docs on the left. */
const GATES = {
  help: { side: 1, at: [455, 20, 90] as [number, number, number], face: [-0.62, 0.05, 0.78] as [number, number, number], glow: [0xf97316, 0xffd08a] as [number, number], metal: 0x7fb2ff },
  dev: { side: -1, at: [-455, 20, 90] as [number, number, number], face: [0.62, 0.05, 0.78] as [number, number, number], glow: [0x3b82f6, 0x9fd0ff] as [number, number], metal: 0xffc37a },
};

const NEAR = 170; // camera distance under which section/page labels appear

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = any;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const AtlasGraph = forwardRef<AtlasGraphHandle, AtlasGraphProps>(function AtlasGraph(props, ref) {
  const A = props.atlas; // fixed for the life of this instance (keyed by system)
  const { nodes: NODES, links: LINKS, byId: BY_ID, products: PRODUCTS, pathOf } = A;
  const nodeOf = (x: string | AtlasNode) => (typeof x === "string" ? BY_ID[x] : x);
  const stageRef = useRef<HTMLDivElement>(null);
  const gate = useRef<JumpGate | null>(null);
  const gateLbl = useRef<HTMLButtonElement>(null);
  const warpEl = useRef<HTMLDivElement>(null);
  const graphEl = useRef<HTMLDivElement>(null);
  const labelsEl = useRef<HTMLDivElement>(null);
  const popEl = useRef<HTMLDivElement>(null);
  const zoomLvl = useRef<HTMLSpanElement>(null);
  const graph = useRef<Graph>(null);
  const space = useRef<SpaceFx | null>(null);
  // tokens are read from the stage, which carries its own dark palette while effects are on
  const css = (n: string) => getComputedStyle(stageRef.current ?? document.documentElement).getPropertyValue(n).trim();
  const propsRef = useRef(props);
  propsRef.current = props;

  const [popId, setPopId] = useState<string | null>(null);
  const popIdRef = useRef<string | null>(null);
  popIdRef.current = popId;
  useEffect(() => { dirty.current = true; }, [popId]);
  const [rotating, setRotating] = useState(false);
  const arrived = useRef(false);

  const lblEls = useRef<Record<string, HTMLDivElement>>({});
  const current = useRef<AtlasNode[]>([]);
  const fitDist = useRef<number | null>(null);
  /** set when labels or the popover must be repositioned even if the camera did not move */
  const dirty = useRef(true);

  /* ---------- predicates reading the latest props ---------- */
  const visible = (n: AtlasNode) => {
    const p = propsRef.current;
    if (p.hidden.has(n.prod) && n.level !== 0) return false;
    const rn = n.kind === "release" || n.kind === "rnpage" || n.kind === "rnhub";
    if (p.mode === "docs" && rn) return false;
    if (p.mode === "rn" && !(rn || n.level === 0)) return false;
    return true;
  };
  const matches = (n: AtlasNode) => !!propsRef.current.query && n.label.toLowerCase().includes(propsRef.current.query);
  const hot = (n: AtlasNode) => n.kind === "release" && !!n.rel && isHot(n.rel, propsRef.current.winDays, propsRef.current.read);

  const nodeSize = (n: AtlasNode) => {
    if (n.level === 0) return 22;
    if (n.level === 1) return 10;
    if (n.pin) return 6;
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
    // Only the newest "new" release per product gets a permanent label; the rest show when you zoom in.
    const newestHot = new Map<string, AtlasNode>();
    NODES.forEach((n) => {
      if (!visible(n) || !hot(n) || !n.rel?.date) return;
      // IGA and OPA releases sit under Identity Engine but get their own label
      const key = n.prod + ":" + (/^(IGA|OPA) /.test(n.rel.ver) ? n.rel.ver.slice(0, 3) : "");
      const cur = newestHot.get(key);
      if (!cur || n.rel.date > (cur.rel!.date || "")) newestHot.set(key, n);
    });
    const featured = new Set([...newestHot.values()].map((n) => n.id));
    const set: AtlasNode[] = [];
    NODES.forEach((n) => {
      if (!visible(n)) return;
      n._near = !(n.level <= 1 || n.pin || featured.has(n.id) || n.id === sel || matches(n));
      set.push(n);
    });
    current.current = set;
    dirty.current = true;
    const keep = new Set(set.map((n) => n.id));
    Object.keys(lblEls.current).forEach((id) => { if (!keep.has(id)) { lblEls.current[id].remove(); delete lblEls.current[id]; } });
    set.forEach((n) => {
      let d = lblEls.current[n.id];
      if (!d) {
        d = document.createElement("div");
        d.addEventListener("click", () => { propsRef.current.onSelect(n.id); setPopId(n.id); });
        box.appendChild(d); lblEls.current[n.id] = d;
      }
      const h = hot(n) && !n._near;
      d.className = "lbl " + (n._near ? "l3" : n.level === 0 ? "l0" : n.level === 1 ? "l1" : "") + (h ? " rel" : "") +
        (!n._near && (matches(n) || (n.id === sel && !h && n.level > 1)) ? " hit" : "");
      const wk = n.rel ? weekOf(n.rel.ver) : null;
      d.textContent = n.kind === "release" && n.rel ? `${PRODUCTS[n.prod].name} ${n.rel.ver}${wk ? ` · wk ${wk}` : ""}` : n.label;
      d.style.color = (n.level === 1 || n.pin) && n.prod !== "res" ? PRODUCTS[n.prod].color : "";
    });
  };

  const lookOf = (n: AtlasNode): NodeLook => ({ color: nodeColor(n), radius: Math.cbrt(nodeSize(n)) * 4, hub: n.level <= 1 || !!n.pin, root: n.level === 0, hot: hot(n) });
  const refreshGraph = () => {
    const G = graph.current; if (!G) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (propsRef.current.fx) NODES.forEach((n) => { const o = (n as any).__threeObj; if (o?.userData?.fx) styleNode(o, lookOf(n)); });
    G.nodeColor(G.nodeColor()).nodeVal(G.nodeVal()).linkColor(G.linkColor()).linkWidth(G.linkWidth())
      .linkDirectionalParticles(G.linkDirectionalParticles()).nodeVisibility(G.nodeVisibility()).linkVisibility(G.linkVisibility());
  };

  const flyTo = (id: string, tries = 0) => {
    const G = graph.current; const n = BY_ID[id]; if (!n) return;
    // deep links arrive before the force layout has positions: retry for up to ~10 s
    if (!G || n.x == null) { if (tries < 30) setTimeout(() => flyTo(id, tries + 1), 350); return; }
    const d = n.level === 0 ? 520 : n.level === 1 ? 330 : 150;
    const r = Math.hypot(n.x, n.y!, n.z!) || 1;
    G.cameraPosition({ x: n.x * (1 + d / r), y: n.y! * (1 + d / r), z: n.z! * (1 + d / r) }, n, reducedMotion() ? 0 : 900);
  };
  /** Frame the whole map. With the gate in the scene the view is widened to include it; otherwise this is the library's own fit. */
  const fitAll = (ms: number) => {
    const G = graph.current; if (!G) return;
    const g = gate.current;
    if (!g) { G.zoomToFit(ms, 30); return; }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const grow = (x: number, y: number, z: number, r: number) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r); };
    NODES.forEach((n) => { if (n.x != null && visible(n)) grow(n.x, n.y!, n.z!, 8); });
    grow(g.position.x, g.position.y, g.position.z, GATE_R + 22);
    const cam = G.camera(), t = Math.tan((cam.fov * Math.PI) / 360);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const dist = Math.max((y1 - y0) / 2 / t, (x1 - x0) / 2 / (t * cam.aspect)) * 1.06 + (z1 - z0) / 2;
    G.cameraPosition({ x: cx, y: cy, z: cz + dist }, { x: cx, y: cy, z: cz }, reducedMotion() ? 0 : ms);
  };
  const fit = () => { setPopId(null); fitAll(800); };
  /** Keep the gate just outside the map on its side, level with the map's middle, while the layout settles. */
  const placeGate = () => {
    const g = gate.current; if (!g) return;
    const side = GATES[A.id].side;
    let edge = 0, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, any = false;
    NODES.forEach((n) => { if (n.x == null) return; any = true; edge = Math.max(edge, side * n.x); y0 = Math.min(y0, n.y!); y1 = Math.max(y1, n.y!); z0 = Math.min(z0, n.z!); z1 = Math.max(z1, n.z!); });
    if (any) g.moveTo(side * (edge + GATE_R + 45), (y0 + y1) / 2, (z0 + z1) / 2 + 40);
  };
  const jumpOut = () => new Promise<void>((done) => {
    const G = graph.current, g = gate.current;
    if (!G || !g || reducedMotion()) { done(); return; }
    setPopId(null); g.charge();
    const p = g.position, n = g.normal, at = (k: number) => ({ x: p.x + n.x * k, y: p.y + n.y * k, z: p.z + n.z * k });
    G.cameraPosition(at(210), p, 650);                       // line up in front of the ring
    setTimeout(() => { G.cameraPosition(at(-30), at(-400), 600); warpEl.current?.classList.add("on"); }, 680); // and through it
    setTimeout(done, 1180);
  });
  const dolly = (f: number) => {
    const G = graph.current; if (!G) return;
    const cam = G.camera().position, t = G.controls().target || { x: 0, y: 0, z: 0 };
    G.cameraPosition({ x: t.x + (cam.x - t.x) * f, y: t.y + (cam.y - t.y) * f, z: t.z + (cam.z - t.z) * f }, t, reducedMotion() ? 0 : 350);
  };

  useImperativeHandle(ref, () => ({ flyTo: (id: string) => flyTo(id), openPopover: (id) => setPopId(id), fit, jumpOut }));

  /* ---------- mount once ---------- */
  useEffect(() => {
    const el = graphEl.current!, stage = stageRef.current!;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const target = (l: AtlasLink) => nodeOf(l.target);
    const G: Graph = new (ForceGraph3D as unknown as new (el: HTMLElement, cfg: object) => Graph)(el, { controlType: "orbit" })
      .backgroundColor("rgba(0,0,0,0)")
      .showNavInfo(false)
      .warmupTicks(props.arrive ? 110 : 0)
      .cooldownTicks(props.arrive ? 50 : 160)
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
      .linkDirectionalParticles((l: AtlasLink) => (hot(target(l)) && !reducedMotion() ? 4 : 0))
      .linkDirectionalParticleWidth(2.4)
      .linkDirectionalParticleSpeed(0.012)
      .linkDirectionalParticleColor(() => css("--new"))
      .onNodeClick((n: AtlasNode) => { propsRef.current.onSelect(n.id); setPopId(n.id); })
      .onNodeHover((n: AtlasNode | null) => { el.style.cursor = n ? "pointer" : ""; })
      .onBackgroundClick(() => setPopId(null))
      .onEngineTick(() => { dirty.current = true; placeGate(); });
    // a hub whose children are themselves labelled topics (Developer docs "Guides") needs room around it
    const bigHubs = new Set(NODES.filter((n) => n.pin && n.parent).map((n) => n.parent!));
    G.d3Force("link").distance((l: AtlasLink) => { const t = target(l); return t.level === 1 ? (bigHubs.has(t.id) ? 200 : 90) : t.pin ? 85 : t.kind === "release" ? 26 : t.level === 2 ? 40 : 18; });
    G.d3Force("charge").strength((n: AtlasNode) => (n.level <= 1 ? -260 : n.pin ? -170 : -30));
    let fitted = false;
    G.onEngineStop(() => {
      if (fitted) return; fitted = true; fitAll(props.arrive ? 500 : 900);
      setTimeout(() => { const c = G.camera().position, t = G.controls().target || { x: 0, y: 0, z: 0 }; fitDist.current = Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z); }, 1000);
    });
    graph.current = G;

    /* ---- jump gate: hover and click are tested against the ring's opening ---- */
    const ndcOf = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
    let downAt: [number, number] | null = null, hoverT = 0;
    const onDown = (e: PointerEvent) => { downAt = [e.clientX, e.clientY]; };
    const onUp = (e: PointerEvent) => {
      const g = gate.current, d = downAt; downAt = null;
      if (!g || !d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 5) return; // a drag orbits the map
      const [x, y] = ndcOf(e);
      if (g.hit(x, y, G.camera())) propsRef.current.onJump();
    };
    const onMove = (e: PointerEvent) => {
      const g = gate.current; if (!g) return;
      const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
      const [x, y] = ndcOf(e), over = g.hit(x, y, G.camera());
      g.setHover(over); stage.classList.toggle("gate-hover", over);
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp); el.addEventListener("pointermove", onMove);

    const resize = () => { const r = stage.getBoundingClientRect(); G.width(r.width).height(r.height); dirty.current = true; };
    const ro = new ResizeObserver(resize); ro.observe(stage); resize();

    let raf = 0;
    let lastSig = "";
    const fwdTmp = new (G.camera().position.constructor)();
    let lastT = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      if (propsRef.current.fx && space.current) {
        space.current.update(now / 1000, dt, G.camera());
        gate.current?.update(now / 1000, dt);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!reducedMotion()) NODES.forEach((n) => { const o = (n as any).__threeObj; if (o?.userData?.fx) animateNode(o, now / 1000, dt); });
      }
      const cam = G.camera().position; const box = labelsEl.current!;
      const tg = G.controls().target || { x: 0, y: 0, z: 0 };
      // Only reposition ~250 labels when the view actually changed: saves CPU/battery when idle
      const sig = [cam.x, cam.y, cam.z, tg.x, tg.y, tg.z].map((v: number) => v.toFixed(2)).join(",");
      if (sig === lastSig && !dirty.current) return;
      lastSig = sig; dirty.current = false;
      current.current.forEach((n) => {
        const d = lblEls.current[n.id]; if (!d || n.x == null) return;
        const c = G.graph2ScreenCoords(n.x, n.y, n.z);
        const inside = c.x > -40 && c.y > -20 && c.x < box.clientWidth + 40 && c.y < box.clientHeight + 20;
        const close = !n._near || Math.hypot(cam.x - n.x, cam.y - n.y!, cam.z - n.z!) < NEAR;
        d.style.display = inside && close ? "" : "none"; d.style.left = c.x + "px"; d.style.top = c.y + "px";
      });
      const gl = gateLbl.current, gt = gate.current;
      if (gl && gt) {
        // the label hangs under the ring; hidden when the gate is behind the camera
        const c = G.graph2ScreenCoords(gt.position.x, gt.position.y - GATE_R - 26, gt.position.z);
        const cp = G.camera().position, f = G.camera().getWorldDirection(fwdTmp);
        const ahead = (gt.position.x - cp.x) * f.x + (gt.position.y - cp.y) * f.y + (gt.position.z - cp.z) * f.z > 0;
        gl.style.display = ahead && c.x > -60 && c.x < box.clientWidth + 60 && c.y > 0 && c.y < box.clientHeight ? "" : "none";
        gl.style.left = c.x + "px"; gl.style.top = c.y + "px";
      }
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
    };
    raf = requestAnimationFrame(tick);

    const retheme = () => refreshGraph();
    const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", retheme);
    const mo = new MutationObserver(retheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    rebuildLabels();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener("change", retheme); mo.disconnect();
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointermove", onMove);
      space.current?.dispose(); space.current = null;
      gate.current?.dispose(); gate.current = null;
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

  /* ---------- effects on/off: add or remove the space scenery and swap the node objects ---------- */
  useEffect(() => {
    const G = graph.current; if (!G) return;
    if (props.fx) {
      if (!space.current) space.current = createSpace(reducedMotion(), A.id);
      G.scene().add(space.current.group);
      if (!gate.current) { const k = GATES[A.id]; gate.current = createGate(k.at, k.face, k.glow, k.metal, reducedMotion()); }
      G.scene().add(gate.current.group); placeGate();
      if (props.arrive && !arrived.current) {
        // far side of a jump: start just in front of this system's gate, then pull back to the whole map
        arrived.current = true;
        const g = gate.current, p = g.position, n = g.normal;
        G.cameraPosition({ x: p.x + n.x * 120, y: p.y + n.y * 120, z: p.z + n.z * 120 }, { x: 0, y: 0, z: 0 }, 0);
        if (!reducedMotion()) setTimeout(() => fitAll(1500), 200);
      }
      G.nodeThreeObject((n: AtlasNode) => buildNode(lookOf(n)));
    } else {
      if (space.current) G.scene().remove(space.current.group);
      if (gate.current) { G.scene().remove(gate.current.group); gate.current.dispose(); gate.current = null; stageRef.current?.classList.remove("gate-hover"); }
      G.nodeThreeObject(() => undefined); // back to the built-in spheres
    }
    refreshGraph(); dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fx]);

  const pop = popId ? BY_ID[popId] : null;

  return (
    <section ref={stageRef} className={"stage" + (props.fx ? " fx" : "") + (A.id === "dev" ? " dev" : "")} aria-label={`3D map of ${A.host}`}>
      <div ref={graphEl} className="absolute inset-0" />
      <div ref={labelsEl} className="labels" />
      {props.fx && (
        <button ref={gateLbl} className={"gate-lbl " + A.id} onClick={props.onJump} title={`Jump to the ${props.otherName} system`}>
          <span className="eyebrow">Jump gate</span>
          {A.id === "help" ? `${props.otherName} ⟶` : `⟵ ${props.otherName}`}
        </button>
      )}
      <div ref={warpEl} className={"warp" + (props.arrive && props.fx ? " arrive" : "")} aria-hidden="true" />
      <div className="hint">Drag to orbit · scroll to zoom · click any dot to open its page</div>

      <div className="zoom" aria-label="Zoom controls">
        <div className="grp">
          <button onClick={() => dolly(0.7)} title="Zoom in" aria-label="Zoom in">+</button>
          <button onClick={() => dolly(1.4)} title="Zoom out" aria-label="Zoom out">−</button>
          <button onClick={fit} title="Fit whole map" aria-label="Fit whole map">⤢</button>
          {!reducedMotion() && (
            <button onClick={() => setRotating((r) => !r)} title="Auto-rotate" aria-label="Auto-rotate" aria-pressed={rotating}>⟳</button>
          )}
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

      <Legend atlas={A} hidden={props.hidden} onToggle={props.onToggleProduct} />
    </section>
  );
});

function Legend({ atlas, hidden, onToggle }: { atlas: Atlas; hidden: Set<ProductKey>; onToggle: (k: ProductKey) => void }) {
  return (
    <div className="legend">
      {atlas.legend.map((k) => (
        <button key={k} className="chip" aria-pressed={!hidden.has(k)} onClick={() => onToggle(k)}>
          <i style={{ background: atlas.products[k].color }} />{atlas.products[k].name}
        </button>
      ))}
      {atlas.id === "help" && <span className="chip static"><i style={{ background: "var(--new)" }} />New release <i style={{ background: "var(--up)", marginLeft: 6 }} />Upcoming</span>}
    </div>
  );
}

export default AtlasGraph;
