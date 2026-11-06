// 시작, 게임 루프, 입력, 화면 크기
(function () {
  const C = G.CFG, F = G.FX, U = G.U;
  const canvas = document.getElementById('cv'), ctx = canvas.getContext('2d');
  G.canvas = canvas;
  const game = document.getElementById('game');
  let scale = 1, dpr = 1, last = performance.now();

  function resize() {
    const r = game.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    scale = r.width / C.W;
    game.style.setProperty('--u', (r.width / C.W).toFixed(4) + 'px');
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(game);

  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000) * (G.speed || 1); last = now;
    const b = G.Run.battle;
    if (b) {
      let pdt = dt;
      if (F.freezeT > 0) { F.freezeT -= dt; pdt = 0; }
      else if (F.slowT > 0) { F.slowT -= dt; pdt = dt * F.slowK; }
      F.update(dt);
      b.update(pdt);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      G.Render.draw(ctx, b);
      canvas.hidden = false;
    } else canvas.hidden = true;
    requestAnimationFrame(frame);
  }

  // ---------- 입력 ----------
  let aiming = false;
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * C.W, y: ((e.clientY - r.top) / r.height) * C.H }; }
  function setAim(p) {
    const b = G.Run.battle; if (!b || !b.current) return;
    let a = Math.atan2(p.y - C.launchY, p.x - C.launchX);
    if (a < -Math.PI / 2) a = Math.PI + 0.25; else if (a < -0.25) a = -0.25; else if (a > Math.PI + 0.25) a = Math.PI + 0.25;
    if (Math.abs(a - b.aim.angle) > 0.002 || !b.previewPts) { b.aim.angle = a; b.previewPts = b.board.preview(a, b.current.id, b.current.lv); }
  }
  function hitTest(p) { const hs = G.Render.hit; for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; } return null; }
  canvas.addEventListener('pointerdown', e => {
    G.AUDIO.init();
    const b = G.Run.battle; if (!b || G.UI.isModal()) return;
    const p = toLogical(e), h = hitTest(p);
    if (h) {
      if (h.type === 'menu') return G.UI.settings(true);
      if (h.type === 'relic') return G.UI.relicInfo(h.id);
      if (h.type === 'bag') return G.UI.bag('view');
      if (h.type === 'enemy') return G.UI.monInfo(h.e.id, h.e);
      if (h.type === 'queue') { if (!b.swapQueue(h.i)) G.UI.orbInfo(b.queueView()[h.i]); return; }
    }
    if (b.phase !== 'aim') return;
    aiming = true; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); setAim(p);
  });
  canvas.addEventListener('pointermove', e => {
    const b = G.Run.battle; if (!b || b.phase !== 'aim' || G.UI.isModal()) return;
    if (aiming || e.pointerType === 'mouse') setAim(toLogical(e));
  });
  canvas.addEventListener('pointerup', e => {
    const b = G.Run.battle; if (!aiming) return; aiming = false;
    if (!b || b.phase !== 'aim') return;
    setAim(toLogical(e)); b.fire(b.aim.angle);
  });
  canvas.addEventListener('pointercancel', () => { aiming = false; });
  window.addEventListener('keydown', e => {
    const b = G.Run.battle; if (!b || G.UI.isModal() || b.phase !== 'aim') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      b.aim.angle = U.clamp(b.aim.angle + (e.key === 'ArrowLeft' ? 0.03 : -0.03), -0.25, Math.PI + 0.25);
      b.previewPts = b.board.preview(b.aim.angle, b.current.id, b.current.lv);
    } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); G.AUDIO.init(); b.fire(b.aim.angle); }
  });

  // ---------- 시작 ----------
  async function boot() {
    resize();
    G.Meta.load();
    G.UI.init();
    const bar = document.getElementById('loadbar');
    await G.IMG.load(k => { if (bar) bar.style.width = Math.round(k * 100) + '%'; });
    try { await document.fonts.load('20px Jua'); } catch (e) {}
    if (G.IMG.src('bg/forest')) game.style.setProperty('--title-bg', `url("${G.IMG.src('bg/forest')}")`);
    document.getElementById('loading').hidden = true;
    G.UI.title();
    G.Online.init();
    requestAnimationFrame(frame);
  }
  G.debug = { get battle() { return G.Run.battle; }, C };
  boot();
})();
