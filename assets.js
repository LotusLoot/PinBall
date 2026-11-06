// 이미지 로더. assets/분류/id.webp 를 읽고, 없으면 도형 자리표시자를 그린다.
(function () {
  const IMG = (G.IMG = { cache: {}, white: {}, ghost: {}, ext: '.webp', base: 'assets/' });
  const LIST = [
    'ui/logo', 'bg/forest', 'bg/cave', 'bg/castle',
    ...Object.keys(G.ORBS).map(k => 'orbs/' + k), ...Object.keys(G.RELICS).map(k => 'relics/' + k),
    ...Object.keys(G.CHARS).map(k => 'heroes/' + k),
    ...Object.keys(G.MONSTERS).map(k => (G.MONSTERS[k].tier === 'boss' ? 'bosses/' : 'monsters/') + k),
    'map/battle', 'map/elite', 'map/shop', 'map/rest', 'map/treasure', 'map/event',
  ];
  IMG.list = LIST;
  IMG.load = function (onProgress) {
    let done = 0;
    return Promise.all(LIST.map(key => new Promise(res => {
      const im = new Image();
      im.onload = () => { IMG.cache[key] = im; done++; onProgress && onProgress(done / LIST.length); res(); };
      im.onerror = () => { done++; onProgress && onProgress(done / LIST.length); res(); };
      im.src = IMG.base + key + IMG.ext;
    })));
  };
  IMG.get = k => IMG.cache[k] || null;
  IMG.monKey = id => (G.MONSTERS[id].tier === 'boss' ? 'bosses/' : 'monsters/') + id;
  IMG.src = k => (IMG.cache[k] ? IMG.cache[k].src : '');

  // 피격 시 흰 번쩍임용 실루엣
  IMG.whiteOf = function (key) {
    if (IMG.white[key]) return IMG.white[key];
    const im = IMG.cache[key]; if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    return (IMG.white[key] = c);
  };
  // 복제 구슬 잔상: 같은 이미지를 흐리게
  IMG.ghostOf = function (key) {
    if (IMG.ghost[key]) return IMG.ghost[key];
    const im = IMG.cache[key]; if (!im) return null;
    const pad = 16, c = document.createElement('canvas'); c.width = im.width + pad * 2; c.height = im.height + pad * 2;
    const x = c.getContext('2d');
    try { x.filter = 'blur(6px)'; } catch (e) {}
    x.drawImage(im, pad, pad);
    return (IMG.ghost[key] = c);
  };

  // 그림 그리기: 발 위치(cx, footY) 기준, 높이 h. flip=true 면 좌우 반전.
  IMG.drawFoot = function (ctx, key, cx, footY, h, opt) {
    opt = opt || {};
    const im = opt.white ? IMG.whiteOf(key) : IMG.cache[key];
    if (!im) {
      ctx.save(); ctx.fillStyle = opt.color || '#7a6aa8'; ctx.beginPath(); ctx.ellipse(cx, footY - h / 2, h * 0.36, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    const w = (im.width / im.height) * h;
    ctx.save(); ctx.translate(cx, footY);
    if (opt.rot) ctx.rotate(opt.rot);
    ctx.scale((opt.flip ? -1 : 1) * (opt.sx || 1), opt.sy || 1);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  };
  IMG.drawCenter = function (ctx, key, cx, cy, size, rot) {
    const im = IMG.cache[key];
    if (!im) { ctx.save(); ctx.fillStyle = '#8b7fc9'; ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    const s = size / Math.max(im.width, im.height);
    ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
    ctx.drawImage(im, (-im.width * s) / 2, (-im.height * s) / 2, im.width * s, im.height * s); ctx.restore();
  };
})();
