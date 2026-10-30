// 音のエンジン（素材なし・WebAudio）。bakage の snd.js が土台。曲と効果音は湯切り職人用
const Snd = {
  ctx: null, muted: false, next: 0, step: 0, track: null, want: null, switchAt: 0, played: {},
  TEMPO: { title: 112, play: 150, win: 126, sad: 70 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.master.connect(this.an); this.an.connect(this.ctx.destination)
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.0001; this.bgm.connect(this.master)
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, len)
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      if (this.want) { const w = this.want; this.want = null; this.setTrack(w) }
      if (this.wantAmb) this.ambient(true)
    } catch (e) { this.ctx = null }
  },
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7 },
  tone(f, t0, dur, type = 'square', vol = 0.2, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  noise(t0, dur, vol, freq, type = 'highpass', dest, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02)
  },
  level() { if (!this.an) return 0; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  mark(n) { this.played[n] = (this.played[n] || 0) + 1 },
  setTrack(name) {
    if (this.want === name) return
    this.want = name; if (!this.ctx) return
    const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.25)
    this.switchAt = now + 0.27
  },
  tick() {
    if (!this.ctx) return; const c = this.ctx
    if (this.switchAt && c.currentTime >= this.switchAt) {
      this.track = this.want; this.step = 0; this.next = c.currentTime + 0.05; this.switchAt = 0
      const g = this.bgm.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0.0001, c.currentTime); g.linearRampToValueAtTime(0.24, c.currentTime + 0.35)
      if (this.track) this.mark('bgm:' + this.track)
    }
    if (!this.track || this.switchAt) return
    const spb = 60 / this.TEMPO[this.track] / 4
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05
    while (this.next < c.currentTime + 0.25) { this['p_' + this.track](this.step, this.next); this.next += spb; this.step++ }
  },
  kick(t, v = 0.7) { this.tone(150, t, 0.16, 'sine', v, this.bgm, 42) },
  clap(t, v = 0.2) { for (const d of [0, 0.012, 0.024]) this.noise(t + d, 0.09, v, 1500, 'bandpass', this.bgm) },
  hat(t, v = 0.06, open) { this.noise(t, open ? 0.12 : 0.03, v, 8000, 'highpass', this.bgm) },
  wood(t, v = 0.12, f = 1400) { this.tone(f, t, 0.05, 'sine', v, this.bgm, f * 0.7) },
  bass(n, t, dur = 0.18, vol = 0.4, type = 'triangle') { this.tone(this.mtof(n), t, dur, type, vol, this.bgm) },
  // 三味線っぽいはじく音
  shami(n, t, dur = 0.22, vol = 0.07) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(this.mtof(n) * 1.01, t); o.frequency.exponentialRampToValueAtTime(this.mtof(n), t + 0.03)
    f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(700, t + dur)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f); f.connect(g); g.connect(this.bgm); o.start(t); o.stop(t + dur + 0.02)
  },
  flute(n, t, dur, vol = 0.05) { this.tone(this.mtof(n), t, dur, 'sine', vol, this.bgm); this.tone(this.mtof(n) * 2, t, dur * 0.5, 'sine', vol * 0.15, this.bgm) },
  // タイトル: のんびりした屋台の三味線（ヨナ抜き）
  p_title(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    if (s === 0 || s === 8) this.kick(t, 0.45); if (s === 4 || s === 12) this.wood(t, 0.1); if (s % 2) this.hat(t, 0.025)
    const mel = [[69, -1, 72, 74, 76, -1, 74, 72], [69, -1, 67, -1, 64, 67, 69, -1], [72, -1, 74, 76, 79, -1, 76, 74], [72, 69, -1, 67, 69, -1, -1, -1]]
    if (s % 2 === 0) { const n = mel[bar][s / 2]; if (n > 0) this.shami(n, t, 0.26, 0.06) }
    if (s === 0) this.bass([45, 41, 43, 45][bar], t, 0.5, 0.3); if (s === 10) this.bass([52, 48, 50, 52][bar], t, 0.25, 0.22)
  },
  // プレイ: せわしない厨房（速い三味線＋太鼓）
  p_play(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    if (s % 4 === 0) this.kick(t, 0.6); if (s === 4 || s === 12) this.clap(t, 0.1); if (s % 2 === 1) this.hat(t, 0.04)
    if (s === 6 || s === 14) this.wood(t, 0.09, 1800)
    const mel = [[76, 74, 72, 69, 72, 74, 76, 79], [81, 79, 76, 74, 76, -1, 74, 72], [74, 76, 79, 76, 74, 72, 69, 72], [74, -1, 72, 69, 67, 69, -1, -1]]
    if (s % 2 === 0) { const n = mel[bar][s / 2]; if (n > 0) this.shami(n, t, 0.16, 0.05) }
    if (s % 4 === 0) this.bass([45, 45, 43, 40][bar] + (s === 8 ? 7 : 0), t, 0.16, 0.36, 'sawtooth')
  },
  p_win(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    if (s % 4 === 0) this.kick(t, 0.55); if (s === 4 || s === 12) this.clap(t, 0.14); if (s % 2) this.hat(t, 0.04, s % 4 === 2)
    const mel = [[76, 79, 81, 84, 81, 79, 76, 79], [81, -1, 79, 76, 74, 76, 79, -1], [76, 79, 81, 84, 86, 84, 81, 79], [81, -1, -1, 79, 81, -1, -1, -1]]
    if (s % 2 === 0) { const n = mel[bar][s / 2]; if (n > 0) this.shami(n, t, 0.22, 0.06) }
    if (s === 0 || s === 8) this.bass([45, 50, 45, 52][bar], t, 0.3, 0.3)
  },
  p_sad(i, t) {
    const bar = Math.floor(i / 12) % 4, s = i % 12
    const root = [33, 38, 40, 33][bar]
    if (s === 0) this.bass(root, t, 0.8, 0.3, 'sine')
    const mel = [[76, 74, 72], [74, 72, 69], [71, 69, 68], [69, -1, -1]][bar]
    if (s % 4 === 0) { const n = mel[s / 4]; if (n > 0) this.flute(n - 12, t, 0.5, 0.06) }
  },
  // 寸胴のぐつぐつ（ずっと鳴る）
  ambient(on) {
    if (!this.ctx) { this.wantAmb = on; return }
    this.wantAmb = on
    if (on && !this.amb) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
      s.buffer = this.noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2; g.gain.value = 0.05
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.amb = { s, g }
    } else if (!on && this.amb) { try { this.amb.s.stop() } catch (e) {} this.amb = null }
  },
  bubble() { if (!this.ctx || !this.amb) return; const t = this.ctx.currentTime; const f = 220 + Math.random() * 260; this.tone(f, t, 0.06, 'sine', 0.05, null, f * 1.8) },
  // 情けない声（ノコギリ波を母音っぽいフィルタに通す）
  voice(pitch, kind) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime; this.mark('voice:' + kind)
    const plans = {
      talk: [[1, 1.15, 0.09, 1100], [1.1, 0.95, 0.08, 1500], [0.95, 1.05, 0.1, 900]],
      wow: [[1.2, 1.9, 0.45, 1300]],
      ok: [[1, 1.2, 0.16, 1200], [1.2, 1.0, 0.18, 900]],
      meh: [[1, 0.8, 0.35, 700]],
      hot: [[1.6, 2.6, 0.12, 1700], [2.6, 3.2, 0.5, 2400], [3.0, 1.4, 0.35, 1600]],
      mad: [[0.9, 0.6, 0.18, 800], [1.1, 0.7, 0.3, 900]],
      sad: [[1.2, 0.7, 0.6, 800]],
    }[kind] || [[1, 1, 0.1, 1000]]
    let s = t
    for (const [a, b, d, fq] of plans) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), base = 180 * pitch
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * a, s); o.frequency.exponentialRampToValueAtTime(base * b, s + d)
      if (kind === 'hot') { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 14; lg.gain.value = base * 0.12; lfo.connect(lg); lg.connect(o.frequency); lfo.start(s); lfo.stop(s + d) }
      f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 3; f2.type = 'bandpass'; f2.frequency.value = fq * 2.4; f2.Q.value = 4
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(kind === 'hot' || kind === 'mad' ? 0.55 : 0.36, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + d)
      o.connect(f); o.connect(f2); f.connect(g); f2.connect(g); g.connect(this.master); o.start(s); o.stop(s + d + 0.02); s += d * 0.9
    }
  },
  sfx(name, v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime; this.mark(name)
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'triangle', 0.12); break
      case 'lift': this.noise(t, 0.35, 0.25, 900, 'lowpass'); this.tone(300, t, 0.2, 'sine', 0.2, null, 700); break
      case 'swish': this.noise(t, 0.12 + v * 0.08, 0.05 + v * 0.12, 600 + v * 1800, 'bandpass', null, 1.4); this.noise(t + 0.08, 0.18, 0.04 + v * 0.08, 1200, 'highpass'); break
      case 'weak': this.tone(500, t, 0.08, 'sine', 0.12, null, 300); this.noise(t, 0.08, 0.05, 1400, 'bandpass'); break
      case 'splash': this.noise(t, 0.5, 0.4, 1800, 'bandpass', null, 0.7); this.noise(t + 0.05, 0.35, 0.2, 5000, 'highpass'); for (let k = 0; k < 6; k++) this.tone(900 + Math.random() * 900, t + 0.1 + k * 0.05, 0.04, 'sine', 0.06); break
      case 'tenkuUp': this.tone(300, t, 0.4, 'sine', 0.15, null, 1200); this.noise(t, 0.4, 0.08, 2000, 'bandpass', null, 2); break
      case 'tenku': this.noise(t, 0.25, 0.35, 1000, 'lowpass'); this.tone(80, t, 0.4, 'sine', 0.6, null, 40); this.tone(1320, t + 0.05, 0.5, 'sine', 0.14); this.tone(1760, t + 0.12, 0.6, 'sine', 0.12); break
      case 'ceil': this.tone(400, t, 0.35, 'triangle', 0.18, null, 1600); this.tone(180, t + 0.38, 0.12, 'sine', 0.5, null, 90); this.noise(t + 0.38, 0.15, 0.25, 900, 'lowpass'); break
      case 'fly': for (let k = 0; k < 6; k++) this.noise(t + k * 0.09, 0.08, 0.1, 1500, 'bandpass', null, 3); this.tone(600, t, 0.6, 'triangle', 0.12, null, 200); break
      case 'clonk': this.tone(520, t, 0.25, 'square', 0.16, null, 380); this.tone(780, t, 0.2, 'triangle', 0.12); this.noise(t, 0.08, 0.2, 3000); break
      case 'serve': this.tone(220, t, 0.12, 'sine', 0.4, null, 120); this.tone(988, t + 0.05, 0.15, 'triangle', 0.12); this.tone(1319, t + 0.12, 0.25, 'triangle', 0.1); break
      case 'bell': this.tone(1568, t, 0.6, 'sine', 0.12); this.tone(2093, t + 0.02, 0.5, 'sine', 0.06); break
      case 'applause': for (let k = 0; k < 80 * v; k++) this.noise(t + Math.random() * 1.8 * v, 0.03, 0.08, 1800 + Math.random() * 2000, 'bandpass', null, 0.8); break
      case 'cheer': this.noise(t, 1.6, 0.14, 1200, 'bandpass', null, 0.6); for (let k = 0; k < 4; k++) this.tone(1800, t + k * 0.3, 0.3, 'sine', 0.05, null, 2600); break
      case 'boo': for (let k = 0; k < 9; k++) { const f = 105 + Math.random() * 40; this.tone(f, t + Math.random() * 0.2, 1.3, 'sawtooth', 0.04, null, f * 0.7) } this.noise(t, 1.3, 0.12, 500, 'lowpass'); break
      case 'tv': this.tone(988, t, 0.12, 'square', 0.08); this.tone(1319, t + 0.12, 0.12, 'square', 0.08); this.tone(1976, t + 0.24, 0.3, 'square', 0.08); break
      case 'tvng': this.tone(1000, t, 1.0, 'sine', 0.12); this.noise(t, 1.0, 0.05, 3000); break
      case 'shutter': for (let k = 0; k < 14; k++) this.noise(t + k * 0.05, 0.05, 0.12, 700 + k * 40, 'bandpass', null, 2); break
      case 'go': this.tone(660, t, 0.08, 'square', 0.08); this.tone(990, t + 0.08, 0.2, 'square', 0.08); break
      case 'tick': this.tone(1500, t, 0.03, 'square', 0.04); break
      case 'roll': for (let k = 0; k < 30 * v; k++) this.noise(t + k * 0.04, 0.05, 0.05 + k * 0.004, 1800, 'bandpass'); break
      case 'ding': { const f = 440 * Math.pow(2, (v - 5) / 8); this.tone(f, t, 0.4, 'triangle', 0.25); this.tone(f * 2, t + 0.05, 0.3, 'sine', 0.12); break }
      case 'slam': this.tone(90, t, 0.5, 'sine', 0.8, null, 40); this.noise(t, 0.3, 0.3, 2000, 'lowpass'); break
      case 'flash': this.noise(t, 0.04, 0.08, 6000); this.tone(1800, t, 0.03, 'square', 0.03); break
    }
  },
}
