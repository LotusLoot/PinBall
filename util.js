// 공용 도구: 시드 난수, 수학, 저장, 효과음 합성
(function () {
  const U = (G.U = {});

  // 시드 난수 (mulberry32). 상태를 저장해서 이어 하기와 일일 도전에서 같은 결과가 나온다.
  U.RNG = function (seed) { this.s = seed >>> 0 || 1; };
  U.RNG.prototype.next = function () {
    let t = (this.s += 0x6d2b79f5) >>> 0; this.s = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  U.RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  U.RNG.prototype.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  U.RNG.prototype.weighted = function (obj) {
    let tot = 0; for (const k in obj) tot += obj[k];
    let r = this.next() * tot; for (const k in obj) { r -= obj[k]; if (r < 0) return k; }
    return Object.keys(obj)[0];
  };
  U.hashStr = function (s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.easeOut = t => 1 - Math.pow(1 - t, 3);
  U.easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  U.sleep = ms => new Promise(r => setTimeout(r, ms / (G.speed || 1)));
  U.fmt = n => Math.round(n).toLocaleString('ko-KR');
  U.todayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  // 저장: 버전 번호를 넣어 나중에 구조가 바뀌어도 기존 저장이 깨지지 않게 한다.
  const META_KEY = 'tgy_meta', RUN_KEY = 'tgy_run';
  U.SAVE_VERSION = 1;
  U.load = function (key) {
    try { const raw = localStorage.getItem(key); if (!raw) return null; const d = JSON.parse(raw); return d && d.v ? d : null; } catch (e) { return null; }
  };
  U.store = function (key, data) { try { data.v = U.SAVE_VERSION; localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} };
  U.remove = function (key) { try { localStorage.removeItem(key); } catch (e) {} };
  U.META_KEY = META_KEY; U.RUN_KEY = RUN_KEY;

  U.migrateMeta = function (m) {
    const base = {
      v: 1, essence: 0, essenceTotal: 0,
      unlocked: [], perma: { hp: 0, gold: 0, reroll: 0 },
      chars: { apprentice: true }, flags: {},
      codex: { orbs: {}, relics: {}, monsters: {} },
      ach: {}, asc: {}, stats: { runs: 0, wins: 0, elites: 0, bosses: 0 },
      settings: { shake: true, vol: 0.7, low: false, vibrate: true },
      daily: { date: 0, best: 0, code: '' },
    };
    if (!m) return base;
    const out = Object.assign(base, m);
    out.perma = Object.assign(base.perma, m.perma || {});
    out.codex = Object.assign({ orbs: {}, relics: {}, monsters: {} }, m.codex || {});
    out.settings = Object.assign({ shake: true, vol: 0.7, low: false, vibrate: true }, m.settings || {});
    out.stats = Object.assign({ runs: 0, wins: 0, elites: 0, bosses: 0 }, m.stats || {});
    out.chars = Object.assign({ apprentice: true }, m.chars || {});
    return out;
  };

  // ---------- 효과음: 외부 파일 없이 Web Audio로 합성 ----------
  const A = (G.AUDIO = { ctx: null, master: null, vol: 0.7 });
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = A.vol;
      const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      A.master.connect(comp); comp.connect(A.ctx.destination);
      A.noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
      const d = A.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.ctx = null; }
  };
  A.setVol = function (v) { A.vol = v; if (A.master) A.master.gain.value = v; };
  function tone(freq, dur, type, gain, when, slideTo) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain, f1, f2, type, when) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f1, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  let lastPeg = 0;
  A.sfx = {
    // 한 발 안에서 n번째 핀: 반음씩 올라간다
    peg(n) {
      if (!A.ctx) return; const now = A.ctx.currentTime; if (now - lastPeg < 0.012) return; lastPeg = now;
      const semi = Math.min(n, 30); const f = 392 * Math.pow(2, semi / 12);
      tone(f, 0.16, 'triangle', 0.16); tone(f * 2, 0.08, 'sine', 0.05);
    },
    crit() { tone(880, 0.7, 'sine', 0.22); tone(880 * 2.76, 0.5, 'sine', 0.08); tone(1320, 0.4, 'triangle', 0.08, 0.03); },
    wall() { tone(140, 0.07, 'square', 0.05); },
    refill() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.05)); },
    bomb() { noise(0.6, 0.55, 2400, 120); tone(90, 0.5, 'sine', 0.5, 0, 38); },
    coin() { tone(988, 0.08, 'square', 0.06); tone(1319, 0.22, 'square', 0.06, 0.07); },
    launch() { noise(0.22, 0.18, 400, 2400, 'bandpass'); tone(260, 0.15, 'triangle', 0.08, 0, 520); },
    hit(big) { tone(big ? 110 : 160, big ? 0.45 : 0.22, 'sine', 0.5, 0, big ? 36 : 60); noise(big ? 0.35 : 0.15, big ? 0.45 : 0.25, 1800, 200); },
    hurt() { tone(330, 0.3, 'sawtooth', 0.12, 0, 110); noise(0.15, 0.2, 900, 200); },
    basket() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.06)); },
    thorn() { tone(600, 0.12, 'sawtooth', 0.1, 0, 200); },
    tally() { tone(660, 0.05, 'square', 0.04); },
    mult() { tone(523, 0.12, 'square', 0.08); tone(784, 0.3, 'square', 0.08, 0.08); },
    death() { tone(440, 0.4, 'triangle', 0.15, 0, 110); noise(0.3, 0.15, 3000, 300, 'highpass'); },
    click() { tone(1200, 0.04, 'square', 0.04); },
    reward(r) { const s = r === 'rare' ? [523, 659, 784, 1046, 1318, 1568] : r === 'uncommon' ? [523, 659, 784, 1046] : [523, 784]; s.forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.07)); },
    heal() { [523, 784].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.08)); },
    shield() { tone(300, 0.2, 'square', 0.06, 0, 500); },
    freeze() { tone(1800, 0.3, 'sine', 0.08, 0, 2400); noise(0.25, 0.1, 6000, 3000, 'highpass'); },
    zap() { noise(0.15, 0.25, 4000, 1500, 'bandpass'); tone(1600, 0.08, 'square', 0.05, 0, 600); },
    breath() { noise(0.9, 0.35, 300, 1800, 'bandpass'); },
    victory() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.1)); },
    gameover() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, i * 0.18)); },
  };
  A.play = function (name, a) { if (!A.ctx || A.vol <= 0) return; try { A.sfx[name](a); } catch (e) {} };
  U.vibrate = function (ms) { try { if (G.meta && G.meta.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
})();
