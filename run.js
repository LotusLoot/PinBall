// 한 판 진행(지도, 노드, 보상)과 판 밖 성장(정수, 해금, 도감, 업적)
(function () {
  const U = G.U;

  // ---------- 메타 ----------
  const M = (G.Meta = {});
  M.load = function () { G.meta = U.migrateMeta(U.load(U.META_KEY)); G.AUDIO.setVol(G.meta.settings.vol); };
  M.save = function () { U.store(U.META_KEY, G.meta); };
  M.seen = function (cat, id, silent) {
    const c = G.meta.codex[cat]; if (c[id]) return;
    c[id] = 1; M.save();
    if (silent) return;
    const name = cat === 'orbs' ? G.ORBS[id].name : cat === 'relics' ? G.RELICS[id].name : G.MONSTERS[id].name;
    G.UI.toast('새로 발견! ' + name, cat === 'monsters' ? 'mon' : 'item');
  };
  M.achieve = function (id) {
    if (G.meta.ach[id]) return;
    G.meta.ach[id] = Date.now(); M.save();
    const a = G.ACHIEVEMENTS.find(x => x.id === id); a && G.UI.toast('업적 달성: ' + a.name, 'ach');
  };
  M.flag = function (key) {
    if (G.meta.flags[key]) return; G.meta.flags[key] = 1;
    for (const id in G.CHARS) { const u = G.CHARS[id].unlock; if (u && u.key === key && !G.meta.chars[id]) { G.meta.chars[id] = true; G.UI.toast('새 캐릭터 해금: ' + G.CHARS[id].name, 'ach'); } }
    M.save();
  };
  M.pool = function (type, daily) {
    const all = type === 'orb' ? Object.keys(G.ORBS).filter(k => k !== 'stone') : Object.keys(G.RELICS);
    if (daily) return all;
    const start = type === 'orb' ? G.START_POOL.orbs : G.START_POOL.relics;
    return all.filter(k => start.includes(k) || G.meta.unlocked.includes(k));
  };

  // ---------- 판 ----------
  const R = (G.Run = { cur: null, battle: null, relicFlash: {} });
  R.flashRelic = id => { R.relicFlash[id] = performance.now(); };

  // mode: 'normal' 보통 판 / 'daily' 일일 도전 / 'challenge' 도전장. 일일·도전장은 공정 규칙(모든 구슬·유물, 영구 강화 없음).
  R.create = function (char, asc, mode, seedIn, extra) {
    if (mode === true) mode = 'daily'; if (!mode) mode = 'normal';
    const meta = G.meta, ch = G.CHARS[char], fair = mode !== 'normal', daily = mode === 'daily';
    const seed = seedIn != null ? seedIn >>> 0 : daily ? U.hashStr('tgy-daily-' + U.todayKey()) : (Math.random() * 4294967295) >>> 0;
    const perma = fair ? { hp: 0, gold: 0, reroll: 0 } : meta.perma;
    const maxHp = ch.hp + perma.hp * 5 - (asc >= 8 ? 10 : 0);
    const run = {
      seed, rngS: seed, char, asc: asc || 0, mode, fair, daily, dailyKey: daily ? U.todayKey() : 0,
      act: 1, floor: -1, map: null, pos: null, hp: maxHp, maxHp,
      gold: (asc >= 4 ? 0 : 40) + perma.gold * 20,
      bag: ch.bag.map(id => ({ id, lv: 1 })), relics: [], rerolls: perma.reroll ? 1 : 0,
      stats: { kills: 0, elites: 0, bosses: 0, floors: 0, maxHit: 0, maxPegs: 0, goldMax: 0 },
      flags: {}, actBattles: 0, seenEvents: [],
    };
    if (extra) Object.assign(run, extra);
    R.attachRng(run);
    R.genMap(run);
    for (const o of run.bag) M.seen('orbs', o.id, true);
    return run;
  };
  R.attachRng = function (run) {
    const rng = new U.RNG(1); rng.s = run.rngS;
    Object.defineProperty(run, 'rng', { value: rng, enumerable: false, configurable: true, writable: true });
  };
  // 노드마다 따로 뽑는 난수: 플레이 방식과 상관없이 같은 시드면 같은 지도·적·보상이 나온다
  R.stream = function (run, tag) { const rng = new U.RNG(U.hashStr(run.seed + '|' + tag)); run.rng = rng; return rng; };
  R.save = function () { const r = R.cur; if (!r) return; r.rngS = r.rng.s; U.store(U.RUN_KEY, JSON.parse(JSON.stringify(r))); };
  R.loadSaved = function () { const d = U.load(U.RUN_KEY); if (!d || !d.map || !d.bag) return null; R.attachRng(d); return d; };
  R.clearSave = function () { U.remove(U.RUN_KEY); };

  // 지도: 7층 + 보스. 3갈래 길을 위로 이어 붙인다.
  R.genMap = function (run) {
    const rng = R.stream(run, 'map' + run.act), nodes = {}, ROWS = 7, COLS = 4;
    const get = (r, c) => nodes[r + '-' + c] || (nodes[r + '-' + c] = { id: r + '-' + c, row: r, col: c, type: null, next: [] });
    const starts = rng.shuffle([0, 1, 2, 3]).slice(0, 3);
    for (const s of starts) {
      let c = s;
      for (let r = 0; r < ROWS; r++) {
        const n = get(r, c);
        if (r < ROWS - 1) {
          let nc = U.clamp(c + rng.int(-1, 1), 0, COLS - 1);
          const nx = get(r + 1, nc); if (!n.next.includes(nx.id)) n.next.push(nx.id); c = nc;
        }
      }
    }
    const w = Object.assign({}, G.MAP_WEIGHTS); if (run.asc >= 2) w.elite = 18;
    for (const id in nodes) {
      const n = nodes[id];
      if (n.row === 0) n.type = 'battle';
      else if (n.row === ROWS - 1) n.type = 'rest';
      else {
        let t; do { t = rng.weighted(w); } while ((t === 'elite' && n.row < 2) || (t === 'rest' && n.row === ROWS - 2));
        n.type = t;
      }
      if (n.row === ROWS - 1) n.next.push('boss');
    }
    nodes.boss = { id: 'boss', row: ROWS, col: 1.5, type: 'boss', next: [] };
    run.map = nodes; run.pos = null; run.floor = -1; run.actBattles = 0;
  };
  R.reachable = function (run) {
    if (!run.pos) return Object.values(run.map).filter(n => n.row === 0).map(n => n.id);
    return run.map[run.pos].next;
  };

  R.start = function (run) { if (R.cur !== run) G.Brag.reset(); R.cur = run; R.battle = null; R.save(); G.UI.map(); if (run.daily && G.Online) { G.Online.watchRace(run.dailyKey); G.Online.race(true); } };

  R.enter = function (id) {
    const run = R.cur, n = run.map[id];
    if (!R.reachable(run).includes(id)) return;
    run.pos = id; run.floor = n.row; run.stats.floors++;
    R.stream(run, run.act + '-' + id);
    G.AUDIO.play('click'); G.Online && G.Online.race();
    switch (n.type) {
      case 'battle': case 'elite': case 'boss': return R.startBattle(n.type);
      case 'shop': return G.UI.shop(R.makeShop(run));
      case 'rest': return G.UI.rest();
      case 'event': return G.UI.event(R.pickEvent(run));
      case 'treasure': return G.UI.treasure(R.rollRelic(run, { common: 60, uncommon: 30, rare: 10 }));
    }
  };
  R.startBattle = function (kind) {
    const run = R.cur, enc = G.ENCOUNTERS[run.act];
    let ids;
    if (kind === 'boss') ids = enc.boss[0];
    else if (kind === 'elite') ids = run.rng.pick(enc.elite);
    else ids = run.actBattles === 0 ? enc.first[0] : run.rng.pick(enc.normal);
    if (kind === 'battle') run.actBattles++;
    const b = new G.Battle(run, ids.slice(), kind);
    R.battle = b; G.UI.hideScreen(); b.start();
  };

  R.onBattleEnd = function (b, result) {
    const run = R.cur;
    if (!run || R.battle !== b) return; // 포기한 전투의 늦은 결과는 무시
    R.battle = null; G.FX.reset();
    if (result === 'lose') return R.end(false);
    G.Online && G.Online.race();
    const st = run.stats;
    if (b.kind === 'elite') { st.elites++; G.meta.stats.elites++; }
    if (b.kind === 'boss') { st.bosses++; G.meta.stats.bosses++; M.flag('boss' + run.act); if (run.act === 1) M.achieve('boss1'); }
    let gold = b.kind === 'boss' ? 60 : b.kind === 'elite' ? 30 : run.rng.int(10, 15);
    const notes = [];
    if (R.has('lucky_coin')) { gold += 5; notes.push('행운의 동전 +5'); }
    if (R.has('piggy_bank')) { const i = Math.floor(run.gold / 10); if (i) { gold += i; notes.push('저금통 이자 +' + i); } }
    run.gold += gold; R.checkGold(run);
    if (R.has('bandage')) { const h = Math.min(3, run.maxHp - run.hp); run.hp += h; if (h) notes.push('붕대 +' + h); }
    M.save();
    if (b.kind === 'boss' && run.act === 3) { run.gold = run.gold; return R.end(true); }
    const rew = { gold, notes, orbs: R.orbChoices(run), relics: null, boss: b.kind === 'boss' };
    if (b.kind === 'elite') rew.relic = R.rollRelic(run, { common: 65, uncommon: 30, rare: 5 });
    if (b.kind === 'boss') rew.relics = R.relicChoices(run, 3, { uncommon: 50, rare: 50 });
    G.UI.reward(rew);
  };
  R.afterReward = function () {
    const run = R.cur;
    if (run.pos === 'boss') { // 다음 막
      run.act++; const heal = Math.round(run.maxHp * 0.3); run.hp = Math.min(run.maxHp, run.hp + heal);
      R.genMap(run); R.save(); G.UI.actIntro(run.act, heal); return;
    }
    R.save(); G.UI.map();
  };

  R.has = id => R.cur && R.cur.relics.includes(id);
  R.checkGold = function (run) {
    if (run.gold >= 300 && !run.fair) M.flag('gold300');
    if (run.gold >= 500) M.achieve('rich');
  };

  // ---------- 보상 뽑기 ----------
  R.rollOrb = function (run, rar, exclude) {
    const pool = M.pool('orb', run.fair).filter(k => !(exclude || []).includes(k));
    const order = ['rare', 'uncommon', 'common'];
    let r = rar; for (let i = order.indexOf(rar); i < order.length; i++) { r = order[i]; const p = pool.filter(k => G.ORBS[k].rarity === r); if (p.length) return run.rng.pick(p); }
    return run.rng.pick(pool);
  };
  R.orbChoices = function (run) {
    const n = run.asc >= 9 ? 2 : 3, out = [];
    for (let i = 0; i < n; i++) out.push(R.rollOrb(run, run.rng.weighted({ common: 70, uncommon: 25, rare: 5 }), out));
    return out;
  };
  R.rollRelic = function (run, w, exclude) {
    const pool = M.pool('relic', run.fair).filter(k => !run.relics.includes(k) && !(exclude || []).includes(k));
    if (!pool.length) return null;
    const rar = run.rng.weighted(w), order = ['rare', 'uncommon', 'common'];
    for (let i = order.indexOf(rar); i < order.length; i++) { const p = pool.filter(k => G.RELICS[k].rarity === order[i]); if (p.length) return run.rng.pick(p); }
    return run.rng.pick(pool);
  };
  R.relicChoices = function (run, n, w) { const out = []; for (let i = 0; i < n; i++) { const r = R.rollRelic(run, w, out); if (r) out.push(r); } return out; };

  R.addOrb = function (id) { R.cur.bag.push({ id, lv: 1 }); M.seen('orbs', id); };
  R.addRelic = function (id) {
    const run = R.cur; if (!id || run.relics.includes(id)) return;
    run.relics.push(id); M.seen('relics', id); R.flashRelic(id);
    if (id === 'cursed_crown') { run.maxHp = Math.max(10, run.maxHp - 25); run.hp = Math.min(run.hp, run.maxHp); }
    if (run.relics.filter(r => G.RELICS[r].rarity === 'rare').length >= 3) M.achieve('legend3');
  };

  // ---------- 상점 ----------
  R.price = function (base) { const r = R.cur; return Math.round(base * (r.asc >= 6 ? 1.25 : 1) * (0.9 + r.rng.next() * 0.2)); };
  R.makeShop = function (run) {
    const orbs = []; for (let i = 0; i < 3; i++) { const id = R.rollOrb(run, run.rng.weighted({ common: 55, uncommon: 35, rare: 10 }), orbs.map(o => o.id)); orbs.push({ id, price: R.price(G.PRICES.orb[G.ORBS[id].rarity]), sold: false }); }
    const relics = R.relicChoices(run, 2, { common: 55, uncommon: 35, rare: 10 }).map(id => ({ id, price: R.price(G.PRICES.relic[G.RELICS[id].rarity]), sold: false }));
    return { orbs, relics, removePrice: R.price(G.PRICES.remove), removed: false };
  };

  // ---------- 이벤트 ----------
  R.EVENTS = [
    { id: 'spring', title: '수상한 샘', img: 'map/event', text: '숲 한가운데 맑은 샘이 반짝인다. 바닥에 동전이 잔뜩 깔려 있다.',
      opts: run => [
        { label: '샘물을 마신다', desc: '체력 20 회복', go: () => R.heal(20) },
        { label: '동전 30을 던진다', desc: '절반 확률로 유물을 얻는다', need: run.gold >= 30, go: () => { run.gold -= 30; if (run.rng.next() < 0.5) { const r = R.rollRelic(run, { common: 60, uncommon: 35, rare: 5 }); R.addRelic(r); return r ? `샘이 빛나더니 「${G.RELICS[r].name}」이 떠올랐다!` : '아무 일도 없었다.'; } return '동전이 가라앉았다. 아무 일도 없었다.'; } },
        { label: '지나간다', desc: '', go: () => '조용히 지나갔다.' },
      ] },
    { id: 'smith', title: '떠돌이 대장장이', img: 'heroes/dwarf_smith', text: '수레를 끄는 대장장이가 손을 흔든다. "구슬 좀 손봐 줄까?"',
      opts: run => [
        { label: '구슬 하나 무료 강화', desc: '고른 구슬의 레벨 +1', need: run.bag.some(o => o.lv < 3), pick: 'upgrade' },
        { label: '체력 10을 주고 두 개 강화', desc: '무작위 구슬 2개 레벨 +1', need: run.hp > 10 && run.bag.some(o => o.lv < 3), go: () => { run.hp -= 10; const c = run.rng.shuffle(run.bag.filter(o => o.lv < 3)).slice(0, 2); c.forEach(o => o.lv++); return c.map(o => G.ORBS[o.id].name).join(', ') + ' 강화 완료!'; } },
        { label: '지나간다', desc: '', go: () => '대장장이가 아쉬운 듯 수레를 끌고 갔다.' },
      ] },
    { id: 'casino', title: '고블린 도박장', img: 'heroes/goblin_gambler', text: '고블린이 동전을 튕기며 웃는다. "한 판 어때?"',
      opts: run => [
        { label: '골드 40을 건다', desc: '절반 확률로 80을 받는다', need: run.gold >= 40, go: () => { run.gold -= 40; if (run.rng.next() < 0.5) { run.gold += 80; R.checkGold(run); G.AUDIO.play('coin'); return '이겼다! 골드 80을 받았다.'; } return '졌다… 고블린이 낄낄 웃는다.'; } },
        { label: '가진 골드를 모두 건다', desc: '40% 확률로 3배', need: run.gold >= 10, go: () => { const g = run.gold; run.gold = 0; if (run.rng.next() < 0.4) { run.gold = g * 3; R.checkGold(run); G.AUDIO.play('reward', 'rare'); return `대박! 골드 ${g * 3}이 되었다!`; } return '전부 잃었다…'; } },
        { label: '지나간다', desc: '', go: () => '"겁쟁이!" 고블린이 소리쳤다.' },
      ] },
    { id: 'altar', title: '저주받은 제단', img: 'relics/cursed_crown', text: '보랏빛 연기가 피어오르는 제단. 무언가를 바치면 힘을 준다고 속삭인다.',
      opts: run => [
        { label: '최대 체력 12를 바친다', desc: '전설 유물을 얻는다', need: run.maxHp > 20, go: () => { run.maxHp -= 12; run.hp = Math.min(run.hp, run.maxHp); const r = R.rollRelic(run, { rare: 100 }); R.addRelic(r); return r ? `「${G.RELICS[r].name}」을 얻었다!` : '제단이 침묵했다.'; } },
        { label: '골드 60을 바친다', desc: '고급 유물을 얻는다', need: run.gold >= 60, go: () => { run.gold -= 60; const r = R.rollRelic(run, { uncommon: 100 }); R.addRelic(r); return r ? `「${G.RELICS[r].name}」을 얻었다!` : '제단이 침묵했다.'; } },
        { label: '지나간다', desc: '', go: () => '속삭임이 멀어졌다.' },
      ] },
    { id: 'chest', title: '길 잃은 구슬 상자', img: 'map/treasure', text: '길가에 낡은 상자가 놓여 있다. 안에서 무언가 달그락거린다.',
      opts: run => [
        { label: '상자를 연다', desc: '고급 구슬을 얻거나, 덫에 걸린다', go: () => { if (run.rng.next() < 0.7) { const o = R.rollOrb(run, 'uncommon'); R.addOrb(o); return `「${G.ORBS[o].name}」을 얻었다!`; } run.hp = Math.max(1, run.hp - 8); G.AUDIO.play('hurt'); return '덫이었다! 체력 8을 잃었다.'; } },
        { label: '부숴서 판다', desc: '골드 35', go: () => { run.gold += 35; R.checkGold(run); G.AUDIO.play('coin'); return '골드 35를 받았다.'; } },
        { label: '지나간다', desc: '', go: () => '상자를 그대로 두었다.' },
      ] },
  ];
  R.pickEvent = function (run) {
    let pool = R.EVENTS.filter(e => !run.seenEvents.includes(e.id)); if (!pool.length) pool = R.EVENTS;
    const e = run.rng.pick(pool); run.seenEvents.push(e.id); return e;
  };
  R.heal = function (n) { const r = R.cur; const h = Math.min(n, r.maxHp - r.hp); r.hp += h; G.AUDIO.play('heal'); return `체력 ${h} 회복`; };

  // ---------- 판 끝 ----------
  R.end = function (win) {
    const run = R.cur, st = run.stats, meta = G.meta;
    const essence = st.floors * 3 + st.kills * 2 + st.elites * 8 + st.bosses * 25 + (win ? 40 : 0);
    meta.essence += essence; meta.essenceTotal += essence; meta.stats.runs++;
    const res = { win, essence, stats: st, run, score: 0, code: '' };
    if (win) {
      meta.stats.wins++; M.achieve('clear');
      if (run.bag.length <= 3) M.achieve('lean');
      if (run.asc >= 5) M.achieve('asc5');
      if (!run.fair) meta.asc[run.char] = Math.max(meta.asc[run.char] || 0, Math.min(10, run.asc + 1));
    }
    res.score = R.score(run, win);
    if (run.daily) {
      res.code = R.shareCode(run.dailyKey, res.score, run.act, run.floor + 1, win);
      if (meta.daily.date !== run.dailyKey || res.score > meta.daily.best) meta.daily = { date: run.dailyKey, best: res.score, code: res.code };
      else meta.daily.date = run.dailyKey;
    }
    M.save(); R.clearSave(); R.cur = null; R.battle = null;
    G.UI.results(res);
    if (G.Online) G.Online.submitRun(res);
  };
  // 경쟁 점수: 일일 도전과 도전장에서 같은 공식
  R.score = function (run, win) {
    const st = run.stats;
    return st.floors * 10 + st.kills * 5 + st.elites * 30 + st.bosses * 150 + run.gold + (win ? 500 : 0);
  };
  R.shareCode = function (date, score, act, floor, win) {
    const p = [date, score, act, floor, win ? 1 : 0].join('.');
    const sum = (U.hashStr(p) % 1296).toString(36).padStart(2, '0');
    return 'TGY-' + [date.toString(36), score.toString(36), act, floor, win ? 1 : 0, sum].join('-').toUpperCase();
  };
  R.readCode = function (code) {
    try {
      const parts = code.trim().toUpperCase().replace(/^TGY-/, '').split('-');
      if (parts.length !== 6) return null;
      const date = parseInt(parts[0], 36), score = parseInt(parts[1], 36), act = +parts[2], floor = +parts[3], win = parts[4] === '1';
      const p = [date, score, act, floor, win ? 1 : 0].join('.');
      if ((U.hashStr(p) % 1296).toString(36).padStart(2, '0').toUpperCase() !== parts[5]) return null;
      return { date, score, act, floor, win };
    } catch (e) { return null; }
  };
  R.abandon = function () { if (R.cur) R.end(false); };
})();
