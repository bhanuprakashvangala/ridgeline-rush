'use strict';
window.RR = window.RR || {};
(function (RR) {
  RR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RR.lerp = (a, b, t) => a + (b - a) * t;
  RR.smooth = (t) => t * t * (3 - 2 * t);
  RR.TAU = Math.PI * 2;

  // Seeded PRNG (mulberry32)
  RR.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Deterministic hash of an integer cell -> [0,1)
  RR.hash = function (i, seed) {
    let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 13;
    h = Math.imul(h, 0x27d4eb2f);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };

  // 1D value noise in [-1,1]
  RR.noise1 = function (seed) {
    const r = RR.rng(seed), p = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) p[i] = r() * 2 - 1;
    return function (x) {
      const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      const a = p[i & 1023], b = p[(i + 1) & 1023];
      return a + (b - a) * u;
    };
  };

  RR.fbm = function (n, x, oct) {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f + i * 17.3) * a; norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  };

  RR.fmtTime = function (t) {
    if (t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  };

  RR.Save = {
    key: 'ridgeline-rush-save-v1',
    load() {
      try {
        const d = JSON.parse(localStorage.getItem(this.key));
        if (d && d.best) return Object.assign(RR.Save.defaults(), d, { up: Object.assign(RR.Save.defaults().up, d.up || {}) });
      } catch (e) { /* storage unavailable */ }
      return this.defaults();
    },
    defaults() {
      return { unlocked: 1, best: {}, stars: {}, muted: false, coins: 0, up: { engine: 0, tires: 0, susp: 0, fuel: 0, rider: 0 }, paints: [0], paint: 0 };
    },
    write(d) {
      try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
  };
})(window.RR);
