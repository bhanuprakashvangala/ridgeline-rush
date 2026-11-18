// Detailed 3D dirt bike + rider, built from primitives at runtime (no external models).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTexture } from './textures.js';

const RR = window.RR;
const UP = new THREE.Vector3(0, 1, 0);

function mats(renderer) {
  const cloth = getTexture('cloth', 512, renderer).normal;
  const fabric = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, normalMap: cloth, normalScale: new THREE.Vector2(0.6, 0.6) });
  return {
    plastic: new THREE.MeshPhysicalMaterial({ color: 0xff3d00, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xe8e8e6, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.93 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 1, roughness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 1, roughness: 0.08 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a124, metalness: 1, roughness: 0.28 }),
    frame: new THREE.MeshPhysicalMaterial({ color: 0x30343b, metalness: 0.7, roughness: 0.35, clearcoat: 0.6 }),
    engine: new THREE.MeshStandardMaterial({ color: 0x3c3f46, metalness: 0.75, roughness: 0.42 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.75, normalMap: cloth, normalScale: new THREE.Vector2(0.4, 0.4) }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x9a6c4e, metalness: 1, roughness: 0.32 }),
    muffler: new THREE.MeshStandardMaterial({ color: 0xbfc3c9, metalness: 0.95, roughness: 0.3 }),
    spring: new THREE.MeshPhysicalMaterial({ color: 0xffc21a, roughness: 0.3, clearcoat: 1 }),
    jersey: fabric(0x1b2340), jerseyAccent: fabric(0xff5a10), pants: fabric(0x2a303c),
    boot: new THREE.MeshPhysicalMaterial({ color: 0xebebeb, roughness: 0.45, clearcoat: 0.5 }),
    glove: fabric(0xff5a10),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0xf5f5f3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xff8c1a, metalness: 0.8, roughness: 0.05, clearcoat: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0 }),
  };
}

function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

function extrude(pts, depth, mat, bevel) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const b = bevel == null ? 0.018 : bevel;
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return shadowed(new THREE.Mesh(g, mat));
}

function tube(points, radius, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0)));
  return shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 24, radius, 12, false), mat));
}

function numberDecal(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.font = 'italic 900 130px "Rajdhani", "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 86);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

function buildWheel(M, front) {
  const R = 0.36, g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(R - 0.075, 0.075, 20, 72), M.rubber)));
  const knobs = [];
  for (let row = -1; row <= 1; row += 2) {
    for (let k = 0; k < 40; k++) {
      const a = ((k + (row > 0 ? 0.5 : 0)) / 40) * Math.PI * 2;
      const kg = new THREE.BoxGeometry(0.045, 0.04, 0.05);
      kg.translate(0, R - 0.008, row * 0.035);
      kg.rotateZ(a);
      knobs.push(kg);
    }
  }
  g.add(shadowed(new THREE.Mesh(mergeGeometries(knobs), M.rubber)));
  g.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(R * 0.73, 0.02, 10, 72), M.black)));
  const sp = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2, side = k % 2 ? 1 : -1;
    const a0 = new THREE.Vector3(Math.cos(a + 0.4 * side) * 0.045, Math.sin(a + 0.4 * side) * 0.045, side * 0.055);
    const a1 = new THREE.Vector3(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72, 0);
    const d = a1.clone().sub(a0), len = d.length();
    const cg = new THREE.CylinderGeometry(0.0045, 0.0045, len, 5);
    cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    cg.translate((a0.x + a1.x) / 2, (a0.y + a1.y) / 2, (a0.z + a1.z) / 2);
    sp.push(cg);
  }
  g.add(new THREE.Mesh(mergeGeometries(sp), M.chrome));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.17, 20), M.alu);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(front ? 0.135 : 0.11, front ? 0.135 : 0.11, 0.006, 40), M.alu);
  disc.rotation.x = Math.PI / 2; disc.position.z = front ? 0.075 : -0.075; g.add(disc);
  for (let k = 0; k < 8; k++) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 8), M.black);
    const a = (k / 8) * Math.PI * 2, rr = front ? 0.1 : 0.08;
    h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * rr, Math.sin(a) * rr, disc.position.z); g.add(h);
  }
  if (!front) {
    const spr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 36), M.black);
    spr.rotation.x = Math.PI / 2; spr.position.z = 0.09; g.add(spr);
  }
  return g;
}

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 16);
  return shadowed(new THREE.Mesh(g, mat));
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
function orient(mesh, a, b) {
  _d.subVectors(b, a);
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  if (_d.lengthSq() > 1e-8) mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
}

class Rider {
  constructor(M) {
    this.group = new THREE.Group();
    const add = (m) => { this.group.add(m); return m; };
    this.limbs = {};
    for (const s of [1, -1]) {
      const k = s > 0 ? 'n' : 'f';
      this.limbs['thigh' + k] = add(capsule(0.085, 0.47, M.pants));
      this.limbs['shin' + k] = add(capsule(0.07, 0.47, M.pants));
      this.limbs['boot' + k] = add(capsule(0.078, 0.24, M.boot));
      const sole = add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.06, 0.13, 2, 0.02), M.black)));
      this.limbs['sole' + k] = sole;
      this.limbs['upper' + k] = add(capsule(0.06, 0.35, M.jersey));
      this.limbs['fore' + k] = add(capsule(0.052, 0.35, M.jersey));
      this.limbs['cuff' + k] = add(capsule(0.056, 0.08, M.jerseyAccent));
      this.limbs['glove' + k] = add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), M.glove)));
      this.limbs['knee' + k] = add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), M.black)));
    }
    this.torso = add(capsule(0.15, 0.38, M.jersey));
    this.torso.scale.set(1, 1, 1.35);
    this.band = add(capsule(0.153, 0.06, M.jerseyAccent));
    this.band.scale.set(1, 1, 1.36);
    this.hips = add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), M.pants)));
    this.hips.scale.set(1, 0.9, 1.3);
    // helmet
    const h = (this.helmet = new THREE.Group());
    const shell = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.165, 32, 24), M.helmet));
    shell.scale.set(1.08, 1, 0.95); h.add(shell);
    const stripe = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.168, 32, 8, 0, Math.PI * 2, 0.55, 0.22), M.plasticAccent || M.jerseyAccent));
    stripe.scale.set(1.08, 1, 0.95); stripe.rotation.z = -0.5; h.add(stripe);
    const chin = extrude([[0.04, -0.03], [0.24, -0.06], [0.2, -0.18], [0.02, -0.16]], 0.2, M.helmet, 0.025); h.add(chin);
    const peak = extrude([[0.04, 0.13], [0.31, 0.1], [0.28, 0.06], [0.08, 0.07]], 0.24, M.jerseyAccent, 0.01); h.add(peak);
    const gog = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.24, 2, 0.02), M.black)); gog.position.set(0.17, 0.02, 0); h.add(gog);
    const lens = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.06, 0.2, 2, 0.01), M.lens); lens.position.set(0.2, 0.02, 0); h.add(lens);
    this.group.add(h);
    this.zs = { hip: 0.1, knee: 0.19, foot: 0.21, sh: 0.19, elbow: 0.3, hand: 0.33 };
  }

  // p: 2D joint dict {head,neck,pelvis,knee,foot,elbow,hand}; zOff shifts the whole figure
  pose(p, mirror) {
    const z = this.zs, L = this.limbs;
    const v = (q, zz) => new THREE.Vector3(q.x, q.y, zz);
    for (const s of [1, -1]) {
      const k = s > 0 ? 'n' : 'f';
      const ps = mirror ? p : p; // same 2D pose both sides
      const hip = v(ps.pelvis, s * z.hip), knee = v(ps.knee, s * z.knee), foot = v(ps.foot, s * z.foot);
      const sh = v(ps.neck, s * z.sh), el = v(ps.elbow, s * z.elbow), hand = v(ps.hand, s * z.hand);
      sh.y -= 0.05;
      orient(L['thigh' + k], hip, knee);
      orient(L['shin' + k], knee, foot);
      _a.copy(knee).lerp(foot, 0.42);
      orient(L['boot' + k], _a, foot);
      L['knee' + k].position.copy(knee).add(new THREE.Vector3(0.03, 0, s * 0.01));
      L['sole' + k].position.set(foot.x + 0.06, foot.y - 0.07, foot.z);
      L['sole' + k].rotation.z = Math.atan2(foot.y - knee.y, foot.x - knee.x) + Math.PI / 2;
      orient(L['upper' + k], sh, el);
      orient(L['fore' + k], el, hand);
      _b.copy(el).lerp(hand, 0.82);
      orient(L['cuff' + k], _b, hand);
      L['glove' + k].position.copy(hand);
    }
    const pel = v(p.pelvis, 0), nk = v(p.neck, 0);
    orient(this.torso, pel, nk);
    _a.copy(pel).lerp(nk, 0.55); _b.copy(pel).lerp(nk, 0.66);
    orient(this.band, _a, _b);
    this.hips.position.copy(pel);
    this.hips.rotation.z = Math.atan2(nk.y - pel.y, nk.x - pel.x) - Math.PI / 2;
    this.helmet.position.set(p.head.x, p.head.y, 0);
    this.helmet.rotation.z = Math.atan2(p.head.y - p.neck.y, p.head.x - p.neck.x) - Math.PI / 2;
  }
}

export class BikeModel {
  constructor(renderer) {
    const M = (this.M = mats(renderer));
    M.plasticAccent = M.plastic;
    this.group = new THREE.Group();
    this.chassis = new THREE.Group();
    this.group.add(this.chassis);
    this.wheels = [buildWheel(M, false), buildWheel(M, true)];
    this.group.add(this.wheels[0], this.wheels[1]);
    const C = this.chassis;

    // plastics
    C.add(extrude([[-0.15, 0.22], [-0.62, 0.3], [-1.07, 0.38], [-1.04, 0.29], [-0.62, 0.13], [-0.3, -0.02]], 0.32, M.plastic));
    C.add(extrude([[-0.64, 0.27], [-0.36, 0.22], [-0.38, 0.07], [-0.62, 0.13]], 0.36, M.white, 0.012));
    for (const s of [1, -1]) {
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.15), numberDecal('27'));
      num.position.set(-0.5, 0.17, s * 0.195); num.rotation.y = s > 0 ? 0 : Math.PI; num.rotation.z = 0.12 * s;
      C.add(num);
    }
    const seatShape = new THREE.Shape();
    seatShape.moveTo(-0.84, 0.33); seatShape.quadraticCurveTo(-0.35, 0.5, 0.12, 0.48);
    seatShape.lineTo(0.18, 0.41); seatShape.quadraticCurveTo(-0.3, 0.37, -0.84, 0.29); seatShape.closePath();
    const seatG = new THREE.ExtrudeGeometry(seatShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 4, curveSegments: 16 });
    seatG.translate(0, 0, -0.11);
    C.add(shadowed(new THREE.Mesh(seatG, M.seat)));
    C.add(extrude([[0.02, 0.44], [0.42, 0.54], [0.5, 0.41], [0.4, 0.12], [0.12, 0.08], [-0.06, 0.26]], 0.42, M.plastic));
    C.add(extrude([[0.08, 0.36], [0.44, 0.45], [0.47, 0.39], [0.12, 0.29]], 0.45, M.white, 0.01));
    this.fender = extrude([[-0.3, 0.0], [-0.05, 0.06], [0.22, 0.05], [0.42, -0.02], [0.4, -0.06], [0.2, -0.0], [-0.05, 0.01], [-0.28, -0.05]], 0.16, M.plastic);
    C.add(this.fender);
    C.add(extrude([[0.5, 0.48], [0.56, 0.64], [0.61, 0.62], [0.57, 0.44]], 0.22, M.white));
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), M.lamp);
    lamp.position.set(0.6, 0.56, 0); lamp.rotation.y = Math.PI / 2; lamp.rotation.x = -0.4; C.add(lamp);
    this.lampMat = M.lamp;

    // engine
    const eng = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.38, 0.28, 4, 0.05), M.engine));
    eng.position.set(0, -0.26, 0); C.add(eng);
    const head = new THREE.Group(); head.position.set(0.08, -0.03, 0); head.rotation.z = -0.25; C.add(head);
    const hb = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.2, 3, 0.03), M.engine)); hb.position.y = 0.1; head.add(hb);
    for (let k = 0; k < 6; k++) { const f = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.012, 0.25), M.alu)); f.position.y = 0.0 + k * 0.042; head.add(f); }
    for (const s of [1, -1]) {
      const cov = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 32), M.alu));
      cov.rotation.x = Math.PI / 2; cov.position.set(-0.07, -0.29, s * 0.15); C.add(cov);
    }
    // frame
    for (const s of [1, -1]) C.add(tube([[0.46, 0.44, s * 0.06], [0.12, 0.36, s * 0.1], [-0.25, 0.24, s * 0.1], [-0.13, -0.26, s * 0.1]], 0.03, M.frame));
    C.add(tube([[0.46, 0.4], [0.26, 0.02], [0.03, -0.42]], 0.034, M.frame));
    for (const s of [1, -1]) C.add(tube([[-0.25, 0.24, s * 0.1], [-0.6, 0.3, s * 0.09], [-0.85, 0.33, s * 0.07]], 0.018, M.frame));
    // exhaust
    C.add(tube([[0.18, -0.05, 0.1], [0.3, -0.25, 0.14], [0.05, -0.42, 0.17], [-0.2, -0.3, 0.18], [-0.4, -0.06, 0.18], [-0.52, 0.1, 0.17]], 0.034, M.pipe, 40));
    const muff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.5, 28), M.muffler));
    muff.position.set(-0.76, 0.17, 0.17); muff.rotation.z = Math.atan2(0.13, -0.45) - Math.PI / 2; C.add(muff);
    const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20), M.black));
    cap.position.set(-1.0, 0.24, 0.17); cap.rotation.z = muff.rotation.z; C.add(cap);
    // bars and clamps
    const bar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 12), M.alu));
    bar.rotation.x = Math.PI / 2; bar.position.set(0.41, 0.665, 0); C.add(bar);
    for (const s of [1, -1]) {
      const grip = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 14), M.rubber));
      grip.rotation.x = Math.PI / 2; grip.position.set(0.41, 0.665, s * 0.33); C.add(grip);
    }
    C.add(tube([[0.5, 0.5], [0.45, 0.6], [0.41, 0.665]], 0.02, M.black));
    for (const [y, x] of [[0.47, 0.5], [0.37, 0.47]]) {
      const tc = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.05, 0.3, 2, 0.015), M.alu)); tc.position.set(x, y, 0); C.add(tc);
    }
    // dynamic parts
    this.arms = [1, -1].map((s) => { const m = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1, 0.075, 0.045, 2, 0.015), M.alu)); m.userData.z = s * 0.12; C.add(m); return m; });
    this.chain = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 0.02), M.black)); C.add(this.chain);
    this.forkUp = [1, -1].map((s) => { const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.55, 16), M.chrome)); m.userData.z = s * 0.11; C.add(m); return m; });
    this.forkLow = [1, -1].map((s) => { const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.46, 16), M.gold)); m.userData.z = s * 0.11; C.add(m); return m; });
    const helix = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 2 * 9; helix.push(new THREE.Vector3(Math.cos(a) * 0.05, t, Math.sin(a) * 0.05)); }
    this.spring = shadowed(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 240, 0.011, 6), M.spring)); C.add(this.spring);
    this.shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), M.chrome)); C.add(this.shaft);

    this.rider = new Rider(M);
    C.add(this.rider.group);
    this.ragdollMode = false;

    this.headlight = new THREE.SpotLight(0xfff0d8, 0, 45, 0.5, 0.5, 1.2);
    this.headlight.position.set(0.62, 0.56, 0);
    this.headlight.target.position.set(6, -0.8, 0);
    C.add(this.headlight, this.headlight.target);
  }

  setPaint(color) { this.M.plastic.color.setHex(color); }

  setNight(on) {
    this.headlight.intensity = on ? 60 : 0;
    this.lampMat.emissiveIntensity = on ? 3 : 0;
  }

  update(bike, ragdoll, scene) {
    const c = bike.c, ca = Math.cos(c.a), sa = Math.sin(c.a);
    this.chassis.position.set(c.x, c.y, 0);
    this.chassis.rotation.z = c.a;
    for (let i = 0; i < 2; i++) {
      const w = bike.wheels[i];
      this.wheels[i].position.set(w.x, w.y, 0);
      this.wheels[i].rotation.z = w.ang;
    }
    const local = (w) => { const dx = w.x - c.x, dy = w.y - c.y; return new THREE.Vector3(dx * ca + dy * sa, -dx * sa + dy * ca, 0); };
    const rw = local(bike.wheels[0]), fw = local(bike.wheels[1]);
    const piv = new THREE.Vector3(-0.12, -0.26, 0);
    const dir = rw.clone().sub(piv), len = dir.length(), ang = Math.atan2(dir.y, dir.x);
    for (const m of this.arms) { m.position.set((piv.x + rw.x) / 2, (piv.y + rw.y) / 2, m.userData.z); m.rotation.z = ang; m.scale.x = len + 0.06; }
    const spk = new THREE.Vector3(-0.07, -0.29, 0.16);
    const cd = new THREE.Vector3(rw.x - spk.x, rw.y - spk.y, 0);
    this.chain.position.set((spk.x + rw.x) / 2, (spk.y + rw.y) / 2, 0.16);
    this.chain.rotation.z = Math.atan2(cd.y, cd.x); this.chain.scale.x = cd.length();
    const top = new THREE.Vector3(0.5, 0.47, 0), fd = fw.clone().sub(top), fl = fd.length(), fdir = fd.clone().normalize();
    for (const m of this.forkUp) { m.position.copy(top).addScaledVector(fdir, 0.26); m.position.z = m.userData.z; m.quaternion.setFromUnitVectors(UP, fdir); }
    for (const m of this.forkLow) { m.position.copy(fw).addScaledVector(fdir, -0.2); m.position.z = m.userData.z; m.quaternion.setFromUnitVectors(UP, fdir); }
    void fl;
    this.fender.position.set(fw.x - fdir.x * 0.42, fw.y - fdir.y * 0.42, 0);
    this.fender.rotation.z = Math.atan2(fdir.y, fdir.x) + Math.PI / 2 - 0.15;
    const sTop = new THREE.Vector3(-0.2, 0.16, 0), sBot = piv.clone().lerp(rw, 0.35); sBot.y += 0.05;
    const sd = sBot.clone().sub(sTop), sl = sd.length();
    this.spring.position.copy(sTop); this.spring.quaternion.setFromUnitVectors(UP, sd.clone().normalize()); this.spring.scale.set(1, sl, 1);
    this.shaft.position.copy(sTop).addScaledVector(sd, 0.5); this.shaft.quaternion.copy(this.spring.quaternion); this.shaft.scale.set(1, sl, 1);

    const R = this.rider;
    if (bike.alive && !ragdoll) {
      if (this.ragdollMode) { this.chassis.add(R.group); R.group.position.set(0, 0, 0); this.ragdollMode = false; }
      R.pose(RR.riderPose(bike.leanVis));
    } else if (ragdoll) {
      if (!this.ragdollMode) { scene.add(R.group); this.ragdollMode = true; }
      R.pose(ragdoll.p);
    }
  }
}
