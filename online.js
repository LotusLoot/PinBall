// 친구와 겨루기: Firebase(익명 로그인 + Firestore)
// 일일 도전 순위표, 명예의 전당, 실시간 레이스, 도전장
(function () {
  const U = G.U;
  const O = (G.Online = { state: 'off', uid: null, db: null, raceList: [], raceKey: 0, unsubRace: null, lastRaceWrite: 0 });
  const SDK = () => window.FIREBASE_SDK_BASE || 'https://www.gstatic.com/firebasejs/10.12.2/';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = s => document.querySelector(s);
  const now = () => Date.now();
  const ymd = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const fromKey = k => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  // 시즌은 월요일 0시에 시작해서 일주일. 키는 그 주 월요일 날짜.
  O.weekOf = key => { const d = fromKey(key); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
  O.weekKey = off => { const d = fromKey(O.weekOf(U.todayKey())); d.setDate(d.getDate() + 7 * (off || 0)); return ymd(d); };
  O.weekDays = wk => { const d = fromKey(wk); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return ymd(x); }); };
  O.weekEnd = () => { const d = fromKey(O.weekKey(1)); return d.getTime(); };
  O.prevDay = key => { const d = fromKey(key); d.setDate(d.getDate() - 1); return ymd(d); };
  // 이름 옆 표시: 지난주 1위 왕관, 연속 참가 불꽃
  const CROWN = '<svg class="ic crown" viewBox="0 0 24 18" role="img" aria-label="지난주 1위"><path d="M2 16h20l-2-11-5 5-3-8-3 8-5-5z" fill="#ffc94a" stroke="#8a5a00" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const FLAME = '<svg class="ic flame" viewBox="0 0 16 20" aria-hidden="true"><path d="M8 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8z" fill="#ff8a3d"/></svg>';
  O.CROWN = CROWN;
  const GICON = '<svg class="gico" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  O.badges = (uid, streak) => (O.champ && O.champ.uid === uid ? CROWN : '') + (streak >= 2 ? `<span class="streak" title="${streak}일 연속 일일 도전">${FLAME}${streak}</span>` : '');

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
  O.configured = () => !!(window.FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
  O.on = () => O.state === 'on';
  O.name = () => (G.meta && G.meta.nick) || '';

  O.init = async function () {
    if (!O.configured()) { O.state = 'off'; return; }
    O.state = 'connecting';
    try {
      if (!window.firebase) {
        await loadScript(SDK() + 'firebase-app-compat.js');
        await Promise.all([loadScript(SDK() + 'firebase-auth-compat.js'), loadScript(SDK() + 'firebase-firestore-compat.js')]);
      }
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      O.auth = firebase.auth(); O.db = firebase.firestore();
      const emu = window.FIREBASE_EMULATOR;
      if (emu) { O.db.useEmulator(emu.host, emu.firestore); O.auth.useEmulator(`http://${emu.host}:${emu.auth}`); }
      // 저장된 로그인(구글 포함)이 복원될 때까지 기다린 뒤, 없으면 익명으로 시작
      const saved = await new Promise(r => { const un = O.auth.onAuthStateChanged(u => { un(); r(u); }); });
      O.setUser(saved || (await O.auth.signInAnonymously()).user); O.state = 'on';
      O.afterReady();
    } catch (e) {
      O.state = 'error'; O.err = e && e.message; console.warn('online', e);
    }
  };
  O.afterReady = function () {
    const p = new URLSearchParams(location.search), cid = p.get('c');
    if (cid && /^[A-Za-z0-9]{6,40}$/.test(cid)) {
      O.pendingChallenge = cid; // 타이틀 화면이 열리면 띄운다
      history.replaceState(null, '', location.pathname);
    }
    O.loadChamp(); O.loadMe();
    const r = G.Run.cur || G.Run.loadSaved();
    if (r && r.daily) O.watchRace(r.dailyKey);
    if ($('.title')) G.UI.title();
  };

  O.setUser = u => { O.uid = u.uid; O.gmail = u.isAnonymous ? '' : (u.email || 'Google'); };
  O.linked = () => !!O.gmail;

  // ---------- 구글 계정 연결 ----------
  // 익명 계정에 구글을 붙이면 uid가 그대로라 기록이 이어진다.
  // 그 구글 계정을 다른 기기에서 이미 썼다면, 그쪽 기록으로 바꿔 탄다.
  const INAPP = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i;
  O.linkGoogle = async function (after) {
    if (!O.on()) return G.UI.toast('서버에 연결된 뒤 다시 눌러 주세요');
    if (INAPP.test(navigator.userAgent)) {
      return G.UI.modal(`<h3>이 앱 안에서는 구글 로그인이 안 돼요</h3><p class="mt">카카오톡 같은 앱 안의 브라우저는 구글이 로그인을 막아요. 오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>(크롬·사파리)를 누른 뒤 다시 해 주세요.</p><div class="btnrow"><button class="btn primary" data-act="x">알겠어요</button></div>`, { x: G.UI.closeModal });
    }
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    const before = O.uid;
    try {
      let cred;
      try { cred = await O.auth.currentUser.linkWithPopup(p); }
      catch (e) {
        if ((e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') && e.credential) cred = await O.auth.signInWithCredential(e.credential);
        else throw e;
      }
      O.setUser(cred.user);
      if (O.uid !== before) {
        const d = await O.db.collection('players').doc(O.uid).get();
        if (d.exists && d.data().name) { G.meta.nick = d.data().name; G.Meta.save(); }
        else if (O.name()) await O.saveName(O.name());
        O.streak = 0; await O.loadMe();
        G.UI.toast(d.exists ? `${O.name()}님의 기록을 불러왔어요` : '구글 계정으로 로그인했어요');
      } else G.UI.toast('구글 계정을 연결했어요. 이제 폰·PC 어디서든 같은 기록이에요');
      after && after();
    } catch (e) {
      const c = e && e.code;
      if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' || c === 'auth/user-cancelled') return;
      console.warn('google', e);
      G.UI.toast(c === 'auth/popup-blocked' ? '팝업이 막혔어요. 브라우저에서 팝업을 허용해 주세요'
        : c === 'auth/unauthorized-domain' ? 'Firebase 승인된 도메인에 이 주소가 없어요'
        : c === 'auth/operation-not-allowed' ? 'Firebase에서 Google 로그인이 꺼져 있어요'
        : c === 'auth/network-request-failed' ? '인터넷 연결을 확인해 주세요'
        : '구글 로그인을 하지 못했어요 (' + (c || '알 수 없음') + ')');
    }
  };
  O.saveName = async function (v) {
    const ref = O.db.collection('players').doc(O.uid), cur = await ref.get();
    await ref.set(Object.assign(O.playerBase(), cur.exists ? cur.data() : {}, { name: v, at: now() })); // 기존 기록은 그대로 두고 이름만 바꾼다
  };

  // ---------- 닉네임 ----------
  O.askName = function (next) {
    G.UI.modal(`<h3>친구들에게 보일 이름</h3><p class="mt">순위표와 레이스에 이 이름이 나옵니다. 1~12글자.</p>
      <input id="nick" class="field" maxlength="12" value="${esc(O.name())}" autocomplete="off" placeholder="예: 민수">
      <p id="nickErr" class="warn" hidden></p>
      <div class="btnrow"><button class="btn" data-act="no">취소</button><button class="btn primary" data-act="ok">저장</button></div>
      ${O.linked() ? '' : `<button class="gbtn" data-act="google">${GICON}<span>${O.name() ? '구글 계정 연결하기' : '다른 기기에서 하던 기록 불러오기'}<small>구글로 로그인하면 폰·PC 어디서든 같은 기록</small></span></button>`}`, {
      no: G.UI.closeModal,
      google: () => { G.UI.closeModal(); O.linkGoogle(() => (O.name() ? next && next() : O.askName(next))); },
      ok: async () => {
        const v = $('#nick').value.trim().replace(/\s+/g, ' ');
        if (!v || v.length > 12) { const e = $('#nickErr'); e.textContent = '1~12글자로 적어 주세요.'; e.hidden = false; return; }
        G.meta.nick = v; G.Meta.save();
        try { await O.saveName(v); } catch (e) { console.warn(e); }
        G.UI.closeModal(); next && next();
      },
    });
    setTimeout(() => { const i = $('#nick'); i && i.focus(); }, 50);
  };
  O.playerBase = () => ({ bestHit: 0, bestKills: 0, bestAsc: 0, bestScore: 0, wins: 0, runs: 0, streak: 0, lastDaily: 0 });
  // 지난주 1위
  O.loadChamp = async function () {
    try {
      const s = await O.db.collection('weekly').doc(String(O.weekKey(-1))).collection('scores').orderBy('total', 'desc').limit(1).get();
      const d = s.docs[0]; O.champ = d ? { uid: d.id, name: d.data().name, total: d.data().total } : null;
    } catch (e) { console.warn(e); }
  };
  // 내 연속 참가 (어제나 오늘 했으면 이어지는 중)
  O.loadMe = async function () {
    try {
      const d = await O.db.collection('players').doc(O.uid).get();
      if (d.exists) { const x = d.data(), t = U.todayKey(); O.streak = x.lastDaily === t || x.lastDaily === O.prevDay(t) ? x.streak || 0 : 0; }
    } catch (e) { console.warn(e); }
  };
  O.need = function (fn) {
    if (!O.on()) return G.UI.toast(O.state === 'connecting' ? '서버에 연결하는 중이에요' : '온라인 기능을 쓸 수 없어요');
    if (!O.name()) return O.askName(fn);
    fn();
  };

  // ---------- 판 끝: 기록 올리기 ----------
  O.submitRun = async function (res) {
    if (!O.on() || !O.name()) return;
    const run = res.run, st = res.stats, me = O.uid, name = O.name(), db = O.db;
    const box = () => $('#onlineBox');
    try {
      // 명예의 전당
      const pref = db.collection('players').doc(me);
      await db.runTransaction(async tx => {
        const d = (await tx.get(pref)).data() || {};
        const b = Object.assign(O.playerBase(), d);
        let streak = b.streak, lastDaily = b.lastDaily;
        if (run.daily && lastDaily !== run.dailyKey) { streak = lastDaily === O.prevDay(run.dailyKey) ? streak + 1 : 1; lastDaily = run.dailyKey; }
        O.streak = streak;
        tx.set(pref, {
          streak, lastDaily,
          name, at: now(),
          bestHit: Math.max(b.bestHit, st.maxHit || 0), bestKills: Math.max(b.bestKills, st.kills || 0),
          bestAsc: res.win && !run.fair ? Math.max(b.bestAsc, run.asc + 1) : b.bestAsc,
          bestScore: run.fair ? Math.max(b.bestScore, res.score) : b.bestScore,
          wins: b.wins + (res.win ? 1 : 0), runs: b.runs + 1,
        });
      });
      const rec = { name, char: run.char, score: res.score, act: run.act, floor: Math.max(1, run.floor + 1), win: !!res.win, kills: st.kills || 0, maxHit: st.maxHit || 0, streak: O.streak || 0, at: now() };
      if (run.daily) {
        await O.bestOnly(db.collection('daily').doc(String(run.dailyKey)).collection('scores').doc(me), rec);
        // 주간 시즌: 그날 최고 점수를 요일별로 더한다
        const wref = db.collection('weekly').doc(String(O.weekOf(run.dailyKey))).collection('scores').doc(me);
        await db.runTransaction(async tx => {
          const w = (await tx.get(wref)).data() || { days: {} }, days = Object.assign({}, w.days), k = String(run.dailyKey);
          days[k] = Math.max(days[k] || 0, res.score);
          tx.set(wref, { name, total: Object.values(days).reduce((a, b) => a + b, 0), days, streak: O.streak || 0, at: now() });
        });
        await O.race(true, { done: true, win: !!res.win, score: res.score });
        const top = await db.collection('daily').doc(String(run.dailyKey)).collection('scores').orderBy('score', 'desc').limit(100).get();
        const rank = top.docs.findIndex(d => d.id === me) + 1;
        if (box()) box().innerHTML = `<div class="onl"><b>오늘의 순위 ${rank ? rank + '위' : '-'}</b><small>참가 ${top.size}명 · 내 최고 ${U.fmt((top.docs.find(d => d.id === me) || { data: () => rec }).data().score)}점</small><button class="btn small primary" data-act="hub">순위표 보기</button></div>`;
        G.UI.toast(`오늘의 순위 ${rank}위!`, 'ach');
      } else if (run.mode === 'challenge') {
        let cid = run.challengeId;
        if (run.challengeNew && !cid) {
          const ref = await db.collection('challenges').add({ from: me, fromName: name, seed: run.seed, char: run.char, asc: run.asc, score: res.score, at: now() });
          cid = ref.id; O.rememberChallenge(cid);
        }
        await O.bestOnly(db.collection('challenges').doc(cid).collection('results').doc(me), rec);
        O.rememberChallenge(cid);
        const link = O.link(cid);
        if (box()) box().innerHTML = `<div class="onl"><b>${run.challengeNew ? '도전장을 만들었어요' : '도전장에 기록했어요'}</b><small>이 링크를 받은 친구가 같은 판으로 도전합니다</small><code id="clink">${esc(link)}</code>
          <div class="btnrow"><button class="btn small primary" data-act="shareC" data-id="${cid}">친구에게 보내기</button><button class="btn small" data-act="viewC" data-id="${cid}">순위 보기</button></div></div>`;
      } else if (box()) box().innerHTML = `<div class="onl"><small>명예의 전당 기록을 올렸어요</small><button class="btn small" data-act="hub">명예의 전당</button></div>`;
    } catch (e) {
      console.warn(e);
      if (box()) box().innerHTML = '<div class="onl"><small>기록을 올리지 못했어요. 인터넷 연결을 확인해 주세요.</small></div>';
    }
  };
  // 더 높은 점수일 때만 덮어쓴다
  O.bestOnly = async function (ref, rec) {
    await O.db.runTransaction(async tx => {
      const d = await tx.get(ref);
      if (!d.exists || (d.data().score || 0) < rec.score) tx.set(ref, rec);
    });
  };
  // 결과 화면에서 쓰는 버튼
  O.resultActs = {
    hub: () => O.hub(G.Run.cur ? 'daily' : 'daily'),
    shareC: d => O.share(d.id),
    viewC: d => O.openChallenge(d.id),
  };

  // ---------- 실시간 레이스 (일일 도전) ----------
  O.race = async function (force, extra) {
    const run = G.Run.cur;
    if (!O.on() || !O.name() || !run || !run.daily) return;
    if (!force && now() - O.lastRaceWrite < 4000) { clearTimeout(O.raceTimer); O.raceTimer = setTimeout(() => O.race(true), 4200); return; }
    O.lastRaceWrite = now();
    const doc = Object.assign({ name: O.name(), char: run.char, act: run.act, floor: Math.max(1, run.floor + 1), hp: Math.max(0, run.hp), maxHp: run.maxHp, score: G.Run.score(run, false), done: false, win: false, streak: O.streak || 0, at: now() }, extra || {});
    try { await O.db.collection('race').doc(String(run.dailyKey)).collection('live').doc(O.uid).set(doc); } catch (e) { console.warn(e); }
    if (O.raceKey !== run.dailyKey) O.watchRace(run.dailyKey);
  };
  O.watchRace = function (key) {
    if (!O.on()) return;
    if (O.unsubRace && O.raceKey === key) return;
    O.unsubRace && O.unsubRace(); O.raceKey = key; O.raceList = [];
    let first = true;
    O.unsubRace = O.db.collection('race').doc(String(key)).collection('live').where('at', '>', now() - 6 * 3600e3).onSnapshot(snap => {
      const prev = {}; for (const r of O.raceList) prev[r.id] = r;
      O.raceList = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      O.sortRace(O.raceList);
      if (!first) for (const r of O.raceList) {
        if (r.id === O.uid) continue; const p = prev[r.id];
        if (!p) G.UI.toast(`${r.name}님이 레이스에 들어왔어요`);
        else if (r.done && !p.done) G.UI.toast(`${r.name}님 완주: ${U.fmt(r.score)}점${r.win ? ' (클리어!)' : ''}`, 'ach');
        else if (r.act > p.act) G.UI.toast(`${r.name}님이 ${r.act}막에 도착했어요`);
      }
      first = false;
      O.renderStrip();
    }, e => console.warn(e));
  };
  O.sortRace = list => list.sort((a, b) => (b.done && b.win) - (a.done && a.win) || b.act * 100 + b.floor - (a.act * 100 + a.floor) || b.score - a.score);
  O.raceBadge = function () {
    const run = G.Run.cur;
    if (!run || !run.daily || O.raceList.length < 2) return '';
    const i = O.raceList.findIndex(r => r.id === O.uid);
    return i < 0 ? '' : `레이스 ${i + 1}위 / ${O.raceList.length}명`;
  };
  const live = r => !r.done && now() - r.at < 3 * 60e3;
  O.raceRows = function (limit) {
    return O.raceList.slice(0, limit || 50).map((r, i) => `<div class="rrow ${r.id === O.uid ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="rn">${esc(r.name)}${O.badges(r.id, r.streak)}</span>
      <span class="rp">${r.done ? (r.win ? '클리어' : '완주') : `${r.act}막 ${r.floor}층`}</span><span class="rh"><i style="width:${Math.max(0, Math.min(100, (r.hp / r.maxHp) * 100))}%"></i></span>
      <span class="rs ${live(r) ? 'live' : ''}">${r.done ? U.fmt(r.score) + '점' : live(r) ? '플레이 중' : '쉬는 중'}</span></div>`).join('');
  };
  O.renderStrip = function () {
    const el = $('#raceStrip'); if (el) el.innerHTML = O.raceList.length ? `<div class="rtitle">실시간 레이스</div>${O.raceRows(4)}` : '';
    const hub = $('#raceFull'); if (hub) hub.innerHTML = O.raceList.length ? O.raceRows() : '<p class="sub">오늘 레이스에 들어온 사람이 아직 없어요. 일일 도전을 시작하면 여기에 나타나요.</p>';
  };

  // ---------- 도전장 ----------
  O.link = cid => location.origin + location.pathname + '?c=' + cid;
  O.rememberChallenge = function (cid) {
    const l = G.meta.challenges || (G.meta.challenges = []);
    if (!l.includes(cid)) { l.unshift(cid); l.length = Math.min(l.length, 30); G.Meta.save(); }
  };
  O.share = function (cid) {
    const link = O.link(cid), text = '튕겨라, 용사 도전장! 같은 판으로 내 점수를 넘어 봐';
    if (navigator.share) navigator.share({ title: '튕겨라, 용사 도전장', text, url: link }).catch(() => {});
    else G.UI.copy(link, '#clink');
  };
  O.newChallenge = function () {
    O.need(() => {
      const chars = Object.keys(G.CHARS).filter(id => G.meta.chars[id]);
      G.UI.modal(`<h3>새 도전장</h3><p class="mt">고른 용사로 새 판을 먼저 플레이합니다. 끝나면 링크가 생기고, 링크를 받은 친구는 같은 지도·적·보상으로 도전합니다. 모든 구슬과 유물이 나오고 영구 강화는 적용되지 않아요.</p>
        <div class="pickrow">${chars.map(id => `<button class="pk" data-act="go" data-id="${id}">${G.UI.img('heroes/' + id)}<span>${esc(G.CHARS[id].name)}</span></button>`).join('')}</div>
        <button class="btn" data-act="no">취소</button>`, {
        no: G.UI.closeModal,
        go: d => { G.UI.closeModal(); G.Run.clearSave(); const run = G.Run.create(d.id, 0, 'challenge', null, { challengeNew: true }); G.Run.start(run); },
      });
    });
  };
  O.openChallenge = async function (cid) {
    if (!O.on()) return;
    G.UI.modal('<h3>도전장 불러오는 중…</h3>', {});
    try {
      const doc = await O.db.collection('challenges').doc(cid).get();
      if (!doc.exists) { G.UI.modal('<h3>도전장을 찾을 수 없어요</h3><p class="mt">링크가 잘못되었거나 지워졌어요.</p><button class="btn" data-act="x">닫기</button>', { x: G.UI.closeModal }); return; }
      const c = doc.data();
      const rs = await O.db.collection('challenges').doc(cid).collection('results').orderBy('score', 'desc').limit(30).get();
      const rows = rs.docs.map((d, i) => { const r = d.data(); return `<div class="rrow ${d.id === O.uid ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="rn">${esc(r.name)}</span><span class="rp">${r.win ? '클리어' : `${r.act}막 ${r.floor}층`}</span><span class="rs">${U.fmt(r.score)}점</span></div>`; }).join('');
      const mine = rs.docs.some(d => d.id === O.uid);
      O.rememberChallenge(cid);
      G.UI.modal(`<h3>${esc(c.fromName)}님의 도전장</h3>
        <div class="chead">${G.UI.img('heroes/' + c.char, 'chimg')}<div><b>${esc(G.CHARS[c.char].name)}</b><small>${c.asc ? '승천 ' + c.asc + ' · ' : ''}${new Date(c.at).toLocaleDateString('ko-KR')} · 참가 ${rs.size}명</small></div></div>
        <div class="rlist">${rows || '<p class="sub">아직 기록이 없어요</p>'}</div><code id="clink" class="clink">${esc(O.link(cid))}</code>
        <div class="btnrow"><button class="btn" data-act="x">닫기</button><button class="btn" data-act="share">링크 보내기</button><button class="btn primary" data-act="play">${mine ? '다시 도전' : '도전하기'}</button></div>`, {
        x: G.UI.closeModal, share: () => O.share(cid),
        play: () => O.need(() => { G.UI.closeModal(); G.Run.clearSave(); const run = G.Run.create(c.char, c.asc || 0, 'challenge', c.seed, { challengeId: cid }); G.Run.start(run); }),
      });
    } catch (e) { console.warn(e); G.UI.modal('<h3>도전장을 불러오지 못했어요</h3><button class="btn" data-act="x">닫기</button>', { x: G.UI.closeModal }); }
  };

  // ---------- 허브 화면 ----------
  let unsubDaily = null;
  O.hub = function (tab) {
    tab = tab || 'daily';
    unsubDaily && unsubDaily(); unsubDaily = null;
    if (!O.on()) {
      const why = O.configured() ? (O.state === 'connecting' ? '서버에 연결하는 중이에요. 잠시 뒤 다시 눌러 주세요.' : '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.') : '이 페이지에는 서버가 연결되어 있지 않아요. 친구와 겨루기는 GitHub Pages에 올린 버전에서 Firebase 설정을 넣으면 쓸 수 있어요.';
      G.UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>친구와 겨루기</h2><span></span></div><p class="sub">${why}</p></div>`, 'bg-plain', { back: () => G.UI.title() });
      return;
    }
    if (!O.name()) return O.askName(() => O.hub(tab));
    const key = U.todayKey();
    const tabs = [['daily', '오늘'], ['week', '주간 시즌'], ['race', '레이스'], ['hall', '명예의 전당'], ['ch', '도전장']];
    O.loadChamp();
    G.UI.show(`<div class="page"><div class="top"><button class="btn small ghost" data-act="back">← 뒤로</button><h2>친구와 겨루기</h2><button class="btn small ghost" data-act="nick">${esc(O.name())} ✎</button></div>
      <div class="tabs five">${tabs.map(t => `<button class="tab ${tab === t[0] ? 'on' : ''}" data-act="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
      <div id="hubBody"><p class="sub">불러오는 중…</p></div>
      ${O.linked() ? `<p class="gok">${GICON}구글 계정 연결됨 · 폰·PC 어디서든 같은 기록</p>` : `<button class="gbtn" data-act="google">${GICON}<span>구글 계정 연결하기<small>연결해 두면 폰·PC 어디서든 같은 기록으로 이어져요</small></span></button>`}</div>`, 'bg-plain', Object.assign({
      google: () => O.linkGoogle(() => O.hub(tab)),
      back: () => { unsubDaily && unsubDaily(); G.UI.title(); }, tab: d => O.hub(d.t), nick: () => O.askName(() => O.hub(tab)),
      daily: () => G.UI.daily(G.Run.loadSaved()), newC: () => O.newChallenge(), openC: d => O.openChallenge(d.id),
    }, O.resultActs));
    const body = $('#hubBody');
    if (tab === 'daily') {
      unsubDaily = O.db.collection('daily').doc(String(key)).collection('scores').orderBy('score', 'desc').limit(50).onSnapshot(snap => {
        if (!$('#hubBody')) return unsubDaily && unsubDaily();
        const rows = snap.docs.map((d, i) => { const r = d.data(); return `<div class="rrow ${d.id === O.uid ? 'me' : ''}"><span class="rk ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><span class="rn">${esc(r.name)}${O.badges(d.id, r.streak)}</span><span class="rp">${r.win ? '클리어' : `${r.act}막 ${r.floor}층`}</span><span class="rs">${U.fmt(r.score)}점</span></div>`; }).join('');
        $('#hubBody').innerHTML = `<p class="sub">${String(key).replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')} 일일 도전 · 모두 같은 지도와 보상</p><div class="rlist">${rows || '<p class="sub">아직 아무도 기록이 없어요. 첫 번째가 되어 보세요!</p>'}</div><button class="btn primary big" data-act="daily">일일 도전 하기</button>`;
      }, e => { body.innerHTML = '<p class="sub">순위표를 불러오지 못했어요.</p>'; console.warn(e); });
    } else if (tab === 'race') {
      O.watchRace(key);
      body.innerHTML = `<p class="sub">오늘 일일 도전을 하는 친구들의 진행 상황이 실시간으로 보여요.</p><div class="rlist" id="raceFull"></div><button class="btn primary big" data-act="daily">일일 도전 하기</button>`;
      O.renderStrip();
    } else if (tab === 'week') {
      const wk = O.weekKey(0), days = O.weekDays(wk), today = U.todayKey();
      const left = O.weekEnd() - now(), dd = Math.floor(left / 864e5), hh = Math.floor((left % 864e5) / 36e5);
      const champ = () => O.champ ? `<div class="champ">${CROWN}<div><small>지난주 용사</small><b>${esc(O.champ.name)}</b><small>주간 합계 ${U.fmt(O.champ.total)}점 · 이번 주 내내 이름 옆에 왕관</small></div></div>` : '<div class="champ empty"><div><small>지난주 용사</small><b>아직 없음</b><small>이번 주 1위가 다음 주 왕관을 씁니다</small></div></div>';
      unsubDaily = O.db.collection('weekly').doc(String(wk)).collection('scores').orderBy('total', 'desc').limit(50).onSnapshot(snap => {
        if (!$('#hubBody')) return unsubDaily && unsubDaily();
        const rows = snap.docs.map((d, i) => { const r = d.data(); const dots = days.map(k => `<i class="${r.days && r.days[k] ? 'on' : ''} ${k === today ? 'today' : ''}"></i>`).join(''); return `<div class="rrow ${d.id === O.uid ? 'me' : ''}"><span class="rk ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><span class="rn">${esc(r.name)}${O.badges(d.id, r.streak)}</span><span class="dots" aria-label="참가한 날">${dots}</span><span class="rs">${U.fmt(r.total)}점</span></div>`; }).join('');
        $('#hubBody').innerHTML = `${champ()}<p class="sub">이번 시즌: 매일 일일 도전 최고 점수를 더해요. 하루라도 빠지면 그만큼 손해! · 끝까지 ${dd}일 ${hh}시간</p>
          <div class="rlist">${rows || '<p class="sub">이번 주 기록이 아직 없어요.</p>'}</div>${O.streak >= 1 ? `<p class="sub center">내 연속 참가 <b class="gold">${O.streak}일</b></p>` : ''}<button class="btn primary big" data-act="daily">오늘의 일일 도전 하기</button>`;
      }, e => { body.innerHTML = '<p class="sub">시즌 순위를 불러오지 못했어요.</p>'; console.warn(e); });
    } else if (tab === 'hall') {
      const cats = [['bestHit', '한 발 최대 피해', v => U.fmt(v)], ['bestScore', '최고 경쟁 점수', v => U.fmt(v) + '점'], ['bestAsc', '최고 클리어 승천', v => v ? '승천 ' + (v - 1) : '-'], ['bestKills', '한 판 최다 처치', v => v + '마리'], ['wins', '클리어 횟수', v => v + '번']];
      Promise.all(cats.map(c => O.db.collection('players').orderBy(c[0], 'desc').limit(5).get())).then(res => {
        if (!$('#hubBody')) return;
        $('#hubBody').innerHTML = cats.map((c, k) => {
          const rows = res[k].docs.filter(d => (d.data()[c[0]] || 0) > 0).map((d, i) => `<div class="rrow ${d.id === O.uid ? 'me' : ''}"><span class="rk ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><span class="rn">${esc(d.data().name)}${O.badges(d.id, d.data().streak)}</span><span class="rs">${c[2](d.data()[c[0]] || 0)}</span></div>`).join('');
          return `<h3>${c[1]}</h3><div class="rlist">${rows || '<p class="sub">아직 기록 없음</p>'}</div>`;
        }).join('');
      }).catch(e => { body.innerHTML = '<p class="sub">명예의 전당을 불러오지 못했어요.</p>'; console.warn(e); });
    } else {
      const ids = G.meta.challenges || [];
      body.innerHTML = `<p class="sub">내 판을 링크로 보내 친구와 같은 지도·적·보상으로 점수를 겨뤄요.</p><button class="btn primary big" data-act="newC">새 도전장 만들기</button><h3>내 도전장</h3><div id="chList">${ids.length ? '<p class="sub">불러오는 중…</p>' : '<p class="sub">아직 없어요. 친구에게 받은 링크를 열면 여기에 쌓여요.</p>'}</div>`;
      if (ids.length) Promise.all(ids.slice(0, 15).map(id => Promise.all([O.db.collection('challenges').doc(id).get(), O.db.collection('challenges').doc(id).collection('results').orderBy('score', 'desc').limit(1).get()]).catch(() => null))).then(list => {
        const el = $('#chList'); if (!el) return;
        el.innerHTML = list.map((x, i) => {
          if (!x || !x[0].exists) return ''; const c = x[0].data(), top = x[1].docs[0] && x[1].docs[0].data();
          return `<button class="chrow" data-act="openC" data-id="${ids[i]}">${G.UI.img('heroes/' + c.char, 'bimg')}<div><b>${esc(c.fromName)}님의 도전장</b><small>${esc(G.CHARS[c.char].name)} · 1위 ${top ? esc(top.name) + ' ' + U.fmt(top.score) + '점' : '-'}</small></div></button>`;
        }).join('') || '<p class="sub">불러올 수 있는 도전장이 없어요.</p>';
      });
    }
  };
})();
