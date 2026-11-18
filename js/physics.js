'use strict';
(function (RR) {
  const G = 15;              // gravity (m/s^2) - slightly arcade
  const DT = 1 / 240;        // fixed physics step
  RR.PHYS = { G, DT };

  // Tuning
  // Balance presets: how hard the bike tries to wheelie/loop and how much the rider can correct it.
  RR.BALANCE = {
    // tq: engine torque, wmax: rear-wheel spin limit (sets top speed), react: wheelie kick
    easy: { tq: 200, wmax: 36, react: 1.0, lean: 85, dampG: 1.6, dampA: 1.4, thr: 8, I: 6.4 },
    normal: { tq: 230, wmax: 30, react: 1.3, lean: 76, dampG: 0.9, dampA: 1.1, thr: 12, I: 6.0 },
    hard: { tq: 245, wmax: 28, react: 1.5, lean: 70, dampG: 0.5, dampA: 0.9, thr: 18, I: 5.6 },
  };
  RR.balance = RR.BALANCE.normal;

  // Garage upgrades
  RR.UPGRADES = [
    { id: 'engine', name: 'ENGINE', desc: 'More torque and top speed. Also wheelies harder.', base: 250 },
    { id: 'tires', name: 'TYRES', desc: 'More grip on steep rock and loose dirt.', base: 200 },
    { id: 'susp', name: 'SUSPENSION', desc: 'Softer landings and a steadier chassis.', base: 200 },
    { id: 'fuel', name: 'FUEL TANK', desc: 'Bigger tank. Ride further between cans.', base: 150 },
    { id: 'rider', name: 'RIDER FITNESS', desc: 'Stronger body lean to tame wheelies.', base: 220 },
  ];
  RR.UP_MAX = 6;
  RR.upCost = (u, lvl) => Math.round((u.base * Math.pow(1.6, lvl)) / 10) * 10;
  RR.PAINTS = [
    { name: 'Blaze Orange', color: 0xff3d00, price: 0 }, { name: 'Race Red', color: 0xd01a22, price: 400 },
    { name: 'Factory Blue', color: 0x1b5bd4, price: 600 }, { name: 'Acid Lime', color: 0x86d01c, price: 800 },
    { name: 'Arctic White', color: 0xe9e9e7, price: 900 }, { name: 'Stealth Black', color: 0x1a1b1f, price: 1200 },
    { name: 'Royal Purple', color: 0x6a2bd1, price: 1400 }, { name: 'Gold Rush', color: 0xd4a017, price: 2500 },
  ];
  RR.fuelMax = (up) => 45 * (1 + 0.16 * (up.fuel || 0));
  // Combine a balance preset with garage upgrades into the live tuning.
  RR.makeTune = function (preset, up) {
    up = up || {};
    return Object.assign({}, preset, {
      tq: preset.tq * (1 + 0.07 * (up.engine || 0)),
      wmax: preset.wmax * (1 + 0.035 * (up.engine || 0)),
      mu: 1.3 * (1 + 0.045 * (up.tires || 0)),
      susp: 1 + 0.1 * (up.susp || 0),
      dampG: preset.dampG + 0.12 * (up.susp || 0),
      lean: preset.lean * (1 + 0.05 * (up.rider || 0)),
    });
  };
  const BRAKE_TQ = 95, REVERSE_TQ = 35;
  const K_C = 40000, C_C = 380, MU_TIRE = 1.3;
  const K_B = 20000, C_B = 700, MU_BODY = 0.45;
  const K_STOP = 40000, C_STOP = 600, K_LAT = 50000, C_LAT = 500;

  const WHEELS = [
    { ax: -0.42, ay: -0.05, dx: -0.24, dy: -1, L0: 0.64, k: 2600, c: 150, R: 0.36, m: 4 },
    { ax: 0.5, ay: 0.26, dx: 0.38, dy: -1, L0: 0.95, k: 2300, c: 130, R: 0.36, m: 4 },
  ];
  for (const w of WHEELS) {
    const l = Math.hypot(w.dx, w.dy);
    w.dx /= l; w.dy /= l;
    w.Lmin = w.L0 - 0.3;
    w.Lmax = w.L0 + 0.03;
  }
  // chassis points that can scrape the ground (local, y up)
  const BODY_PTS = [[0.05, -0.42], [-1.0, 0.24], [0.98, 0.34], [0.42, 0.68], [-0.5, 0.42]];

  // Rider pose in chassis-local coordinates. l in [-1,1]: +1 = lean back, -1 = lean forward.
  function ik(a, b, l1, l2, bend) {
    const dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.hypot(dx, dy);
    d = RR.clamp(d, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const ang = Math.atan2(dy, dx) + bend * Math.acos(RR.clamp(ca, -1, 1));
    return { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 };
  }
  RR.ik = ik;

  RR.riderPose = function (l) {
    const f = Math.max(0, -l), b = Math.max(0, l);
    const foot = { x: -0.1, y: -0.2 };
    const hand = { x: 0.42, y: 0.63 };
    const pelvis = { x: -0.3 + 0.22 * f - 0.1 * b, y: 0.42 + 0.1 * f };
    const tilt = 0.55 + 0.38 * f - 0.25 * b;
    const neck = { x: pelvis.x + Math.sin(tilt) * 0.56, y: pelvis.y + Math.cos(tilt) * 0.56 };
    const head = { x: neck.x + Math.sin(tilt * 0.6) * 0.22 + 0.03, y: neck.y + Math.cos(tilt * 0.6) * 0.22 };
    const knee = ik(pelvis, foot, 0.47, 0.47, 1);
    const elbow = ik(neck, hand, 0.35, 0.35, -1);
    return { head, neck, pelvis, knee, foot, elbow, hand };
  };

  class Bike {
    constructor(level, x) {
      this.level = level;
      this.events = [];
      this.reset(x);
    }

    reset(x) {
      const L = this.level;
      const a = L.slope(x + 0.15);
      const ca = Math.cos(a), sa = Math.sin(a);
      this.c = { x, y: 0, vx: 0, vy: 0, a, w: 0, m: 32, I: RR.balance.I };
      this.wheels = WHEELS.map((s) => {
        const lx = s.ax + s.dx * (s.L0 - 0.08), ly = s.ay + s.dy * (s.L0 - 0.08);
        return { spec: s, x: x + lx * ca - ly * sa, y: lx * sa + ly * ca, vx: 0, vy: 0, w: 0, ang: 0,
          m: s.m, R: s.R, I: 0.5 * s.m * s.R * s.R, contact: false, slip: 0, ext: s.L0 };
      });
      let lift = -Infinity;
      for (const w of this.wheels) lift = Math.max(lift, L.height(w.x) + w.R + 0.02 - w.y);
      this.c.y += lift;
      for (const w of this.wheels) w.y += lift;
      this.alive = true;
      this.airTime = 0;
      this.airRot = 0;
      this.grounded = true;
      this.leanVis = 0;
      this.throttle = 0;
      this.events.length = 0;
    }

    speed() { return Math.hypot(this.c.vx, this.c.vy); }

    localToWorld(p) {
      const c = this.c, ca = Math.cos(c.a), sa = Math.sin(c.a);
      return { x: c.x + p.x * ca - p.y * sa, y: c.y + p.x * sa + p.y * ca };
    }

    step(dt, inp) {
      const c = this.c, ws = this.wheels, L = this.level;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      c.fx = 0; c.fy = -G * c.m; c.t = 0;
      for (const w of ws) { w.fx = 0; w.fy = -G * w.m; w.t = 0; }

      // suspension (prismatic spring-damper per wheel)
      for (const w of ws) {
        const s = w.spec;
        const rax = s.ax * ca - s.ay * sa, ray = s.ax * sa + s.ay * ca;
        const Ax = c.x + rax, Ay = c.y + ray;
        const dx = s.dx * ca - s.dy * sa, dy = s.dx * sa + s.dy * ca;
        const px = -dy, py = dx;
        const relx = w.x - Ax, rely = w.y - Ay;
        const vAx = c.vx - c.w * ray, vAy = c.vy + c.w * rax;
        const rvx = w.vx - vAx, rvy = w.vy - vAy;
        const ext = relx * dx + rely * dy, lat = relx * px + rely * py;
        const ve = rvx * dx + rvy * dy, vl = rvx * px + rvy * py;
        const sd = RR.balance.susp || 1;
        let F = -s.k * (ext - s.L0) - s.c * sd * ve;
        if (ext < s.Lmin) F += K_STOP * (s.Lmin - ext) - C_STOP * ve;
        else if (ext > s.Lmax) F += -K_STOP * (ext - s.Lmax) - C_STOP * ve;
        const Fl = -K_LAT * lat - C_LAT * vl;
        const fx = dx * F + px * Fl, fy = dy * F + py * Fl;
        w.fx += fx; w.fy += fy;
        c.fx -= fx; c.fy -= fy;
        c.t -= rax * fy - ray * fx;
        w.ext = ext;
      }

      const rear = ws[0];
      this.leanVis += ((this.alive ? inp.lean : 0) - this.leanVis) * Math.min(1, dt * 10);
      this.throttle += ((this.alive && inp.gas ? 1 : 0) - this.throttle) * Math.min(1, dt * RR.balance.thr);
      if (this.alive) {
        if (this.throttle > 0.01) {
          const B = RR.balance;
          const frac = RR.clamp((1 + rear.w / B.wmax) * 1.8, 0, 1); // flat torque until near top speed
          const tq = -B.tq * frac * this.throttle;
          rear.t += tq;
          c.t -= tq * RR.balance.react;
        }
        if (inp.brake) {
          const fwd = c.vx * ca + c.vy * sa;
          if (fwd > 1.0 || !this.grounded) {
            for (const w of ws) {
              const tq = -Math.sign(w.w) * Math.min(BRAKE_TQ, (Math.abs(w.w) * w.I) / dt);
              w.t += tq;
              c.t -= tq * 0.5;
            }
          } else if (rear.w < 12) {
            rear.t += REVERSE_TQ;
            c.t -= REVERSE_TQ * 0.3;
          }
        }
        c.t += inp.lean * RR.balance.lean;
      }
      c.t -= c.w * (this.grounded ? RR.balance.dampG : RR.balance.dampA);
      c.I = RR.balance.I;

      // integrate velocities
      c.vx += (c.fx / c.m) * dt; c.vy += (c.fy / c.m) * dt; c.w += (c.t / c.I) * dt;
      c.vx *= 1 - 0.015 * dt; c.vy *= 1 - 0.015 * dt;
      for (const w of ws) {
        w.vx += (w.fx / w.m) * dt; w.vy += (w.fy / w.m) * dt; w.w += (w.t / w.I) * dt;
        w.w *= 1 - 0.25 * dt;
      }

      // wheel contacts: penalty normal + clamped Coulomb friction
      let any = false, impact = 0;
      for (const w of ws) {
        w.contact = false;
        const cs = L.circleContacts(w.x, w.y, w.R);
        for (const k of cs) {
          const nx = k.nx, ny = k.ny;
          const vn = w.vx * nx + w.vy * ny;
          const jn = (K_C * k.pen - C_C * vn) * dt;
          if (jn <= 0) continue;
          if (-vn > impact) impact = -vn;
          w.vx += (nx * jn) / w.m; w.vy += (ny * jn) / w.m;
          const tx = ny, ty = -nx;
          const vs = w.vx * tx + w.vy * ty + w.w * w.R;
          let jt = -vs / (1 / w.m + (w.R * w.R) / w.I);
          const mx = (RR.balance.mu || MU_TIRE) * jn;
          if (jt > mx) jt = mx; else if (jt < -mx) jt = -mx;
          w.vx += (tx * jt) / w.m; w.vy += (ty * jt) / w.m; w.w += (jt * w.R) / w.I;
          w.contact = true; any = true;
          w.slip = vs; w.cnx = nx; w.cny = ny;
        }
      }

      // chassis scraping
      let tailHit = false, noseHit = false;
      for (let bi = 0; bi < BODY_PTS.length; bi++) {
        const p = BODY_PTS[bi];
        const rx = p[0] * ca - p[1] * sa, ry = p[0] * sa + p[1] * ca;
        const cs = L.circleContacts(c.x + rx, c.y + ry, 0.08);
        if (cs.length) { if (bi === 1 || bi === 4) tailHit = true; if (bi === 2 || bi === 3) noseHit = true; }
        for (const k of cs) {
          const nx = k.nx, ny = k.ny;
          let vpx = c.vx - c.w * ry, vpy = c.vy + c.w * rx;
          const vn = vpx * nx + vpy * ny;
          const jn = (K_B * k.pen - C_B * vn) * dt;
          if (jn <= 0) continue;
          const rn = rx * ny - ry * nx;
          const mn = 1 / (1 / c.m + (rn * rn) / c.I);
          const j = Math.min(jn, mn * 6); // keep it stable for long lever arms
          c.vx += (nx * j) / c.m; c.vy += (ny * j) / c.m; c.w += (rn * j) / c.I;
          const tx = ny, ty = -nx;
          vpx = c.vx - c.w * ry; vpy = c.vy + c.w * rx;
          const vt = vpx * tx + vpy * ty;
          const rt = rx * ty - ry * tx;
          let jt = -vt / (1 / c.m + (rt * rt) / c.I);
          const mx = MU_BODY * j;
          if (jt > mx) jt = mx; else if (jt < -mx) jt = -mx;
          c.vx += (tx * jt) / c.m; c.vy += (ty * jt) / c.m; c.w += (rt * jt) / c.I;
        }
      }

      // integrate positions
      c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt;
      for (const w of ws) { w.x += w.vx * dt; w.y += w.vy * dt; w.ang += w.w * dt; }

      // air time / flips / landings
      if (any) {
        if (this.airTime > 0.3 && this.alive) {
          const flips = Math.floor((Math.abs(this.airRot) + 0.9) / RR.TAU);
          if (flips > 0) this.events.push({ type: 'flip', n: flips, dir: this.airRot > 0 ? 'back' : 'front' });
          this.events.push({ type: 'land', s: impact, air: this.airTime });
        }
        this.airTime = 0;
        this.airRot = 0;
      } else {
        this.airTime += dt;
        this.airRot += c.w * dt;
      }
      this.grounded = this.airTime < 0.1;

      // looping out (tail on the ground, bike reared up) or an endo -> crash
      if (this.alive && (tailHit || noseHit)) {
        let rel = c.a - L.slope(c.x);
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if ((tailHit && rel > 1.1) || (noseHit && rel < -1.0)) { this.alive = false; this.events.push({ type: 'crash' }); }
      }
      // rider collision -> crash
      if (this.alive) {
        const pose = RR.riderPose(this.leanVis);
        const h = this.localToWorld(pose.head), n = this.localToWorld(pose.neck);
        const mid = this.localToWorld({ x: (pose.neck.x + pose.pelvis.x) / 2, y: (pose.neck.y + pose.pelvis.y) / 2 });
        if (L.circleContacts(h.x, h.y, 0.17).length || L.circleContacts(n.x, n.y, 0.13).length || L.circleContacts(mid.x, mid.y, 0.12).length) {
          this.alive = false;
          this.events.push({ type: 'crash' });
        }
      }
    }
  }
  RR.Bike = Bike;

  // Verlet ragdoll used when the rider is thrown off.
  const STICKS = [['head', 'neck'], ['neck', 'pelvis'], ['pelvis', 'knee'], ['knee', 'foot'], ['neck', 'elbow'], ['elbow', 'hand'], ['head', 'pelvis']];
  const RADII = { head: 0.17, neck: 0.1, pelvis: 0.12, knee: 0.09, foot: 0.08, elbow: 0.07, hand: 0.06 };

  class Ragdoll {
    constructor(level, bike) {
      this.level = level;
      const c = bike.c, pose = RR.riderPose(bike.leanVis);
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      this.p = {};
      for (const k in pose) {
        const q = pose[k];
        const rx = q.x * ca - q.y * sa, ry = q.x * sa + q.y * ca;
        const vx = (c.vx - c.w * ry) * 0.9, vy = (c.vy + c.w * rx) * 0.9 + 1.5;
        const x = c.x + rx, y = c.y + ry;
        this.p[k] = { x, y, px: x - vx * DT, py: y - vy * DT, r: RADII[k] };
      }
      this.sticks = STICKS.map(([a, b]) => {
        const A = this.p[a], B = this.p[b];
        return [A, B, Math.hypot(A.x - B.x, A.y - B.y)];
      });
    }

    collide(p, friction) {
      const cs = this.level.circleContacts(p.x, p.y, p.r);
      for (const k of cs) {
        p.x += k.nx * k.pen; p.y += k.ny * k.pen;
        if (friction) {
          const vx = p.x - p.px, vy = p.y - p.py;
          let vn = vx * k.nx + vy * k.ny;
          const tx = k.ny, ty = -k.nx;
          let vt = vx * tx + vy * ty;
          if (vn < 0) vn = -vn * 0.15;
          vt *= 0.8;
          p.px = p.x - (k.nx * vn + tx * vt);
          p.py = p.y - (k.ny * vn + ty * vt);
        }
      }
    }

    step(dt) {
      const g = G * dt * dt;
      for (const k in this.p) {
        const p = this.p[k];
        const vx = (p.x - p.px) * 0.998, vy = (p.y - p.py) * 0.998;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy - g;
      }
      for (let it = 0; it < 6; it++) {
        for (const [A, B, len] of this.sticks) {
          const dx = B.x - A.x, dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const diff = ((d - len) / d) * 0.5;
          A.x += dx * diff; A.y += dy * diff;
          B.x -= dx * diff; B.y -= dy * diff;
        }
        for (const k in this.p) this.collide(this.p[k], it === 5);
      }
    }
  }
  RR.Ragdoll = Ragdoll;
})(window.RR);
