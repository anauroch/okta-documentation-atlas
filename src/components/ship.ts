/**
 * A distant ship for the space scenery: a long-haul hauler that crosses the far background
 * very slowly, on its own path (not the comet's). Original design, built from primitives:
 * forward command module, open truss spine with cargo pods, radiator wings, reactor and drive.
 * The nose points along local +x.
 */
import * as THREE from "three";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;

const noRay = (o: Obj) => { o.raycast = () => {}; return o; };

export interface ShipLook {
  hull: number;    // main plating
  dark: number;    // truss, nozzle, recessed parts
  accent: number;  // window band and radiator glow
  plume: number;   // drive exhaust
  name: string;    // painted on both sides of the command module
  reg: string;     // small registry mark under the name
}

export interface Ship {
  group: Obj;
  /** t and dt in seconds */
  update(t: number, dt: number): void;
  /** crew EVA: the forward hatch opens, a crew member walks out along the hull, waves, and goes back in */
  startEva(): void;
  /** close the hatch and put the crew member back inside at once */
  resetEva(): void;
}

let glowTex: Obj = null;
function glow(): Obj {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.3, "rgba(255,255,255,.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** Radiator panel texture: thin vertical fins with a soft heat gradient toward the spine. */
function finTexture(accent: number): Obj {
  const c = document.createElement("canvas"); c.width = 128; c.height = 32;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(accent);
  const rgb = (a: number) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  g.fillStyle = "rgba(20,24,30,1)"; g.fillRect(0, 0, 128, 32);
  for (let x = 2; x < 128; x += 6) {
    const heat = 0.55 * (1 - x / 128) + 0.12;
    g.fillStyle = rgb(heat); g.fillRect(x, 2, 2, 28);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

/** Hull plating: offset panels, seams, rivets and slight tone variation. Tinted by the material colour. */
let plateTex: Obj = null;
function plating(): Obj {
  if (plateTex) return plateTex;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 8; row++) {
    const h = 32, off = row % 2 ? 24 : 0;
    for (let x = -off; x < 256; x += 48) {
      const v = 200 + Math.floor(rnd() * 46);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1, row * h + 1, 46, h - 2);
      g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(x + 1, row * h + h - 6, 46, 4); // shade at the panel's lower edge
      g.fillStyle = "rgba(60,60,60,.55)";
      for (const [rx, ry] of [[4, 4], [42, 4], [4, h - 5], [42, h - 5]]) g.fillRect(x + rx, row * h + ry, 2, 2); // rivets
      if (rnd() < 0.18) { g.fillStyle = "rgba(40,40,40,.35)"; g.fillRect(x + 10, row * h + 10, 26, 10); } // access hatch
    }
    g.fillStyle = "rgba(30,30,30,.7)"; g.fillRect(0, row * 32, 256, 1); // seam
  }
  plateTex = new THREE.CanvasTexture(c);
  plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping; plateTex.anisotropy = 4;
  return plateTex;
}

/** Name plate: hull-coloured panel with the ship's name, a registry mark and an accent rule. */
function namePlate(name: string, reg: string, hull: number, accent: number): Obj {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const g = c.getContext("2d")!;
  const h = new THREE.Color(hull), a = new THREE.Color(accent);
  const css = (k: Obj, m = 1) => `rgb(${Math.round(k.r * 255 * m)},${Math.round(k.g * 255 * m)},${Math.round(k.b * 255 * m)})`;
  const draw = () => {
    g.fillStyle = css(h); g.fillRect(0, 0, 512, 96);
    g.fillStyle = css(a); g.fillRect(16, 78, 330, 6);
    g.fillStyle = "#14171d"; g.font = "800 68px Archivo, Arial Black, sans-serif"; g.textBaseline = "alphabetic";
    g.fillText(name, 14, 66);
    g.font = "500 18px 'IBM Plex Mono', monospace"; g.fillText(reg, 360, 88);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  // the self-hosted fonts may still be loading; redraw once they are in
  document.fonts?.load?.("800 54px Archivo").then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return t;
}

export function createShip(look: ShipLook, still: boolean): Ship {
  const ship = new THREE.Group(); ship.name = "fx-ship";
  const plate = plating();
  const hull = new THREE.MeshLambertMaterial({ color: look.hull, map: plate, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: look.dark, flatShading: true });
  const lit = new THREE.MeshBasicMaterial({ color: look.accent });
  const add = (geo: Obj, mat: Obj, x = 0, y = 0, z = 0) => { const m = noRay(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); ship.add(m); return m; };
  const alongX = (m: Obj) => { m.rotation.z = -Math.PI / 2; return m; }; // cylinders are built along y

  /* command module: octagonal section with a blunt wedge nose and a lit window band */
  const OCT = Math.PI / 8; // turn the octagon so flat faces point up, down and to each side
  alongX(add(new THREE.CylinderGeometry(15, 19, 64, 8, 1, false, OCT), hull, 92));
  alongX(add(new THREE.CylinderGeometry(6, 15, 26, 8, 1, false, OCT), hull, 137));
  alongX(add(new THREE.CylinderGeometry(15.4, 15.6, 3, 8, 1, true, OCT), lit, 120));

  /* name on both flat sides of the module, readable from either side */
  const plateMat = new THREE.MeshLambertMaterial({ map: namePlate(look.name, look.reg, look.hull, look.accent), side: THREE.FrontSide });
  const lean = Math.atan2(4, 64); // the module tapers toward the nose
  for (const s of [1, -1]) {
    const m = add(new THREE.PlaneGeometry(52, 9.75), plateMat, 93, -1, s * 15.8);
    m.rotation.set(0, s > 0 ? lean : Math.PI - lean, 0); // lie flat on the tapered face
  }
  add(new THREE.BoxGeometry(12, 6, 4), dark, 81, 18.5, 0); // dorsal sensor spine, aft of the hatch

  /* spine: open truss of four rails with cross members */
  for (const [y, z] of [[7, 7], [7, -7], [-7, 7], [-7, -7]]) add(new THREE.BoxGeometry(150, 2.2, 2.2), dark, -15, y, z);
  for (let x = -85; x <= 55; x += 20) add(new THREE.BoxGeometry(2, 16, 16), dark, x, 0, 0);

  /* cargo: two rings of four pods around the truss */
  for (const x of [-38, 8]) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const pod = add(new THREE.BoxGeometry(38, 13, 13), k % 2 ? hull : dark, x, Math.cos(a) * 17, Math.sin(a) * 17);
      pod.rotation.x = a;
    }
  }

  /* radiator wings: thin panels above and below, glowing faintly */
  const fins = new THREE.MeshBasicMaterial({ map: finTexture(look.accent), side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  for (const s of [1, -1]) add(new THREE.PlaneGeometry(70, 46), fins, -60, s * 33, 0); // in the x-y plane, above and below the spine

  /* reactor and drive */
  add(new THREE.SphereGeometry(17, 12, 8), hull, -100);
  alongX(add(new THREE.CylinderGeometry(10, 12, 16, 10), dark, -118));
  alongX(add(new THREE.CylinderGeometry(9, 20, 26, 14, 1, true), dark, -137)).material.side = THREE.DoubleSide;

  /* armament: point-defence turrets that sweep slowly, and a keel-mounted rail gun */
  const turrets: { g: Obj; ph: number; w: number }[] = [];
  const turret = (x: number, y: number, z: number, rx: number) => {
    const mount = new THREE.Group(); mount.position.set(x, y, z); mount.rotation.x = rx; ship.add(mount);
    const g = new THREE.Group(); mount.add(g);
    const base = noRay(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5, 2, 10), dark)); base.position.y = 1; g.add(base);
    const dome = noRay(new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hull)); dome.position.y = 2; g.add(dome);
    for (const bz of [-1.3, 1.3]) {
      const b = noRay(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 11, 6), dark));
      b.rotation.z = -Math.PI / 2; b.position.set(6.5, 3.4, bz); g.add(b);
    }
    turrets.push({ g, ph: Math.random() * 6, w: 0.25 + Math.random() * 0.2 });
  };
  turret(116, 15, 0, 0); turret(68, 18, 0, 0);                    // dorsal, either side of the hatch
  turret(112, -16, 0, Math.PI); turret(70, -18, 0, Math.PI);       // ventral
  turret(-12, 0, 25, Math.PI / 2); turret(-12, 0, -25, -Math.PI / 2); // either side of the cargo section
  // rail gun along the keel: twin rails, a barrel and a muzzle collar
  for (const rz of [-3, 3]) add(new THREE.BoxGeometry(170, 2.4, 1.6), dark, 50, -25, rz);
  alongX(add(new THREE.CylinderGeometry(1.8, 2.2, 176, 8), hull, 52, -25, 0));
  alongX(add(new THREE.CylinderGeometry(3.4, 3.4, 6, 10), dark, 138, -25, 0));
  for (let x = -20; x <= 110; x += 26) add(new THREE.BoxGeometry(4, 7, 9), dark, x, -21, 0); // brackets to the hull

  /* exhaust: a hot core sprite plus a long additive cone, both flicker */
  const fade = document.createElement("canvas"); fade.width = 4; fade.height = 128;
  const fg = fade.getContext("2d")!, grad = fg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.55, "rgba(255,255,255,.25)"); grad.addColorStop(1, "rgba(255,255,255,1)");
  fg.fillStyle = grad; fg.fillRect(0, 0, 4, 128);
  // bright at the nozzle, gone by the tip
  const plumeMat = new THREE.MeshBasicMaterial({ color: look.plume, map: new THREE.CanvasTexture(fade), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const plume = alongX(add(new THREE.ConeGeometry(16, 150, 16, 1, true), plumeMat, -225));
  plume.rotation.z = Math.PI / 2; // cone tip points aft
  const core = noRay(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: look.plume, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  core.position.set(-152, 0, 0); core.scale.setScalar(70); ship.add(core);

  /* navigation lights: green to starboard, red to port, white strobe on the spine */
  const light = (color: number, x: number, y: number, z: number, size: number) => {
    const s = noRay(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.position.set(x, y, z); s.scale.setScalar(size); ship.add(s); return s;
  };
  const starboard = light(0x57ff9a, 58, 0, 22, 14);
  const port = light(0xff5a5a, 58, 0, -22, 14);
  const strobe = light(0xffffff, -20, 12, 0, 26);
  const tipA = light(look.accent, -60, 56, 0, 12), tipB = light(look.accent, -60, -56, 0, 12);

  /* ---- crew hatch on the dorsal face and a crew member for the EVA ---- */
  // the module tapers: radius 19 at x = 60, 15 at x = 124; the flat top sits at radius * cos(22.5°)
  const topY = (x: number) => (19 - ((x - 60) / 64) * 4) * Math.cos(Math.PI / 8);
  const HATCH_X = 92.5, HATCH_L = 6, HATCH_W = 5;
  add(new THREE.BoxGeometry(HATCH_L + 0.8, 0.3, HATCH_W + 0.8), dark, HATCH_X + HATCH_L / 2, topY(HATCH_X + HATCH_L / 2) + 0.1, 0); // frame
  const well = add(new THREE.BoxGeometry(HATCH_L - 0.4, 0.2, HATCH_W - 0.4), lit, HATCH_X + HATCH_L / 2, topY(HATCH_X + HATCH_L / 2) + 0.2, 0); // lit airlock below
  well.visible = false;
  const hinge = new THREE.Group(); hinge.position.set(HATCH_X, topY(HATCH_X) + 0.35, 0); ship.add(hinge);
  const door = noRay(new THREE.Mesh(new THREE.BoxGeometry(HATCH_L, 0.5, HATCH_W), hull)); door.position.set(HATCH_L / 2, 0, 0); hinge.add(door);

  const suit = new THREE.MeshLambertMaterial({ color: 0xf2f4f7, flatShading: true });
  const gear = new THREE.MeshLambertMaterial({ color: 0x5a6270, flatShading: true });
  const visor = new THREE.MeshBasicMaterial({ color: look.accent });
  const part = (geo: Obj, mat: Obj, parent: Obj, x = 0, y = 0, z = 0) => { const m = noRay(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); parent.add(m); return m; };
  // built facing +x, standing on y = 0, about 9 units tall
  const crew = new THREE.Group(); crew.visible = false; ship.add(crew);
  const body = new THREE.Group(); crew.add(body);
  const legs = [-1, 1].map((sz) => { const hip = new THREE.Group(); hip.position.set(0, 3.8, sz * 0.75); body.add(hip); part(new THREE.BoxGeometry(1.2, 3.8, 1.2), suit, hip, 0, -1.9, 0); part(new THREE.BoxGeometry(1.8, 0.7, 1.3), gear, hip, 0.3, -3.6, 0); return hip; });
  part(new THREE.BoxGeometry(2, 3.4, 2.4), suit, body, 0, 5.5, 0);                 // torso
  part(new THREE.BoxGeometry(1.2, 3, 2.2), gear, body, -1.5, 5.6, 0);             // life-support pack
  part(new THREE.SphereGeometry(1.35, 12, 8), suit, body, 0.1, 8.1, 0);           // helmet
  part(new THREE.SphereGeometry(0.95, 10, 6, Math.PI / 2, Math.PI, Math.PI / 4, Math.PI / 2), visor, body, 0.55, 8.1, 0); // visor, facing forward
  const lamp = noRay(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  lamp.position.set(1.2, 9, 0.9); lamp.scale.setScalar(3); body.add(lamp);
  const arms = [-1, 1].map((sz) => {
    const sh = new THREE.Group(); sh.position.set(0, 6.9, sz * 1.5); body.add(sh);
    part(new THREE.BoxGeometry(1, 2, 1), suit, sh, 0, -1, 0);
    const elbow = new THREE.Group(); elbow.position.set(0, -2, 0); sh.add(elbow);
    part(new THREE.BoxGeometry(0.9, 2, 0.9), suit, elbow, 0, -1, 0); part(new THREE.BoxGeometry(1, 0.8, 1), gear, elbow, 0, -2.3, 0);
    return { sh, elbow };
  });
  const wave = arms[1]; // right arm (+z when facing +x)

  const ease = (k: number) => k * k * (3 - 2 * k);
  const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const X0 = HATCH_X + HATCH_L / 2, X1 = 108; // from the hatch forward, short of the front turret
  let evaT = -1;
  const pose = (t: number) => {
    // 0-1.5 open, 1.5-3.5 climb out, 3.5-7 walk forward, 7-7.8 turn to the camera side, 7.8-11.3 wave,
    // 11.3-12.3 turn back, 12.3-15.8 walk back, 15.8-17.6 climb in, 17.6-19 close
    const open = ease(seg(t, 0, 1.5)) * (1 - ease(seg(t, 17.6, 19)));
    hinge.rotation.z = open * 1.95; well.visible = open > 0.05;
    const rise = ease(seg(t, 1.5, 3.5)) * (1 - ease(seg(t, 15.8, 17.6)));
    crew.visible = t > 1.4 && t < 17.7;
    const out = ease(seg(t, 3.5, 7)), back = ease(seg(t, 12.3, 15.8));
    const x = X0 + (X1 - X0) * (out - back);
    crew.position.set(x, topY(x) + (rise - 1) * 9.5, 0);
    // heading: forward (+x), then the camera side (+z), then back toward the hatch (-x)
    crew.rotation.y = -Math.PI / 2 * ease(seg(t, 7, 7.8)) - Math.PI / 2 * ease(seg(t, 11.3, 12.3));
    const walking = (t > 3.5 && t < 7) || (t > 12.3 && t < 15.8);
    const ph = t * 5.5;
    legs[0].rotation.z = walking ? Math.sin(ph) * 0.45 : 0; legs[1].rotation.z = walking ? -Math.sin(ph) * 0.45 : 0;
    arms[0].sh.rotation.z = walking ? -Math.sin(ph) * 0.35 : 0;
    const w = seg(t, 7.8, 8.3) * (1 - seg(t, 10.8, 11.3)); // raise, wave, lower
    wave.sh.rotation.x = -w * 2.6; // arm up and out to the side
    wave.sh.rotation.z = walking ? Math.sin(ph) * 0.35 : 0;
    wave.elbow.rotation.x = w * (0.35 + Math.sin(t * 9) * 0.45);
    body.position.y = walking ? Math.abs(Math.sin(ph)) * 0.25 : 0;
    lamp.material.opacity = crew.visible ? 0.6 + 0.4 * Math.sin(t * 3) : 0;
  };
  const startEva = () => { if (!still && evaT < 0) evaT = 0; };
  const resetEva = () => { evaT = -1; pose(0); crew.visible = false; };
  resetEva();

  const update = (t: number, dt: number) => {
    if (still) return;
    if (evaT >= 0) { evaT += dt; pose(evaT); if (evaT > 19.2) resetEva(); }
    turrets.forEach((k) => { k.g.rotation.y = Math.sin(t * k.w + k.ph) * 1.4; });
    const f = 0.85 + Math.sin(t * 23) * 0.07 + Math.sin(t * 37.3) * 0.05;
    plumeMat.opacity = 0.42 * f; core.scale.setScalar(70 * f); plume.scale.set(1, 0.9 + 0.12 * f, 1);
    const blink = (t % 1.6) < 0.12;
    strobe.material.opacity = blink ? 1 : 0;
    const nav = 0.65 + 0.35 * Math.sin(t * 2.4);
    starboard.material.opacity = nav; port.material.opacity = nav;
    tipA.material.opacity = tipB.material.opacity = 0.5 + 0.5 * Math.sin(t * 1.3);
  };
  return { group: ship, update, startEva, resetEva };
}
