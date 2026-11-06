// 전투: 쏘기 → 튕기기 → 피해 → 적 턴
// 피해 계산 순서: 핀 점수 합(구슬 핀 피해 + 무딘 칼날, 벽 점수) → 배율(크리, 연쇄 반응, 공명석) → 최종 배수(바구니, 첫 발의 기세, 저주받은 왕관)
(function () {
  const C = G.CFG, A = G.AUDIO, F = G.FX, U = G.U;
  const STEP = G.Board.STEP;
  const PEG_COLORS = { normal: '#7cc6ff', crit: '#ffb347', refill: '#5be3a8', bomb: '#ff6b5b', gold: '#ffd54a', thorn: '#c06bff', burn: '#ff7a2f' };

  class Battle {
    constructor(run, ids, kind) {
      this.run = run; this.kind = kind;
      this.rng = new U.RNG(U.hashStr(run.seed + '|battle|' + run.act + '|' + run.pos)); // 전투 전용 난수 (보상 난수와 분리)
      this.board = new G.Board(this);
      this.enemies = []; this.hero = { flash: 0, lunge: 0, burn: 0, poison: 0, hurtT: 0 };
      const n = ids.length;
      const start = kind === 'boss' ? [3] : n === 1 ? [3] : n === 2 ? [2, 3] : [2, 3, 4];
      ids.forEach((id, i) => this.addEnemy(id, start[i] || i + 2));
      this.turn = 0; this.phase = 'intro'; this.shot = null; this.balls = [];
      this.firstShot = true; this.drawPile = []; this.current = null; this.cloneNext = null; this.lastOrb = null;
      this.usedSecond = false; this.mirrorUsed = false; this.pouchUsed = false;
      this.tally = null; this.projectile = null; this.aim = { angle: Math.PI / 2, on: false }; this.previewPts = null;
      this.acc = 0; this.combo = { n: 0, t: 0 }; this.banner = null; this.t = 0;
      for (const id of ids) G.Meta.seen('monsters', id);
    }
    has(r) { return this.run.relics.includes(r); }
    relic(id) { if (this.has(id)) { G.Run.flashRelic(id); return true; } return false; }
    ascMod() {
      const a = this.run.asc || 0;
      return { hp: (a >= 1 ? 1.1 : 1) * (a >= 10 ? 1.25 : 1), atk: a >= 5 ? 1.15 : 1, boss: a >= 7 ? 1.2 : 1 };
    }
    addEnemy(id, pos) {
      const m = G.MONSTERS[id], mod = this.ascMod();
      const hp = Math.round(m.hp * mod.hp * (m.tier === 'boss' ? mod.boss : 1));
      const e = { id, m, hp, maxHp: hp, atk: Math.round(m.atk * mod.atk), pos, x: C.slotX[Math.min(pos, 4)] + 40, intent: null, burn: 0, poison: 0, frozen: 0, shield: 0, stone: false, revived: false, flash: 0, lunge: 0, knock: 0, dead: false, deathT: 0, turns: 0, spawnT: 0.35, phase: 1, uid: Math.random() };
      this.enemies.push(e); return e;
    }
    alive() { return this.enemies.filter(e => !e.dead); }
    front() { const a = this.alive(); a.sort((p, q) => p.pos - q.pos); return a[0] || null; }
    slotFree(pos, self) { return !this.enemies.some(e => !e.dead && e !== self && e.pos === pos); }

    // ---------- 시작 ----------
    start() {
      F.reset();
      this.board.generate();
      if (this.relic('poison_jar')) for (const e of this.enemies) e.poison += 2;
      this.reshuffle(true);
      const names = { battle: '전투', elite: '엘리트 전투', boss: '보스 전투' };
      this.banner = { text: this.kind === 'boss' ? this.enemies[0].m.name : names[this.kind], sub: this.kind === 'boss' ? '보스' : '', t: 0, life: 1.3 };
      this.startTurn();
    }
    reshuffle(silent) {
      this.drawPile = this.rng.shuffle(this.run.bag.map(o => ({ id: o.id, lv: o.lv })));
      if (!silent) F.text(80, 362, '가방을 섞었다', { size: 18, color: '#cfc6ff', vy: -20 });
    }
    drawNext() {
      if (this.cloneNext) { this.current = this.cloneNext; this.cloneNext = null; return; }
      if (!this.drawPile.length) this.reshuffle();
      this.current = this.drawPile.shift();
    }
    queueView() { return this.drawPile.slice(0, this.has('infinite_pouch') ? 5 : 3); }
    swapQueue(i) {
      if (this.phase !== 'aim' || !this.has('infinite_pouch') || this.pouchUsed || !this.drawPile[i]) return false;
      const t = this.current; this.current = this.drawPile[i]; this.drawPile[i] = t; this.pouchUsed = true;
      A.play('click'); F.text(270, 380, '순서 바꿈', { size: 20, color: '#ffc94a' }); return true;
    }

    startTurn() {
      this.turn++;
      const bd = this.board;
      bd.rerollSpecials();
      if (this.relic('chaos_dice')) {
        const pool = bd.activeNormals();
        if (pool.length) { const p = this.rng.pick(pool); p.type = this.rng.pick(['crit', 'refill', 'bomb', 'gold']); p.bombHp = 2; p.pop = 0.5; F.ring(p.x, p.y, '#c08cff', 40); }
      }
      const boss = this.enemies.find(e => e.id === 'demon_lord' && !e.dead);
      bd.basket.gone = !!(boss && boss.phase >= 3);
      for (const e of this.alive()) e.intent = this.decide(e);
      this.drawNext();
      this.phase = 'aim';
      if (this.turn > 1) G.Online && G.Online.race();
    }

    // ---------- 적 행동 결정 ----------
    decide(e) {
      if (e.frozen > 0) return { type: 'frozen' };
      const inR = e.pos <= e.m.range;
      const atk = { type: 'attack', dmg: e.atk }, mv = { type: 'move' };
      const base = inR ? atk : mv;
      const t = e.turns, mod = this.ascMod().atk;
      switch (e.id) {
        case 'mushroom_soldier': return t % 2 === 1 ? { type: 'spore' } : base;
        case 'rock_golem': return Object.assign({}, base, { shield: 15 });
        case 'cave_spider': return t % 2 === 0 ? { type: 'thorn' } : base;
        case 'treant': return t % 3 === 0 && this.board.pegs.filter(p => p.blocked && !p.gone).length < 3 ? { type: 'root' } : base;
        case 'minotaur': return t % 3 === 2 ? { type: 'charge', dmg: Math.round(20 * mod) } : base;
        case 'slime_king': return [atk, { type: 'guard', shield: 20 }, atk][t % 3];
        case 'cave_dragon': return [atk, { type: 'burnpegs' }, { type: 'inhale' }, { type: 'breath', dmg: Math.round(18 * mod) }][t % 4];
        case 'gargoyle': return t % 2 === 1 ? { type: 'stone' } : base;
        case 'reaper': return t % 2 === 1 && this.alive().some(o => o !== e) ? { type: 'absorb' } : base;
        case 'demon_lord': return t % 3 === 2 ? { type: 'curse' } : { type: 'attack', dmg: Math.round([11, 13, 15][e.phase - 1] * mod) };
        default: return base;
      }
    }

    // ---------- 발사 ----------
    fire(angle) {
      if (this.phase !== 'aim' || !this.current) return;
      if (!G.meta.flags.aimed) { G.meta.flags.aimed = 1; G.Meta.save(); }
      const o = this.current, lv = o.lv;
      this.phase = 'shoot'; this.previewPts = null;
      this.shot = { orb: o.id, lv, score: 0, hits: 0, crits: 0, wallHits: 0, basket: false, fireCount: 0, burnAdd: 0, goldCount: 0, freeze: 0, lastX: C.launchX, t: 0, chainShown: 0 };
      if (o.id === 'lucky_orb') this.board.assign('crit', [3, 4, 5][lv - 1]);
      const b = this.board.makeBall(angle, o.id, lv);
      this.balls = [b]; this.combo = { n: 0, t: 0 };
      A.play('launch'); F.burst(C.launchX, C.launchY, '#cfc6ff', 8, 120);
      G.Meta.seen('orbs', o.id);
    }

    update(dt) {
      this.t += dt;
      this.board.updateAnim(dt);
      if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
      this.combo.t += dt;
      for (const e of this.enemies) {
        const tx = C.slotX[Math.min(e.pos, 4)];
        e.x += (tx - e.x) * Math.min(1, dt * 8);
        e.flash = Math.max(0, e.flash - dt); e.lunge = Math.max(0, e.lunge - dt); e.knock *= Math.pow(0.002, dt);
        if (e.spawnT > 0) e.spawnT -= dt;
        if (e.dead) e.deathT += dt;
      }
      const h = this.hero; h.flash = Math.max(0, h.flash - dt); h.lunge = Math.max(0, h.lunge - dt);
      if (this.tally) this.tally.t += dt;
      if (this.projectile) { const p = this.projectile; p.t += dt; }
      if (this.phase === 'shoot') this.physics(dt);
    }

    physics(dt) {
      this.acc += dt;
      const bd = this.board, s = this.shot;
      let steps = 0;
      while (this.acc >= STEP && steps < 40) {
        this.acc -= STEP; steps++; bd.ptime += STEP; s.t += STEP;
        for (const b of this.balls) {
          if (!b.alive) continue;
          bd.stepBall(b, STEP, this.cb || (this.cb = this.makeCb()));
          // 바구니 직전 슬로모
          if (b.alive && !b.slowed && !bd.basket.gone && b.vy > 0 && b.y > C.basketY - 50 && b.y < C.basketY && Math.abs(b.x - bd.basket.x) < bd.basketW() / 2) { b.slowed = true; F.slowmo(C.fx.slowmoBasket, 0.35); }
          // 끼임 처리
          if (b.age - b.lastMove.t > 1.2) {
            if (U.dist2(b.x, b.y, b.lastMove.x, b.lastMove.y) < 22 * 22) this.unstick(b);
            b.lastMove = { x: b.x, y: b.y, t: b.age };
          }
        }
        if (s.t > C.maxShotTime) for (const b of this.balls) b.alive = false;
        if (!this.balls.some(b => b.alive)) { this.phase = 'resolve'; this.endShot(); break; }
      }
      if (this.acc > STEP * 40) this.acc = 0;
      // 꼬리
      for (const b of this.balls) if (b.alive) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift(); }
    }
    unstick(b) {
      const near = this.board.pegs.filter(p => !p.gone && U.dist2(p.x, p.y, b.x, b.y) < (b.r + p.r + 6) ** 2);
      let removed = false;
      for (const p of near) if (p.lit || p.blocked) { p.gone = true; removed = true; F.burst(p.x, p.y, '#ffffff', 5, 80); }
      if (!removed) { b.vx += (Math.random() - 0.5) * 300; b.vy -= 200; }
    }
    makeCb() {
      return {
        hit: (p, b) => this.pegHit(p, b, 'ball'),
        wall: b => this.wallHit(b),
        basket: b => this.basketHit(b),
        lost: b => this.ballLost(b),
      };
    }

    pinDmg() { const s = this.shot; return G.ORBS[s.orb].dmg + (s.lv - 1) + (this.has('dull_blade') ? 1 : 0); }

    pegHit(p, ball, src) {
      const s = this.shot; if (!s || p.gone) return;
      if (src === 'ball') { if (this.board.ptime - p.lastHit < 0.1) return; p.lastHit = this.board.ptime; }
      if (p.blocked) { p.pop = 0.12; return; }
      if (p.lit) return;
      p.pop = 0.25;
      if (p.type === 'thorn') { p.lit = true; A.play('thorn'); F.burst(p.x, p.y, PEG_COLORS.thorn, 8, 160); this.hurtHero(2, null, '가시'); return; }
      if (p.type === 'burn') { p.lit = true; F.burst(p.x, p.y, PEG_COLORS.burn, 8, 160); this.hero.burn += 1; F.text(C.heroX, 170, '화상 +1', { size: 18, color: '#ff9a4a' }); return; }

      // 점수
      const pin = this.pinDmg();
      s.score += pin; s.hits++; this.combo = { n: s.hits, t: 0 };
      A.play('peg', s.hits - 1);
      F.burst(p.x, p.y, PEG_COLORS[p.type] || '#7cc6ff', C.fx.particlesPeg, 140, 9);
      if (this.has('chain_reaction') && s.hits % 10 === 0) F.text(p.x, p.y - 24, '연쇄 +0.5', { size: 18, color: '#ffb347' });
      // 구슬 효과: 개수 세기
      if (s.orb === 'fire_orb' && ++s.fireCount % [4, 3, 2][s.lv - 1] === 0) { s.burnAdd++; F.text(p.x, p.y - 20, '불씨', { size: 16, color: '#ff8a3d' }); }
      if (s.orb === 'gold_orb' && ++s.goldCount % [5, 4, 3][s.lv - 1] === 0) this.gainGold(1, p.x, p.y);
      if (ball && ball.orb === 'split_orb' && !ball.split && !ball.child) this.split(ball);

      if (p.type === 'bomb') {
        p.bombHp -= this.has('bomb_pouch') || src === 'bomb' ? 2 : 1;
        if (p.bombHp > 0) { F.text(p.x, p.y - 18, '한 번 더!', { size: 16, color: '#ff8b7b' }); return; }
        p.lit = true; p.exploded = true; this.explode(p.x, p.y, 92, true); return;
      }
      p.hp--;
      if (p.hp > 0) return; // 드워프: 한 번 더 맞아야 꺼짐
      p.lit = true;

      const crit = p.type === 'crit' || (p.type === 'gold' && this.has('golden_pin'));
      if (crit) {
        s.crits++;
        F.hitstop(C.fx.hitstopCrit); F.shake(C.fx.shakeCrit); F.ring(p.x, p.y, '#ffb347', 70); F.burst(p.x, p.y, '#ffb347', 14, 240, 12);
        A.play('crit'); U.vibrate(18);
        F.text(p.x, p.y - 22, '크리!', { size: 26, color: '#ffb347' });
        if (s.orb === 'ice_orb') { s.freeze = Math.max(s.freeze, s.lv >= 3 ? 2 : 1); F.text(p.x, p.y - 46, '빙결 준비', { size: 16, color: '#9fe3ff' }); }
        if (src !== 'zap') {
          let n = 0; if (s.orb === 'lightning_orb') n += [4, 5, 6][s.lv - 1]; if (this.relic('lightning_rod')) n += 4;
          if (n) this.zapFrom(p, n);
        }
      }
      if (p.type === 'refill') { A.play('refill'); F.ring(p.x, p.y, '#5be3a8', 120, 0.6); F.text(p.x, p.y - 22, '리필!', { size: 24, color: '#5be3a8' }); this.board.refillAll(); p.lit = true; p.gone = false; }
      if (p.type === 'gold') this.gainGold(3, p.x, p.y);
    }
    zapFrom(p, n) {
      const c = this.board.pegs.filter(q => q !== p && !q.gone && !q.lit && !q.blocked && q.type !== 'thorn' && q.type !== 'burn')
        .sort((a, b) => U.dist2(a.x, a.y, p.x, p.y) - U.dist2(b.x, b.y, p.x, p.y)).slice(0, n);
      A.play('zap');
      for (const q of c) { F.zap(p.x, p.y, q.x, q.y); this.pegHit(q, null, 'zap'); }
    }
    explode(x, y, rad, hurtEnemies) {
      A.play('bomb'); F.shake(C.fx.shakeBomb); F.hitstop(0.08); F.ring(x, y, '#ff6b5b', rad * 1.3, 0.5); F.burst(x, y, '#ff8a3d', 26, 320, 14); U.vibrate(30);
      const near = this.board.pegs.filter(q => !q.gone && !q.lit && U.dist2(q.x, q.y, x, y) < rad * rad);
      for (const q of near) this.pegHit(q, null, 'bomb');
      if (hurtEnemies) {
        for (const e of this.alive()) this.damageEnemy(e, 10, { kind: 'bomb' });
        F.flash(0.15, '#ff8a3d');
      }
    }
    split(b) {
      b.split = true; const n = b.lv >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const c = Object.assign({}, b, { vx: -b.vx * (0.8 + 0.2 * i) + (i ? 60 : 0), vy: b.vy, trail: [], child: true, id: Math.random(), lastMove: { x: b.x, y: b.y, t: b.age } });
        this.balls.push(c);
      }
      F.burst(b.x, b.y, '#ffd54a', 12, 200); A.play('zap');
    }
    wallHit(b) {
      const s = this.shot; if (!s) return;
      let add = 0; if (b.orb === 'rubber_orb') add += b.lv + 1; if (this.relic('bouncy_boots')) add += 1;
      if (add) { s.score += add; s.wallHits++; F.text(b.x < 270 ? 44 : 496, b.y, '+' + add, { size: 18, color: '#ff9ad5' }); F.burst(b.x, b.y, '#ff9ad5', 4, 100); }
      A.play('wall');
    }
    basketHit(b) {
      const s = this.shot; s.basket = true; s.lastX = b.x;
      A.play('basket'); F.burst(b.x, C.basketY, '#ffd54a', 18, 260, 12); F.ring(b.x, C.basketY, '#ffd54a', 60);
      F.text(b.x, C.basketY - 34, '바구니 ×1.5', { size: 22, color: '#ffd54a' });
      if (b.orb === 'clone_orb' && !this.cloneNext) { this.cloneNext = { id: b.orb, lv: b.lv }; F.text(b.x, C.basketY - 62, '한 번 더!', { size: 20, color: '#e6e1ff' }); }
    }
    ballLost(b) {
      if (!this.usedSecond && this.relic('second_chance')) {
        this.usedSecond = true; b.y = C.H - b.r - 2; b.vy = -1050; b.vx *= 0.6;
        F.text(b.x, C.H - 60, '두 번째 기회!', { size: 22, color: '#9fe3ff' }); F.ring(b.x, C.H - 20, '#9fe3ff', 80); A.play('refill');
        return;
      }
      b.alive = false; this.shot.lastX = b.x;
    }

    // ---------- 발이 끝난 뒤 ----------
    async endShot() {
      const s = this.shot;
      const snap = G.Brag.capture(); // 맞은 핀이 켜진 보드 (자랑 카드용)
      if (s.orb === 'bomb_orb') {
        await U.sleep(120);
        const n = [6, 8, 10][s.lv - 1];
        const near = this.board.pegs.filter(q => !q.gone && !q.lit && !q.blocked && q.type !== 'thorn' && q.type !== 'burn')
          .sort((a, b) => U.dist2(a.x, a.y, s.lastX, 900) - U.dist2(b.x, b.y, s.lastX, 900)).slice(0, n);
        A.play('bomb'); F.shake(C.fx.shakeBomb); F.ring(s.lastX, 900, '#ff6b5b', 140, 0.5); F.burst(s.lastX, 900, '#ff8a3d', 24, 320, 14);
        for (const q of near) this.pegHit(q, null, 'bomb');
      }
      await U.sleep(220);
      // 배율
      const critMult = this.has('shooting_star') ? 1 : C.critMult;
      let mult = 1;
      const parts = [];
      if (s.orb !== 'iron_orb' && s.crits) { mult += s.crits * critMult; parts.push(`크리 ${s.crits}`); }
      if (s.hits >= 10 && this.relic('chain_reaction')) { mult += 0.5 * Math.floor(s.hits / 10); parts.push('연쇄'); }
      if (this.lastOrb === s.orb && this.relic('resonance_stone')) { mult += 1; parts.push('공명'); }
      let extra = 1; const extras = [];
      if (s.basket) { extra *= C.basketMult; extras.push('바구니 ×1.5'); }
      if (this.firstShot && this.relic('first_strike')) { extra *= 2; extras.push('첫 발 ×2'); }
      if (this.relic('cursed_crown')) { extra *= 1.5; extras.push('왕관 ×1.5'); }
      const final = Math.round(s.score * mult * extra);
      this.tally = { score: s.score, mult, extra, final, parts, extras, t: 0, hits: s.hits };
      // 롤업 (0 → 점수)
      const roll = C.fx.rollupTime * 1000;
      for (let i = 0; i < 6; i++) { setTimeout(() => A.play('tally'), (roll / 6) * i); }
      await U.sleep(roll + 80);
      if (mult > 1 || extra > 1) { A.play('mult'); this.tally.multT = this.tally.t; await U.sleep(480); }
      this.tally.finalT = this.tally.t;
      await U.sleep(380);

      // 피해 적용 (폭탄으로 이미 쓰러진 적은 먼저 정리)
      await this.checkDeaths();
      let target = this.front();
      if (target && final > 0) {
        this.projectile = { x0: 270, y0: 470, x1: target.x, y1: C.footY - target.m.h / 2, t: 0, dur: 0.22 };
        this.hero.lunge = 0.25;
        await U.sleep(220);
        this.projectile = null;
        // 앞 적부터 피해를 넣고, 쓰러뜨리고 남은 피해는 뒤 적에게 넘어간다
        let left = final, dealt = 0, hitList = [];
        while (target && left > 0) {
          const o = { kind: 'orb', crits: s.crits };
          dealt += this.damageEnemy(target, left, o); hitList.push(target);
          left = o.excess || 0;
          if (left <= 0) break;
          const prev = target;
          target = this.alive().filter(e => e.hp > 0 && !hitList.includes(e)).sort((a, b) => a.pos - b.pos)[0];
          if (!target) break;
          F.text(prev.x + 30, C.footY - prev.m.h - 30, '남은 피해 ' + U.fmt(left) + ' →', { size: 18, color: '#ffb347', drift: 60 });
          this.projectile = { x0: prev.x, y0: C.footY - prev.m.h / 2, x1: target.x, y1: C.footY - target.m.h / 2, t: 0, dur: 0.16 };
          await U.sleep(170);
          this.projectile = null;
        }
        const st = this.run.stats; st.maxHit = Math.max(st.maxHit || 0, dealt); st.maxPegs = Math.max(st.maxPegs || 0, s.hits);
        const r = this.run;
        G.Brag.consider({ dealt, hits: s.hits, crits: s.crits, mult, extra, basket: s.basket, orb: s.orb, lv: s.lv, enemy: hitList[0] && hitList[0].id, char: r.char, act: r.act, floor: Math.max(1, r.floor + 1), mode: r.mode, snap });
        if (dealt >= 1000) G.Meta.achieve('hit1000');
        if (s.orb === 'vampire_orb' && dealt > 0) this.heal(Math.max(1, Math.round(dealt * [0.1, 0.15, 0.2][s.lv - 1])));
      }
      if (s.hits >= 50) G.Meta.achieve('pegs50');
      if (s.crits >= 5) G.Meta.achieve('crit5');
      this.tally = null;
      // 상태 이상 부여
      if (s.orb === 'poison_orb') {
        const add = Math.floor(s.hits / [5, 4, 3][s.lv - 1]);
        if (add > 0) for (const e of this.alive()) { e.poison += add; F.text(e.x, C.footY - e.m.h - 10, '독 +' + add, { size: 18, color: '#8dff6a' }); }
      }
      const fr = this.front();
      if (fr && s.burnAdd > 0) { fr.burn += s.burnAdd; F.text(fr.x, C.footY - fr.m.h - 10, '화상 +' + s.burnAdd, { size: 18, color: '#ff9a4a' }); }
      if (fr && s.freeze > 0) { fr.frozen = Math.max(fr.frozen, s.freeze); fr.intent = { type: 'frozen' }; A.play('freeze'); F.text(fr.x, C.footY - fr.m.h - 30, '빙결!', { size: 22, color: '#9fe3ff' }); }
      await this.checkDeaths();
      this.board.clearLit();
      this.lastOrb = s.orb; this.firstShot = false; this.shot = null; this.balls = [];
      if (!this.alive().length) return this.win();
      if (this.run.hp <= 0) return this.lose();
      await U.sleep(250);
      const r = await this.enemyTurn();
      if (r === 'win') return this.win();
      if (r === 'lose') return this.lose();
      this.startTurn();
    }

    // 적에게 피해. 돌려주는 값 = 실제로 깎인 체력
    damageEnemy(e, amt, o) {
      o = o || {};
      if (e.dead) return 0;
      const top = C.footY - e.m.h;
      if (e.stone && o.kind !== 'dot') { F.text(e.x, top - 6, '면역', { size: 22, color: '#c9c3d6' }); A.play('shield'); return 0; }
      let d = amt;
      if (e.id === 'black_knight' && o.kind === 'orb' && !o.crits) { d = Math.round(d / 2); F.text(e.x, top - 30, '크리 없음: 절반', { size: 15, color: '#c9c3d6' }); }
      if (e.frozen > 0 && this.has('frost_ring') && o.kind !== 'dot') d = Math.round(d * 1.5);
      const factor = amt > 0 ? d / amt : 1; // 보정 배율 (남은 피해를 원래 단위로 되돌릴 때 사용)
      if (e.shield > 0 && o.kind !== 'dot') { const ab = Math.min(e.shield, d); e.shield -= ab; d -= ab; if (ab) { F.text(e.x + 30, top + 10, '막힘 ' + ab, { size: 16, color: '#9fb7ff' }); A.play('shield'); } }
      if (d > e.hp && factor > 0) o.excess = Math.floor((d - e.hp) / factor); // 쓰러뜨리고 남은 피해
      d = Math.max(0, Math.min(d, e.hp));
      e.hp -= d;
      if (d > 0) {
        const big = o.kind === 'orb' && d >= 30 && d >= e.maxHp * 0.5;
        e.flash = C.fx.flashEnemy; e.knock = Math.min(26, 6 + d / 8);
        const col = o.kind === 'dot' ? o.color || '#ff9a4a' : '#ff6b5b';
        F.text(e.x + (Math.random() - 0.5) * 20, top + 20, U.fmt(d), { size: big ? 56 : o.kind === 'orb' ? 38 : 24, color: col, vy: -80, life: big ? 1.3 : 0.9 });
        F.burst(e.x, top + e.m.h / 2, col, big ? 22 : 10, big ? 300 : 180, 12);
        if (o.kind === 'orb') { A.play('hit', big); if (big) { F.slowmo(C.fx.slowmoBig, 0.2); F.shake(C.fx.shakeBig); F.hitstop(C.fx.hitstopBig); U.vibrate(40); } else F.shake(4); }
      }
      // 슬라임 왕 분열
      if (e.id === 'slime_king' && !e.split && e.hp > 0 && e.hp <= e.maxHp / 2) {
        e.split = true;
        for (const pos of [1, 2]) if (this.slotFree(pos, e)) { const s = this.addEnemy('slime', pos); s.hp = s.maxHp = 12; s.atk = 3; s.mini = true; s.x = e.x; s.intent = this.decide(s); }
        F.text(e.x, top - 20, '분열!', { size: 26, color: '#8dff6a' });
      }
      if (e.id === 'demon_lord' && e.hp > 0) {
        const ph = e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3;
        if (ph > e.phase) { e.phase = ph; this.banner = { text: ph === 2 ? '보드가 돌기 시작한다' : '바구니가 사라졌다', sub: `마왕 ${ph}단계`, t: 0, life: 1.6 }; F.flash(0.3, '#c06bff'); F.shake(12); A.play('breath'); }
      }
      return d;
    }
    async checkDeaths() {
      let any = false;
      for (const e of this.enemies) {
        if (e.dead || e.hp > 0) continue;
        if (e.id === 'skeleton' && !e.revived) { e.revived = true; e.hp = 10; e.burn = 0; e.poison = 0; F.text(e.x, C.footY - e.m.h - 10, '부활!', { size: 24, color: '#9fe3ff' }); continue; }
        this.kill(e); any = true;
      }
      if (any) await U.sleep(350);
    }
    kill(e) {
      e.dead = true; e.deathT = 0; A.play('death');
      F.burst(e.x, C.footY - e.m.h / 2, '#fff4dc', 18, 260, 12);
      const st = this.run.stats; st.kills = (st.kills || 0) + 1;
      if (e.id === 'treant') for (const p of this.board.pegs) p.blocked = false;
      if (e.id === 'mimic') this.gainGold(60, e.x, C.footY - 40);
    }
    gainGold(n, x, y) {
      this.run.gold += n; F.coin(x, y, n);
      this.run.stats.goldMax = Math.max(this.run.stats.goldMax || 0, this.run.gold);
      G.Run.checkGold(this.run);
    }
    heal(n) {
      const r = this.run; const h = Math.min(n, r.maxHp - r.hp); if (h <= 0) return;
      r.hp += h; F.text(C.heroX, 160, '+' + h, { size: 24, color: '#5be3a8' }); A.play('heal');
    }
    hurtHero(n, attacker, label) {
      if (n <= 0) return;
      const r = this.run;
      if (attacker && !this.mirrorUsed && this.relic('mirror_shield')) {
        this.mirrorUsed = true; F.text(C.heroX, 150, '반사!', { size: 26, color: '#cfe9ff' }); A.play('shield');
        this.damageEnemy(attacker, n, { kind: 'reflect' }); return;
      }
      r.hp -= n; this.hero.flash = 0.12; this.hero.hurtT = 0.3;
      F.text(C.heroX + 10, 170, '-' + n + (label ? ' ' + label : ''), { size: 28, color: '#ff6b5b' });
      F.shake(C.fx.shakeHurt); A.play('hurt'); U.vibrate(25); F.flash(0.12, '#ff3b3b');
      if (r.hp <= 0) {
        if (!r.flags.heartUsed && this.relic('dragon_heart')) { r.flags.heartUsed = true; r.hp = Math.ceil(r.maxHp / 2); F.text(C.heroX, 130, '용의 심장: 부활!', { size: 24, color: '#ffb347' }); A.play('refill'); }
        else r.hp = 0;
      }
    }

    // ---------- 적 턴 ----------
    async enemyTurn() {
      this.phase = 'enemy';
      const fireMage = this.run.char === 'fire_mage';
      let ticked = false;
      for (const e of this.alive()) {
        if (e.burn > 0) { this.damageEnemy(e, e.burn * (this.has('burning_gloves') ? 2 : 1), { kind: 'dot', color: '#ff9a4a' }); if (!fireMage) e.burn--; ticked = true; }
        if (e.poison > 0 && e.hp > 0) { this.damageEnemy(e, e.poison, { kind: 'dot', color: '#8dff6a' }); e.poison--; ticked = true; }
      }
      if (ticked) { await U.sleep(380); await this.checkDeaths(); }
      if (!this.alive().length) return 'win';
      const h = this.hero;
      if (h.poison > 0) { this.hurtHero(h.poison, null, '독'); h.poison--; await U.sleep(250); }
      if (h.burn > 0) { this.hurtHero(h.burn, null, '화상'); h.burn--; await U.sleep(250); }
      if (this.run.hp <= 0) return 'lose';

      const order = this.alive().sort((a, b) => a.pos - b.pos);
      for (const e of order) {
        if (e.dead) continue;
        e.stone = false; e.shield = 0;
        if (e.frozen > 0) { e.frozen--; F.text(e.x, C.footY - e.m.h - 8, '꽁꽁', { size: 18, color: '#9fe3ff' }); await U.sleep(220); e.turns++; continue; }
        await this.act(e, e.intent || this.decide(e));
        e.turns++;
        if (this.run.hp <= 0) return 'lose';
        await this.checkDeaths();
        if (!this.alive().length) return 'win';
      }
      // 보드 방해
      if (this.alive().some(e => e.id === 'dark_mage')) { this.board.jitter(); F.text(270, 640, '핀이 흔들린다', { size: 22, color: '#c08cff' }); await U.sleep(520); }
      const boss = this.alive().find(e => e.id === 'demon_lord');
      if (boss && boss.phase === 2) { this.board.rotate(22); await U.sleep(820); }
      return null;
    }
    async act(e, it) {
      const top = C.footY - e.m.h;
      if (it.shield) { e.shield = it.shield; F.text(e.x, top - 8, '방어막 ' + it.shield, { size: 18, color: '#9fb7ff' }); A.play('shield'); }
      switch (it.type) {
        case 'attack': {
          e.lunge = 0.3; await U.sleep(140);
          this.hurtHero(it.dmg, e); await U.sleep(320); break;
        }
        case 'charge': {
          if (e.pos > 1) { const f = this.front(); if (f && f !== e && f.pos === 1) { f.pos = e.pos; } e.pos = 1; }
          e.lunge = 0.35; await U.sleep(200); F.text(e.x, top - 10, '돌진!', { size: 24, color: '#ff8b7b' });
          this.hurtHero(it.dmg, e); F.shake(12); await U.sleep(400); break;
        }
        case 'move': {
          const steps = e.m.move || 1;
          for (let i = 0; i < steps; i++) if (e.pos > 1 && this.slotFree(e.pos - 1, e)) e.pos--;
          await U.sleep(240); break;
        }
        case 'spore': { this.hero.poison += 2; F.text(C.heroX, 150, '독 포자 +2', { size: 20, color: '#8dff6a' }); F.burst(C.heroX, 200, '#8dff6a', 14, 120); await U.sleep(360); break; }
        case 'thorn': { const pool = this.rng.shuffle(this.board.activeNormals()).slice(0, 2); for (const p of pool) { p.type = 'thorn'; p.pop = 0.5; F.ring(p.x, p.y, '#c06bff', 40); } F.text(e.x, top - 8, '가시 핀 설치', { size: 18, color: '#c06bff' }); A.play('thorn'); await U.sleep(420); break; }
        case 'root': { const pool = this.rng.shuffle(this.board.activeNormals()).slice(0, 3); for (const p of pool) { p.blocked = true; p.pop = 0.5; F.ring(p.x, p.y, '#8bd16b', 40); } F.text(e.x, top - 8, '뿌리!', { size: 22, color: '#8bd16b' }); await U.sleep(420); break; }
        case 'curse': { const pool = this.rng.shuffle(this.board.activeNormals()).slice(0, 3); for (const p of pool) { p.type = 'thorn'; p.pop = 0.5; F.ring(p.x, p.y, '#c06bff', 40); } F.text(e.x, top - 8, '저주: 가시 핀', { size: 20, color: '#c06bff' }); F.flash(0.2, '#c06bff'); A.play('thorn'); await U.sleep(450); break; }
        case 'guard': { await U.sleep(260); break; }
        case 'stone': { e.stone = true; F.text(e.x, top - 8, '석화', { size: 22, color: '#c9c3d6' }); A.play('shield'); await U.sleep(320); break; }
        case 'inhale': { F.text(e.x, top - 8, '숨을 크게 들이쉰다', { size: 18, color: '#ffb347' }); await U.sleep(380); break; }
        case 'breath': { A.play('breath'); F.flash(0.35, '#ff7a2f'); e.lunge = 0.4; await U.sleep(300); this.hurtHero(it.dmg, e, '브레스'); await U.sleep(400); break; }
        case 'burnpegs': { const pool = this.rng.shuffle(this.board.activeNormals()).slice(0, 4); for (const p of pool) { p.type = 'burn'; p.pop = 0.5; F.burst(p.x, p.y, '#ff7a2f', 8, 120); } F.text(270, 600, '핀이 불타오른다', { size: 22, color: '#ff9a4a' }); A.play('breath'); await U.sleep(450); break; }
        case 'absorb': {
          const allies = this.alive().filter(o => o !== e).sort((a, b) => a.hp - b.hp);
          const v = allies[0];
          if (v) { v.hp = 0; this.kill(v); e.atk += v.atk; F.zap(v.x, C.footY - v.m.h / 2, e.x, top + 30, '#8dff6a'); F.text(e.x, top - 8, '공격력 흡수 +' + v.atk, { size: 18, color: '#8dff6a' }); }
          await U.sleep(450); break;
        }
        default: await U.sleep(100);
      }
    }

    async win() {
      this.phase = 'over'; this.result = 'win';
      A.play('victory'); G.Meta.achieve('first_win');
      this.banner = { text: '승리!', sub: '', t: 0, life: 1.4 };
      await U.sleep(1100);
      G.Run.onBattleEnd(this, 'win');
    }
    async lose() {
      this.phase = 'over'; this.result = 'lose';
      A.play('gameover');
      this.banner = { text: '쓰러졌다…', sub: '', t: 0, life: 2 };
      await U.sleep(1500);
      G.Run.onBattleEnd(this, 'lose');
    }
  }
  Battle.PEG_COLORS = PEG_COLORS;
  G.Battle = Battle;
})();
