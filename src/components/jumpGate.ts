/**
 * Jump gate: a ring structure with a swirling event horizon that links the two documentation
 * systems. It sits beside the map in the same three.js scene; clicking it (or its label) jumps.
 */
import * as THREE from "three";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;
const noRay = (o: Obj) => { o.raycast = () => {}; return o; };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const R0 = 62, SCALE = 1.3;
export const GATE_R = R0 * SCALE; // radius of the ring's centre line, in graph units

export interface JumpGate {
  group: Obj;
  /** world position of the ring centre and the unit vector pointing out of its face, toward the map */
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  update(t: number, dt: number): void;
  /** true when the pointer (normalised device coordinates) is over the ring opening */
  hit(ndcX: number, ndcY: number, camera: Obj): boolean;
  moveTo(x: number, y: number, z: number): void;
  setHover(on: boolean): void;
  /** ramps the horizon up before a jump */
  charge(): void;
  dispose(): void;
}

function softDot(): Obj {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.3, "rgba(255,255,255,.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const HORIZON_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const HORIZON_FS = `
uniform float uT; uniform float uPower; uniform vec3 uA; uniform vec3 uB;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 p = vUv*2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float pulse = 0.5 + 0.5*sin(uT*0.8);                       // one slow breath about every 8 s
  // ripples travel outward from the centre and bend everything they pass over
  float wave = sin(r*15.0 - uT*1.05) * smoothstep(1.0, 0.25, r);
  float rr = r * (1.0 + 0.035*wave);
  // the surface turns slowly, more tightly toward the centre, and its texture drifts
  float tw = a + 1.5/(rr + 0.4) - uT*0.11;
  vec2 sw = vec2(cos(tw), sin(tw)) * (1.2 + rr*1.6);
  float cloud = fbm(sw + vec2(uT*0.05, -uT*0.035));
  float veil = fbm(sw*2.6 - vec2(uT*0.07, 0.0) + cloud*1.5);
  float grain = fbm(p*11.0 + vec2(uT*0.16, uT*0.11) + veil*2.0); // fine shimmer, like a liquid surface
  float core = smoothstep(0.85, 0.0, rr) * (0.5 + 0.5*pulse);
  float edge = smoothstep(1.0, 0.86, r);
  float rim = smoothstep(0.8, 0.985, r) * smoothstep(1.0, 0.97, r);
  float body = (0.16 + 0.55*cloud*veil*1.9 + 0.16*grain + 0.07*wave) * edge;
  vec3 col = mix(uA*0.55, uB, clamp(cloud*veil*2.4 + core*0.7, 0.0, 1.0)) * (body + rim*1.1)
           + mix(uB, vec3(1.0), 0.55) * core*core * (0.5 + 0.35*grain + uPower*1.5);
  float alpha = clamp(0.28*edge + body*1.1 + rim + core*0.8, 0.0, 1.0) * (0.82 + 0.18*uPower);
  gl_FragColor = vec4(col*(1.0 + 0.12*pulse + uPower*1.2), alpha);
}`;


/** Strip of small lit cells in rows, tiled around a band: reads as dense machinery from a distance. */
function techTexture(): Obj {
  const c = document.createElement("canvas"); c.width = 512; c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 32);
  for (let row = 0; row < 4; row++) {
    let x = 0;
    while (x < 512) {
      const w = [2, 3, 4, 6, 9][Math.floor(Math.random() * 5)];
      if (Math.random() < 0.72) { g.fillStyle = `rgba(255,255,255,${(0.25 + Math.random() * 0.75).toFixed(2)})`; g.fillRect(x, row * 8 + 1, w, row % 2 ? 5 : 6); }
      x += w + 1 + Math.floor(Math.random() * 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return t;
}
/** Flat ring whose texture runs around it (u along the circumference, v across the band). */
function bandGeo(rIn: number, rOut: number, repeat: number, seg = 160): Obj {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * rIn, s * rIn, 0, c * rOut, s * rOut, 0); uv.push((i / seg) * repeat, 0, (i / seg) * repeat, 1);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/**
 * @param at ring centre
 * @param face direction the opening faces (toward the map and the default camera)
 * @param glow [edge colour, inner colour] of the horizon: the palette of the system on the other side
 * @param metal colour of the lights on the structure itself
 */
export function createGate(at: [number, number, number], face: [number, number, number], glow: [number, number], metal: number, still: boolean): JumpGate {
  const R = R0;
  const group = new THREE.Group(); group.name = "jump-gate";
  group.scale.setScalar(SCALE);
  const n = new THREE.Vector3(...face).normalize();
  const position = { x: 0, y: 0, z: 0 };

  const hull = new THREE.MeshLambertMaterial({ color: 0x1c2333, emissive: 0x0b0f1a, flatShading: true });
  const plate = new THREE.MeshLambertMaterial({ color: 0x2b3448, emissive: 0x0d1220, flatShading: true });
  const light = new THREE.MeshBasicMaterial({ color: metal });
  const lightDim = new THREE.MeshBasicMaterial({ color: metal, transparent: true, opacity: 0.35 });

  /* main ring, faceted so it catches the scene light like machined metal */
  group.add(noRay(new THREE.Mesh(new THREE.TorusGeometry(R, 5.2, 8, 72), hull)));
  /* wire shell: ties the gate to the wireframe look of the nodes */
  group.add(noRay(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(R, 6.4, 6, 36), 1),
    new THREE.LineBasicMaterial({ color: metal, transparent: true, opacity: 0.28 }))));
  /* glowing seams on the inner and outer edge of the ring */
  group.add(noRay(new THREE.Mesh(new THREE.TorusGeometry(R - 5.4, 0.55, 6, 120), light)));
  group.add(noRay(new THREE.Mesh(new THREE.TorusGeometry(R + 5.6, 0.3, 6, 120), lightDim)));

  /* armour segments and the emitter pylons between them */
  const SEG = 12, segGeo = new THREE.BoxGeometry(17, 13.5, 12.5), pylonGeo = new THREE.BoxGeometry(4.2, 20, 8), lampGeo = new THREE.BoxGeometry(1.6, 5, 1.2);
  const lamps: Obj[] = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2, b = a + Math.PI / SEG;
    const seg = noRay(new THREE.Mesh(segGeo, plate));
    seg.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); seg.rotation.z = a + Math.PI / 2; group.add(seg);
    const py = noRay(new THREE.Mesh(pylonGeo, hull));
    py.position.set(Math.cos(b) * (R + 1), Math.sin(b) * (R + 1), 0); py.rotation.z = b + Math.PI / 2; group.add(py);
    // each pylon carries a lamp on both faces; they light in sequence around the ring
    [6.6, -6.6].forEach((z) => {
      const lamp = noRay(new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: metal, transparent: true })));
      lamp.position.set(Math.cos(b) * (R - 2.5), Math.sin(b) * (R - 2.5), z); lamp.rotation.z = b + Math.PI / 2;
      lamp.userData.i = i; lamps.push(lamp); group.add(lamp);
    });
  }

  /* two counter-rotating outer arcs */
  const arcs = new THREE.Group(), arcs2 = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a1 = noRay(new THREE.Mesh(new THREE.TorusGeometry(R + 13, 1.1, 6, 28, 1.25), plate)); a1.rotation.z = (i / 3) * Math.PI * 2; arcs.add(a1);
    const a2 = noRay(new THREE.Mesh(new THREE.TorusGeometry(R + 18, 0.45, 5, 28, 0.8), lightDim)); a2.rotation.z = (i / 3) * Math.PI * 2 + 0.6; arcs2.add(a2);
  }
  group.add(arcs, arcs2);

  /* ring tech: bands of tiny lit cells on both faces, inside and outside the hull, plus a rim of emitters */
  const tech = techTexture();
  const bandMat = (opacity: number) => new THREE.MeshBasicMaterial({ map: tech, color: metal, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const inner = new THREE.Group(), outer = new THREE.Group();
  [5.4, -5.4].forEach((z) => {
    const a = noRay(new THREE.Mesh(bandGeo(R - 9.6, R - 5.9, 14), bandMat(0.9))); a.position.z = z * 0.35; inner.add(a);
    const b = noRay(new THREE.Mesh(bandGeo(R + 6.2, R + 10.4, 18), bandMat(0.6))); b.position.z = z * 0.2; outer.add(b);
  });
  const far = noRay(new THREE.Mesh(bandGeo(R + 21.5, R + 23.2, 26), bandMat(0.4)));
  group.add(inner, outer, far);
  const EMIT = 96, emitGeo = new THREE.BoxGeometry(0.9, 2.6, 0.9), emitMat = new THREE.MeshBasicMaterial({ color: glow[1] });
  const emit = noRay(new THREE.InstancedMesh(emitGeo, emitMat, EMIT)), m4 = new THREE.Object3D();
  for (let i = 0; i < EMIT; i++) { const a = (i / EMIT) * Math.PI * 2; m4.position.set(Math.cos(a) * (R - 11.2), Math.sin(a) * (R - 11.2), 0); m4.rotation.z = a + Math.PI / 2; m4.updateMatrix(); emit.setMatrixAt(i, m4.matrix); }
  group.add(emit);

  /* event horizon */
  const uni = { uT: { value: 0 }, uPower: { value: 0 }, uA: { value: new THREE.Color(glow[0]) }, uB: { value: new THREE.Color(glow[1]) } };
  const horizon = noRay(new THREE.Mesh(new THREE.CircleGeometry(R - 10.5, 72),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: HORIZON_VS, fragmentShader: HORIZON_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
  group.add(horizon);
  const tex = softDot();
  const halo = noRay(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: glow[0], transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })));
  halo.scale.setScalar(R * 4.4); group.add(halo);

  /* dust drawn into the ring from the map side */
  const DUST = 70, dp = new Float32Array(DUST * 3);
  const dust = Array.from({ length: DUST }, () => ({ a: rand(0, 6.283), r: rand(0.15, 1), z: rand(0, 1), w: rand(0.4, 1.1) }));
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dustPts = noRay(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 2.6, map: tex, color: glow[1], transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending })));
  group.add(dustPts);
  const placeDust = () => {
    dust.forEach((d, i) => { const rr = d.r * (R - 13) * (0.35 + 0.65 * d.z); dp[i * 3] = Math.cos(d.a) * rr; dp[i * 3 + 1] = Math.sin(d.a) * rr; dp[i * 3 + 2] = d.z * 95; });
    dustGeo.attributes.position.needsUpdate = true;
  };
  placeDust();

  let power = 0, target = 0, hover = false;
  const update = (t: number, dt: number) => {
    power += (Math.max(target, hover ? 0.35 : 0) - power) * Math.min(1, dt * 3.2);
    uni.uPower.value = power;
    halo.material.opacity = 0.26 + power * 0.5;
    if (still) return;
    uni.uT.value = t;
    arcs.rotation.z += dt * 0.11; arcs2.rotation.z -= dt * 0.17;
    inner.rotation.z += dt * 0.02; outer.rotation.z -= dt * 0.013; far.rotation.z += dt * 0.03;
    const breath = 0.5 + 0.5 * Math.sin(t * 0.8); // in step with the horizon
    halo.scale.setScalar(R * (4.2 + 0.35 * breath + power * 0.8));
    inner.children.forEach((b: Obj) => { b.material.opacity = 0.7 + 0.25 * breath; });
    const lead = (t * 2.2) % SEG;
    lamps.forEach((l) => { const d = (l.userData.i - lead + SEG) % SEG; l.material.opacity = 0.22 + 0.78 * Math.max(0, 1 - d / 4) + power * 0.5; });
    const pull = 1 + power * 4;
    dust.forEach((d) => { d.z -= dt * 0.11 * d.w * pull; d.a += dt * 0.5 * d.w * pull; if (d.z < 0) { d.z = 1; d.r = rand(0.15, 1); } });
    placeDust();
  };

  const plane = new THREE.Plane();
  const moveTo = (x: number, y: number, z: number) => {
    group.position.set(x, y, z); position.x = x; position.y = y; position.z = z;
    group.lookAt(x + n.x, y + n.y, z + n.z); // local +z is the face normal
    plane.setFromNormalAndCoplanarPoint(n, group.position);
  };
  moveTo(...at);
  const ray = new THREE.Raycaster(), pt = new THREE.Vector3(), ndc = new THREE.Vector2();
  const hit = (x: number, y: number, camera: Obj) => {
    ndc.set(x, y); ray.setFromCamera(ndc, camera);
    return !!ray.ray.intersectPlane(plane, pt) && pt.distanceTo(group.position) < (R + 9) * SCALE;
  };

  return {
    group, position, normal: { x: n.x, y: n.y, z: n.z }, update, hit, moveTo,
    setHover: (on) => { hover = on; },
    charge: () => { target = 1; },
    dispose: () => { group.traverse((o: Obj) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x: Obj) => { x.map?.dispose?.(); x.dispose?.(); }); }); },
  };
}
