// 화면 UI (DOM): 타이틀, 캐릭터 선택, 지도, 보상, 상점, 휴식, 이벤트, 결과, 해금, 도감, 업적, 설정
(function () {
  const UI = (G.UI = { acts: {}, macts: {} });
  const U = G.U, IMG = G.IMG;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rar = r => G.RARITY[r];

  // ---------- 기본 ----------
  UI.init = function () {
    $('#screen').addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled || el.classList.contains('off')) return; G.AUDIO.init(); const f = UI.acts[el.dataset.act]; if (f) { G.AUDIO.play('click'); f(el.dataset, el); } });
    $('#modal').addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (el && !el.disabled && !el.classList.contains('off')) { const f = UI.macts[el.dataset.act]; if (f) { G.AUDIO.play('click'); f(el.dataset, el); } return; }
      if (e.target.id === 'modal') UI.closeModal();
    });
  };
  UI.show = function (html, cls, acts) {
    const s = $('#screen'); s.className = 'scr ' + (cls || ''); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; UI.acts = acts || {};
    UI.closeModal();
  };
  UI.hideScreen = function () { const s = $('#screen'); s.hidden = true; s.innerHTML = ''; UI.closeModal(); };
  UI.modal = function (html, acts, cls) { const m = $('#modal'); m.innerHTML = `<div class="sheet ${cls || ''}">${html}</div>`; m.hidden = false; UI.macts = acts || {}; };
  UI.closeModal = function () { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; UI.macts = {}; };
  UI.isModal = () => !$('#modal').hidden;
  UI.toast = function (text, kind) {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = text;
    $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
  };
  const img = (key, cls) => IMG.src(key) ? `<img class="${cls || ''}" src="${IMG.src(key)}" alt="" draggable="false">` : `<span class="ph ${cls || ''}"></span>`;
  UI.img = img;

  function orbCard(id, lv, extra, cls) {
    const o = G.ORBS[id], r = rar(o.rarity);
    return `<div class="card rar-${o.rarity} ${cls || ''}">${img('orbs/' + id, 'cimg')}<div class="cname">${esc(o.name)}${lv > 1 ? ` <b class="lv">+${lv - 1}</b>` : ''}</div><div class="crar" style="color:${r.color}">${r.name} 구슬 · 핀 피해 ${o.dmg + lv - 1}</div><div class="cdesc">${esc(o.desc(lv))}</div>${extra || ''}</div>`;
  }
  function relicCard(id, extra, cls) {
    const o = G.RELICS[id], r = rar(o.rarity);
    return `<div class="card rar-${o.rarity} ${cls || ''}">${img('relics/' + id, 'cimg')}<div class="cname">${esc(o.name)}</div><div class="crar" style="color:${r.color}">${r.name} 유물</div><div class="cdesc">${esc(o.desc)}</div>${extra || ''}</div>`;
  }
  UI.orbCard = orbCard; UI.relicCard = relicCard;

  function header() {
    const run = G.Run.cur; if (!run) return '';
    const k = run.hp / run.maxHp;
    return `<div class="hdr"><div class="hp"><div class="hpfill ${k < 0.3 ? 'low' : ''}" style="width:${Math.max(0, k * 100)}%"></div><span>${run.hp} / ${run.maxHp}</span></div>
      <div class="gold"><i></i>${U.fmt(run.gold)}</div><div class="where">${run.act}막 · ${G.ACTS[run.act].name}</div>
      <button class="iconbtn" data-act="menu" aria-label="메뉴"><span></span><span></span><span></span></button></div>
      <div class="relics">${run.relics.map(id => `<button class="relic" data-act="relicInfo" data-id="${id}" aria-label="${esc(G.RELICS[id].name)}">${img('relics/' + id)}</button>`).join('')}
      <button class="bagbtn" data-act="bag">가방 ${run.bag.length}</button></div>`;
  }
  const commonActs = () => ({
    menu: () => UI.settings(true),
    relicInfo: d => UI.relicInfo(d.id),
    bag: () => UI.bag('view'),
  });

  // ---------- 타이틀 ----------
  UI.title = function () {
    G.Run.battle = null;
    const saved = G.Run.loadSaved();
    const today = U.todayKey(), daily = G.meta.daily;
    const dailyNote = daily.date === today ? `오늘 기록 ${U.fmt(daily.best)}점` : '오늘의 시드로 친구와 겨루기';
    UI.show(`<div class="title">
      <div class="logo-wrap">${img('ui/logo', 'logo')}</div>
      <p class="tag">구슬을 쏘아 핀에 튕긴 만큼 몬스터를 때리는 핀볼 로그라이크</p>
      <div class="menu">
        ${saved ? `<button class="btn primary" data-act="cont">이어 하기<small>${esc(G.CHARS[saved.char].name)} · ${saved.act}막 ${saved.floor < 0 ? '시작' : saved.floor + 1 + '층'}${saved.daily ? ' · 일일 도전' : ''}</small></button>` : ''}
        <button class="btn ${saved ? '' : 'primary'}" data-act="newgame">새 게임</button>
        <button class="btn" data-act="daily">일일 도전<small>${dailyNote}</small></button>
        <button class="btn" data-act="hub">친구와 겨루기<small>${G.Online.on() ? (G.meta.nick ? esc(G.meta.nick) + '님 · 순위표, 레이스, 도전장' : '순위표, 레이스, 도전장') : G.Online.configured() ? '서버에 연결하는 중…' : '서버 연결 필요'}</small></button>
        <div class="row4">
          <button class="btn small" data-act="unlocks">해금</button>
          <button class="btn small" data-act="codex">도감</button>
          <button class="btn small" data-act="ach">업적</button>
          <button class="btn small" data-act="settings">설정</button>
        </div>
      </div>
      <div class="essence"><i></i>정수 ${U.fmt(G.meta.essence)}</div>
    </div>`, 'bg-title', {
      cont: () => { G.Run.start(saved); },
      newgame: () => {
        if (saved) UI.modal(`<h3>새 게임을 시작할까요?</h3><p class="mt">진행 중인 판(${saved.act}막 ${saved.floor < 0 ? '시작' : saved.floor + 1 + '층'})이 사라집니다.</p><div class="btnrow"><button class="btn" data-act="no">취소</button><button class="btn primary" data-act="yes">새로 시작</button></div>`, { no: UI.closeModal, yes: () => { G.Run.clearSave(); UI.charSelect(); } });
        else UI.charSelect();
      },
      daily: () => UI.daily(saved),
      unlocks: () => UI.unlocks(), codex: () => UI.codex('orbs'), ach: () => UI.achievements(), settings: () => UI.settings(false),
      hub: () => G.Online.hub('daily'),
    });
    if (G.Online.pendingChallenge && G.Online.on()) { const c = G.Online.pendingChallenge; G.Online.pendingChallenge = null; G.Online.openChallenge(c); }
  };

  // ---------- 캐릭터 선택 ----------
  let pickChar = 'apprentice', pickAsc = 0;
  UI.charSelect = function () {
    const meta = G.meta;
    if (!meta.chars[pickChar]) pickChar = 'apprentice';
    const maxAsc = meta.asc[pickChar] || 0; pickAsc = Math.min(pickAsc, maxAsc);
    const cards = Object.keys(G.CHARS).map(id => {
      const c = G.CHARS[id], open = meta.chars[id];
      return `<button class="hero ${open ? '' : 'locked'} ${pickChar === id ? 'sel' : ''}" data-act="${open ? 'pick' : 'lockedChar'}" data-id="${id}">
        ${img('heroes/' + id, 'himg')}<div class="hname">${open ? esc(c.name) : '???'}</div>
        <div class="hsub">${open ? `체력 ${c.hp}` : esc(c.unlock.text)}</div></button>`;
    }).join('');
    const c = G.CHARS[pickChar];
    const ascRow = maxAsc > 0 ? `<div class="asc"><button class="btn small" data-act="ascDown" ${pickAsc <= 0 ? 'disabled' : ''}>−</button><div><b>승천 ${pickAsc}</b><small>${pickAsc ? esc(G.ASCENSION.slice(1, pickAsc + 1).join(' · ')) : '기본 난이도'}</small></div><button class="btn small" data-act="ascUp" ${pickAsc >= maxAsc ? 'disabled' : ''}>+</button></div>` : '';
    UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>용사 고르기</h2><span></span></div>
      <div class="heroes">${cards}</div>
      <div class="detail"><div class="dname">${esc(c.name)}</div><p>${esc(c.passive)}</p>
        <div class="startbag">시작 구슬 ${c.bag.map(id => img('orbs/' + id, 'mini')).join('')}</div>${ascRow}</div>
      <button class="btn primary big" data-act="go">출발</button></div>`, 'bg-plain', {
      back: () => UI.title(), pick: d => { pickChar = d.id; UI.charSelect(); },
      lockedChar: d => UI.toast('해금 조건: ' + G.CHARS[d.id].unlock.text),
      ascUp: () => { pickAsc++; UI.charSelect(); }, ascDown: () => { pickAsc--; UI.charSelect(); },
      go: () => { const run = G.Run.create(pickChar, pickAsc, 'normal'); G.Run.start(run); },
    });
  };

  // ---------- 일일 도전 ----------
  UI.daily = function (saved) {
    const today = U.todayKey(), d = G.meta.daily, played = d.date === today;
    const ds = String(today).replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일');
    UI.modal(`<h3>일일 도전</h3><p class="mt">${ds}. 오늘은 모두 같은 지도와 보상으로 견습 용사를 플레이합니다. 해금 전 구슬과 유물도 모두 나옵니다.</p>
      ${played ? `<div class="codebox"><div>오늘 최고 <b>${U.fmt(d.best)}점</b></div>${G.Online.on() ? '' : `<code id="mycode">${esc(d.code)}</code><button class="btn small" data-act="copy">코드 복사</button>`}</div>` : ''}
      ${G.Online.on() ? (G.meta.nick ? `<p class="mt">기록은 <b>${esc(G.meta.nick)}</b> 이름으로 오늘의 순위표에 올라가고, 플레이하는 동안 친구들과 실시간 레이스를 해요.</p>` : '<p class="mt">이름을 정하면 순위표와 실시간 레이스에 참가할 수 있어요. 「친구와 겨루기」에서 정해 주세요.</p>')
        : `<label class="lbl" for="friendCode">친구 코드와 비교</label><div class="cmp"><input id="friendCode" placeholder="TGY-…" autocomplete="off"><button class="btn small" data-act="cmp">비교</button></div><div id="cmpOut" class="mt"></div>`}
      ${saved ? '<p class="warn">진행 중인 판이 있으면 새 도전을 시작할 때 사라집니다.</p>' : ''}
      <div class="btnrow"><button class="btn" data-act="close">닫기</button><button class="btn primary" data-act="go">도전하기</button></div>`, {
      close: UI.closeModal,
      copy: () => UI.copy(d.code, '#mycode'),
      cmp: () => {
        const f = G.Run.readCode($('#friendCode').value), out = $('#cmpOut');
        if (!f) { out.textContent = '코드를 읽을 수 없어요. TGY-로 시작하는 코드를 그대로 붙여 넣어 주세요.'; return; }
        const same = f.date === d.date;
        out.innerHTML = `친구: <b>${U.fmt(f.score)}점</b> (${f.act}막 ${f.floor}층${f.win ? ', 클리어' : ''})${same ? `<br>나: <b>${U.fmt(d.best)}점</b> → ${d.best > f.score ? '내가 이겼다!' : d.best === f.score ? '무승부' : '친구가 이겼다'}` : '<br>다른 날의 기록이라 비교할 수 없어요.'}`;
      },
      go: () => { G.Run.clearSave(); const run = G.Run.create('apprentice', 0, 'daily'); G.Run.start(run); },
    });
  };
  UI.copy = function (text, sel) {
    const done = () => UI.toast('복사했어요');
    const fallback = () => { const el = $(sel); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); UI.toast('코드를 선택했어요. 길게 눌러 복사하세요'); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  };

  // ---------- 지도 ----------
  UI.map = function () {
    const run = G.Run.cur; G.Run.battle = null;
    const nodes = Object.values(run.map), reach = G.Run.reachable(run);
    const px = n => ((n.col + 0.5) / 4) * 100, py = n => 93 - (n.row / 7) * 79;
    let lines = '';
    for (const n of nodes) for (const id of n.next) { const m = run.map[id]; const on = n.id === run.pos || (!run.pos && n.row === 0 && false); lines += `<line x1="${px(n)}" y1="${py(n)}" x2="${px(m)}" y2="${py(m)}" class="${n.id === run.pos ? 'on' : ''}"/>`; }
    const btns = nodes.map(n => {
      const info = G.NODE_INFO[n.type]; const can = reach.includes(n.id);
      const st = n.id === run.pos ? 'cur' : can ? 'reach' : n.row <= run.floor ? 'past' : '';
      return `<button class="node ${n.type} ${st}" style="left:${px(n)}%;top:${py(n)}%" ${can ? `data-act="go" data-id="${n.id}"` : 'tabindex="-1"'} aria-label="${info.name}">${n.type === 'boss' ? img(IMG.monKey(G.ENCOUNTERS[run.act].boss[0][0]), 'nimg boss') : img(info.icon, 'nimg')}<span>${info.name}</span></button>`;
    }).join('');
    UI.show(`${header()}<div class="maparea ${run.daily && G.Online.on() ? 'withrace' : ''}"><div class="mapttl">${run.act}막 · ${esc(G.ACTS[run.act].name)}${run.daily ? ' · 일일 도전' : run.mode === 'challenge' ? ' · 도전장' : ''}${run.asc ? ` · 승천 ${run.asc}` : ''}</div>
      <svg class="maplines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${btns}</div>
      <p class="hint">빛나는 칸을 눌러 다음으로 이동</p>${run.daily && G.Online.on() ? '<div id="raceStrip" class="race"></div>' : ''}`, 'bg-map act' + run.act, Object.assign(commonActs(), { go: d => G.Run.enter(d.id) }));
  };

  // ---------- 보상 ----------
  UI.reward = function (rew) {
    const run = G.Run.cur;
    const st = { orb: rew.orbs.length ? null : 'skip', relic: rew.relic ? 'pending' : rew.relics ? 'pending' : 'none', orbs: rew.orbs };
    const best = [...rew.orbs.map(id => G.ORBS[id].rarity), ...(rew.relic ? [G.RELICS[rew.relic].rarity] : []), ...(rew.relics || []).map(id => G.RELICS[id].rarity)];
    G.AUDIO.play('reward', best.includes('rare') ? 'rare' : best.includes('uncommon') ? 'uncommon' : 'common');
    const render = () => {
      const done = st.orb && st.relic !== 'pending';
      let relicHtml = '';
      if (rew.relic) relicHtml = `<h3>유물</h3><div class="cards one">${relicCard(rew.relic, st.relic === 'taken' ? '<div class="tag ok">받음</div>' : '<button class="btn small primary" data-act="takeRelic">받기</button>', 'pop')}</div>`;
      if (rew.relics) relicHtml = `<h3>보스 유물 고르기</h3><div class="cards">${rew.relics.map(id => relicCard(id, st.relic === id ? '<div class="tag ok">선택함</div>' : st.relic !== 'pending' ? '' : `<button class="btn small primary" data-act="pickRelic" data-id="${id}">고르기</button>`, 'pop ' + (st.relic !== 'pending' && st.relic !== id ? 'dim' : ''))).join('')}</div>`;
      const orbHtml = st.orbs.length ? `<h3>구슬 하나 고르기</h3><div class="cards">${st.orbs.map(id => orbCard(id, 1, st.orb === id ? '<div class="tag ok">가방에 넣음</div>' : st.orb ? '' : `<button class="btn small primary" data-act="pickOrb" data-id="${id}">가방에 넣기</button>`, 'pop ' + (st.orb && st.orb !== id ? 'dim' : ''))).join('')}</div>
        ${!st.orb ? `<div class="btnrow"><button class="btn small" data-act="skip">건너뛰기 (체력 5 회복)</button>${run.rerolls > 0 ? `<button class="btn small" data-act="reroll">다시 뽑기 (${run.rerolls})</button>` : ''}</div>` : ''}` : '';
      UI.show(`${header()}<div class="page reward"><h2 class="win">${rew.boss ? '보스 처치!' : '승리!'}</h2>
        <div class="goldline"><i></i>골드 +${rew.gold}${rew.notes.length ? ` <small>(${esc(rew.notes.join(', '))})</small>` : ''}</div>
        ${G.Brag.fresh ? `<div class="brag"><div><b>한 발 신기록 ${U.fmt(G.Brag.fresh.dealt)}!</b><small>친구들에게 자랑해 보세요</small></div><button class="btn small primary" data-act="brag">자랑 카드</button></div>` : ''}
        ${relicHtml}${orbHtml}
        <button class="btn primary big" data-act="next" ${done ? '' : 'disabled'}>${done ? '계속' : '보상을 골라 주세요'}</button></div>`, 'bg-plain', Object.assign(commonActs(), {
        pickOrb: d => { G.Run.addOrb(d.id); st.orb = d.id; G.AUDIO.play('reward', G.ORBS[d.id].rarity); render(); },
        skip: () => { G.Run.heal(5); st.orb = 'skip'; render(); },
        reroll: () => { run.rerolls--; st.orbs = G.Run.orbChoices(run); render(); },
        takeRelic: () => { G.Run.addRelic(rew.relic); st.relic = 'taken'; G.AUDIO.play('reward', G.RELICS[rew.relic].rarity); render(); },
        pickRelic: d => { G.Run.addRelic(d.id); st.relic = d.id; G.AUDIO.play('reward', G.RELICS[d.id].rarity); render(); },
        next: () => { G.Brag.fresh = null; G.Run.afterReward(); },
        brag: () => G.Brag.open(G.Brag.fresh),
      }));
    };
    render();
  };

  // ---------- 상점 ----------
  UI.shop = function (shop) {
    const run = G.Run.cur;
    const render = () => {
      const buy = (kind, i, it) => it.sold ? '<div class="tag ok">팔림</div>' : `<button class="btn small ${run.gold >= it.price ? 'primary' : ''}" data-act="buy" data-k="${kind}" data-i="${i}" ${run.gold >= it.price ? '' : 'disabled'}><i class="coin"></i>${it.price}</button>`;
      UI.show(`${header()}<div class="page shop"><h2>상점</h2><p class="sub">고블린 상인이 물건을 늘어놓았다.</p>
        <h3>구슬</h3><div class="cards">${shop.orbs.map((o, i) => orbCard(o.id, 1, buy('orb', i, o), o.sold ? 'dim' : '')).join('')}</div>
        <h3>유물</h3><div class="cards two">${shop.relics.map((o, i) => relicCard(o.id, buy('relic', i, o), o.sold ? 'dim' : '')).join('')}</div>
        <div class="service"><div><b>구슬 빼기</b><small>가방을 가볍게 하면 좋은 구슬이 더 자주 나온다</small></div>${shop.removed ? '<div class="tag ok">완료</div>' : `<button class="btn small" data-act="remove" ${run.gold >= shop.removePrice && run.bag.length > 1 ? '' : 'disabled'}><i class="coin"></i>${shop.removePrice}</button>`}</div>
        <button class="btn primary big" data-act="leave">나가기</button></div>`, 'bg-plain', Object.assign(commonActs(), {
        buy: d => {
          const it = d.k === 'orb' ? shop.orbs[d.i] : shop.relics[d.i]; if (it.sold || run.gold < it.price) return;
          run.gold -= it.price; it.sold = true; G.AUDIO.play('coin');
          if (d.k === 'orb') G.Run.addOrb(it.id); else G.Run.addRelic(it.id);
          render();
        },
        remove: () => UI.bag('remove', o => { run.gold -= shop.removePrice; run.bag.splice(run.bag.indexOf(o), 1); shop.removed = true; G.AUDIO.play('coin'); UI.toast(G.ORBS[o.id].name + '을(를) 뺐어요'); render(); }),
        leave: () => { G.Run.save(); UI.map(); },
      }));
    };
    render();
  };

  // ---------- 휴식 ----------
  UI.rest = function () {
    const run = G.Run.cur, pct = run.asc >= 3 ? 0.2 : 0.3, amt = Math.round(run.maxHp * pct);
    UI.show(`${header()}<div class="page rest">${img('map/rest', 'bigicon')}<h2>모닥불</h2><p class="sub">따뜻한 불 앞에서 한숨 돌린다. 하나만 할 수 있다.</p>
      <div class="choices"><button class="choice" data-act="heal"><b>쉬기</b><small>체력 ${amt} 회복 (${Math.round(pct * 100)}%)</small></button>
      <button class="choice" data-act="up" ${run.bag.some(o => o.lv < 3) ? '' : 'disabled'}><b>구슬 강화</b><small>구슬 하나의 레벨 +1 (핀 피해 +1, 효과 강화)</small></button></div></div>`, 'bg-plain', Object.assign(commonActs(), {
      heal: () => { const t = G.Run.heal(amt); UI.done('모닥불', t); },
      up: () => UI.bag('upgrade', o => { o.lv++; G.AUDIO.play('reward', 'uncommon'); UI.done('모닥불', `${G.ORBS[o.id].name}이(가) +${o.lv - 1}이 되었다!`); }),
    }));
  };
  UI.done = function (title, text) {
    UI.show(`${header()}<div class="page center"><h2>${esc(title)}</h2><p class="result">${esc(text)}</p><button class="btn primary big" data-act="next">계속</button></div>`, 'bg-plain', Object.assign(commonActs(), { next: () => { G.Run.save(); UI.map(); } }));
  };

  // ---------- 이벤트 ----------
  UI.event = function (ev) {
    const run = G.Run.cur, opts = ev.opts(run);
    UI.show(`${header()}<div class="page event">${img(ev.img, 'evimg')}<h2>${esc(ev.title)}</h2><p class="sub">${esc(ev.text)}</p>
      <div class="choices">${opts.map((o, i) => `<button class="choice" data-act="opt" data-i="${i}" ${o.need === false ? 'disabled' : ''}><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</button>`).join('')}</div></div>`, 'bg-plain', Object.assign(commonActs(), {
      opt: d => {
        const o = opts[d.i];
        if (o.pick === 'upgrade') return UI.bag('upgrade', orb => { orb.lv++; G.AUDIO.play('reward', 'uncommon'); UI.done(ev.title, `${G.ORBS[orb.id].name}이(가) +${orb.lv - 1}이 되었다!`); });
        UI.done(ev.title, o.go() || '');
      },
    }));
  };

  // ---------- 보물 ----------
  UI.treasure = function (id) {
    if (!id) return UI.done('보물', '상자는 비어 있었다.');
    const r = G.RELICS[id].rarity;
    UI.show(`${header()}<div class="page center"><div class="chest shake-${r}">${img('map/treasure', 'bigicon')}</div><h2>보물 상자</h2><p class="sub">상자가 ${r === 'rare' ? '금빛으로 크게' : r === 'uncommon' ? '푸르게' : ''} 흔들린다…</p>
      <button class="btn primary big" data-act="open">열기</button></div>`, 'bg-plain', Object.assign(commonActs(), {
      open: () => {
        G.AUDIO.play('reward', r); G.Run.addRelic(id);
        UI.show(`${header()}<div class="page center"><h2>${rar(r).name} 유물!</h2><div class="cards one">${relicCard(id, '', 'pop glow-' + r)}</div><button class="btn primary big" data-act="next">계속</button></div>`, 'bg-plain', Object.assign(commonActs(), { next: () => { G.Run.save(); UI.map(); } }));
      },
    }));
  };

  // ---------- 막 시작 ----------
  UI.actIntro = function (act, heal) {
    const a = G.ACTS[act];
    UI.show(`<div class="page center actintro">${img('bg/' + a.bg, 'actbg')}<div class="actbox"><small>${act}막</small><h1>${esc(a.name)}</h1><p>보스를 쓰러뜨리고 체력 ${heal}을 회복했다.</p><button class="btn primary big" data-act="go">출발</button></div></div>`, 'bg-plain', { go: () => UI.map() });
  };

  // ---------- 결과 ----------
  UI.results = function (res) {
    const s = res.stats, run = res.run;
    const rows = [['도달', `${run.act}막 ${Math.max(1, run.floor + 1)}층`], ['처치한 몬스터', s.kills], ['엘리트 / 보스', `${s.elites} / ${s.bosses}`], ['한 발 최대 피해', U.fmt(s.maxHit || 0)], ['한 발 최대 핀', s.maxPegs || 0], ['구슬 / 유물', `${run.bag.length} / ${run.relics.length}`]];
    UI.show(`<div class="page center results">${img('heroes/' + run.char, 'resimg ' + (res.win ? '' : 'down'))}<h1 class="${res.win ? 'win' : 'lose'}">${res.win ? '마왕을 쓰러뜨렸다!' : '용사가 쓰러졌다'}</h1>
      <table class="stats">${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table>
      ${G.Brag.best ? `<div class="brag"><div><b>이번 판 최고의 한 방 ${U.fmt(G.Brag.best.dealt)}</b><small>${esc(G.ORBS[G.Brag.best.orb].name)} · 핀 ${G.Brag.best.hits}개${G.Brag.best.record ? ' · 개인 신기록' : ''}</small></div><button class="btn small primary" data-act="brag">자랑 카드</button></div>` : ''}
      <div class="essence big"><i></i>정수 +${res.essence}<small>해금 메뉴에서 새 구슬과 유물을 열 수 있어요</small></div>
      ${run.fair ? `<div class="codebox"><div>${run.daily ? '일일 도전' : '도전장'} 점수 <b>${U.fmt(res.score)}점</b></div>${run.daily && !G.Online.on() ? `<code id="rescode">${esc(res.code)}</code><button class="btn small" data-act="copy">코드 복사</button>` : ''}</div>` : ''}
      ${G.Online.on() && G.meta.nick ? '<div id="onlineBox"><div class="onl"><small>기록을 올리는 중…</small></div></div>' : ''}
      <div class="btnrow"><button class="btn" data-act="title">타이틀로</button>${run.fair ? '' : `<button class="btn primary" data-act="again">다시 하기</button>`}</div></div>`, 'bg-plain', Object.assign({
      title: () => UI.title(), again: () => { pickChar = run.char; UI.charSelect(); }, copy: () => UI.copy(res.code, '#rescode'), brag: () => G.Brag.open(G.Brag.best),
    }, G.Online.resultActs));
  };

  // ---------- 해금 ----------
  UI.unlocks = function () {
    const meta = G.meta;
    const row = u => {
      let name, desc, icon, owned;
      if (u.type === 'orb') { name = G.ORBS[u.id].name; desc = G.ORBS[u.id].desc(1); icon = 'orbs/' + u.id; owned = meta.unlocked.includes(u.id); }
      else if (u.type === 'relic') { name = G.RELICS[u.id].name; desc = G.RELICS[u.id].desc; icon = 'relics/' + u.id; owned = meta.unlocked.includes(u.id); }
      else { name = u.name; desc = '모든 판에 적용 (일일 도전 제외)'; icon = null; owned = meta.perma[u.id] > 0; }
      const can = meta.essence >= u.cost;
      return `<div class="urow ${owned ? 'owned' : ''}">${icon ? img(icon, 'uimg') : '<span class="uimg perma"></span>'}<div class="utext"><b>${esc(name)}</b><small>${esc(desc)}</small></div>${owned ? '<div class="tag ok">해금됨</div>' : `<button class="btn small ${can ? 'primary' : ''}" data-act="buy" data-id="${u.id}" ${can ? '' : 'disabled'}><i class="ess"></i>${u.cost}</button>`}</div>`;
    };
    UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>해금</h2><div class="essence"><i></i>${U.fmt(meta.essence)}</div></div>
      <p class="sub">판이 끝나면 이기든 지든 정수를 받는다. 해금한 구슬과 유물은 보상과 상점에 나오기 시작한다.</p>
      <h3>영구 강화</h3>${G.UNLOCKS.filter(u => u.type === 'perma').map(row).join('')}
      <h3>구슬</h3>${G.UNLOCKS.filter(u => u.type === 'orb').map(row).join('')}
      <h3>유물</h3>${G.UNLOCKS.filter(u => u.type === 'relic').map(row).join('')}</div>`, 'bg-plain', {
      back: () => UI.title(),
      buy: d => {
        const u = G.UNLOCKS.find(x => x.id === d.id); if (!u || meta.essence < u.cost) return;
        meta.essence -= u.cost; if (u.type === 'perma') meta.perma[u.id] = 1; else meta.unlocked.push(u.id);
        G.Meta.save(); G.AUDIO.play('reward', 'uncommon'); UI.toast('해금했어요'); UI.unlocks();
      },
    });
  };

  // ---------- 도감 ----------
  UI.codex = function (tab) {
    const c = G.meta.codex;
    const list = tab === 'orbs' ? Object.keys(G.ORBS) : tab === 'relics' ? Object.keys(G.RELICS) : Object.keys(G.MONSTERS);
    const key = id => tab === 'orbs' ? 'orbs/' + id : tab === 'relics' ? 'relics/' + id : IMG.monKey(id);
    const name = id => (tab === 'orbs' ? G.ORBS : tab === 'relics' ? G.RELICS : G.MONSTERS)[id].name;
    const seen = list.filter(id => c[tab][id]).length;
    UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>도감</h2><span class="count">${seen} / ${list.length}</span></div>
      <div class="tabs"><button class="tab ${tab === 'orbs' ? 'on' : ''}" data-act="tab" data-t="orbs">구슬</button><button class="tab ${tab === 'relics' ? 'on' : ''}" data-act="tab" data-t="relics">유물</button><button class="tab ${tab === 'monsters' ? 'on' : ''}" data-act="tab" data-t="monsters">몬스터</button></div>
      <div class="codex">${list.map(id => `<button class="cx ${c[tab][id] ? '' : 'unseen'}" data-act="${c[tab][id] ? 'info' : 'nope'}" data-id="${id}">${img(key(id))}<span>${c[tab][id] ? esc(name(id)) : '???'}</span></button>`).join('')}</div></div>`, 'bg-plain', {
      back: () => UI.title(), tab: d => UI.codex(d.t), nope: () => UI.toast('아직 만나지 못했어요'),
      info: d => tab === 'orbs' ? UI.orbInfo({ id: d.id, lv: 1 }) : tab === 'relics' ? UI.relicInfo(d.id) : UI.monInfo(d.id),
    });
  };

  UI.achievements = function () {
    const a = G.meta.ach;
    UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>업적</h2><span class="count">${G.ACHIEVEMENTS.filter(x => a[x.id]).length} / ${G.ACHIEVEMENTS.length}</span></div>
      <div class="achs">${G.ACHIEVEMENTS.map(x => `<div class="ach ${a[x.id] ? 'done' : ''}"><span class="medal"></span><div><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></div></div>`).join('')}</div>
      <p class="sub">판 수 ${G.meta.stats.runs} · 클리어 ${G.meta.stats.wins} · 누적 정수 ${U.fmt(G.meta.essenceTotal)}</p></div>`, 'bg-plain', { back: () => UI.title() });
  };

  // ---------- 모달: 정보, 가방, 설정 ----------
  UI.relicInfo = function (id) { UI.modal(relicCard(id, '', 'solo') + '<button class="btn" data-act="x">닫기</button>', { x: UI.closeModal }, 'info'); };
  UI.orbInfo = function (o) { UI.modal(orbCard(o.id, o.lv, '', 'solo') + '<button class="btn" data-act="x">닫기</button>', { x: UI.closeModal }, 'info'); };
  UI.monInfo = function (id, e) {
    const m = G.MONSTERS[id];
    const tier = { normal: '일반', elite: '엘리트', boss: '보스' }[m.tier];
    UI.modal(`<div class="card solo mon">${img(IMG.monKey(id), 'cimg')}<div class="cname">${esc(m.name)}</div><div class="crar">${m.act}막 ${tier} · 체력 ${e ? `${e.hp} / ${e.maxHp}` : m.hp} · 공격 ${e ? e.atk : m.atk}</div><div class="cdesc">${esc(m.note || '특별한 능력 없음')}${m.range > 1 ? ` · 사거리 ${m.range}칸` : ''}</div></div><button class="btn" data-act="x">닫기</button>`, { x: UI.closeModal }, 'info');
  };
  UI.bag = function (mode, cb) {
    const run = G.Run.cur; if (!run) return;
    const b = G.Run.battle;
    const title = { view: '구슬 가방', upgrade: '강화할 구슬 고르기', remove: '뺄 구슬 고르기' }[mode];
    const items = run.bag.map((o, i) => {
      const can = mode === 'upgrade' ? o.lv < 3 : mode === 'remove' ? run.bag.length > 1 : false;
      const desc = mode === 'upgrade' && o.lv < 3 ? `→ +${o.lv}: ${G.ORBS[o.id].desc(o.lv + 1)}` : G.ORBS[o.id].desc(o.lv);
      return `<button class="bagrow ${can ? '' : 'static'}" ${can ? `data-act="pick" data-i="${i}"` : 'tabindex="-1"'} ${mode !== 'view' && !can ? 'disabled' : ''}>${img('orbs/' + o.id, 'bimg')}<div><b>${esc(G.ORBS[o.id].name)}${o.lv > 1 ? ` <span class="lv">+${o.lv - 1}</span>` : ''}</b><small>핀 피해 ${G.ORBS[o.id].dmg + o.lv - 1} · ${esc(desc)}</small></div></button>`;
    }).join('');
    const pile = b && mode === 'view' ? `<p class="sub">다음 순서: ${b.drawPile.map(o => G.ORBS[o.id].name).join(' → ') || '다 쓰면 다시 섞음'}</p>` : '';
    UI.modal(`<h3>${title}</h3>${pile}<div class="baglist">${items}</div><button class="btn" data-act="x">${mode === 'view' ? '닫기' : '취소'}</button>`, {
      x: UI.closeModal, pick: d => { const o = run.bag[d.i]; UI.closeModal(); cb && cb(o); },
    }, 'bagsheet');
  };
  UI.settings = function (inRun) {
    const s = G.meta.settings;
    const sw = (k, label) => `<button class="sw ${s[k] ? 'on' : ''}" data-act="tog" data-k="${k}" role="switch" aria-checked="${!!s[k]}"><span>${label}</span><i></i></button>`;
    const inBattle = !!G.Run.battle;
    UI.modal(`<h3>설정</h3>
      <label class="lbl" for="vol">효과음 크기</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.vol}">
      ${sw('shake', '화면 흔들림')}${sw('vibrate', '진동 (모바일)')}${sw('low', '저사양 모드 (파티클 줄이기)')}
      ${inRun && G.Run.cur ? `<div class="sep"></div>
        <button class="btn" data-act="toTitle">타이틀로 나가기</button>${inBattle ? '<p class="warn">전투 중에 나가면 이 전투는 처음부터 다시 시작합니다.</p>' : ''}
        <button class="btn danger" data-act="giveup">이번 판 포기하기</button>` : ''}
      <div class="sep"></div><p class="sub">조작: 화면을 끌어서 조준하고 손을 떼면 발사. 키보드는 ←→ 조준, 스페이스 발사.</p>
      <button class="btn primary" data-act="x">닫기</button>`, {
      x: UI.closeModal,
      tog: d => { s[d.k] = !s[d.k]; G.Meta.save(); UI.settings(inRun); },
      toTitle: () => { UI.closeModal(); G.Run.battle = null; G.Run.cur = null; UI.title(); },
      giveup: () => UI.modal(`<h3>이번 판을 포기할까요?</h3><p class="mt">지금까지의 기록으로 정수를 받고 판이 끝납니다.</p><div class="btnrow"><button class="btn" data-act="no">취소</button><button class="btn danger" data-act="yes">포기하기</button></div>`, { no: () => UI.settings(inRun), yes: () => { UI.closeModal(); G.Run.abandon(); } }),
    });
    const v = $('#vol'); v && v.addEventListener('input', () => { s.vol = +v.value; G.AUDIO.setVol(s.vol); }); v && v.addEventListener('change', () => { G.Meta.save(); G.AUDIO.init(); G.AUDIO.play('peg', 4); });
  };
})();
