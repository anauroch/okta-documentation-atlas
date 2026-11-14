/**
 * Optional "space" visuals for the 3D map: a starfield with slow parallax, a distant planet
 * system, a drifting rock field, a comet, occasional shooting stars, and detailed wireframe
 * "balloon" nodes. Everything lives in the graph's own three.js scene so it moves with the camera.
 * Turned off, none of this is created and the map renders exactly as before.
 */
import * as THREE from "three";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const noRay = (o: Obj) => { o.raycast = () => {}; return o; };

let dotTex: Obj = null;
/** soft round dot used for stars, halos and the comet */
function dot(): Obj {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.25, "rgba(255,255,255,.85)");
  grad.addColorStop(0.6, "rgba(255,255,255,.18)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

function onSphere(r: number): [number, number, number] {
  const u = rand(-1, 1), a = rand(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
  return [r * s * Math.cos(a), r * u, r * s * Math.sin(a)];
}

const STAR_TINTS = [[1, 1, 1], [0.81, 0.88, 1], [0.66, 0.77, 1], [1, 0.91, 0.77], [0.75, 0.95, 0.92]];

/** @param band 0 = even sky; above 0 squeezes stars toward one great circle, like a galactic band */
function starLayer(count: number, rMin: number, rMax: number, size: number, opacity: number, band = 0): Obj {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = onSphere(rand(rMin, rMax));
    if (band) p[1] *= Math.pow(Math.random(), band) * 0.35;
    pos.set(p, i * 3);
    const t = STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)], b = Math.pow(Math.random(), 1.5) * 0.65 + 0.35;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: dot(), vertexColors: true, transparent: true, opacity, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending });
  return noRay(new THREE.Points(geo, mat));
}

/** Sphere shaded from one fixed direction, with soft bands and a rim glow: reads as a lit planet without touching the scene lights. */
function planetMat(color: number, rim: number, bands: number): Obj {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uBands: { value: bands } },
    vertexShader: "varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; uniform vec3 uRim; uniform float uBands; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec3 L = normalize(vec3(-0.55, 0.5, 0.67)); float d = max(dot(vN, L), 0.0); float band = 1.0 + 0.16 * sin(vY * uBands) + 0.07 * sin(vY * uBands * 2.7 + 1.3); vec3 c = uColor * band * (0.05 + 0.95 * d); float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.5); c += uRim * rim * (0.15 + 0.6 * d); gl_FragColor = vec4(c, 1.0); }",
  });
}

export interface SpaceFx {
  group: Obj;
  /** t and dt in seconds; camera is the graph camera (used to aim shooting stars into view) */
  update(t: number, dt: number, camera: Obj): void;
  dispose(): void;
}

/** @param still true when the viewer prefers reduced motion: same scenery, nothing moves */
export function createSpace(still: boolean): SpaceFx {
  const root = new THREE.Group(); root.name = "space-fx";

  /* ---- stars: two shells at different distances, so orbiting the map gives parallax ---- */
  const sky = new THREE.Group();
  const farStars = starLayer(2600, 5200, 9000, 2.6, 1);
  const nearStars = starLayer(420, 2600, 4200, 4.2, 1);
  const bandStars = starLayer(1800, 6000, 9000, 1.9, 0.8, 1.6);
  bandStars.rotation.set(0.9, 0, 0.5);
  sky.add(farStars, nearStars, bandStars); root.add(sky);

  /* ---- distant planet system: ringed planet, wire overlay, two moons, one far companion ---- */
  const planetPivot = new THREE.Group();
  const system = new THREE.Group(); system.position.set(-1000, 700, -2900);
  const planet = noRay(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), planetMat(0x3a66b8, 0x7fb2ff, 9)));
  planet.scale.setScalar(215);
  const planetWire = noRay(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 3)), new THREE.LineBasicMaterial({ color: 0x5b9bff, transparent: true, opacity: 0.13 })));
  planetWire.scale.setScalar(217.5);
  const ring = noRay(new THREE.Mesh(new THREE.RingGeometry(1.45, 2.15, 96), new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
  ring.scale.setScalar(215); ring.rotation.set(1.22, 0.25, 0);
  const moons = [
    { o: noRay(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), planetMat(0x2cc2ac, 0x9ff0e4, 0))), r: 620, s: 34, w: 0.05, tilt: 0.3, ph: 1.1 },
    { o: noRay(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), planetMat(0xd9953a, 0xffd9a0, 0))), r: 900, s: 22, w: -0.032, tilt: -0.5, ph: 3.6 },
  ];
  moons.forEach((m) => { m.o.scale.setScalar(m.s); system.add(m.o); });
  const companion = noRay(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), planetMat(0x7a63d6, 0xc3b5ff, 14)));
  companion.scale.setScalar(70); companion.position.set(-640, 300, -900);
  system.add(planet, planetWire, ring, companion); planetPivot.add(system); root.add(planetPivot);

  /* ---- rock field: low-poly tumbling rocks drifting as one formation ---- */
  const rockPivot = new THREE.Group();
  const field = new THREE.Group(); field.position.set(900, -640, -2400);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMats = [0x3a4252, 0x2f3644, 0x475062].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const rocks: { o: Obj; ax: number; ay: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const o = noRay(new THREE.Mesh(rockGeo, rockMats[i % 3]));
    const s = rand(9, 40);
    o.scale.set(s * rand(0.6, 1.4), s * rand(0.6, 1.3), s * rand(0.6, 1.4));
    o.position.set(rand(-520, 520), rand(-150, 150), rand(-260, 260));
    o.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    rocks.push({ o, ax: rand(-0.12, 0.12), ay: rand(-0.12, 0.12) }); field.add(o);
  }
  rockPivot.add(field); root.add(rockPivot);

  /* ---- comet: bright head with a fading tail of points, on a slow tilted orbit ---- */
  const cometPivot = new THREE.Group(); cometPivot.rotation.set(0.5, 0, 0.35);
  const comet = new THREE.Group(); comet.position.set(0, 0, -3900);
  const head = noRay(new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: 0xd6ecff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  head.scale.setScalar(120);
  const TAIL = 90, tp = new Float32Array(TAIL * 3), tc = new Float32Array(TAIL * 3);
  for (let i = 0; i < TAIL; i++) {
    const f = i / TAIL, spread = 4 + f * 46;
    tp.set([-f * 900 + rand(-6, 6), rand(-spread, spread) * 0.5, rand(-spread, spread) * 0.5], i * 3);
    const b = Math.pow(1 - f, 2.2) * 0.85; tc.set([0.72 * b, 0.86 * b, 1 * b], i * 3);
  }
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute("position", new THREE.BufferAttribute(tp, 3)); tailGeo.setAttribute("color", new THREE.BufferAttribute(tc, 3));
  const tail = noRay(new THREE.Points(tailGeo, new THREE.PointsMaterial({ size: 5, map: dot(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending })));
  comet.add(head, tail); cometPivot.add(comet); root.add(cometPivot);

  /* ---- shooting stars: a small pool of streaks aimed into the camera's field of view ---- */
  const meteors = Array.from({ length: 3 }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = noRay(new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    line.visible = false; line.frustumCulled = false; root.add(line);
    return { line, geo, life: 0, dur: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), len: 300 };
  });
  let nextMeteor = rand(2.5, 5);
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const spawn = (camera: Obj) => {
    const m = meteors.find((x) => x.life <= 0); if (!m) return;
    camera.getWorldDirection(fwd);
    side.crossVectors(fwd, camera.up).normalize(); up.crossVectors(side, fwd).normalize();
    // start somewhere in the upper part of the view, well behind the map
    m.p.copy(camera.position).addScaledVector(fwd, 2300).addScaledVector(side, rand(-1100, 1100)).addScaledVector(up, rand(150, 900));
    const dir = Math.random() < 0.5 ? 1 : -1;
    m.v.copy(side).multiplyScalar(dir * rand(0.7, 1)).addScaledVector(up, -rand(0.25, 0.6)).addScaledVector(fwd, rand(-0.15, 0.15)).normalize().multiplyScalar(rand(2200, 3200));
    m.len = rand(260, 420); m.dur = rand(0.7, 1.15); m.life = m.dur; m.line.visible = true;
  };

  const update = (t: number, dt: number, camera: Obj) => {
    if (still) return;
    sky.rotation.y += dt * 0.0035; sky.rotation.x = Math.sin(t * 0.01) * 0.04;
    nearStars.material.opacity = 0.8 + Math.sin(t * 0.7) * 0.15;
    planetPivot.rotation.y += dt * 0.003;
    planet.rotation.y += dt * 0.02; planetWire.rotation.y -= dt * 0.012; ring.rotation.z += dt * 0.006;
    moons.forEach((m) => { const a = t * m.w + m.ph; m.o.position.set(Math.cos(a) * m.r, Math.sin(a) * m.r * Math.sin(m.tilt), Math.sin(a) * m.r * Math.cos(m.tilt)); });
    rockPivot.rotation.y -= dt * 0.0045;
    rocks.forEach((r) => { r.o.rotation.x += dt * r.ax; r.o.rotation.y += dt * r.ay; });
    cometPivot.rotation.y += dt * 0.011;

    nextMeteor -= dt;
    if (nextMeteor <= 0) { spawn(camera); nextMeteor = rand(6, 15); }
    meteors.forEach((m) => {
      if (m.life <= 0) return;
      m.life -= dt;
      if (m.life <= 0) { m.line.visible = false; return; }
      m.p.addScaledVector(m.v, dt);
      const k = Math.sin(Math.PI * (1 - m.life / m.dur)); // fade in and out
      const pos = m.geo.attributes.position, col = m.geo.attributes.color;
      const tx = m.p.x - (m.v.x / m.v.length()) * m.len, ty = m.p.y - (m.v.y / m.v.length()) * m.len, tz = m.p.z - (m.v.z / m.v.length()) * m.len;
      pos.setXYZ(0, m.p.x, m.p.y, m.p.z); pos.setXYZ(1, tx, ty, tz);
      col.setXYZ(0, k, k, k); col.setXYZ(1, 0, 0, 0);
      pos.needsUpdate = true; col.needsUpdate = true;
    });
  };
  // place the moons once so the still (reduced-motion) scene is complete
  moons.forEach((m) => { const a = m.ph; m.o.position.set(Math.cos(a) * m.r, Math.sin(a) * m.r * Math.sin(m.tilt), Math.sin(a) * m.r * Math.cos(m.tilt)); });

  const dispose = () => {
    root.traverse((o: Obj) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x: Obj) => x.dispose?.()); });
  };
  return { group: root, update, dispose };
}

/* ====================== detailed nodes ====================== */

const G = {
  skin: null as Obj, core: null as Obj, wireLo: null as Obj, wireHi: null as Obj, ring: null as Obj,
};
function geos() {
  if (!G.skin) {
    G.skin = new THREE.SphereGeometry(1, 20, 14);
    G.core = new THREE.IcosahedronGeometry(1, 1);
    G.wireLo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1));
    G.wireHi = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 2));
    G.ring = new THREE.TorusGeometry(1, 0.012, 6, 72);
  }
  return G;
}
const mats = new Map<string, { skin: Obj; core: Obj; wire: Obj; ring: Obj; halo: Obj }>();
function matsFor(color: string) {
  let m = mats.get(color);
  if (!m) {
    m = {
      skin: new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
      core: new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35, flatShading: true }),
      wire: new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      ring: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
      halo: new THREE.SpriteMaterial({ map: dot(), color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    mats.set(color, m);
  }
  return m;
}

export interface NodeLook { color: string; radius: number; hub: boolean; root: boolean; hot: boolean }

/** A wireframe "balloon": translucent skin, faceted core, geodesic wire shell; hubs get orbit rings, new releases a halo. */
export function buildNode(look: NodeLook): Obj {
  const g = geos(), grp = new THREE.Group();
  const skin = new THREE.Mesh(g.skin), core = new THREE.Mesh(g.core);
  const wire = new THREE.LineSegments(look.hub ? g.wireHi : g.wireLo);
  core.scale.setScalar(0.5); wire.raycast = () => {}; core.raycast = () => {};
  const rings: Obj[] = [];
  if (look.hub) {
    const n = look.root ? 2 : 1;
    for (let i = 0; i < n; i++) { const r = new THREE.Mesh(g.ring); r.raycast = () => {}; r.scale.setScalar(1.42 + i * 0.2); r.rotation.set(1.15 + i * 0.9, i * 0.8, 0); rings.push(r); grp.add(r); }
  }
  const halo = new THREE.Sprite(); halo.raycast = () => {}; halo.scale.setScalar(5.2);
  grp.add(skin, core, wire, halo);
  grp.userData.fx = { skin, core, wire, rings, halo, spin: rand(0.12, 0.34) * (Math.random() < 0.5 ? -1 : 1) * (look.hub ? 0.5 : 1), ph: rand(0, 6) };
  styleNode(grp, look);
  return grp;
}

/** Re-apply colour, size and the "new" halo without rebuilding the object. */
export function styleNode(obj: Obj, look: NodeLook) {
  const f = obj.userData.fx; if (!f) return;
  const m = matsFor(look.color);
  f.skin.material = m.skin; f.core.material = m.core; f.wire.material = m.wire; f.halo.material = m.halo;
  f.rings.forEach((r: Obj) => { r.material = m.ring; });
  f.halo.visible = look.hot;
  obj.scale.setScalar(look.radius);
}

export function animateNode(obj: Obj, t: number, dt: number) {
  const f = obj.userData.fx; if (!f) return;
  f.wire.rotation.y += dt * f.spin; f.core.rotation.y -= dt * f.spin * 0.6; f.core.rotation.x += dt * f.spin * 0.25;
  f.rings.forEach((r: Obj, i: number) => { r.rotation.z += dt * (0.18 + i * 0.1); });
  if (f.halo.visible) f.halo.scale.setScalar(5.2 + Math.sin(t * 2.2 + f.ph) * 0.9);
}
