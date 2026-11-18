// HTML/CSS overlay UI: menus, HUD, touch controls.
const RR = window.RR;

const CARD_BG = {
  alpine: 'linear-gradient(160deg,#3f7fbf 0%,#9cc3e0 55%,#d9e8f0 100%)',
  desert: 'linear-gradient(160deg,#d8683a 0%,#f2a96a 55%,#fbe0b4 100%)',
  dusk: 'linear-gradient(160deg,#241c4a 0%,#7a4578 55%,#ef8c6c 100%)',
  snow: 'linear-gradient(160deg,#7fb0db 0%,#c8def0 55%,#f4f8fc 100%)',
  night: 'linear-gradient(160deg,#050a1a 0%,#14224a 60%,#2a4070 100%)',
};
const GROUND_COL = { alpine: '#3e6b2c', desert: '#9a5a30', dusk: '#2c3f2a', snow: '#e9f1f8', night: '#1c2d26' };

const ICON = {
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 15.5A7 7 0 1 0 6 8"/><path d="M6 3.5V8h4.5"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15.5A7 7 0 1 1 18 8"/><path d="M18 3.5V8h-4.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc23a"/><circle cx="12" cy="12" r="10" fill="none" stroke="#b07a10" stroke-width="1.6"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b07a10" stroke-width="1.4"/></svg>',
  can: '<svg viewBox="0 0 24 24"><path d="M6 6h9l3 3v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V7a1 1 0 0 1 1-1z" fill="#e0302a"/><path d="M8 3h5v3H8z" fill="#ddd"/><path d="M8 13h8" stroke="#ffd23a" stroke-width="2.4"/></svg>',
  engine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9h3l2-2h5l2 2h2v3h2v4h-2v2h-4l-2 2H8v-4H4z"/></svg>',
  tires: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
  susp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M8 5h8M8 19h8M8 7l8 2-8 2 8 2-8 2 8 2"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16zM5 10h10M15 8l3 2v8a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>',
  rider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="13" cy="4.5" r="2.2"/><path d="M12 8l-3 5 4 2 1 6M9 13l-4 2M14 9l4 3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
};

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const stars = (n) => [0, 1, 2].map((k) => `<span class="star ${k < n ? 'on' : ''}">${ICON.star}</span>`).join('');

export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('ui');
    this.root.innerHTML = `
      <section id="s-title" class="screen">
        <div class="title-wrap">
          <div class="eyebrow">HILL CLIMB TRIALS</div>
          <h1 class="logo"><span>RIDGELINE</span><b>RUSH</b></h1>
          <p class="tag">Throttle. Balance. Summit.</p>
          <div class="menu">
            <button class="btn primary big" data-act="tracks">PLAY</button>
            <button class="btn" data-act="garage">GARAGE</button>
            <button class="btn" data-act="settings">SETTINGS</button>
          </div>
          <div class="tstat"><span class="star on">${ICON.star}</span><span id="t-stars">0</span><small>/ 36 stars</small><span class="coin">${ICON.coin}</span><span id="t-coins" class="coins">0</span></div>
        </div>
        <div class="corner"><button class="icon" data-act="mute"></button><button class="icon" data-act="full">${ICON.full}</button></div>
        <div class="hint" id="t-hint"></div>
      </section>

      <section id="s-levels" class="screen dim">
        <header class="bar"><button class="btn small" data-act="title">‹ BACK</button><h2>SELECT A MOUNTAIN</h2><div class="corner-inline"><div class="wallet glass"><span class="coin">${ICON.coin}</span><b id="l-coins">0</b></div><button class="btn small" data-act="garage">GARAGE</button><button class="icon" data-act="mute"></button></div></header>
        <div class="grid" id="grid"></div>
      </section>

      <section id="s-hud" class="screen hud">
        <div class="hud-tl glass">
          <div class="hud-name" id="h-name"></div>
          <div class="hud-time" id="h-time">0:00.00</div>
          <div class="hud-bonus" id="h-bonus"></div>
          <div class="fuel"><span class="can">${ICON.can}</span><div class="fbar"><i id="h-fuel"></i></div></div>
        </div>
        <div class="hud-coins glass"><span class="coin">${ICON.coin}</span><b id="h-coins">0</b></div>
        <div class="hud-top">
          <div class="prog glass"><div class="prog-track"><div class="prog-fill" id="h-fill"></div><div id="h-cps"></div><div class="prog-dot" id="h-dot"></div></div></div>
          <div class="alt" id="h-alt"></div>
        </div>
        <div class="corner"><button class="icon" data-act="mute"></button><button class="icon" data-act="pause">${ICON.pause}</button></div>
        <div class="gauge" id="h-gauge"><svg viewBox="0 0 120 70"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="9" stroke-linecap="round"/>
          <path d="M37 19 A50 50 0 0 1 83 19" fill="none" stroke="#38d27a" stroke-width="9" stroke-linecap="round"/>
          <path d="M18 36 A50 50 0 0 1 37 19 M83 19 A50 50 0 0 1 102 36" fill="none" stroke="#ffb020" stroke-width="9"/>
          <path d="M10 62 A50 50 0 0 1 18 36 M102 36 A50 50 0 0 1 110 62" fill="none" stroke="#ff4040" stroke-width="9" stroke-linecap="round"/>
          <g id="h-needle"><path d="M60 62 L57 22 L60 14 L63 22 Z" fill="#fff"/></g><circle cx="60" cy="62" r="6" fill="#fff"/></svg><span>BALANCE</span></div>
        <div class="popups" id="h-pop"></div>
        <div class="center-msg" id="h-msg"></div>
        <div class="touch" id="touch">
          <div class="tleft"><button class="tb" data-k="back">${ICON.back}<small>LEAN BACK</small></button><button class="tb" data-k="fwd">${ICON.fwd}<small>LEAN FWD</small></button></div>
          <div class="tright"><button class="tb" data-k="brake"><b>BRAKE</b></button><button class="tb gas" data-k="gas"><b>GAS</b></button></div>
        </div>
      </section>

      <section id="s-pause" class="screen modal">
        <div class="panel glass">
          <h2>PAUSED</h2>
          <button class="btn primary" data-act="resume">RESUME</button>
          <button class="btn" data-act="restart">RESTART</button>
          <button class="btn" data-act="settings">SETTINGS</button>
          <button class="btn" data-act="tracks">MOUNTAINS</button>
        </div>
      </section>

      <section id="s-results" class="screen modal">
        <div class="panel glass wide">
          <div class="eyebrow">SUMMIT REACHED</div>
          <h2 id="r-name"></h2>
          <div class="rstars" id="r-stars"></div>
          <div class="rtime" id="r-time"></div>
          <div class="rbest" id="r-best"></div>
          <div class="rstats" id="r-stats"></div>
          <div class="rcoins" id="r-coins"></div>
          <div class="row"><button class="btn" data-act="restart">RETRY</button><button class="btn" data-act="tracks">MOUNTAINS</button><button class="btn primary" data-act="next" id="r-next">NEXT ›</button></div>
        </div>
      </section>

      <section id="s-garage" class="screen dim">
        <header class="bar"><button class="btn small" data-act="garageBack">‹ BACK</button><h2>GARAGE</h2><div class="corner-inline"><div class="wallet glass"><span class="coin">${ICON.coin}</span><b id="g-coins">0</b></div></div></header>
        <div class="garage">
          <div class="ups" id="g-ups"></div>
          <div class="ghead">PAINT SHOP</div>
          <div class="paints" id="g-paints"></div>
        </div>
      </section>

      <section id="s-nofuel" class="screen modal">
        <div class="panel glass wide">
          <div class="eyebrow red">RUN OVER</div>
          <h2>OUT OF FUEL</h2>
          <div class="rstats" id="nf-stats"></div>
          <p class="note center">Upgrade your Fuel Tank in the Garage to ride further between cans.</p>
          <div class="row"><button class="btn" data-act="garage">GARAGE</button><button class="btn" data-act="tracks">MOUNTAINS</button><button class="btn primary" data-act="restart">RETRY</button></div>
        </div>
      </section>

      <section id="s-settings" class="screen modal">
        <div class="panel glass wide">
          <h2>SETTINGS</h2>
          <div class="set"><label>Graphics</label><div class="seg" id="q-seg">
            <button data-q="low">LOW</button><button data-q="medium">MEDIUM</button><button data-q="high">HIGH</button><button data-q="ultra">ULTRA</button></div></div>
          <p class="note" id="q-note"></p>
          <div class="set"><label>Balance</label><div class="seg" id="b-seg">
            <button data-b="easy">EASY</button><button data-b="normal">NORMAL</button><button data-b="hard">HARD</button></div></div>
          <p class="note" id="b-note"></p>
          <div class="set"><label>Sound</label><div class="seg" id="snd-seg"><button data-s="on">ON</button><button data-s="off">OFF</button></div></div>
          <div class="set"><label>Show FPS</label><div class="seg" id="fps-seg"><button data-f="on">ON</button><button data-f="off">OFF</button></div></div>
          <button class="btn primary" data-act="closeSettings">DONE</button>
        </div>
      </section>
      <div id="fps"></div>`;

    this.$ = (id) => document.getElementById(id);
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { this.g.action(b.dataset.act); return; }
      const q = e.target.closest('[data-q]');
      if (q) { this.g.setQuality(q.dataset.q); this.refreshSettings(); return; }
      const bl = e.target.closest('[data-b]');
      if (bl) { this.g.setBalance(bl.dataset.b); this.refreshSettings(); return; }
      const s = e.target.closest('[data-s]');
      if (s) { this.g.setMuted(s.dataset.s === 'off'); this.refreshSettings(); return; }
      const f = e.target.closest('[data-f]');
      if (f) { this.g.save.fps = f.dataset.f === 'on'; RR.Save.write(this.g.save); this.refreshSettings(); return; }
      const up = e.target.closest('[data-up]');
      if (up) { this.g.buyUpgrade(up.dataset.up); return; }
      const pt = e.target.closest('[data-paint]');
      if (pt) { this.g.buyPaint(+pt.dataset.paint); return; }
      const c = e.target.closest('[data-lvl]');
      if (c && !c.classList.contains('locked')) this.g.startLevel(+c.dataset.lvl);
    });
    // touch controls: multi-touch, slide between buttons
    this.touch = { gas: false, brake: false, back: false, fwd: false };
    this.ptr = new Map();
    const tz = this.$('touch');
    const keyAt = (x, y) => { const t = document.elementFromPoint(x, y); const b = t && t.closest && t.closest('.tb'); return b ? b.dataset.k : null; };
    const recompute = () => {
      for (const k in this.touch) this.touch[k] = false;
      for (const k of this.ptr.values()) if (k) this.touch[k] = true;
      tz.querySelectorAll('.tb').forEach((b) => b.classList.toggle('on', this.touch[b.dataset.k]));
    };
    tz.addEventListener('pointerdown', (e) => { RR.Audio.init(); this.ptr.set(e.pointerId, keyAt(e.clientX, e.clientY)); try { tz.setPointerCapture(e.pointerId); } catch (_) { /* */ } recompute(); e.preventDefault(); });
    tz.addEventListener('pointermove', (e) => { if (!this.ptr.has(e.pointerId)) return; const k = keyAt(e.clientX, e.clientY); if (k) { this.ptr.set(e.pointerId, k); recompute(); } });
    const end = (e) => { this.ptr.delete(e.pointerId); recompute(); };
    tz.addEventListener('pointerup', end); tz.addEventListener('pointercancel', end);
    this.popEls = [];
    this.lastTime = '';
  }

  show(state, prev) {
    const map = { title: ['s-title'], levels: ['s-levels'], play: ['s-hud'], paused: ['s-hud', 's-pause'], results: ['s-hud', 's-results'], settings: [], garage: ['s-garage'], nofuel: ['s-hud', 's-nofuel'] };
    let on = map[state] || [];
    if (state === 'settings') on = (map[prev] || []).concat(['s-settings']);
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', on.includes(s.id)));
    this.root.classList.toggle('playing', state === 'play');
    if (state === 'levels') { this.buildGrid(); this.$('l-coins').textContent = this.fmtC(this.g.save.coins); }
    if (state === 'garage') this.buildGarage();
    if (state === 'title') {
      this.$('t-stars').textContent = Object.values(this.g.save.stars).reduce((a, b) => a + b, 0);
      this.$('t-coins').textContent = this.fmtC(this.g.save.coins);
      this.$('t-hint').innerHTML = this.g.touchMode ? 'Left thumb: lean &nbsp;·&nbsp; Right thumb: brake / gas'
        : '<kbd>↑</kbd> Gas &nbsp; <kbd>↓</kbd> Brake &nbsp; <kbd>←</kbd><kbd>→</kbd> Lean &nbsp; <kbd>R</kbd> Restart &nbsp; <kbd>Esc</kbd> Pause &nbsp; <kbd>F</kbd> Fullscreen';
    }
    if (state === 'settings') this.refreshSettings();
    this.refreshMute();
  }

  fmtC(n) { return Math.floor(n).toLocaleString('en-US'); }

  buildGarage() {
    const sv = this.g.save;
    this.$('g-coins').textContent = this.fmtC(sv.coins);
    this.$('g-ups').innerHTML = RR.UPGRADES.map((u) => {
      const lvl = sv.up[u.id] || 0, max = lvl >= RR.UP_MAX, cost = max ? 0 : RR.upCost(u, lvl), afford = sv.coins >= cost;
      const pips = Array.from({ length: RR.UP_MAX }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="upcard glass">
        <div class="upicon">${ICON[u.id]}</div>
        <div class="upname">${u.name}</div>
        <div class="updesc">${u.desc}</div>
        <div class="uppips">${pips}</div>
        <button class="btn ${max ? '' : afford ? 'primary' : 'poor'}" data-up="${u.id}" ${max ? 'disabled' : ''}>${max ? 'MAXED' : `<span class="coin">${ICON.coin}</span>${this.fmtC(cost)}`}</button>
      </div>`;
    }).join('');
    this.$('g-paints').innerHTML = RR.PAINTS.map((p, i) => {
      const owned = sv.paints.includes(i), on = sv.paint === i;
      const hex = '#' + p.color.toString(16).padStart(6, '0');
      return `<button class="paint ${on ? 'on' : ''} ${owned ? 'owned' : ''}" data-paint="${i}">
        <span class="sw" style="background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 45%), ${hex}"></span>
        <span class="pn">${p.name.toUpperCase()}</span>
        <span class="pp">${on ? 'EQUIPPED' : owned ? 'OWNED' : `<span class="coin">${ICON.coin}</span>${this.fmtC(p.price)}`}</span>
      </button>`;
    }).join('');
  }

  showNoFuel(s) {
    const L = s.level, prog = Math.round(RR.clamp((s.bike.c.x - L.checkpoints[0]) / (L.finishX - L.checkpoints[0]), 0, 1) * 100);
    const alt = Math.round(L.height(RR.clamp(s.bike.c.x, 0, L.finishX)) - L.height(0));
    this.$('nf-stats').innerHTML = `<span>Distance <b>${prog}%</b></span><span>Altitude <b>${alt} m</b></span><span>Coins <b>+${this.fmtC(s.coinsRun)}</b></span>`;
  }

  refreshMute() { this.root.querySelectorAll('[data-act="mute"]').forEach((b) => { b.innerHTML = this.g.save.muted ? ICON.muted : ICON.sound; }); }

  refreshSettings() {
    const s = this.g.save;
    this.$('q-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.q === s.quality));
    this.$('snd-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b.dataset.s === 'off') === !!s.muted));
    this.$('fps-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b.dataset.f === 'on') === !!s.fps));
    const notes = { low: 'Fastest. For older phones.', medium: 'Balanced. Good for most phones.', high: 'Sharp at native resolution up to 2x pixel density, 4K shadows.', ultra: 'Native 4K+ on any display, highest-detail textures. Needs a strong GPU.' };
    this.$('q-note').textContent = notes[s.quality] || '';
    this.$('b-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.b === s.balance));
    const bn = { easy: 'Forgiving: the bike is stable and easy to correct.', normal: 'The bike wheelies hard on throttle. Feather the gas and lean to stay up.', hard: 'Twitchy and unforgiving. Every throttle input matters.' };
    this.$('b-note').textContent = bn[s.balance] || '';
    this.refreshMute();
  }

  buildGrid() {
    const grid = this.$('grid'), sv = this.g.save;
    grid.innerHTML = '';
    RR.LEVELS.forEach((def, i) => {
      const L = this.g.preview(i), locked = i >= sv.unlocked;
      let mn = Infinity, mx = -Infinity;
      const N = 70, pts = [];
      for (let k = 0; k <= N; k++) { const v = L.height((L.finishX * k) / N); pts.push(v); mn = Math.min(mn, v); mx = Math.max(mx, v); }
      const span = Math.max(10, mx - mn);
      const d = 'M0 100 ' + pts.map((v, k) => `L${(k / N) * 200} ${92 - ((v - mn) / span) * 62}`).join(' ') + ' L200 100 Z';
      const climb = Math.round(L.height(L.finishX) - L.height(0));
      const best = sv.best[i];
      const pips = Array.from({ length: 5 }, (_, k) => `<i class="${k < Math.round(def.diff * 4) + 1 ? 'on' : ''}"></i>`).join('');
      const card = el(`<button class="card ${locked ? 'locked' : ''}" data-lvl="${i}" style="background:${CARD_BG[def.theme]}">
        <svg class="prof" viewBox="0 0 200 100" preserveAspectRatio="none"><path d="${d}" fill="${GROUND_COL[def.theme]}" stroke="rgba(255,255,255,.55)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>
        <div class="card-in">
          <div class="num">${String(i + 1).padStart(2, '0')}</div>
          <div class="nm">${def.name.toUpperCase()}</div>
          <div class="meta"><span class="pips">${pips}</span><span>+${climb} m</span></div>
          <div class="foot"><span class="stars">${stars(sv.stars[i] || 0)}</span><span class="best">${best != null ? RR.fmtTime(best) : ''}</span></div>
        </div>
        ${locked ? `<div class="lock">${ICON.lock}</div>` : ''}
      </button>`);
      grid.appendChild(card);
    });
  }

  setupHud(s) {
    const L = s.level;
    this.$('h-name').textContent = `${String(s.index + 1).padStart(2, '0')} · ${L.def.name.toUpperCase()}`;
    const cps = this.$('h-cps');
    cps.innerHTML = '';
    const x0 = L.checkpoints[0];
    for (let i = 1; i < L.checkpoints.length; i++) {
      const d = el(`<i class="cp" data-i="${i}" style="left:${((L.checkpoints[i] - x0) / (L.finishX - x0)) * 100}%"></i>`);
      cps.appendChild(d);
    }
    this.$('h-pop').innerHTML = '';
    this.lastCp = -1;
  }

  updateHud(s, t, touchMode) {
    const L = s.level, b = s.bike;
    const tm = RR.fmtTime(s.time - s.bonus);
    if (tm !== this.lastTime) { this.$('h-time').textContent = tm; this.lastTime = tm; }
    this.$('h-bonus').textContent = s.bonus > 0 ? `−${s.bonus.toFixed(1)}s flip bonus` : '';
    const fp = RR.clamp(s.fuel / s.fuelMax, 0, 1), fb = this.$('h-fuel');
    fb.style.width = fp * 100 + '%';
    fb.className = fp < 0.22 ? 'low' : fp < 0.45 ? 'mid' : '';
    if (this.lastCoins !== s.coinsRun) { this.$('h-coins').textContent = this.fmtC(s.coinsRun); this.lastCoins = s.coinsRun; }
    const x0 = L.checkpoints[0], prog = RR.clamp((b.c.x - x0) / (L.finishX - x0), 0, 1);
    this.$('h-fill').style.width = prog * 100 + '%';
    this.$('h-dot').style.left = prog * 100 + '%';
    const alt = Math.round(L.height(RR.clamp(b.c.x, 0, L.finishX)) - L.height(0));
    const tot = Math.round(L.height(L.finishX) - L.height(0));
    this.$('h-alt').textContent = `ALT ${alt} m  /  ${tot} m`;
    if (this.lastCp !== s.cp) {
      this.$('h-cps').querySelectorAll('.cp').forEach((c) => c.classList.toggle('done', +c.dataset.i <= s.cp));
      this.lastCp = s.cp;
    }
    // balance gauge: pitch relative to the ground under the bike
    let err = b.c.a - L.slope(b.c.x);
    err = Math.atan2(Math.sin(err), Math.cos(err));
    this.$('h-needle').setAttribute('transform', `rotate(${RR.clamp(err * 57.3, -85, 85)} 60 62)`);
    this.$('h-gauge').classList.toggle('hide', !b.alive);
    // popups
    const pop = this.$('h-pop');
    for (const p of s.popups) {
      if (!p.el) {
        p.el = el(`<div class="pop"><b>${p.text}</b>${p.sub ? `<span>${p.sub}</span>` : ''}</div>`);
        pop.appendChild(p.el);
        setTimeout(() => p.el.remove(), 1800);
      }
    }
    const msg = this.$('h-msg');
    let m = '';
    if (!b.alive) m = '<b class="bad">WIPEOUT</b>';
    else if (!s.started) m = `<span class="pulse">${touchMode ? 'Hold GAS to ride' : 'Press ↑ to ride'}</span>`;
    if (msg.dataset.m !== m) { msg.innerHTML = m; msg.dataset.m = m; }
    this.$('touch').classList.toggle('on', touchMode);
  }

  showResults(s, hasNext) {
    const r = s.result;
    this.$('r-name').textContent = s.level.def.name.toUpperCase();
    this.$('r-stars').innerHTML = [0, 1, 2].map((k) => `<span class="star big ${k < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.22}s">${ICON.star}</span>`).join('');
    this.$('r-time').textContent = RR.fmtTime(r.final);
    this.$('r-best').innerHTML = r.isBest && r.prev != null ? '<b>NEW BEST!</b>' : r.prev != null ? `Best ${RR.fmtTime(Math.min(r.prev, r.final))}` : '';
    this.$('r-stats').innerHTML = `<span>3★ under <b>${RR.fmtTime(r.par)}</b></span><span>Flips <b>${s.flips}</b></span><span>Wipeouts <b>${s.crashes}</b></span>`;
    this.$('r-next').style.display = hasNext ? '' : 'none';
    this.$('r-coins').innerHTML = `<span class="coin">${ICON.coin}</span> +${this.fmtC(r.coins)} collected &nbsp;·&nbsp; +${this.fmtC(r.bonus)} summit bonus`;
  }

  fps(v, on) { const f = this.$('fps'); f.style.display = on ? 'block' : 'none'; if (on) f.textContent = v + ' FPS'; }
}
