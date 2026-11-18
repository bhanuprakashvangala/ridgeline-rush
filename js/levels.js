'use strict';
(function (RR) {
  // Visual themes for the 3D renderer.
  RR.THEMES = {
    alpine: {
      sky: { turbidity: 4, rayleigh: 1.2, mie: 0.004, elev: 34, azim: 62 }, exposure: 0.5,
      fog: 0xa9c4dc, fogNear: 60, fogFar: 520, sun: 0xfff1dc, sunI: 3.4, hemiSky: 0xbfd9ff, hemiGround: 0x4a3a28, hemiI: 0.6,
      ground: 'grass', wall: 'rock', mountains: 0x666a6e, snowCaps: true, trees: 'pine', treeDensity: 0.9, rocks: 0x8a8378,
    },
    desert: {
      sky: { turbidity: 8, rayleigh: 1.6, mie: 0.006, elev: 24, azim: 60 }, exposure: 0.5,
      fog: 0xe0b58c, fogNear: 60, fogFar: 480, sun: 0xffd6a6, sunI: 3.4, hemiSky: 0xffd9b0, hemiGround: 0x7a4a2a, hemiI: 0.65,
      ground: 'sand', wall: 'redrock', mountains: 0xa45f3c, snowCaps: false, trees: 'none', treeDensity: 0.0, rocks: 0xa8653e,
    },
    dusk: {
      sky: { turbidity: 6, rayleigh: 3.0, mie: 0.01, elev: 6, azim: 95 }, exposure: 0.62,
      fog: 0x8a6a80, fogNear: 50, fogFar: 420, sun: 0xffb27a, sunI: 2.6, hemiSky: 0x9f8fc0, hemiGround: 0x3a2a26, hemiI: 0.9,
      ground: 'grass', wall: 'rock', mountains: 0x4e4560, snowCaps: true, trees: 'pine', treeDensity: 1.0, rocks: 0x6c6470,
    },
    snow: {
      sky: { turbidity: 3, rayleigh: 1.0, mie: 0.003, elev: 30, azim: 55 }, exposure: 0.42,
      fog: 0xd2e1ee, fogNear: 50, fogFar: 420, sun: 0xffffff, sunI: 3.0, hemiSky: 0xdbe9ff, hemiGround: 0x8090a0, hemiI: 0.7,
      ground: 'snow', wall: 'rock', mountains: 0x707a86, snowCaps: true, trees: 'snowpine', treeDensity: 0.7, rocks: 0x7f8794,
    },
    night: {
      sky: { turbidity: 2, rayleigh: 0.3, mie: 0.002, elev: -6, azim: 160 }, exposure: 0.9, night: true,
      fog: 0x0e1628, fogNear: 40, fogFar: 300, sun: 0xaabbff, sunI: 1.4, hemiSky: 0x3a4a7a, hemiGround: 0x101018, hemiI: 0.7,
      ground: 'grass', wall: 'rock', mountains: 0x1a2440, snowCaps: true, trees: 'pine', treeDensity: 0.9, rocks: 0x4c5266,
    },
  };

  RR.LEVELS = [
    { name: 'Foothills', theme: 'alpine', seed: 101, length: 300, diff: 0.0 },
    { name: 'Pine Ridge', theme: 'alpine', seed: 202, length: 360, diff: 0.1 },
    { name: 'Red Rock', theme: 'desert', seed: 303, length: 400, diff: 0.2 },
    { name: 'Canyon Wall', theme: 'desert', seed: 404, length: 430, diff: 0.3 },
    { name: 'Sunset Spur', theme: 'dusk', seed: 505, length: 460, diff: 0.38 },
    { name: 'Granite Steps', theme: 'dusk', seed: 606, length: 480, diff: 0.46 },
    { name: 'Frost Line', theme: 'snow', seed: 707, length: 500, diff: 0.54 },
    { name: 'Glacier Climb', theme: 'snow', seed: 808, length: 520, diff: 0.62 },
    { name: 'Moonrise', theme: 'night', seed: 909, length: 540, diff: 0.7 },
    { name: "Devil's Spine", theme: 'desert', seed: 1010, length: 560, diff: 0.8 },
    { name: 'Ice Summit', theme: 'snow', seed: 1111, length: 580, diff: 0.9 },
    { name: 'The Ridgeline', theme: 'night', seed: 1212, length: 620, diff: 1.0 },
  ];

  const STEP = 0.25;
  const DEG = Math.PI / 180;

  class Level {
    constructor(index) {
      this.index = index;
      this.def = RR.LEVELS[index];
      this.theme = RR.THEMES[this.def.theme];
      this.step = STEP;
      this.generate();
    }

    generate() {
      const d = 0.15 + 0.85 * this.def.diff, r = RR.rng(this.def.seed);
      const ys = [0];
      const rough = [0]; // 0..1 how rocky each sample is (used by the renderer)
      let y = 0;
      const rand = (a, b) => a + (b - a) * r();
      const lengthNow = () => (ys.length - 1) * STEP;
      // add samples from a slope-angle function (radians) of t in [0,1]
      const slope = (len, angFn, rk) => {
        const n = Math.max(1, Math.round(len / STEP));
        for (let i = 1; i <= n; i++) { y += Math.tan(angFn(i / n)) * STEP; ys.push(y); rough.push(rk || 0); }
      };
      // add samples from a height-offset function
      const shape = (len, fn, rk) => {
        const y0 = y, n = Math.max(1, Math.round(len / STEP));
        for (let i = 1; i <= n; i++) { ys.push(y0 + fn(i / n)); rough.push(rk || 0); }
        y = ys[ys.length - 1];
      };
      const flat = (len) => slope(len, () => 0, 0);
      const props = [];
      const maxA = (25 + 14 * d) * DEG;        // steepest sustained climb
      const bell = (t) => Math.pow(Math.sin(Math.PI * t), 0.6);

      const F = {
        climb() {
          const a = rand(0.55, 1) * maxA;
          slope(rand(18, 34), (t) => a * bell(t), 0.2);
        },
        wall() {
          const a = Math.min(43 * DEG, maxA + rand(2, 6) * DEG);
          slope(rand(3, 4), (t) => a * RR.smooth(t), 0.6);
          slope(rand(4, 6 + 6 * d), () => a, 0.8);
          slope(rand(3, 5), (t) => a * (1 - RR.smooth(t)), 0.5);
        },
        ledges() {
          const n = 2 + Math.floor(r() * (2 + 3 * d)), base = rand(4, 12) * DEG;
          for (let i = 0; i < n; i++) {
            const h = rand(0.35, 0.5) + 0.45 * d * r();
            slope(rand(3, 5), () => base, 0.5);
            props.push({ type: 'ledge', x: lengthNow() + 0.25, h });
            shape(0.5, (t) => h * RR.smooth(t), 1);
          }
          slope(3, () => base, 0.4);
        },
        boulders() {
          const n = 2 + Math.floor(r() * 3), base = rand(5, 15) * DEG;
          for (let i = 0; i < n; i++) {
            slope(rand(2, 4), () => base, 0.5);
            const h = (rand(0.35, 0.6) + 0.35 * d) * (1 - base / (40 * DEG)), w = rand(1.8, 2.8), tb = Math.tan(base);
            props.push({ type: 'boulder', x: lengthNow() + w / 2, w, h });
            shape(w, (t) => tb * w * t + h * Math.sin(Math.PI * t), 1);
          }
        },
        logs() {
          const n = 3 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) {
            flat(rand(2.5, 4));
            const h = 0.24 + 0.1 * d;
            props.push({ type: 'log', x: lengthNow() + 0.5, h });
            shape(1.0, (t) => h * Math.sin(Math.PI * t), 0.2);
          }
        },
        dip() {
          const a = rand(14, 24 + 10 * d) * DEG;
          slope(rand(8, 14), (t) => -a * bell(t), 0.3);
          slope(rand(8, 12), (t) => a * 1.1 * bell(t), 0.3);
        },
        descent() {
          const a = rand(16, 26 + 12 * d) * DEG;
          slope(rand(10, 18), (t) => -a * bell(t), 0.4);
        },
        rest() { flat(rand(8, 14)); },
      };

      flat(30);
      F.logs();
      const pool = [
        ['climb', 2.2], ['wall', 0.3 + 1.3 * d], ['ledges', 0.4 + 0.9 * d], ['boulders', 0.6 + 0.6 * d],
        ['logs', 0.5], ['dip', 0.7], ['descent', 0.35], ['rest', 0.5],
      ];
      const total = pool.reduce((a, p) => a + p[1], 0);
      let last = '';
      this.featureLog = [];
      while (lengthNow() < this.def.length) {
        let pick;
        do {
          let v = r() * total;
          pick = pool[0][0];
          for (const p of pool) { v -= p[1]; if (v <= 0) { pick = p[0]; break; } }
        } while (pick === last);
        last = pick;
        this.featureLog.push([pick, lengthNow()]);
        F[pick]();
        flat(rand(3, 7));
      }
      flat(10);
      this.finishX = lengthNow();
      flat(60);

      // gentle organic undulation
      const n = RR.noise1(this.def.seed * 7 + 3);
      for (let i = 0; i < ys.length; i++) {
        const x = i * STEP;
        const fade = RR.smooth(RR.clamp((x - 35) / 20, 0, 1)) * (1 - RR.smooth(RR.clamp((x - this.finishX + 10) / 10, 0, 1)));
        ys[i] += RR.fbm(n, x * 0.05, 3) * 0.8 * fade;
      }
      // one light smoothing pass, mostly sparing rocky ledges
      const c = ys.slice();
      for (let i = 1; i < ys.length - 1; i++) {
        const k = rough[i] >= 1 ? 0.15 : 0.5;
        ys[i] = c[i] * (1 - k) + (c[i - 1] + c[i + 1]) * 0.5 * k;
      }
      this.ys = ys;
      this.props = props;
      this.rough = rough;
      this.n = ys.length;
      this.length = (ys.length - 1) * STEP;

      this.checkpoints = [12];
      const count = Math.max(2, Math.round(this.finishX / 130));
      for (let k = 1; k <= count; k++) {
        const tx = (this.finishX * k) / (count + 1);
        let best = tx;
        for (let x = tx; x < tx + 60 && x < this.finishX - 20; x += STEP) {
          if (Math.abs(this.height(x + 2) - this.height(x - 2)) < 0.4 && Math.abs(this.height(x + 4) - this.height(x)) < 0.5) { best = x; break; }
        }
        this.checkpoints.push(best);
      }
      this.par = Math.round(this.finishX / (8.0 - d * 1.9));

      // fuel cans on calm ground, spaced further apart on harder mountains
      const pr = RR.rng(this.def.seed + 555);
      this.fuelCans = [];
      const spacing = 115 + 60 * d;
      for (let x = 75; x < this.finishX - 30; x += spacing * (0.85 + pr() * 0.3)) {
        let fx = x;
        for (let k = 0; k < 60 && Math.abs(this.slope(fx)) > 0.3; k++) fx += 1;
        this.fuelCans.push(fx);
      }
      // coin trails floating along the line
      this.coins = [];
      for (let x = 24; x < this.finishX - 10;) {
        x += 12 + pr() * 12;
        const n = 3 + Math.floor(pr() * 4), rv = pr();
        const v = rv < 0.03 ? 100 : rv < 0.15 ? 25 : 5;
        for (let k = 0; k < n; k++) {
          const cx = x + k * 1.1;
          if (cx > this.finishX - 6 || this.fuelCans.some((f) => Math.abs(f - cx) < 2.5)) continue;
          const g = Math.max(this.height(cx - 0.6), this.height(cx), this.height(cx + 0.6));
          this.coins.push({ x: cx, y: g + 1.0 + 0.2 * Math.sin((k / Math.max(1, n - 1)) * Math.PI), v });
        }
        x += n * 1.1;
      }
    }

    height(x) {
      const f = x / STEP;
      if (f <= 0) return this.ys[0];
      if (f >= this.n - 1) return this.ys[this.n - 1];
      const i = Math.floor(f), t = f - i;
      return this.ys[i] + (this.ys[i + 1] - this.ys[i]) * t;
    }

    roughAt(x) { return this.rough[RR.clamp(Math.round(x / STEP), 0, this.n - 1)]; }

    slope(x) {
      return Math.atan2(this.height(x + 0.75) - this.height(x - 0.75), 1.5);
    }

    circleContacts(px, py, R) {
      const ys = this.ys, last = this.n - 2;
      const i0 = RR.clamp(Math.floor((px - R) / STEP) - 1, 0, last), i1 = RR.clamp(Math.floor((px + R) / STEP) + 1, 0, last);
      const out = [];
      for (let i = i0; i <= i1; i++) {
        const ax = i * STEP, ay = ys[i], dx = STEP, dy = ys[i + 1] - ay;
        const ll = dx * dx + dy * dy;
        let t = ((px - ax) * dx + (py - ay) * dy) / ll;
        if (t > 1 && i < last) t = 1;
        if (t < 0 && i > 0) t = 0;
        const cx = ax + dx * t, cy = ay + dy * t;
        const ex = px - cx, ey = py - cy;
        const len = Math.sqrt(ll);
        const snx = -dy / len, sny = dx / len;
        const side = ex * snx + ey * sny;
        const d2 = ex * ex + ey * ey;
        if (side < 0) {
          if (t > 0 && t < 1) out.push({ nx: snx, ny: sny, pen: R - side });
          continue;
        }
        if (d2 >= R * R) continue;
        const dd = Math.sqrt(d2);
        if (dd < 1e-6) out.push({ nx: snx, ny: sny, pen: R });
        else out.push({ nx: ex / dd, ny: ey / dd, pen: R - dd });
      }
      if (out.length < 2) return out;
      out.sort((a, b) => b.pen - a.pen);
      const kept = [];
      for (const c of out) {
        let dup = false;
        for (const k of kept) if (c.nx * k.nx + c.ny * k.ny > 0.985) { dup = true; break; }
        if (!dup) kept.push(c);
      }
      return kept;
    }
  }

  RR.Level = Level;
})(window.RR);
