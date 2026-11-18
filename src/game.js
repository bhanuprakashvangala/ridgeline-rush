import { World } from './world3d.js';
import { UI } from './ui.js';

const RR = window.RR;
const DT = RR.PHYS.DT;

function makeSession(index, demo) {
  const level = new RR.Level(index);
  const bike = new RR.Bike(level, level.checkpoints[0]);
  return {
    index, level, bike, demo, ragdoll: null, time: 0, simT: 0, bonus: 0, started: false, cp: 0, crashT: 0,
    crashes: 0, flips: 0, finished: false, finishT: 0, result: null, particles: [], popups: [],
    cam: { x: bike.c.x, y: bike.c.y }, camInit: false, done: false,
    fuelMax: 1, fuel: 1, coinTaken: new Uint8Array(level.coins.length), canTaken: new Uint8Array(level.fuelCans.length),
    coinsRun: 0, noFuelT: 0, lowWarned: false, over: false,
  };
}

export class Game {
  constructor() {
    this.save = RR.Save.load();
    this.touchMode = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!this.save.quality) this.save.quality = this.touchMode ? 'medium' : 'high';
    RR.Audio.muted = !!this.save.muted;
    if (!RR.BALANCE[this.save.balance]) this.save.balance = 'normal';
    this.applyTune();
    this.world = new World(document.getElementById('game'), this.save.quality);
    this.ui = new UI(this);
    this.world.bike.setPaint(RR.PAINTS[this.save.paint].color);
    this.keys = {};
    this.previews = {};
    this.pad = null; this.padPrev = {};
    this.t = 0; this.acc = 0; this.last = 0; this.fpsN = 0; this.fpsT = 0;
    this.demo = makeSession(0, true);
    this.sess = null;
    this.state = 'title';
    this.bind();
    const q = new URLSearchParams(location.search);
    this.botPlay = q.has('bot');
    if (q.has('level')) {
      this.save.unlocked = Math.max(this.save.unlocked, +q.get('level'));
      this.startLevel(+q.get('level') - 1);
      if (q.has('skip')) for (let i = 0; i < +q.get('skip') * 240; i++) this.stepSession(this.sess, RR.botInput(this.sess.bike, this.sess.level));
    } else this.setState(q.get('state') || 'title');
    requestAnimationFrame((ts) => this.frame(ts));
  }

  preview(i) { return this.previews[i] || (this.previews[i] = new RR.Level(i)); }

  setState(s) {
    const prev = this.state;
    if (s === 'settings') this.settingsFrom = prev;
    this.state = s;
    this.ui.show(s, prev);
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      RR.Audio.init();
      const was = this.keys[e.code];
      this.keys[e.code] = true;
      if (!was) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.autoPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('pointerdown', (e) => {
      RR.Audio.init();
      const t = e.pointerType === 'touch';
      if (t !== this.touchMode && e.pointerType !== 'pen') { this.touchMode = t; if (this.state === 'title') this.ui.show('title'); }
    }, true);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  autoPause() { if (this.state === 'play' && this.sess && !this.sess.finished) this.setState('paused'); }

  onKey(code) {
    if (code === 'KeyF') { this.toggleFullscreen(); return; }
    if (code === 'KeyM') { this.setMuted(!this.save.muted); return; }
    const s = this.state;
    if (s === 'title') { if (code === 'Enter' || code === 'Space') this.action('tracks'); }
    else if (s === 'levels') {
      if (code === 'Escape' || code === 'Backspace') this.action('title');
      else if (code === 'Enter') this.startLevel(Math.min(this.save.unlocked, RR.LEVELS.length) - 1);
    } else if (s === 'play') {
      if (code === 'Escape' || code === 'KeyP') this.setState('paused');
      else if (code === 'KeyR') this.startLevel(this.sess.index);
    } else if (s === 'paused') {
      if (code === 'Escape' || code === 'KeyP' || code === 'Enter') this.setState('play');
      else if (code === 'KeyR') this.startLevel(this.sess.index);
    } else if (s === 'results') {
      if (code === 'Enter') this.action(this.sess.index + 1 < RR.LEVELS.length ? 'next' : 'restart');
      else if (code === 'KeyR') this.action('restart');
      else if (code === 'Escape') this.action('tracks');
    } else if (s === 'garage') {
      if (code === 'Escape' || code === 'Backspace') this.action('garageBack');
    } else if (s === 'nofuel') {
      if (code === 'Enter' || code === 'KeyR') this.action('restart');
      else if (code === 'Escape') this.action('tracks');
    } else if (s === 'settings') {
      if (code === 'Escape' || code === 'Enter') this.action('closeSettings');
    }
  }

  action(a) {
    RR.Audio.init();
    RR.Audio.click();
    switch (a) {
      case 'tracks': this.sess = null; this.setState('levels'); break;
      case 'title': this.setState('title'); break;
      case 'settings': this.setState('settings'); break;
      case 'closeSettings': this.setState(this.settingsFrom === 'paused' ? 'paused' : 'title'); break;
      case 'mute': this.setMuted(!this.save.muted); break;
      case 'full': this.toggleFullscreen(); break;
      case 'pause': this.setState('paused'); break;
      case 'resume': this.setState('play'); break;
      case 'restart': this.startLevel(this.sess.index); break;
      case 'next': this.startLevel(Math.min(this.sess.index + 1, RR.LEVELS.length - 1)); break;
      case 'garage': this.garageFrom = this.state === 'title' ? 'title' : 'levels'; this.sess = null; this.setState('garage'); break;
      case 'garageBack': this.setState(this.garageFrom || 'title'); break;
      default: break;
    }
  }

  startLevel(i) {
    this.sess = makeSession(i, false);
    this.sess.fuelMax = this.sess.fuel = RR.fuelMax(this.save.up);
    this.acc = 0;
    this.ui.setupHud(this.sess);
    this.setState('play');
  }

  setMuted(m) { this.save.muted = m; RR.Audio.setMuted(m); RR.Save.write(this.save); this.ui.refreshMute(); }

  applyTune() { RR.balance = RR.makeTune(RR.BALANCE[this.save.balance], this.save.up); }

  setBalance(b) { this.save.balance = b; this.applyTune(); RR.Save.write(this.save); }

  buyUpgrade(id) {
    const u = RR.UPGRADES.find((q) => q.id === id), lvl = this.save.up[id] || 0;
    if (!u || lvl >= RR.UP_MAX) return;
    const cost = RR.upCost(u, lvl);
    if (this.save.coins < cost) { RR.Audio.deny(); return; }
    this.save.coins -= cost;
    this.save.up[id] = lvl + 1;
    this.applyTune();
    RR.Save.write(this.save);
    RR.Audio.buy();
    this.ui.buildGarage();
  }

  buyPaint(i) {
    const p = RR.PAINTS[i];
    if (!this.save.paints.includes(i)) {
      if (this.save.coins < p.price) { RR.Audio.deny(); return; }
      this.save.coins -= p.price;
      this.save.paints.push(i);
      RR.Audio.buy();
    } else RR.Audio.click();
    this.save.paint = i;
    this.world.bike.setPaint(p.color);
    RR.Save.write(this.save);
    this.ui.buildGarage();
  }

  setQuality(q) { this.save.quality = q; RR.Save.write(this.save); this.world.setQuality(q); this.world.level = null; }

  toggleFullscreen() {
    const d = document, elx = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        const p = (elx.requestFullscreen || elx.webkitRequestFullscreen).call(elx);
        const lock = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch (_) { /* */ } };
        if (p && p.then) p.then(lock).catch(() => {}); else lock();
      } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (_) { /* unsupported */ }
  }

  pollGamepad() {
    this.pad = null;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of gps) {
      if (!g) continue;
      const b = (i) => g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.25);
      const ax = g.axes[0] || 0;
      this.pad = { gas: b(7) || b(0), brake: b(6) || b(1), lean: ax < -0.35 || b(14) ? 1 : ax > 0.35 || b(15) ? -1 : 0 };
      const edge = (i, code) => { const now = b(i); if (now && !this.padPrev[i]) { RR.Audio.init(); this.onKey(code); } this.padPrev[i] = now; };
      edge(9, 'Escape');
      if (this.state !== 'play') edge(0, 'Enter');
      break;
    }
  }

  input() {
    const k = this.keys, tc = this.ui.touch;
    let gas = k.ArrowUp || k.KeyW || tc.gas, brake = k.ArrowDown || k.KeyS || k.Space || tc.brake;
    const back = k.ArrowLeft || k.KeyA || tc.back, fwd = k.ArrowRight || k.KeyD || tc.fwd;
    let lean = (back ? 1 : 0) - (fwd ? 1 : 0);
    if (this.pad) { gas = gas || this.pad.gas; brake = brake || this.pad.brake; if (!lean) lean = this.pad.lean; }
    return { gas: !!gas, brake: !!brake, lean };
  }

  frame(ts) {
    const now = ts / 1000;
    let dt = this.last ? now - this.last : 0;
    this.last = now;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.pollGamepad();
    const inp = this.input();
    const st = this.state === 'settings' ? this.settingsFrom : this.state;
    let active = null;
    if (st === 'play' || st === 'results') active = this.sess;
    else if (st === 'title' || st === 'levels' || st === 'garage') active = this.demo;
    if (active) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 60) {
        this.stepSession(active, active.demo || this.botPlay ? RR.botInput(active.bike, active.level) : inp);
        this.acc -= DT; n++;
      }
      if (n >= 60) this.acc = 0;
      this.frameUpdate(active, dt, active.demo ? null : inp);
    }
    if (this.demo.done) this.demo = makeSession((this.demo.index + 1) % RR.LEVELS.length, true);
    const inRun = st === 'play' || st === 'paused' || st === 'results' || st === 'nofuel';
    const view = inRun ? this.sess : this.demo;
    if (view) {
      this.world.update(view, dt, this.t, st === 'title' ? 'title' : 'play');
      this.world.render();
    }
    if (inRun) this.ui.updateHud(this.sess, this.t, this.touchMode);
    if (this.state === 'play' && this.sess && this.sess.bike.alive && !this.sess.finished) {
      const b = this.sess.bike;
      RR.Audio.engine(true, RR.clamp(Math.abs(b.wheels[0].w) / 52, 0, 1), b.throttle);
    } else RR.Audio.engine(false, 0, 0);
    this.fpsN++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.ui.fps(Math.round(this.fpsN / this.fpsT), this.save.fps); this.fpsN = 0; this.fpsT = 0; }
    requestAnimationFrame((t2) => this.frame(t2));
  }

  stepSession(s, inp) {
    if (s.done) return;
    const b = s.bike, L = s.level;
    if (s.finished) inp = { gas: false, brake: true, lean: 0 };
    else if (!s.started && (inp.gas || inp.brake || inp.lean)) s.started = true;
    if (!s.demo && s.fuel <= 0 && inp.gas) inp = { gas: false, brake: inp.brake, lean: inp.lean };
    if (s.started && !s.finished) s.time += DT;
    s.simT += DT;
    b.step(DT, inp);
    if (s.ragdoll) s.ragdoll.step(DT);
    for (const e of b.events) {
      if (e.type === 'crash') {
        s.ragdoll = new RR.Ragdoll(L, b);
        s.crashes++; s.crashT = 0;
        if (!s.demo) RR.Audio.crash();
        this.dust(s, b.c.x, b.c.y - 0.3, 26, 4);
      } else if (e.type === 'flip') {
        s.flips += e.n;
        const bonus = e.n * 1.0;
        s.bonus += bonus;
        this.popup(s, (e.n > 1 ? e.n + 'x ' : '') + (e.dir === 'back' ? 'BACKFLIP' : 'FRONTFLIP'), '−' + bonus.toFixed(1) + 's');
        if (!s.demo) RR.Audio.flip();
      } else if (e.type === 'land') {
        if (!s.demo && e.s > 3) RR.Audio.land(e.s);
        if (e.s > 4) for (const w of b.wheels) if (w.contact) this.dust(s, w.x, w.y - w.R, Math.min(18, e.s * 1.5), e.s * 0.25);
      }
    }
    b.events.length = 0;
    if (!b.alive) {
      s.crashT += DT;
      if (s.crashT > 1.6) { b.reset(L.checkpoints[s.cp]); s.ragdoll = null; s.crashT = 0; }
    } else if (!s.finished) {
      while (s.cp + 1 < L.checkpoints.length && b.c.x >= L.checkpoints[s.cp + 1]) {
        s.cp++;
        if (!s.demo) { this.popup(s, 'CHECKPOINT', ''); RR.Audio.checkpoint(); }
      }
      if (b.c.x >= L.finishX) { if (s.demo) s.done = true; else this.finish(s); }
    }
    if (s.demo && s.simT > 150) s.done = true;
    if (!s.demo && !s.over) this.runEconomy(s);
  }

  runEconomy(s) {
    const b = s.bike, L = s.level, c = b.c;
    if (s.started && b.alive && !s.finished) s.fuel = Math.max(0, s.fuel - (0.55 + 1.3 * b.throttle) * DT);
    if (!s.lowWarned && s.fuel < s.fuelMax * 0.22 && s.started) { s.lowWarned = true; this.popup(s, 'LOW FUEL', ''); RR.Audio.lowFuel(); }
    if (b.alive) {
      // fuel cans
      L.fuelCans.forEach((x, i) => {
        if (!s.canTaken[i] && Math.abs(x - c.x) < 1.4 && Math.abs(L.height(x) + 0.55 - c.y) < 1.8) {
          s.canTaken[i] = 1; s.fuel = s.fuelMax; s.lowWarned = false;
          this.popup(s, 'FUEL', 'TANK FULL'); RR.Audio.fuel();
        }
      });
      // coins near the bike (coins are sorted by x)
      const co = L.coins;
      const head = b.localToWorld({ x: 0.1, y: 1.1 });
      for (let i = 0; i < co.length; i++) {
        const k = co[i];
        if (k.x < c.x - 2.5) continue;
        if (k.x > c.x + 2.5) break;
        if (s.coinTaken[i]) continue;
        if (Math.hypot(k.x - c.x, k.y - c.y) < 1.05 || Math.hypot(k.x - head.x, k.y - head.y) < 0.6) {
          s.coinTaken[i] = 1; s.coinsRun += k.v; this.save.coins += k.v; this.coinDirty = true;
          RR.Audio.coin(k.v);
        }
      }
    }
    if (this.coinDirty && (s.simT - (s.lastSave || 0) > 1)) { RR.Save.write(this.save); this.coinDirty = false; s.lastSave = s.simT; }
    // out of fuel: stopped with an empty tank
    if (s.fuel <= 0 && !s.finished && (b.speed() < 0.35 || !b.alive)) s.noFuelT += DT; else s.noFuelT = 0;
    if (s.noFuelT > 1.6) this.outOfFuel(s);
  }

  outOfFuel(s) {
    s.over = true;
    RR.Save.write(this.save);
    RR.Audio.noFuel();
    this.ui.showNoFuel(s);
    this.setState('nofuel');
  }

  finish(s) {
    s.finished = true;
    const final = Math.max(0, s.time - s.bonus), par = s.level.par;
    const stars = final <= par ? 3 : final <= par * 1.3 ? 2 : 1;
    const i = s.index, prev = this.save.best[i];
    const isBest = prev == null || final < prev;
    if (isBest) this.save.best[i] = final;
    this.save.stars[i] = Math.max(this.save.stars[i] || 0, stars);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(RR.LEVELS.length, i + 2));
    RR.Save.write(this.save);
    const bonus = Math.round((stars * 40 * (1 + i * 0.3)) / 5) * 5;
    this.save.coins += bonus;
    RR.Save.write(this.save);
    s.result = { final, stars, isBest, prev, par, bonus, coins: s.coinsRun };
    RR.Audio.finish();
    this.popup(s, 'SUMMIT!', '');
  }

  popup(s, text, sub) { s.popups.push({ text, sub, t: 0 }); }

  dust(s, x, y, n, power) {
    const col = s.level.theme.ground === 'snow' ? '#f2f6fb' : s.level.theme.ground === 'sand' ? '#d9b07a' : '#8a6a4a';
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + Math.random() * 0.8), v = power * (0.4 + Math.random());
      s.particles.push({ x, y, z: (Math.random() - 0.5) * 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 0.8, max: 1.6, r: 0.12 + Math.random() * 0.18, col, a: 0.55 });
    }
  }

  frameUpdate(s, dt, inp) {
    const b = s.bike, c = b.c;
    const L = s.level, ahead = L.height(c.x + 7) - L.height(c.x);
    const tx = c.x + 1.5 + RR.clamp(c.vx * 0.3, -3, 4.5), ty = c.y + RR.clamp(ahead * 0.35, -2.5, 3) + RR.clamp(c.vy * 0.06, -1.2, 1.2);
    if (!s.camInit) { s.cam.x = tx; s.cam.y = ty; s.camInit = true; }
    const k = 1 - Math.exp(-dt * 4);
    s.cam.x += (tx - s.cam.x) * k;
    s.cam.y += (ty - s.cam.y) * k * 0.85;
    const rear = b.wheels[0], sp = b.speed();
    const gas = inp ? inp.gas : b.throttle > 0.5;
    if (b.alive && rear.contact && !s.finished && (Math.abs(rear.slip) > 1.5 || (gas && sp > 1.5))) {
      const want = (0.6 + Math.min(3, Math.abs(rear.slip) * 0.35)) * dt * 60;
      const col = s.level.theme.ground === 'snow' ? '#f4f8fc' : s.level.theme.ground === 'sand' ? '#d6a873' : '#7d5d40';
      for (let i = 0; i < want; i++) {
        if (i + 1 > want && Math.random() > want - i) break;
        const tx2 = rear.cny, ty2 = -rear.cnx, v = 1.5 + Math.random() * 3.5;
        s.particles.push({
          x: rear.x - rear.cnx * rear.R, y: rear.y - rear.cny * rear.R, z: (Math.random() - 0.5) * 0.4,
          vx: -tx2 * v + rear.cnx * (1 + Math.random() * 2) + c.vx * 0.2, vy: -ty2 * v + rear.cny * (1 + Math.random() * 2),
          life: 0.5 + Math.random() * 0.7, max: 1.2, r: 0.08 + Math.random() * 0.12, col, a: 0.6,
        });
      }
    }
    for (const p of s.particles) { p.vy -= 6 * dt; p.vx *= 1 - 1.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    s.particles = s.particles.filter((p) => p.life > 0);
    if (s.particles.length > 700) s.particles.splice(0, s.particles.length - 700);
    for (const p of s.popups) p.t += dt;
    s.popups = s.popups.filter((p) => p.t < 1.8);
    if (s.finished) {
      s.finishT += dt;
      if (s.finishT > 1.6 && this.state === 'play') {
        this.ui.showResults(s, s.index + 1 < RR.LEVELS.length);
        this.setState('results');
      }
    }
  }
}
