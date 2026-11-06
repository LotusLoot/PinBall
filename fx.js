// 손맛 연출: 파티클, 떠오르는 숫자, 화면 흔들림, 히트스톱, 슬로모션
(function () {
  const U = G.U;
  const F = (G.FX = { parts: [], texts: [], rings: [], zaps: [], coins: [], shakeA: 0, freezeT: 0, slowT: 0, slowK: 0.25, flashT: 0, flashC: '#fff' });
  const glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (glowCache[color] = c);
  }
  F.glow = glow;
  F.cap = () => (G.meta && G.meta.settings.low ? G.CFG.fx.particlesCapLow : G.CFG.fx.particlesCap);
  F.reset = function () { F.parts = []; F.texts = []; F.rings = []; F.zaps = []; F.coins = []; F.shakeA = 0; F.freezeT = 0; F.slowT = 0; F.flashT = 0; };

  F.burst = function (x, y, color, n, speed, size) {
    if (G.meta && G.meta.settings.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n && F.parts.length < F.cap(); i++) {
      const a = Math.random() * Math.PI * 2, s = (speed || 160) * (0.4 + Math.random() * 0.8);
      F.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.35 + Math.random() * 0.35, t: 0, size: (size || 10) * (0.6 + Math.random() * 0.6), color, g: 380 });
    }
  };
  F.sparkle = function (x, y, color) { F.parts.length < F.cap() && F.parts.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0.5, t: 0, size: 7, color, g: 0 }); };
  F.text = function (x, y, str, o) {
    o = o || {};
    F.texts.push({ x, y, str: String(str), color: o.color || '#fff4dc', size: o.size || 26, vy: o.vy == null ? -60 : o.vy, life: o.life || 0.9, t: 0, stroke: o.stroke || '#1b1530', pop: o.pop !== false, drift: o.drift || 0 });
  };
  F.ring = function (x, y, color, maxR, life) { F.rings.push({ x, y, color, maxR: maxR || 60, life: life || 0.4, t: 0 }); };
  F.zap = function (x1, y1, x2, y2, color) {
    const pts = [], n = 7;
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push({ x: U.lerp(x1, x2, k) + (i && i < n ? (Math.random() - 0.5) * 18 : 0), y: U.lerp(y1, y2, k) + (i && i < n ? (Math.random() - 0.5) * 18 : 0) }); }
    F.zaps.push({ pts, life: 0.25, t: 0, color: color || '#9fe3ff' });
  };
  F.coin = function (x, y, n, onArrive) {
    for (let i = 0; i < Math.min(n, 12); i++) F.coins.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20, t: -i * 0.05, life: 0.6, sx: x, sy: y, cb: i === 0 ? onArrive : null, ox: (Math.random() - 0.5) * 120, oy: -60 - Math.random() * 80 });
  };
  F.hitstop = t => { F.freezeT = Math.max(F.freezeT, t); };
  F.shake = a => { if (G.meta && !G.meta.settings.shake) return; F.shakeA = Math.max(F.shakeA, a); };
  F.slowmo = (t, k) => { F.slowT = Math.max(F.slowT, t); F.slowK = k || 0.25; };
  F.flash = (t, c) => { F.flashT = t; F.flashT0 = t; F.flashC = c || '#fff'; };

  F.update = function (dt) {
    for (const p of F.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
    F.parts = F.parts.filter(p => p.t < p.life);
    for (const t of F.texts) { t.t += dt; t.y += t.vy * dt; t.x += t.drift * dt; t.vy *= 0.94; }
    F.texts = F.texts.filter(t => t.t < t.life);
    for (const r of F.rings) r.t += dt; F.rings = F.rings.filter(r => r.t < r.life);
    for (const z of F.zaps) z.t += dt; F.zaps = F.zaps.filter(z => z.t < z.life);
    const gx = 228, gy = 22;
    for (const c of F.coins) {
      c.t += dt; if (c.t < 0) continue;
      const k = Math.min(1, c.t / c.life), e = k * k;
      c.x = U.lerp(c.sx + c.ox * Math.sin(k * Math.PI), gx, e); c.y = U.lerp(c.sy + c.oy * Math.sin(k * Math.PI), gy, e);
      if (k >= 1 && !c.done) { c.done = true; G.AUDIO.play('coin'); c.cb && c.cb(); }
    }
    F.coins = F.coins.filter(c => !c.done);
    F.shakeA *= Math.pow(0.0009, dt); if (F.shakeA < 0.3) F.shakeA = 0;
    if (F.flashT > 0) F.flashT -= dt;
  };
  F.offset = function () { if (!F.shakeA) return [0, 0]; return [(Math.random() - 0.5) * 2 * F.shakeA, (Math.random() - 0.5) * 2 * F.shakeA]; };

  F.draw = function (ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of F.parts) { const k = 1 - p.t / p.life; const s = p.size * (0.5 + k); ctx.globalAlpha = Math.min(1, k * 1.4); ctx.drawImage(glow(p.color), p.x - s, p.y - s, s * 2, s * 2); }
    for (const r of F.rings) { const k = r.t / r.life; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * U.easeOut(k), 0, Math.PI * 2); ctx.stroke(); }
    for (const z of F.zaps) { ctx.globalAlpha = 1 - z.t / z.life; ctx.strokeStyle = z.color; ctx.lineWidth = 3; ctx.beginPath(); z.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.restore();
    for (const c of F.coins) { if (c.t < 0) continue; ctx.fillStyle = '#ffc94a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of F.texts) {
      const k = t.t / t.life; const sc = t.pop ? (k < 0.15 ? U.easeOutBack(k / 0.15) * 1.0 : 1) : 1;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${Math.round(t.size * sc)}px Jua, "Gowun Dodum", sans-serif`;
      ctx.lineWidth = Math.max(3, t.size / 5); ctx.strokeStyle = t.stroke; ctx.strokeText(t.str, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  };
  F.drawFlash = function (ctx) {
    if (F.flashT > 0) { ctx.save(); ctx.globalAlpha = Math.max(0, F.flashT / F.flashT0) * 0.35; ctx.fillStyle = F.flashC; ctx.fillRect(0, 0, G.CFG.W, G.CFG.H); ctx.restore(); }
  };
})();
