// Procedural, tileable PBR textures (colour + normal map) generated at runtime.
import * as THREE from 'three';

const RR = window.RR;
const cache = new Map();

function periodicNoise(seed, period) {
  const r = RR.rng(seed), P = period, g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}

function makeFbm(seed, basePeriod, octaves) {
  const ns = [];
  for (let o = 0; o < octaves; o++) ns.push(periodicNoise(seed + o * 131, basePeriod << o));
  return (u, v) => { // u,v in [0,1)
    let s = 0, a = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const p = basePeriod << o;
      s += ns[o](u * p, v * p) * a; norm += a; a *= 0.5;
    }
    return s / norm;
  };
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

const RECIPES = {
  grass(S, seed) {
    const f = makeFbm(seed, 4, 6), patch = makeFbm(seed + 9, 2, 3), fine = makeFbm(seed + 3, 64, 2);
    const dark = hex(0x2c4f1a), light = hex(0x6e9636), dry = hex(0x9a9548), soil = hex(0x5b4630);
    return (u, v) => {
      const n = f(u, v), p = patch(u, v), fn = fine(u, v);
      let c = mix3(dark, light, sat(n * 1.4 - 0.2 + (fn - 0.5) * 0.5));
      c = mix3(c, dry, sat((p - 0.55) * 3) * 0.6);
      c = mix3(c, soil, sat((0.32 - n) * 5));
      const h = fn * 0.55 + n * 0.45;
      return [c, h];
    };
  },
  dirt(S, seed) {
    const f = makeFbm(seed, 4, 6), fine = makeFbm(seed + 5, 64, 2), stones = makeFbm(seed + 11, 32, 2);
    const dark = hex(0x4a3322), light = hex(0x8c6644), pebble = hex(0x9b8c7a);
    return (u, v) => {
      const n = f(u, v), fn = fine(u, v), st = stones(u, v);
      let c = mix3(dark, light, sat(n * 1.3 - 0.15));
      const peb = sat((st - 0.68) * 8);
      c = mix3(c, pebble, peb * 0.8);
      const h = n * 0.5 + fn * 0.25 + peb * 0.6;
      return [c, h];
    };
  },
  rock(S, seed) {
    const f = makeFbm(seed, 6, 7), rid = makeFbm(seed + 7, 6, 5), lich = makeFbm(seed + 2, 8, 3);
    const dark = hex(0x45423e), light = hex(0x9c958a), moss = hex(0x5e6a3a);
    return (u, v) => {
      const n = f(u, v), r = 1 - Math.abs(rid(u, v) * 2 - 1);
      let c = mix3(dark, light, sat(n * 1.4 - 0.2));
      const crack = sat((r - 0.94) * 14);
      c = mix3(c, hex(0x2f2c29), crack * 0.55);
      c = mix3(c, moss, sat((lich(u, v) - 0.72) * 4) * 0.3);
      const h = n * 0.65 + r * 0.35 - crack * 0.25;
      return [c, h];
    };
  },
  cliff(S, seed) {
    const f = makeFbm(seed, 4, 7), warp = makeFbm(seed + 4, 2, 3), vert = makeFbm(seed + 9, 8, 4), fine = makeFbm(seed + 12, 32, 3);
    const dark = hex(0x3d3a36), light = hex(0x8f8a82), warm = hex(0x7a6a58);
    return (u, v) => {
      const n = f(u, v), w = warp(u, v), fn = fine(u, v);
      const sv = v * 5 + w * 2.2 + (fine(u, v) - 0.5) * 0.25, band = sv - Math.floor(sv), layer = RR.hash(Math.floor(sv) + 50, seed);
      let c = mix3(dark, light, sat(n * 1.2 - 0.1 + (layer - 0.5) * 0.35));
      c = mix3(c, warm, sat(layer - 0.6) * 0.8);
      const ledge = sat((band - 0.93) * 14) * sat((n - 0.35) * 3);
      const crack = sat((vert(u * 2, v * 0.25) - 0.72) * 7) * (0.5 + n * 0.5);
      c = mix3(c, hex(0x2a2724), Math.max(ledge * 0.35, crack * 0.45));
      c = mix3(c, [255, 255, 255], (fn - 0.5) * 0.12);
      const h = n * 0.45 + fn * 0.25 + (1 - ledge) * 0.2 - crack * 0.3 + band * 0.1;
      return [c, h];
    };
  },
  redrock(S, seed) {
    const f = makeFbm(seed, 4, 6), warp = makeFbm(seed + 4, 2, 3), fine = makeFbm(seed + 8, 32, 3);
    const bands = [hex(0x8a3f22), hex(0xb5603a), hex(0xc98858), hex(0x7a3520), hex(0xa85530)];
    return (u, v) => {
      const n = f(u, v), w = warp(u, v);
      const b = (v * 9 + w * 2.0) % 1, bi = Math.floor(((v * 9 + w * 2.0) % 5 + 5) % 5);
      let c = mix3(bands[bi], bands[(bi + 1) % 5], RR.smooth(b));
      c = mix3(c, hex(0x5a2a18), sat((0.35 - n) * 3) * 0.6);
      const fn = fine(u, v);
      const h = n * 0.5 + fn * 0.3 + Math.abs(Math.sin((v * 9 + w * 2.0) * Math.PI)) * 0.2;
      return [mix3(c, [255, 220, 190], (fn - 0.5) * 0.15), h];
    };
  },
  sand(S, seed) {
    const f = makeFbm(seed, 4, 5), warp = makeFbm(seed + 3, 4, 3), fine = makeFbm(seed + 6, 128, 1);
    const a = hex(0xc4925a), b = hex(0xe2bb83);
    return (u, v) => {
      const n = f(u, v), w = warp(u, v);
      const rip = 0.5 + 0.5 * Math.sin((v * 24 + u * 4 + w * 3) * Math.PI * 2);
      const c = mix3(a, b, sat(n * 1.2 - 0.1 + rip * 0.15));
      const h = rip * 0.45 + n * 0.35 + fine(u, v) * 0.2;
      return [c, h];
    };
  },
  snow(S, seed) {
    const f = makeFbm(seed, 4, 6), fine = makeFbm(seed + 5, 64, 2), r = RR.rng(seed);
    const shade = hex(0xc9d8ea), white = hex(0xf6f9fd);
    return (u, v) => {
      const n = f(u, v), fn = fine(u, v);
      let c = mix3(shade, white, sat(n * 1.5 - 0.15));
      if (r() > 0.9985) c = [255, 255, 255];
      return [c, n * 0.7 + fn * 0.3];
    };
  },
  bark(S, seed) {
    const f = makeFbm(seed, 4, 5), str = makeFbm(seed + 2, 16, 3);
    return (u, v) => {
      const n = f(u, v), s = str(u * 0.25, v * 3);
      const c = mix3(hex(0x3b2a1e), hex(0x7a5a40), sat(n * 0.8 + s * 0.6 - 0.3));
      return [c, s * 0.7 + n * 0.3];
    };
  },
  cloth(S, seed) {
    const f = makeFbm(seed, 64, 2);
    return (u, v) => {
      const weave = 0.5 + 0.25 * Math.sin(u * S * 0.9) * Math.sin(v * S * 0.9);
      const n = f(u, v);
      const g = 200 + n * 55 * 0.3;
      return [[g, g, g], weave * 0.6 + n * 0.4];
    };
  },
};

export function getTexture(type, size, renderer) {
  const key = type + size;
  if (cache.has(key)) return cache.get(key);
  const S = size, seed = type.length * 977 + 13;
  const fn = RECIPES[type](S, seed);
  const col = new Uint8ClampedArray(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [c, h] = fn(x / S, y / S);
      const i = y * S + x, ao = 0.72 + 0.28 * sat(h * 1.3);
      col[i * 4] = c[0] * ao; col[i * 4 + 1] = c[1] * ao; col[i * 4 + 2] = c[2] * ao; col[i * 4 + 3] = 255;
      hgt[i] = h;
    }
  }
  const nrm = new Uint8ClampedArray(S * S * 4);
  const k = type === 'snow' ? 2.5 : type === 'cloth' ? 2 : 6;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const l = hgt[y * S + ((x - 1 + S) % S)], r = hgt[y * S + ((x + 1) % S)];
      const t = hgt[((y - 1 + S) % S) * S + x], b = hgt[((y + 1) % S) * S + x];
      let nx = (l - r) * k, ny = (b - t) * k, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * S + x) * 4;
      nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
    }
  }
  const mk = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const out = { map: mk(col, true), normal: mk(nrm, false) };
  cache.set(key, out);
  return out;
}

// A small soft round sprite used for dust particles.
export function dustSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
