// 한 방 자랑 카드: 큰 피해가 나온 순간의 보드를 찍어 공유용 이미지(1080×1350)로 만든다
(function () {
  const U = G.U, IMG = G.IMG, C = G.CFG;
  const B = (G.Brag = { best: null, fresh: null });
  const FONT = s => `${s}px Jua, "Gowun Dodum", sans-serif`;

  // 발이 끝난 순간(맞은 핀이 아직 켜져 있을 때) 보드 부분만 복사해 둔다
  B.capture = function () {
    const cv = G.canvas; if (!cv || !cv.width) return null;
    const k = cv.width / C.W, sy = C.boardTop * k, h = (C.H - C.boardTop) * k;
    const c = document.createElement('canvas'); c.width = 540; c.height = 660;
    try { c.getContext('2d').drawImage(cv, 0, sy, cv.width, h, 0, 0, 540, 660); } catch (e) { return null; }
    return c;
  };
  // 이번 판 최고의 한 방이면 보관, 전체 기록이면 신기록 표시
  B.consider = function (info) {
    if (!info || info.dealt < 30) return;
    if (!B.best || info.dealt > B.best.dealt) B.best = info;
    const m = G.meta;
    if (info.dealt > (m.bestHit || 0)) { info.record = true; m.bestHit = info.dealt; G.Meta.save(); B.fresh = info; }
  };
  B.reset = function () { B.best = null; B.fresh = null; };

  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function text(x, s, px, py, size, col, align) { x.font = FONT(size); x.textAlign = align || 'left'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.lineWidth = Math.max(4, size / 7); x.strokeStyle = '#120d26'; x.strokeText(s, px, py); x.fillStyle = col; x.fillText(s, px, py); }
  function draw(x, key, cx, cy, size) { const im = IMG.get(key); if (!im) return; const s = size / Math.max(im.width, im.height); x.drawImage(im, cx - (im.width * s) / 2, cy - (im.height * s) / 2, im.width * s, im.height * s); }

  B.render = function (info) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b2156'); g.addColorStop(0.55, '#1d1638'); g.addColorStop(1, '#100c20'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.06; x.fillStyle = '#fff'; for (let yy = 30; yy < H; yy += 44) for (let xx = 22 + ((yy / 44) % 2) * 22; xx < W; xx += 44) { x.beginPath(); x.arc(xx, yy, 3, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1;
    // 로고
    const logo = IMG.get('ui/logo'); if (logo) { const w = 560, h = (logo.height / logo.width) * w; x.drawImage(logo, (W - w) / 2, 26, w, h); }
    // 보드 사진
    const bx = 60, by = 300, bw = 470, bh = 574;
    x.save(); rr(x, bx, by, bw, bh, 28); x.clip();
    if (info.snap) x.drawImage(info.snap, bx, by, bw, bh); else { x.fillStyle = '#1d2b2a'; x.fillRect(bx, by, bw, bh); }
    x.restore();
    x.strokeStyle = 'rgba(255,214,140,0.55)'; x.lineWidth = 4; rr(x, bx, by, bw, bh, 28); x.stroke();
    // 오른쪽: 숫자와 내역
    const rx = 570;
    text(x, '한 발 피해', rx, 360, 40, '#ffc94a');
    const big = U.fmt(info.dealt), bs = big.length > 5 ? 128 : 156;
    text(x, big, rx - 4, 360 + bs, bs, '#ff6b5b');
    let y = 360 + bs + 70;
    const line = (label, val) => { text(x, label, rx, y, 34, 'rgba(255,244,220,0.7)'); text(x, val, W - 60, y, 38, '#fff4dc', 'right'); y += 58; };
    line('맞힌 핀', info.hits + '개');
    line('크리 핀', info.crits + '개');
    const mul = info.mult * info.extra;
    if (mul > 1) line('배율', '×' + (+mul.toFixed(2)));
    if (info.basket) line('바구니', '×1.5');
    // 구슬
    y += 6; x.fillStyle = 'rgba(255,255,255,0.06)'; rr(x, rx, y, W - 60 - rx, 110, 22); x.fill();
    draw(x, 'orbs/' + info.orb, rx + 60, y + 55, 80);
    text(x, G.ORBS[info.orb].name + (info.lv > 1 ? ' +' + (info.lv - 1) : ''), rx + 118, y + 68, 38, '#fff4dc');
    // 맞은 적
    if (info.enemy) { draw(x, IMG.monKey(info.enemy), W - 150, 820, 150); }
    // 아래: 영웅과 이름
    x.fillStyle = 'rgba(16,12,32,0.7)'; rr(x, 60, 920, W - 120, 300, 32); x.fill();
    draw(x, 'heroes/' + info.char, 190, 1070, 260);
    text(x, info.name || G.CHARS[info.char].name, 330, 1040, 64, '#fff4dc');
    text(x, `${G.CHARS[info.char].name} · ${info.act}막 ${info.floor}층${info.mode === 'daily' ? ' · 일일 도전' : info.mode === 'challenge' ? ' · 도전장' : ''}`, 330, 1100, 34, 'rgba(255,244,220,0.7)');
    if (info.record) text(x, '개인 신기록!', 330, 1160, 40, '#ffc94a');
    text(x, new Date().toLocaleDateString('ko-KR'), W - 100, 1180, 30, 'rgba(255,244,220,0.5)', 'right');
    const site = /^https?:/.test(location.protocol) && !/claude|localhost/.test(location.host) ? location.host + location.pathname.replace(/index\.html$/, '') : '';
    text(x, site ? site : '튕겨라, 용사', W / 2, 1300, 32, 'rgba(255,244,220,0.55)', 'center');
    return c;
  };

  // 카드 보기 + 공유/저장
  B.open = function (info) {
    if (!info) return;
    info = Object.assign({ name: G.meta.nick || '' }, info);
    const card = B.render(info), url = card.toDataURL('image/png');
    const name = `튕겨라용사_한방_${info.dealt}.png`;
    G.UI.modal(`<h3>한 방 자랑 카드</h3><img class="bragimg" src="${url}" alt="한 발 피해 ${info.dealt} 자랑 카드">
      <p class="sub">이미지를 길게 누르거나 오른쪽 클릭해서 저장할 수도 있어요.</p>
      <div class="btnrow"><button class="btn" data-act="x">닫기</button><button class="btn" data-act="save">저장하기</button><button class="btn primary" data-act="share">공유하기</button></div>`, {
      x: G.UI.closeModal,
      save: async () => {
        // Claude 페이지 안에서는 페이지의 다운로드 권한으로, 그 밖(GitHub Pages 등)에서는 일반 다운로드로 저장
        const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
        if (dl) {
          const blob = await new Promise(r => card.toBlob(r, 'image/png'));
          try { await dl.save({ filename: name, data: blob }); G.UI.toast('저장했어요'); }
          catch (e) { if (e && e.code !== 'declined') G.UI.toast('저장하지 못했어요. 이미지를 길게 눌러 저장해 주세요'); }
          return;
        }
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      },
      share: () => card.toBlob(async blob => {
        try {
          const file = new File([blob], name, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '튕겨라, 용사', text: `한 발에 ${U.fmt(info.dealt)} 피해!` }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        G.UI.toast('이 브라우저는 바로 공유를 지원하지 않아요. 저장한 뒤 보내 주세요');
      }, 'image/png'),
    }, 'bragsheet');
  };
})();
