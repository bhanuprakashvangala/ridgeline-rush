// 3D scene: renderer, sky, lighting, terrain, scenery, markers, particles and camera.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getTexture, dustSprite } from './textures.js';
import { BikeModel } from './bike3d.js';

const RR = window.RR;

export const QUALITY = {
  low: { pr: 1, shadow: 1024, tex: 512, grass: 0.35, trees: 0.5 },
  medium: { pr: 1.5, shadow: 2048, tex: 1024, grass: 0.7, trees: 0.8 },
  high: { pr: 2, shadow: 4096, tex: 1024, grass: 1, trees: 1 },
  ultra: { pr: 3, shadow: 4096, tex: 2048, grass: 1.5, trees: 1.2 },
};

const GROUND = {
  alpine: ['grass', 'dirt', 'rock'], dusk: ['grass', 'dirt', 'rock'], night: ['grass', 'dirt', 'rock'],
  desert: ['sand', 'dirt', 'redrock'], snow: ['snow', 'dirt', 'rock'],
};

function vnoise2(seed) {
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => RR.hash(a * 7919 + b * 104729, seed);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}
function fbm2(n, x, y, oct) {
  let s = 0, a = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; norm += a; a *= 0.5; f *= 2.03; }
  return s / norm;
}

function splatMaterial(A, B, C) {
  const m = new THREE.MeshStandardMaterial({ map: A.map, normalMap: A.normal, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.mapB = { value: B.map }; sh.uniforms.mapC = { value: C.map };
    sh.uniforms.nB = { value: B.normal }; sh.uniforms.nC = { value: C.normal };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 splat;\nvarying vec2 vSplat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mapB; uniform sampler2D mapC; uniform sampler2D nB; uniform sampler2D nC;\nvarying vec2 vSplat;')
      .replace('#include <map_fragment>', `
        vec4 cA = texture2D(map, vMapUv);
        vec4 cB = texture2D(mapB, vMapUv * 1.3);
        vec4 cC = texture2D(mapC, vMapUv * 0.7);
        float lumB = dot(cB.rgb, vec3(0.33));
        float wB = smoothstep(0.0, 1.0, clamp(vSplat.x * 1.4 - 0.2 + (lumB - 0.3) * 0.6, 0.0, 1.0));
        float wC = clamp(vSplat.y, 0.0, 1.0);
        diffuseColor *= mix(mix(cA, cB, wB), cC, wC);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 nA0 = texture2D(normalMap, vNormalMapUv).xyz;
        vec3 nB0 = texture2D(nB, vNormalMapUv * 1.3).xyz;
        vec3 nC0 = texture2D(nC, vNormalMapUv * 0.7).xyz;
        vec3 mapN = mix(mix(nA0, nB0, clamp(vSplat.x, 0.0, 1.0)), nC0, clamp(vSplat.y, 0.0, 1.0)) * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`);
  };
  m.customProgramCacheKey = () => 'splat3';
  return m;
}

function pineGeometry(snow, seed) {
  const r = RR.rng(seed);
  const parts = [];
  const color = (g, fn) => {
    const p = g.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i)); cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  };
  const trunk = new THREE.CylinderGeometry(0.09, 0.2, 3.2, 8, 1, true).translate(0, 1.6, 0);
  color(trunk, () => [0.2, 0.13, 0.08]);
  parts.push(trunk);
  const layers = 8;
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1);
    const rad = 2.0 * (1 - f * 0.85) * (0.9 + r() * 0.2), h = 1.7 - f * 0.6, y0 = 1.1 + f * 6.2;
    const g = new THREE.ConeGeometry(rad, h, 20, 3, true);
    const p = g.attributes.position, nrm = g.attributes.normal;
    const ph = r() * 6;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k), yy = p.getY(k);
      const a = Math.atan2(z, x), rr = Math.hypot(x, z);
      const tip = 1 + 0.32 * Math.cos(a * 7 + ph) * (rr / rad);
      const droop = (rr / rad) * (rr / rad) * 0.35;
      p.setXYZ(k, x * tip, yy - droop, z * tip);
      const nx = Math.cos(a), nz = Math.sin(a);
      const ny = 0.75;
      const l = Math.hypot(nx, ny, nz);
      nrm.setXYZ(k, nx / l, ny / l, nz / l);
    }
    g.translate(0, y0 + h / 2, 0);
    const tone = 0.8 + r() * 0.3;
    color(g, (x, y, z) => {
      const t = RR.clamp((y - y0) / h, 0, 1), edge = RR.clamp(Math.hypot(x, z) / rad, 0, 1);
      const lum = (0.35 + 0.65 * edge * edge) * tone;
      let c = [0.025 * lum, 0.085 * lum, 0.035 * lum];
      if (snow) { const sn = RR.smooth(RR.clamp((1 - t) * 0.6 + edge * 0.5 - 0.35, 0, 1)) * 0.85; c = [c[0] + (0.9 - c[0]) * sn, c[1] + (0.94 - c[1]) * sn, c[2] + (0.98 - c[2]) * sn]; }
      return c;
    });
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function boulderGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position, n = vnoise2(seed), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + (fbm2(n, v.x * 1.4 + v.z * 0.7 + 10, v.y * 1.4 - v.z * 0.5 + 10, 4) - 0.5) * 0.55;
    v.multiplyScalar(d);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3;
    p.setXYZ(i, v.x, v.y * 0.75, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function grassTexture(color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const r = RR.rng(77);
  for (let i = 0; i < 70; i++) {
    const x = 20 + r() * 216, h = 120 + r() * 130, lean = (r() - 0.5) * 70, w = 3 + r() * 5;
    const grd = g.createLinearGradient(0, 256, 0, 256 - h);
    grd.addColorStop(0, `rgba(${color[0] * 0.45},${color[1] * 0.45},${color[2] * 0.45},1)`);
    grd.addColorStop(1, `rgba(${Math.min(255, color[0] * 1.25)},${Math.min(255, color[1] * 1.2)},${color[2]},1)`);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(x - w, 256); g.quadraticCurveTo(x + lean * 0.3, 256 - h * 0.6, x + lean, 256 - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.3, 256 - h * 0.6, x + w, 256); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTexture(text, w, h, opts) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#111'; g.fillRect(0, 0, w, h);
  const sq = h / 6;
  for (let i = 0; i < w / sq; i++) for (let j = 0; j < 1; j++) {
    g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
    g.fillRect(i * sq, 0, sq, sq); g.fillStyle = (i + 1) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * sq, h - sq, sq, sq);
  }
  g.fillStyle = opts.fg || '#fff';
  g.font = `italic 700 ${Math.round(h * 0.52)}px "Rajdhani", "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.03);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#151515' : '#f2f2f2'; g.fillRect(i * 32, j * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(canvas, qualityName) {
    this.q = QUALITY[qualityName] || QUALITY.high;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.3, 6000);
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    this.scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.lightDir = new THREE.Vector3(0.4, 0.8, 0.4).normalize();
    this.pmrem = new THREE.PMREMGenerator(r);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.bike = new BikeModel(r);
    this.scene.add(this.bike.group);
    this.applyQuality();
    this.initParticles();
    this.level = null;
    this.flags = [];
  }

  setQuality(name) { this.q = QUALITY[name] || QUALITY.high; this.applyQuality(); }

  applyQuality() {
    const s = this.q.shadow;
    if (this.sun.shadow.mapSize.width !== s) {
      this.sun.shadow.mapSize.set(s, s);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.resize(true);
  }

  resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pr);
    if (!force && w === this.w && h === this.h && pr === this.pr) return;
    this.w = w; this.h = h; this.pr = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.dustMat) this.dustMat.uniforms.scale.value = (h * pr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  initParticles() {
    const MAX = 800;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dustSprite() }, scale: { value: 800 } },
      vertexShader: `attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 5;
    this.scene.add(this.dust);
    this.MAXP = MAX;
    this.resize(true);
  }

  dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) { if (m.userData.own && m.map) m.map.dispose(); m.dispose(); }
    });
  }

  loadLevel(L) {
    if (this.level === L) return;
    this.level = L;
    for (const ch of [...this.levelGroup.children]) { this.levelGroup.remove(ch); this.dispose(ch); }
    this.flags = [];
    const th = L.theme;
    this.applyTheme(L, th);
    this.buildTerrain(L, th);
    this.buildScenery(L, th);
    this.buildMarkers(L);
    this.buildPickups(L);
    this.bike.setNight(!!th.night);
  }

  applyTheme(L, th) {
    const u = this.sky.material.uniforms;
    u.turbidity.value = th.sky.turbidity; u.rayleigh.value = th.sky.rayleigh;
    u.mieCoefficient.value = th.sky.mie; u.mieDirectionalG.value = 0.8;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - th.sky.elev), THREE.MathUtils.degToRad(th.sky.azim));
    u.sunPosition.value.copy(sunDir);
    this.renderer.toneMappingExposure = th.exposure;
    // light comes from the sun, or from the moon at night
    if (th.night) this.lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(40));
    else this.lightDir.copy(sunDir);
    if (this.lightDir.y < 0.12) { this.lightDir.y = 0.12; this.lightDir.normalize(); }
    this.sun.color.set(th.sun); this.sun.intensity = th.sunI;
    this.hemi.color.set(th.hemiSky); this.hemi.groundColor.set(th.hemiGround); this.hemi.intensity = th.hemiI;
    this.scene.fog = new THREE.FogExp2(th.fog, th.night ? 0.0018 : 0.00068);
    // reflections from the sky
    const envScene = new THREE.Scene();
    this.scene.remove(this.sky); envScene.add(this.sky);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.02);
    envScene.remove(this.sky); this.scene.add(this.sky);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = th.night ? 0.3 : 0.55;
    if (th.night) {
      const N = 2500, pos = new Float32Array(N * 3), rr = RR.rng(5);
      for (let i = 0; i < N; i++) {
        const v = new THREE.Vector3().setFromSphericalCoords(4000, Math.acos(rr() * 0.95), rr() * Math.PI * 2);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6 * this.pr, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
      stars.userData.follow = true;
      this.levelGroup.add(stars);
      const moonDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(68), THREE.MathUtils.degToRad(195));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));
      moon.position.copy(moonDir.multiplyScalar(3800));
      moon.userData.follow = true;
      this.levelGroup.add(moon);
    }
  }

  surfaceFns(L) {
    // smoothed profile for terrain away from the riding line
    const n = L.n, st = L.step, sm = new Float32Array(n), win = Math.round(5 / st);
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + L.ys[i];
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - win), b = Math.min(n, i + win + 1); sm[i] = (pre[b] - pre[a]) / (b - a); }
    const smoothH = (x) => { const f = RR.clamp(x / st, 0, n - 1), i = Math.floor(f), t = f - i; return i >= n - 1 ? sm[n - 1] : sm[i] + (sm[i + 1] - sm[i]) * t; };
    const nz = vnoise2(L.def.seed + 5);
    const surfY = (x, z) => {
      const az = Math.abs(z);
      if (az <= 1.3) return L.height(x) + (az > 0.9 ? (nz(x * 0.8, z * 0.8) - 0.5) * 0.08 * (az - 0.9) / 0.4 : 0);
      const t = az - 1.3, k = RR.smooth(RR.clamp(t / 2.5, 0, 1));
      const base = L.height(x) * (1 - k) + smoothH(x) * k;
      if (z < 0) {
        const bank = 0.7 * RR.smooth(RR.clamp(t / 3, 0, 1)) - Math.max(0, t - 4) * 0.55 - Math.max(0, t - 20) * 0.35;
        return base + bank + (fbm2(nz, x * 0.05, z * 0.05, 4) - 0.5) * Math.min(1, t / 4) * 7 + (nz(x * 0.6, z * 0.6) - 0.5) * 0.25 * Math.min(1, t);
      }
      return base - t * 0.1 + (nz(x * 0.7, z * 0.7) - 0.5) * 0.12 * Math.min(1, t);
    };
    return { surfY, smoothH, nz };
  }

  buildTerrain(L, th) {
    const set = GROUND[L.def.theme];
    const ts = this.q.tex;
    const A = getTexture(set[0], ts, this.renderer), B = getTexture(set[1], ts, this.renderer), C = getTexture(set[2], ts, this.renderer);
    const mat = splatMaterial(A, B, C);
    const { surfY, nz } = (this.fns = this.surfaceFns(L));
    const x0 = -60, x1 = L.length + 10;
    const mkGrid = (xs, zs, splatFn) => {
      const nx = xs.length, nzc = zs.length;
      const pos = new Float32Array(nx * nzc * 3), uv = new Float32Array(nx * nzc * 2), spl = new Float32Array(nx * nzc * 2);
      // arc length along x for less texture stretching on steep slopes
      const s = new Float32Array(nx);
      for (let i = 1; i < nx; i++) { const dy = L.height(xs[i]) - L.height(xs[i - 1]); s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], dy * 0.8); }
      for (let j = 0; j < nzc; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = xs[i], z = zs[j], y = surfY(x, z);
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        uv[k * 2] = s[i] / 4; uv[k * 2 + 1] = -z / 4;
        const sp = splatFn(x, z, y);
        spl[k * 2] = sp[0]; spl[k * 2 + 1] = sp[1];
      }
      const idx = [];
      for (let j = 0; j < nzc - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('splat', new THREE.BufferAttribute(spl, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      return m;
    };
    const steep = (x) => RR.smooth(RR.clamp((Math.abs(L.slope(x)) - 0.45) / 0.3, 0, 1));
    const nearXs = [];
    for (let x = x0; x <= x1; x += L.step) nearXs.push(x);
    const nearZs = [-5.2, -4.2, -3.4, -2.7, -2.1, -1.6, -1.3, -1.0, -0.6, -0.3, 0, 0.3, 0.6, 1.0, 1.3, 1.6, 1.9, 2.2, 2.4];
    this.levelGroup.add(mkGrid(nearXs, nearZs, (x, z) => {
      const az = Math.abs(z), nn = nz(x * 0.35, z * 0.9);
      let path = (1 - RR.smooth(RR.clamp((az - 0.55) / 0.9, 0, 1))) * (0.75 + nn * 0.4);
      const rk = Math.max(L.roughAt(x) * 0.9, steep(x)) * (1 - RR.smooth(RR.clamp((az - 1.2) / 3, 0, 1)));
      return [RR.clamp(path, 0, 1), RR.clamp(rk * (0.7 + nn * 0.5), 0, 1)];
    }));
    const farXs = [];
    for (let x = x0; x <= x1; x += 1) farXs.push(x);
    const farZs = [-60, -48, -38, -30, -24, -19, -15, -12, -9.5, -7.5, -6, -5];
    this.levelGroup.add(mkGrid(farXs, farZs, (x, z) => {
      const o = fbm2(nz, x * 0.04 + 50, z * 0.06, 3);
      return [0, RR.smooth(RR.clamp((o - 0.58) * 6, 0, 1))];
    }));
    // front cliff face
    const W = getTexture(set[2] === 'rock' ? 'cliff' : set[2], ts, this.renderer);
    const cliffMat = new THREE.MeshStandardMaterial({ map: W.map, normalMap: W.normal, roughness: 0.92 });
    const cx = [];
    for (let x = x0; x <= x1; x += 0.5) cx.push(x);
    const drops = [0, 0.3, 0.8, 1.6, 2.8, 4.5, 7, 11, 17, 26, 40, 60];
    const nx = cx.length, nr = drops.length;
    const pos = new Float32Array(nx * nr * 3), uv = new Float32Array(nx * nr * 2);
    for (let j = 0; j < nr; j++) for (let i = 0; i < nx; i++) {
      const x = cx[i], top = surfY(x, 2.4), k = (j * nx + i);
      const jag = j === 0 ? 0 : (fbm2(nz, x * 0.4, drops[j] * 0.3 + 30, 3) - 0.5) * 1.4 * Math.min(1, drops[j] / 1.5);
      const y = top - drops[j];
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = 2.4 + jag - Math.min(drops[j] * 0.08, 1.2);
      uv[k * 2] = x / 2.2; uv[k * 2 + 1] = y / 2.2;
    }
    const idx = [];
    for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    cg.setIndex(idx); cg.computeVertexNormals();
    const cliff = new THREE.Mesh(cg, cliffMat);
    cliff.receiveShadow = true;
    this.levelGroup.add(cliff);
  }

  buildScenery(L, th) {
    const { surfY, smoothH } = this.fns;
    const r = RR.rng(L.def.seed + 31);
    const set = GROUND[L.def.theme];
    const C = getTexture(set[2], this.q.tex, this.renderer);
    const rockMat = new THREE.MeshStandardMaterial({ map: C.map, normalMap: C.normal, roughness: 0.9, color: 0xdddddd });
    const dummy = new THREE.Object3D();
    const x0 = -60, x1 = L.length + 10;

    // boulders: track features + scattered
    const rocks = [];
    for (const p of L.props) {
      if (p.type === 'boulder') rocks.push([p.x, L.height(p.x) - p.h * 0.88, 0, p.w * 0.58, p.h * 1.05, 1.25, r() * 6]);
      else if (p.type === 'ledge') rocks.push([p.x + 0.45, L.height(p.x + 0.6) - p.h * 0.75, 0, 0.75, p.h * 0.95, 1.4, r() * 6]);
    }
    for (let x = x0; x < x1; x += 0.8) {
      const rk = L.roughAt(x);
      if (r() < 0.05 + rk * 0.12) { const s = 0.15 + r() * (0.4 + rk * 0.5), z = -1.7 - r() * 3; rocks.push([x, surfY(x, z) - s * 0.25, z, s * (1 + r()), s, s * (1 + r() * 0.5), r() * 6]); }
      if (r() < 0.06 + rk * 0.1) { const s = 0.1 + r() * 0.3, z = 1.6 + r() * 0.75; rocks.push([x, surfY(x, z) - s * 0.25, z, s * (1 + r()), s, s, r() * 6]); }
      if (r() < 0.025) { const s = 0.6 + r() * 2.2, z = -6 - r() * 40; rocks.push([x, surfY(x, z) - s * 0.3, z, s * (1 + r() * 0.8), s * (0.6 + r() * 0.6), s, r() * 6]); }
    }
    const geos = [boulderGeometry(L.def.seed), boulderGeometry(L.def.seed + 1), boulderGeometry(L.def.seed + 2)];
    const buckets = [[], [], []];
    rocks.forEach((rk, i) => buckets[i % 3].push(rk));
    buckets.forEach((list, bi) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geos[bi], rockMat, list.length);
      list.forEach((q, i) => { dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, q[6], 0); dummy.scale.set(q[3], q[4], q[5]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.castShadow = true; im.receiveShadow = true;
      this.levelGroup.add(im);
    });

    // logs
    const logs = L.props.filter((p) => p.type === 'log');
    if (logs.length) {
      const bark = getTexture('bark', 512, this.renderer);
      const barkMat = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normal, roughness: 0.9 });
      const endMat = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.8 });
      const lg = new THREE.CylinderGeometry(1, 1, 2.8, 20, 1);
      const im = new THREE.InstancedMesh(lg, [barkMat, endMat, endMat], logs.length);
      logs.forEach((p, i) => {
        const rad = Math.min(0.26, p.h * 0.8);
        dummy.position.set(p.x, L.height(p.x) - rad + 0.02, -0.1); dummy.rotation.set(Math.PI / 2, 0.1 * (i % 2 ? 1 : -1), 0);
        dummy.scale.set(rad, 1, rad); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      im.castShadow = true; im.receiveShadow = true;
      this.levelGroup.add(im);
    }

    // trees
    if (th.trees !== 'none') {
      const list = [];
      const dens = th.treeDensity * this.q.trees;
      for (let x = x0 - 40; x < x1 + 40; x += 1.6) {
        for (let k = 0; k < 3; k++) {
          if (r() > dens * 0.55) continue;
          const z = -9 - Math.pow(r(), 0.8) * 50;
          const near = z > -12 ? 0.5 : 1;
          if (r() > near) continue;
          const s = 0.7 + r() * 0.9;
          list.push([x + r() * 1.6, surfY(x, z) - 0.3, z, s, r() * 6]);
        }
      }
      const variants = [pineGeometry(th.trees === 'snowpine', 1), pineGeometry(th.trees === 'snowpine', 2)];
      const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      variants.forEach((g, vi) => {
        const sub = list.filter((_, i) => i % 2 === vi);
        if (!sub.length) return;
        const im = new THREE.InstancedMesh(g, tmat, sub.length);
        sub.forEach((q, i) => { dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, q[4], 0); dummy.scale.set(q[3], q[3] * (0.9 + (i % 5) * 0.06), q[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.castShadow = true; im.receiveShadow = true;
        this.levelGroup.add(im);
      });
    } else {
      // desert: sandstone spires on the hillside
      const sp = [];
      for (let x = x0; x < x1; x += 14) if (r() < 0.5) { const z = -14 - r() * 40, s = 3 + r() * 6; sp.push([x, surfY(x, z) - 1, z, s * 0.6, s * (1.5 + r()), s * 0.6, r() * 6]); }
      if (sp.length) {
        const im = new THREE.InstancedMesh(boulderGeometry(9), rockMat, sp.length);
        sp.forEach((q, i) => { dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, q[6], 0); dummy.scale.set(q[3], q[4], q[5]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.castShadow = true; this.levelGroup.add(im);
      }
    }

    // grass tufts
    if (th.ground !== 'snow') {
      const desert = th.ground === 'sand';
      const col = desert ? [170, 140, 80] : th.night ? [70, 110, 80] : L.def.theme === 'dusk' ? [90, 130, 60] : [110, 160, 60];
      const gt = grassTexture(col);
      const gmat = new THREE.MeshStandardMaterial({ map: gt, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
      gmat.userData.own = true;
      const q1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), q2 = q1.clone().rotateY(Math.PI / 2), q3 = q1.clone().rotateY(Math.PI / 4);
      const gg = mergeGeometries([q1, q2, q3]);
      const nrm = gg.attributes.normal;
      for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
      const list = [];
      const cnt = this.q.grass * (desert ? 0.25 : 1);
      for (let x = x0; x < x1; x += 0.35) {
        if (r() > cnt) continue;
        const rk = L.roughAt(x);
        if (rk > 0.7 && r() < 0.8) continue;
        const side = r();
        let z;
        if (side < 0.35) z = -1.05 - r() * 2.5; else if (side < 0.6) z = 1.05 + r() * 1.3; else z = -3.5 - r() * 12;
        const s = (desert ? 0.5 : 0.28) + r() * 0.3;
        list.push([x, surfY(x, z) - 0.03, z, s]);
      }
      if (list.length) {
        const im = new THREE.InstancedMesh(gg, gmat, list.length);
        list.forEach((q, i) => { dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, (i * 1.7) % 6.28, 0); dummy.scale.set(q[3] * 1.4, q[3], q[3] * 1.4); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.receiveShadow = true;
        this.levelGroup.add(im);
      }
    }

    // distant mountain ranges
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < L.n; i += 20) { minY = Math.min(minY, L.ys[i]); maxY = Math.max(maxY, L.ys[i]); }
    const mid = L.length / 2;
    const layers = [
      { w: 3200, d: 600, sx: 480, sz: 90, z: -520, h: 70 + (maxY - minY) * 0.5, seed: 3 },
      { w: 7000, d: 1400, sx: 500, sz: 90, z: -1600, h: 330, seed: 4 },
    ];
    for (const ly of layers) {
      const g = new THREE.PlaneGeometry(ly.w, ly.d, ly.sx, ly.sz);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, cols = new Float32Array(p.count * 3);
      const n = vnoise2(L.def.seed * 3 + ly.seed);
      const base = new THREE.Color(th.mountains), snowC = new THREE.Color(0xf2f6fb), tmp = new THREE.Color();
      const dark = th.trees !== 'none' ? new THREE.Color(0x1e3020).lerp(base, 0.25) : base.clone().multiplyScalar(0.55);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const wx = x + (n(x / 400 + 9, z / 400) - 0.5) * 300, wz = z + (n(x / 400, z / 400 + 9) - 0.5) * 300;
        let rid = 0, a = 1, f = 1 / 320, norm = 0, prev = 1;
        const oct = ly.seed === 3 ? 5 : 4;
        for (let o = 0; o < oct; o++) { let v = 1 - Math.abs(n(wx * f, wz * f) * 2 - 1); v = v * v * (0.35 + 0.65 * prev); prev = v; rid += v * a; norm += a; a *= 0.5; f *= 2.05; }
        rid = rid / norm * 1.6;
        const edge = RR.smooth(RR.clamp((ly.d / 2 - z) / (ly.d * 0.35), 0, 1));
        const hh = Math.pow(Math.min(rid, 1.2), 1.4) * ly.h * edge;
        p.setY(i, hh);
        const sn = th.snowCaps ? RR.smooth(RR.clamp((hh / ly.h - 0.5 + (n(x / 30, z / 30) - 0.5) * 0.25) * 5, 0, 1)) : 0;
        tmp.copy(dark).lerp(base, RR.smooth(RR.clamp(hh / ly.h * 2.2 - 0.3, 0, 1))).lerp(snowC, sn);
        cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      m.position.set(mid, minY - (ly.seed === 3 ? 40 : 60), ly.z);
      this.levelGroup.add(m);
    }
    void smoothH;
  }

  buildMarkers(L) {
    const pole = (x, z, h, color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 10), new THREE.MeshStandardMaterial({ color: color || 0xe8e8e8, metalness: 0.6, roughness: 0.35 }));
      m.position.set(x, this.fns.surfY(x, z) + h / 2 - 0.1, z);
      m.castShadow = true;
      this.levelGroup.add(m);
      return m;
    };
    const banner = (x, text, w) => {
      const z = -2.4, h = 4.2, bh = 1.1;
      pole(x - w / 2, z, h, 0x2a2d33); pole(x + w / 2, z, h, 0x2a2d33);
      const yb = Math.max(this.fns.surfY(x - w / 2, z), this.fns.surfY(x + w / 2, z)) + h - 0.7;
      const tex = textTexture(text, 1024, 256, {});
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
      mat.userData.own = true;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, bh), mat);
      b.position.set(x, yb, z); b.castShadow = true;
      this.levelGroup.add(b);
    };
    banner(L.checkpoints[0] + 1, 'START', 4.4);
    banner(L.finishX, 'SUMMIT', 6);
    const ct = checkerTexture();
    const cmat = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 });
    cmat.userData.own = true;
    for (const x of [L.checkpoints[0] + 1, L.finishX]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.6), cmat);
      strip.rotation.x = -Math.PI / 2; strip.rotation.y = L.slope(x);
      strip.position.set(x, L.height(x) + 0.02, 0);
      strip.receiveShadow = true;
      this.levelGroup.add(strip);
    }
    for (let i = 1; i < L.checkpoints.length; i++) {
      const x = L.checkpoints[i], z = -1.6;
      const p = pole(x, z, 2.8);
      const fg = new THREE.PlaneGeometry(1.0, 0.6, 12, 6).translate(0.5, 0, 0);
      const fm = new THREE.MeshStandardMaterial({ color: 0xff5a10, side: THREE.DoubleSide, roughness: 0.8 });
      const flag = new THREE.Mesh(fg, fm);
      flag.position.set(x + 0.05, p.position.y + 1.05, z);
      flag.castShadow = true;
      flag.userData.base = Float32Array.from(fg.attributes.position.array);
      flag.userData.idx = i;
      this.levelGroup.add(flag);
      this.flags.push(flag);
    }
  }

  buildPickups(L) {
    const disc = new THREE.CylinderGeometry(0.2, 0.2, 0.045, 36).rotateX(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.2, 0.024, 10, 36);
    const inner = new THREE.TorusGeometry(0.125, 0.014, 8, 30);
    const coinGeo = mergeGeometries([disc, rim, inner]);
    const kinds = { 5: [0xffc23a, 1, 0x6a4000], 25: [0xdde6f0, 1.2, 0x334455], 100: [0xff4d6d, 1.45, 0x660018] };
    this.coinRefs = [];
    for (const v of [5, 25, 100]) {
      const list = L.coins.map((c, i) => [c, i]).filter(([c]) => c.v === v);
      if (!list.length) continue;
      const k = kinds[v];
      const mat = new THREE.MeshStandardMaterial({ color: k[0], metalness: 1, roughness: 0.25, emissive: k[2], emissiveIntensity: 0.6 });
      const im = new THREE.InstancedMesh(coinGeo, mat, list.length);
      im.castShadow = true;
      im.frustumCulled = false;
      list.forEach(([c, i], j) => { this.coinRefs[i] = { mesh: im, j, c, s: k[1] }; });
      this.levelGroup.add(im);
    }
    this.cans = [];
    const red = new THREE.MeshPhysicalMaterial({ color: 0xd21f1f, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x300000 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222326, metalness: 0.6, roughness: 0.4 });
    const label = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 });
    for (const x of L.fuelCans) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.54, 0.2, 3, 0.04), red);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 20, Math.PI), dark);
      handle.position.set(-0.06, 0.27, 0);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 12), dark);
      spout.position.set(0.15, 0.3, 0); spout.rotation.z = -0.5;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.205), label);
      stripe.position.y = -0.05;
      for (const m of [body, handle, spout, stripe]) { m.castShadow = true; g.add(m); }
      g.position.set(x, L.height(x) + 0.55, 0);
      g.userData.y0 = g.position.y;
      this.levelGroup.add(g);
      this.cans.push(g);
    }
  }

  update(sess, dt, t, framing) {
    this.resize(false);
    const L = sess.level;
    this.loadLevel(L);
    this.bike.update(sess.bike, sess.ragdoll, this.scene);
    for (const f of this.flags) {
      const p = f.geometry.attributes.position, b = f.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3];
        p.setZ(i, Math.sin(t * 6 - x * 5 + f.userData.idx) * 0.09 * x);
        p.setY(i, b[i * 3 + 1] - x * 0.06);
      }
      p.needsUpdate = true;
      f.geometry.computeVertexNormals();
      f.material.color.set(sess.cp >= f.userData.idx ? 0x2ecc71 : 0xff5a10);
    }
    // pickups
    const dm = this.pickDummy || (this.pickDummy = new THREE.Object3D());
    const touched = new Set();
    for (let i = 0; i < this.coinRefs.length; i++) {
      const r = this.coinRefs[i];
      if (!r) continue;
      const gone = sess.coinTaken && sess.coinTaken[i];
      dm.position.set(r.c.x, r.c.y + Math.sin(t * 2.2 + r.c.x) * 0.06, 0);
      dm.rotation.set(0, t * 2.6 + r.c.x, 0);
      dm.scale.setScalar(gone ? 0.0001 : r.s);
      dm.updateMatrix();
      r.mesh.setMatrixAt(r.j, dm.matrix);
      touched.add(r.mesh);
    }
    for (const m of touched) m.instanceMatrix.needsUpdate = true;
    this.cans.forEach((g, i) => {
      g.visible = !(sess.canTaken && sess.canTaken[i]);
      g.rotation.y = t * 1.3 + i;
      g.position.y = g.userData.y0 + Math.sin(t * 2 + i) * 0.07;
    });
    // particles
    const ps = sess.particles, n = Math.min(ps.length, this.MAXP), g = this.dust.geometry;
    const pa = g.attributes.position.array, ca = g.attributes.color.array, aa = g.attributes.alpha.array, sa = g.attributes.size.array;
    const pc = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const p = ps[ps.length - 1 - i];
      pa[i * 3] = p.x; pa[i * 3 + 1] = p.y; pa[i * 3 + 2] = p.z || 0;
      pc.set(p.col); ca[i * 3] = pc.r; ca[i * 3 + 1] = pc.g; ca[i * 3 + 2] = pc.b;
      const life = p.life / p.max;
      aa[i] = Math.max(0, life) * p.a;
      sa[i] = p.r * 2.4 * (1.8 - life);
    }
    for (let i = n; i < this.MAXP; i++) aa[i] = 0;
    g.setDrawRange(0, n);
    for (const k of ['position', 'color', 'alpha', 'size']) g.attributes[k].needsUpdate = true;

    // camera
    const cam = sess.cam, aspect = this.w / this.h;
    const fovR = (this.camera.fov * Math.PI) / 180;
    const sp = sess.bike.speed();
    let visH = Math.max(8.6, 16 / aspect) * (1 + 0.14 * RR.clamp(sp / 15, 0, 1));
    const dist = visH / (2 * Math.tan(fovR / 2));
    let tx = cam.x, ty = cam.y;
    if (framing === 'title') { tx -= (visH * aspect) * 0.16; ty += 0.4; }
    this.camera.position.set(tx, ty + 2.4, dist);
    this.camera.lookAt(tx, ty + 1.7, 0);
    // follow-objects (sky dome extras)
    for (const o of this.levelGroup.children) if (o.userData.follow) o.position.x = o.userData.ox == null ? (o.userData.ox = o.position.x) + tx : o.userData.ox + tx;
    // sun / shadow frustum follows the action
    const target = new THREE.Vector3(cam.x, cam.y, 0);
    this.sun.position.copy(target).addScaledVector(this.lightDir, 80);
    this.sun.target.position.copy(target);
    const sc = this.sun.shadow.camera, ext = visH * aspect * 0.5 + 4;
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 220; sc.updateProjectionMatrix(); }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
