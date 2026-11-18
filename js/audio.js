'use strict';
// All sound is synthesised at runtime - no audio files, nothing to license.
(function (RR) {
  const A = {
    ctx: null, muted: false, ready: false,
    init() {
      if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(ctx.destination);

      // engine: two detuned oscillators -> lowpass -> gain
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.Q.value = 4;
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
      this.o2 = ctx.createOscillator(); this.o2.type = 'square';
      this.o1.frequency.value = 40; this.o2.frequency.value = 40.7;
      const g2 = ctx.createGain(); g2.gain.value = 0.45;
      this.o1.connect(this.engFilter); this.o2.connect(g2); g2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.o1.start(); this.o2.start();

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ready = true;
    },
    setMuted(m) {
      this.muted = m;
      if (this.ready) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
    },
    engine(on, rpm, throttle) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      const f = 38 + rpm * 110 + throttle * 12;
      this.o1.frequency.setTargetAtTime(f, t, 0.04);
      this.o2.frequency.setTargetAtTime(f * 1.012, t, 0.04);
      this.engFilter.frequency.setTargetAtTime(350 + throttle * 1500 + rpm * 900, t, 0.05);
      this.engGain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.07 : 0, t, 0.06);
    },
    burst(dur, freq, vol, type) {
      if (!this.ready) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
    },
    tone(freq, dur, vol, type, when) {
      if (!this.ready) return;
      const ctx = this.ctx, t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator(); o.type = type || 'triangle'; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    },
    land(s) { this.burst(0.18, 220, Math.min(0.5, 0.06 + s * 0.04)); },
    crash() { this.burst(0.5, 500, 0.6); this.burst(0.25, 2400, 0.15, 'bandpass'); },
    click() { this.tone(880, 0.06, 0.08, 'square'); },
    checkpoint() { this.tone(660, 0.12, 0.15); this.tone(990, 0.18, 0.15, 'triangle', 0.1); },
    flip() { this.tone(523, 0.1, 0.15); this.tone(784, 0.16, 0.15, 'triangle', 0.08); },
    coin(v) { this.tone(v >= 100 ? 1568 : v >= 25 ? 1318 : 1175, 0.09, 0.09, 'square'); this.tone(v >= 100 ? 2093 : 1760, 0.14, 0.08, 'triangle', 0.05); },
    fuel() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.16, 0.14, 'triangle', i * 0.06)); },
    lowFuel() { this.tone(440, 0.12, 0.14, 'square'); this.tone(440, 0.12, 0.14, 'square', 0.2); },
    noFuel() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 0.15, 'triangle', i * 0.14)); },
    buy() { [784, 988, 1318].forEach((f, i) => this.tone(f, 0.12, 0.13, 'triangle', i * 0.05)); this.burst(0.15, 4000, 0.05, 'highpass'); },
    deny() { this.tone(160, 0.2, 0.15, 'square'); },
    finish() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 0.18, 'triangle', i * 0.11)); },
  };
  RR.Audio = A;
})(window.RR);
