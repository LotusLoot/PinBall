// 전투 화면 그리기
(function () {
  const C = G.CFG, F = G.FX, IMG = G.IMG, U = G.U;
  const R = (G.Render = { hit: [] });
  const FONT = (s) => `${s}px Jua, "Gowun Dodum", sans-serif`;
  const S = 3; // 핀 스프라이트 해상도 배율
  const pegCache = {};

  function pegSprite(type, lit) {
    const key = type + (lit ? '_l' : '');
    if (pegCache[key]) return pegCache[key];
    const col = G.Battle.PEG_COLORS[type] || '#7cc6ff';
    const size = 40, c = document.createElement('canvas'); c.width = c.height = size * S;
    const x = c.getContext('2d'); x.scale(S, S); const m = size / 2, r = C.pegR;
    const g = x.createRadialGradient(m, m, r * 0.6, m, m, m);
    g.addColorStop(0, hexA(col, lit ? 0.85 : 0.45)); g.addColorStop(1, hexA(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(m, m, m, 0, Math.PI * 2); x.fill();
    const cg = x.createRadialGradient(m - r * 0.35, m - r * 0.35, 1, m, m, r);
    if (lit) { cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, mix(col, '#ffffff', 0.55)); }
    else { cg.addColorStop(0, mix(col, '#ffffff', 0.55)); cg.addColorStop(1, mix(col, '#1b1530', 0.25)); }
    x.fillStyle = cg; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fill();
    x.lineWidth = 1.5; x.strokeStyle = lit ? '#ffffff' : mix(col, '#0d0a1c', 0.45); x.stroke();
    if (type === 'crit' && !lit) { star(x, m, m, r * 0.55, '#fff6d8'); }
    if (type === 'refill' && !lit) { x.strokeStyle = '#eafff4'; x.lineWidth = 1.6; x.beginPath(); x.arc(m, m, r * 0.48, 0.4, Math.PI * 1.7); x.stroke(); }
    if (type === 'bomb' && !lit) { x.fillStyle = '#2a1018'; x.beginPath(); x.arc(m, m + 0.5, r * 0.5, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#ffd27a'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(m + 2, m - 3); x.lineTo(m + 4, m - 6); x.stroke(); }
    if (type === 'gold' && !lit) { x.fillStyle = '#8a5a00'; x.font = `bold ${r}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('G', m, m + 0.5); }
    if (type === 'thorn') { x.strokeStyle = '#f0d6ff'; x.lineWidth = 1.4; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; x.beginPath(); x.moveTo(m + Math.cos(a) * r * 0.9, m + Math.sin(a) * r * 0.9); x.lineTo(m + Math.cos(a) * r * 1.5, m + Math.sin(a) * r * 1.5); x.stroke(); } }
    if (type === 'burn') { x.fillStyle = '#ffe08a'; x.beginPath(); x.moveTo(m, m - r * 0.7); x.quadraticCurveTo(m + r * 0.6, m, m, m + r * 0.55); x.quadraticCurveTo(m - r * 0.6, m, m, m - r * 0.7); x.fill(); }
    return (pegCache[key] = c);
  }
  function star(x, cx, cy, r, col) {
    x.fillStyle = col; x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  }
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function mix(a, b, t) {
    const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
    const r = Math.round(U.lerp((p >> 16) & 255, (q >> 16) & 255, t)), g = Math.round(U.lerp((p >> 8) & 255, (q >> 8) & 255, t)), bl = Math.round(U.lerp(p & 255, q & 255, t));
    return `rgb(${r},${g},${bl})`;
  }
  R.mix = mix; R.hexA = hexA;
  function rr(x, cx, cy, w, h, r) { x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); }
  R.rr = rr;
  function txt(x, s, px, py, size, col, align, stroke) {
    x.font = FONT(size); x.textAlign = align || 'left'; x.textBaseline = 'middle';
    if (stroke !== false) { x.lineJoin = 'round'; x.lineWidth = Math.max(3, size / 5); x.strokeStyle = '#140f26'; x.strokeText(s, px, py); }
    x.fillStyle = col || '#fff4dc'; x.fillText(s, px, py);
  }
  R.txt = txt;

  // 보드 바탕 (막마다 한 번 그려 둔다)
  const boardCache = {};
  function boardBg(act) {
    if (boardCache[act]) return boardCache[act];
    const a = G.ACTS[act], w = C.W, h = C.H - C.boardTop, c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const x = c.getContext('2d'); x.scale(2, 2);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a.tint[0]); g.addColorStop(1, a.tint[1]);
    x.fillStyle = g; rr(x, C.boardLeft - 8, 0, C.boardRight - C.boardLeft + 16, h + 20, 22); x.fill();
    x.globalAlpha = 0.07; x.fillStyle = '#ffffff';
    for (let yy = 18; yy < h; yy += 26) for (let xx = C.boardLeft + 10 + ((yy / 26) % 2) * 13; xx < C.boardRight; xx += 26) { x.beginPath(); x.arc(xx, yy, 1.4, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1; x.strokeStyle = 'rgba(255,214,140,0.35)'; x.lineWidth = 2; rr(x, C.boardLeft - 8, 1, C.boardRight - C.boardLeft + 16, h + 20, 22); x.stroke();
    return (boardCache[act] = c);
  }

  R.draw = function (ctx, b) {
    const run = b.run, t = b.t;
    R.hit = [];
    ctx.fillStyle = '#100c20'; ctx.fillRect(0, 0, C.W, C.H);
    const [sx, sy] = F.offset();
    ctx.save(); ctx.translate(sx, sy);
    drawStage(ctx, b, t);
    ctx.drawImage(boardBg(run.act), 0, C.boardTop, C.W, C.H - C.boardTop);
    drawBasket(ctx, b, t);
    drawPegs(ctx, b, t);
    drawAim(ctx, b, t);
    drawBalls(ctx, b);
    drawQueue(ctx, b, t);
    drawCombo(ctx, b);
    drawTally(ctx, b);
    if (b.projectile) { const p = b.projectile, k = Math.min(1, p.t / p.dur); const x = U.lerp(p.x0, p.x1, k), y = U.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * 120; ctx.drawImage(F.glow('#ffd27a'), x - 22, y - 22, 44, 44); F.sparkle(x, y, '#ffd27a'); }
    F.draw(ctx);
    ctx.restore();
    drawHud(ctx, b);
    drawBanner(ctx, b);
    F.drawFlash(ctx);
  };

  function drawStage(ctx, b, t) {
    const act = G.ACTS[b.run.act];
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, C.W, C.stageBottom + 20); ctx.clip();
    const bg = IMG.get('bg/' + act.bg);
    if (bg) { const w = C.W, h = (bg.height / bg.width) * w; ctx.drawImage(bg, 0, C.footY + 12 - h * 0.74, w, h); }
    else { ctx.fillStyle = act.tint[0]; ctx.fillRect(0, 0, C.W, C.stageBottom); }
    const g = ctx.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, 'rgba(16,12,32,0.92)'); g.addColorStop(1, 'rgba(16,12,32,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, 110);
    ctx.restore();

    // 영웅
    const h = b.hero, heroH = 112;
    const br = Math.sin(t * 2.2) * 0.022;
    const lungeX = h.lunge > 0 ? Math.sin((1 - h.lunge / 0.25) * Math.PI) * 18 : 0;
    shadow(ctx, C.heroX, C.footY, 34);
    IMG.drawFoot(ctx, 'heroes/' + b.run.char, C.heroX + lungeX, C.footY, heroH, { sx: 1 - br, sy: 1 + br });
    if (h.flash > 0) { ctx.save(); ctx.globalAlpha = 0.8; IMG.drawFoot(ctx, 'heroes/' + b.run.char, C.heroX + lungeX, C.footY, heroH, { sx: 1 - br, sy: 1 + br, white: true }); ctx.restore(); }
    let ix = C.heroX - 30;
    if (h.poison) { statusChip(ctx, ix, C.footY - heroH - 12, '#8dff6a', h.poison); ix += 30; }
    if (h.burn) { statusChip(ctx, ix, C.footY - heroH - 12, '#ff9a4a', h.burn); }

    // 적
    for (const e of b.enemies) drawEnemy(ctx, b, e, t);
  }
  function shadow(ctx, x, y, w) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y - 2, w, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  function statusChip(ctx, x, y, col, n, label) {
    ctx.save(); ctx.fillStyle = 'rgba(20,15,38,0.85)'; rr(ctx, x - 13, y - 10, 26, 20, 8); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - 5, y, 4.5, 0, Math.PI * 2); ctx.fill();
    txt(ctx, label || String(n), x + 5, y + 1, 14, '#fff4dc', 'center', false); ctx.restore();
  }

  function drawEnemy(ctx, b, e, t) {
    const m = e.m, key = IMG.monKey(e.id);
    let x = e.x + e.knock, y = C.footY, alpha = 1, rot = 0, sc = 1;
    if (e.dead) {
      const k = e.deathT / 0.7; if (k >= 1) return;
      x += k * 140; y -= Math.sin(k * Math.PI) * 120 + k * 40; rot = k * 6; alpha = 1 - k;
    }
    if (e.spawnT > 0) sc = 1 - e.spawnT / 0.35;
    const lungeX = e.lunge > 0 ? -Math.sin((1 - e.lunge / 0.3) * Math.PI) * (e.m.range > 1 ? 14 : 40) : 0;
    const br = Math.sin(t * 2 + e.uid * 10) * 0.025;
    const fy = m.fly ? y - 40 - Math.sin(t * 3 + e.uid * 5) * 6 : y;
    ctx.save(); ctx.globalAlpha = alpha;
    if (!e.dead) shadow(ctx, x, y, m.h * 0.32);
    const opt = { sx: (1 + br) * sc, sy: (1 - br) * sc, rot };
    if (e.stone) ctx.filter = 'grayscale(1) brightness(0.9)';
    IMG.drawFoot(ctx, key, x + lungeX, fy, m.h, opt);
    ctx.filter = 'none';
    if (e.flash > 0) { ctx.globalAlpha = alpha; IMG.drawFoot(ctx, key, x + lungeX, fy, m.h, Object.assign({ white: true }, opt)); }
    ctx.restore();
    if (e.frozen > 0 && !e.dead) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#9fe3ff'; ctx.beginPath(); ctx.ellipse(x, fy - m.h / 2, m.h * 0.42, m.h * 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (e.dead) return;
    // 체력바
    const top = Math.max(118, fy - m.h - 10);
    const bw = m.tier === 'boss' ? 150 : m.tier === 'elite' ? 104 : 74;
    ctx.save();
    ctx.fillStyle = 'rgba(20,15,38,0.9)'; rr(ctx, x - bw / 2 - 2, top - 7, bw + 4, 14, 6); ctx.fill();
    ctx.fillStyle = '#ff5d6c'; rr(ctx, x - bw / 2, top - 5, Math.max(0, bw * (e.hp / e.maxHp)), 10, 4); ctx.fill();
    if (e.shield > 0) { ctx.strokeStyle = '#9fb7ff'; ctx.lineWidth = 2; rr(ctx, x - bw / 2 - 3, top - 8, bw + 6, 16, 7); ctx.stroke(); }
    txt(ctx, `${e.hp}`, x, top + 1, 13, '#fff4dc', 'center');
    // 상태
    let sx = x - bw / 2 + 12; const syy = top + 18;
    if (e.burn) { statusChip(ctx, sx, syy, '#ff9a4a', e.burn); sx += 30; }
    if (e.poison) { statusChip(ctx, sx, syy, '#8dff6a', e.poison); sx += 30; }
    if (e.shield) { statusChip(ctx, sx, syy, '#9fb7ff', e.shield); sx += 30; }
    if (e.stone) { statusChip(ctx, sx + 6, syy, '#c9c3d6', 0, '석화'); }
    ctx.restore();
    // 의도
    if (b.phase === 'aim' || b.phase === 'shoot' || b.phase === 'resolve') drawIntent(ctx, e, x, top - 22, t);
    R.hit.push({ type: 'enemy', e, x: x - m.h * 0.4, y: fy - m.h, w: m.h * 0.8, h: m.h });
  }

  function drawIntent(ctx, e, x, y, t) {
    const it = e.intent; if (!it) return;
    const bob = Math.sin(t * 4 + e.uid * 7) * 2;
    let label = '', col = '#fff4dc', icon = '';
    switch (it.type) {
      case 'attack': label = String(it.dmg); col = '#ff8b7b'; icon = 'sword'; break;
      case 'charge': label = String(it.dmg); col = '#ff5d6c'; icon = 'sword'; break;
      case 'breath': label = String(it.dmg); col = '#ff7a2f'; icon = 'fire'; break;
      case 'move': label = '전진'; icon = 'move'; col = '#cfc6ff'; break;
      case 'spore': label = '독'; icon = 'drop'; col = '#8dff6a'; break;
      case 'thorn': label = '가시'; icon = 'star'; col = '#c06bff'; break;
      case 'root': label = '뿌리'; icon = 'star'; col = '#8bd16b'; break;
      case 'stone': label = '석화'; icon = 'shield'; col = '#c9c3d6'; break;
      case 'guard': label = '방어'; icon = 'shield'; col = '#9fb7ff'; break;
      case 'curse': label = '저주'; icon = 'star'; col = '#c06bff'; break;
      case 'inhale': label = '…'; icon = 'fire'; col = '#ffb347'; break;
      case 'burnpegs': label = '불'; icon = 'fire'; col = '#ff9a4a'; break;
      case 'absorb': label = '흡수'; icon = 'drop'; col = '#8dff6a'; break;
      case 'frozen': label = '빙결'; icon = 'snow'; col = '#9fe3ff'; break;
    }
    if (it.shield && it.type !== 'guard') label = label + ' +막';
    ctx.save(); ctx.translate(x, y + bob);
    ctx.font = FONT(16); const w = ctx.measureText(label).width + 30;
    ctx.fillStyle = 'rgba(20,15,38,0.9)'; rr(ctx, -w / 2, -12, w, 24, 10); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; rr(ctx, -w / 2, -12, w, 24, 10); ctx.stroke();
    drawIcon(ctx, icon, -w / 2 + 13, 0, col);
    txt(ctx, label, -w / 2 + 24, 1, 16, col, 'left', false);
    ctx.restore();
  }
  function drawIcon(ctx, icon, x, y, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (icon === 'sword') { ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(5, -5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(-1, 6); ctx.stroke(); }
    else if (icon === 'move') { ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(-3, 0); ctx.lineTo(4, 5); ctx.stroke(); }
    else if (icon === 'shield') { ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, -3); ctx.lineTo(4, 4); ctx.lineTo(0, 7); ctx.lineTo(-4, 4); ctx.lineTo(-6, -3); ctx.closePath(); ctx.fill(); }
    else if (icon === 'fire') { ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(7, 1, 0, 6); ctx.quadraticCurveTo(-7, 1, 0, -7); ctx.fill(); }
    else if (icon === 'drop') { ctx.beginPath(); ctx.arc(0, 2, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(0, -7); ctx.lineTo(3.5, 0); ctx.fill(); }
    else if (icon === 'snow') { for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); } }
    else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3 : 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  R.drawIcon = drawIcon;

  function drawBasket(ctx, b, t) {
    const bk = b.board.basket; if (bk.gone) { txt(ctx, '바구니 없음', 270, C.basketY + 14, 14, 'rgba(255,244,220,0.35)', 'center', false); return; }
    const w = b.board.basketW(), x = bk.x - w / 2, y = C.basketY;
    ctx.save();
    ctx.drawImage(F.glow('#ffc94a'), bk.x - w * 0.7, y - 30, w * 1.4, 60);
    const g = ctx.createLinearGradient(0, y, 0, y + 30); g.addColorStop(0, '#ffd56a'); g.addColorStop(1, '#b9771c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 10, y + 28); ctx.lineTo(x + 10, y + 28); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a3500'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,53,0,0.45)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + (w * i) / 5, y + 2); ctx.lineTo(x + 10 + ((w - 20) * i) / 5, y + 27); ctx.stroke(); }
    ctx.fillStyle = '#ffe9a8'; rr(ctx, x - 3, y - 4, w + 6, 7, 3); ctx.fill();
    txt(ctx, '×1.5', bk.x, y + 15, 14, '#5a3500', 'center', false);
    ctx.restore();
  }

  function drawPegs(ctx, b, t) {
    const bd = b.board;
    for (const p of bd.pegs) {
      if (p.gone) continue;
      let sc = 1;
      const age = bd.time - p.born; if (age < 0.3) sc = U.easeOutBack(Math.max(0, age / 0.3));
      if (p.pop > 0) sc *= 1 + (C.fx.popScale - 1) * (p.pop / 0.25);
      if (p.type === 'crit' && !p.lit) sc *= 1 + Math.sin(t * 6 + p.id) * 0.06;
      const spr = pegSprite(p.type, p.lit);
      const s = 40 * sc * (p.blocked ? 0.9 : 1);
      ctx.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
      if (p.blocked) { // 뿌리
        ctx.save(); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(80,52,20,0.85)'; ctx.fill();
        ctx.strokeStyle = '#8bd16b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 4); ctx.quadraticCurveTo(p.x, p.y - 8, p.x + 7, p.y + 3); ctx.stroke(); ctx.restore();
      }
      if (!p.lit && p.hp < p.maxHp) { ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (p.type === 'bomb' && !p.lit && p.bombHp < 2) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 14) * 0.4; ctx.drawImage(F.glow('#ff6b5b'), p.x - 18, p.y - 18, 36, 36); ctx.restore(); }
    }
  }

  function drawAim(ctx, b, t) {
    // 발사대
    const lx = C.launchX, ly = C.launchY;
    ctx.save();
    ctx.fillStyle = 'rgba(20,15,38,0.9)'; ctx.beginPath(); ctx.arc(lx, ly - 4, 24, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly - 4, 24, Math.PI, 0); ctx.stroke();
    if (b.phase === 'aim' && b.current) {
      const a = b.aim.angle;
      ctx.strokeStyle = 'rgba(255,244,220,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a) * 30, ly + Math.sin(a) * 30); ctx.stroke();
      const pts = b.previewPts;
      if (pts) {
        const h = pts.hit, end = h ? h.n : pts.length;
        // 첫 핀까지: 일정한 간격의 점선
        ctx.fillStyle = '#fff4dc'; ctx.globalAlpha = 0.85;
        let acc = 0;
        for (let i = 1; i < end; i++) {
          acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          if (acc >= 14) { acc = 0; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 2.4, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        if (h) {
          // 닿는 지점 고리 + 튕겨 나갈 방향 화살표
          ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 11, 0, Math.PI * 2); ctx.stroke();
          const last = pts[pts.length - 1], dx = last.x - h.x, dy = last.y - h.y, len = Math.hypot(dx, dy);
          if (len > 4) {
            const ux = dx / len, uy = dy / len, L = 26, sx = h.x + ux * 14, sy = h.y + uy * 14, ex = sx + ux * L, ey = sy + uy * L;
            ctx.globalAlpha = 0.7; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 8 - uy * 6, ey - uy * 8 + ux * 6); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 8 + uy * 6, ey - uy * 8 - ux * 6); ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      if (!G.meta.flags.aimed) {
        const k = (Math.sin(t * 3) + 1) / 2;
        ctx.fillStyle = 'rgba(16,12,32,0.8)'; rr(ctx, 120, 560, 300, 74, 18); ctx.fill();
        txt(ctx, '화면을 끌어서 조준하고', 270, 584, 20, '#fff4dc', 'center', false);
        txt(ctx, '손을 떼면 발사!', 270, 612, 22, `rgba(255,201,74,${0.6 + k * 0.4})`, 'center', false);
      }
      const sz = C.ballR * 2.6 * (b.current.id === 'giant_orb' ? 2 : 1);
      if (b.current.id === 'clone_orb') { const gh = IMG.ghostOf('orbs/clone_orb'); if (gh) { ctx.globalAlpha = 0.4; ctx.drawImage(gh, lx - sz * 0.7 - 6, ly - sz * 0.7 - 2, sz * 1.4, sz * 1.4); ctx.globalAlpha = 1; } }
      IMG.drawCenter(ctx, 'orbs/' + b.current.id, lx, ly, sz + Math.sin(t * 4) * 1.5);
      if (b.current.lv > 1) txt(ctx, '+' + (b.current.lv - 1), lx + 16, ly - 14, 13, '#ffc94a', 'center');
    }
    ctx.restore();
  }

  function drawBalls(ctx, b) {
    for (const ball of b.balls) {
      if (!ball.alive) continue;
      const sz = ball.r * 2.6;
      ctx.save();
      for (let i = 0; i < ball.trail.length; i++) { const p = ball.trail[i], k = i / ball.trail.length; ctx.globalAlpha = k * 0.35; ctx.drawImage(F.glow('#cfc6ff'), p.x - ball.r * k * 1.5, p.y - ball.r * k * 1.5, ball.r * k * 3, ball.r * k * 3); }
      ctx.globalAlpha = 1;
      if (ball.orb === 'clone_orb') { const gh = IMG.ghostOf('orbs/clone_orb'); const tp = ball.trail[Math.max(0, ball.trail.length - 5)]; if (gh && tp) { ctx.globalAlpha = 0.4; ctx.drawImage(gh, tp.x - sz * 0.7, tp.y - sz * 0.7, sz * 1.4, sz * 1.4); ctx.globalAlpha = 1; } }
      if (ball.orb === 'fire_orb') F.sparkle(ball.x, ball.y, '#ff8a3d');
      IMG.drawCenter(ctx, 'orbs/' + ball.orb, ball.x, ball.y, sz, ball.rot);
      ctx.restore();
    }
  }

  function drawQueue(ctx, b, t) {
    const q = b.queueView();
    const y = 338;
    txt(ctx, '다음', 30, y - 26, 13, 'rgba(255,244,220,0.6)', 'left', false);
    q.forEach((o, i) => {
      const x = 42 + i * 30, s = i === 0 ? 26 : 22;
      ctx.save(); ctx.fillStyle = 'rgba(20,15,38,0.7)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      IMG.drawCenter(ctx, 'orbs/' + o.id, x, y, s);
      if (b.has('infinite_pouch') && !b.pouchUsed && b.phase === 'aim') { ctx.save(); ctx.strokeStyle = 'rgba(255,201,74,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      R.hit.push({ type: 'queue', i, x: x - 15, y: y - 15, w: 30, h: 30 });
    });
    if (b.cloneNext) txt(ctx, '복제 대기', 42, y + 26, 12, '#e6e1ff', 'left', false);
    // 가방 버튼
    const bx = 486, by = 338;
    ctx.save(); ctx.fillStyle = 'rgba(20,15,38,0.8)'; rr(ctx, bx - 32, by - 16, 64, 32, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,140,0.5)'; ctx.lineWidth = 1.5; rr(ctx, bx - 32, by - 16, 64, 32, 12); ctx.stroke(); ctx.restore();
    txt(ctx, `가방 ${b.run.bag.length}`, bx, by + 1, 15, '#fff4dc', 'center', false);
    R.hit.push({ type: 'bag', x: bx - 32, y: by - 16, w: 64, h: 32 });
  }

  function drawCombo(ctx, b) {
    if (!b.shot || b.combo.n < 2) return;
    const k = Math.min(1, b.combo.t / 0.12), sc = 1 + (1 - k) * 0.4;
    ctx.save(); ctx.translate(470, 392); ctx.scale(sc, sc);
    txt(ctx, '×' + b.combo.n, 0, 0, 30, b.combo.n >= 30 ? '#ffb347' : '#fff4dc', 'center');
    ctx.restore();
    txt(ctx, `점수 ${b.shot.score}`, 470, 420, 14, 'rgba(255,244,220,0.7)', 'center', false);
  }

  function drawTally(ctx, b) {
    const T = b.tally; if (!T) return;
    const roll = C.fx.rollupTime;
    const k = Math.min(1, T.t / roll), shown = Math.round(T.score * U.easeOut(k));
    ctx.save(); ctx.fillStyle = 'rgba(16,12,32,0.72)'; rr(ctx, 120, 412, 300, T.multT != null ? 150 : 96, 18); ctx.fill(); ctx.restore();
    txt(ctx, `핀 ${T.hits}개 · 점수`, 270, 434, 15, 'rgba(255,244,220,0.7)', 'center', false);
    const showFinal = T.finalT != null;
    if (!showFinal) {
      const s = 1 + (k < 1 ? 0 : 0.1);
      ctx.save(); ctx.translate(270, 472); ctx.scale(s, s); txt(ctx, U.fmt(shown), 0, 0, 44, '#fff4dc', 'center'); ctx.restore();
    }
    if (T.multT != null) {
      const mk = Math.min(1, (T.t - T.multT) / 0.25), ms = U.easeOutBack(mk);
      const multStr = (T.mult !== 1 ? `×${+T.mult.toFixed(2)}` : '') + (T.extra !== 1 ? (T.mult !== 1 ? ' ' : '') + `×${+T.extra.toFixed(2)}` : '');
      ctx.save(); ctx.translate(270, showFinal ? 520 : 516); ctx.scale(ms, ms); txt(ctx, multStr, 0, 0, 30, '#ffb347', 'center'); ctx.restore();
      const notes = T.parts.concat(T.extras).join(' · ');
      txt(ctx, notes, 270, 546, 13, 'rgba(255,244,220,0.7)', 'center', false);
    }
    if (showFinal) {
      const fk = Math.min(1, (T.t - T.finalT) / 0.22), fs = U.easeOutBack(fk) * (1 + Math.max(0, 0.2 - fk));
      ctx.save(); ctx.translate(270, 474); ctx.scale(fs, fs); txt(ctx, U.fmt(T.final), 0, 0, 58, '#ff6b5b', 'center'); ctx.restore();
    }
  }

  function drawHud(ctx, b) {
    const run = b.run;
    // 상단 바
    const g = ctx.createLinearGradient(0, 0, 0, 46); g.addColorStop(0, 'rgba(16,12,32,0.95)'); g.addColorStop(1, 'rgba(16,12,32,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, 46);
    // 체력
    const hx = 16, hy = 11, hw = 176;
    ctx.fillStyle = '#2a2147'; rr(ctx, hx, hy, hw, 23, 10); ctx.fill();
    const k = Math.max(0, run.hp / run.maxHp);
    ctx.fillStyle = k < 0.3 ? '#ff5d6c' : '#5be3a8'; rr(ctx, hx, hy, Math.max(0, hw * k), 23, 10); ctx.fill();
    if (b.hero.hurtT > 0) { b.hero.hurtT -= 0.016; }
    txt(ctx, `${run.hp} / ${run.maxHp}`, hx + hw / 2, hy + 12, 18, '#fff4dc', 'center');
    // 골드
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(228, 22, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, U.fmt(run.gold), 243, 23, 20, '#ffd56a');
    txt(ctx, `${run.act}막 · ${Math.max(1, run.floor + 1)}층`, 476, 23, 18, 'rgba(255,244,220,0.85)', 'right', false);
    const badge = G.Online && G.Online.raceBadge();
    if (badge) { ctx.save(); ctx.font = FONT(15); const w = ctx.measureText(badge).width + 18; ctx.fillStyle = 'rgba(255,201,74,0.18)'; rr(ctx, 530 - w, 52, w, 24, 10); ctx.fill(); ctx.restore(); txt(ctx, badge, 521, 65, 15, '#ffd56a', 'right', false); }
    // 설정 버튼
    ctx.save(); ctx.fillStyle = 'rgba(255,244,220,0.12)'; rr(ctx, 494, 6, 36, 34, 10); ctx.fill();
    ctx.fillStyle = '#fff4dc'; for (let i = 0; i < 3; i++) rr(ctx, 503, 14 + i * 7, 18, 3, 1.5), ctx.fill(); ctx.restore();
    R.hit.push({ type: 'menu', x: 490, y: 4, w: 46, h: 40 });
    // 유물
    run.relics.forEach((id, i) => {
      const per = 16, x = 16 + (i % per) * 32, y = 52 + Math.floor(i / per) * 30;
      IMG.drawCenter(ctx, 'relics/' + id, x + 13, y + 13, 26);
      const fl = G.Run.relicFlash[id]; if (fl && performance.now() - fl < 400) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(F.glow('#ffd27a'), x - 6, y - 6, 38, 38); ctx.restore(); }
      R.hit.push({ type: 'relic', id, x, y, w: 28, h: 28 });
    });
  }

  function drawBanner(ctx, b) {
    const bn = b.banner; if (!bn) return;
    const k = bn.t / bn.life; const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(16,12,32,0.75)'; ctx.fillRect(0, 560, C.W, 110);
    const s = k < 0.15 ? U.easeOutBack(k / 0.15) : 1;
    ctx.translate(270, 610); ctx.scale(s, s);
    if (bn.sub) txt(ctx, bn.sub, 0, -26, 18, '#ffc94a', 'center', false);
    txt(ctx, bn.text, 0, 8, 42, '#fff4dc', 'center');
    ctx.restore();
  }
})();
