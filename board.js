// 핀 보드: 배치 생성, 물리, 궤적 미리보기
(function () {
  const C = G.CFG, U = G.U;
  const STEP = 1 / 240;
  const CX = 270, CY = 640; // 보드 중심 (회전 기준)

  class Board {
    constructor(battle) {
      this.b = battle; this.pegs = []; this.removed = []; this.pattern = 0; this.initialCount = 0;
      this.basket = { x: CX, dir: 1, gone: false }; this.time = 0; this.ptime = 0; this.nextId = 1;
      this.anim = null; // 핀 이동 애니메이션 (회전·흔들기)
    }

    // ---------- 배치 생성 ----------
    generate() {
      const rng = this.b.rng;
      const pat = this.pattern++ % 3;
      const pts = [];
      const add = (x, y) => {
        if (x < C.boardLeft + 26 || x > C.boardRight - 26 || y < 400 || y > 872) return;
        for (const p of pts) if (U.dist2(p.x, p.y, x, y) < 34 * 34) return;
        pts.push({ x, y });
      };
      if (pat === 0) { // 엇갈린 격자
        for (let r = 0; r < 10; r++) {
          const y = 412 + r * 51, off = r % 2 ? 28 : 0;
          for (let c = 0; c < 9; c++) add(54 + off + c * 56, y);
        }
      } else if (pat === 1) { // 다이아몬드 무리
        const centers = [[130, 480], [270, 470], [410, 480], [200, 640], [340, 640], [130, 800], [270, 800], [410, 800]];
        for (const [cx, cy] of centers) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) add(cx + i * 24 + j * 24, cy + j * 24 - i * 24);
        for (let i = 0; i < 12; i++) add(rng.int(60, 480), rng.int(420, 860));
      } else { // 고리와 호
        for (let ring = 0; ring < 4; ring++) {
          const rad = 70 + ring * 62, n = 6 + ring * 5;
          for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + ring * 0.3; add(CX + Math.cos(a) * rad, 640 + Math.sin(a) * rad * 0.95); }
        }
        for (let c = 0; c < 8; c++) { add(60 + c * 60, 420); add(80 + c * 58, 862); }
      }
      // 너무 많으면 무작위로 줄여 약 62개
      rng.shuffle(pts);
      while (pts.length > 64) pts.pop();
      const dwarf = this.b.run.char === 'dwarf_smith';
      this.pegs = pts.map(p => ({ id: this.nextId++, x: p.x, y: p.y, r: C.pegR, type: 'normal', lit: false, hp: dwarf ? 2 : 1, maxHp: dwarf ? 2 : 1, bombHp: 2, blocked: false, pop: 0, born: this.time, lastHit: -9, gone: false }));
      this.removed = [];
      this.initialCount = this.pegs.length;
      // 오래 남는 특수 핀: 폭탄, 골드
      const nb = this.b.has('bomb_pouch') ? 3 : 1;
      this.assign('bomb', nb); this.assign('gold', 1);
      this.rerollSpecials();
      this.b.onBoardGenerated && this.b.onBoardGenerated();
    }
    activeNormals() { return this.pegs.filter(p => !p.lit && !p.gone && p.type === 'normal' && !p.blocked); }
    assign(type, n) {
      const pool = this.b.rng.shuffle(this.activeNormals());
      for (let i = 0; i < n && i < pool.length; i++) { pool[i].type = type; pool[i].pop = 0.3; }
    }
    // 매 발마다 크리·리필 위치를 다시 뽑는다
    rerollSpecials() {
      for (const p of this.pegs) if (p.type === 'crit' || p.type === 'refill') p.type = 'normal';
      const b = this.b;
      let crits = 2 + (b.has('crit_lens') ? 1 : 0) + (b.run.char === 'goblin_gambler' ? 2 : 0);
      this.assign('crit', crits);
      this.assign('refill', b.has('refill_bell') ? 2 : 1);
    }
    activeCount() { return this.pegs.filter(p => !p.gone && !p.lit).length; }

    // 발이 끝나면 맞은 핀 제거. 30% 아래면 새 배치.
    clearLit() {
      for (const p of this.pegs) {
        if (p.lit && !p.gone) {
          if (p.type === 'bomb' && p.bombHp > 0 && !p.exploded) { p.lit = false; continue; }
          p.gone = true; p.goneT = this.time; this.removed.push(p);
        } else if (!p.lit && p.hp < p.maxHp) { /* 드워프: 한 번 맞은 핀은 그대로 */ }
      }
      const alive = this.pegs.filter(p => !p.gone);
      if (alive.length < this.initialCount * 0.3) { this.generate(); return true; }
      return false;
    }
    refillAll() {
      for (const p of this.pegs) {
        if (p.blocked) continue;
        if (p.gone || p.lit) { p.gone = false; p.lit = false; p.hp = p.maxHp; p.born = this.time; p.pop = 0.4; if (p.type === 'thorn' || p.type === 'burn') p.type = 'normal'; }
      }
      this.removed = [];
    }

    // 회전(마왕 2단계)과 흔들기(어둠 마법사)
    moveAll(fn, dur) {
      const from = this.pegs.map(p => ({ p, x: p.x, y: p.y }));
      const to = from.map(o => { const t = fn(o.p); return { x: U.clamp(t.x, C.boardLeft + 22, C.boardRight - 22), y: U.clamp(t.y, 396, 880) }; });
      this.anim = { from, to, t: 0, dur: dur || 0.6 };
    }
    rotate(deg) {
      const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      this.moveAll(p => ({ x: CX + (p.x - CX) * c - (p.y - CY) * s, y: CY + (p.x - CX) * s + (p.y - CY) * c }), 0.8);
    }
    jitter() {
      const rng = this.b.rng;
      this.moveAll(p => ({ x: p.x + rng.int(-16, 16), y: p.y + rng.int(-16, 16) }), 0.5);
    }
    updateAnim(dt) {
      this.time += dt;
      for (const p of this.pegs) if (p.pop > 0) p.pop = Math.max(0, p.pop - dt);
      const bk = this.basket;
      if (!bk.gone) {
        const w = this.basketW(), sp = C.basketSpeed * (this.b.has('clockwork') ? 0.5 : 1);
        bk.x += bk.dir * sp * dt;
        if (bk.x > C.boardRight - w / 2 - 4) { bk.x = C.boardRight - w / 2 - 4; bk.dir = -1; }
        if (bk.x < C.boardLeft + w / 2 + 4) { bk.x = C.boardLeft + w / 2 + 4; bk.dir = 1; }
      }
      if (this.anim) {
        const a = this.anim; a.t += dt; const k = U.easeOut(Math.min(1, a.t / a.dur));
        a.from.forEach((o, i) => { o.p.x = U.lerp(o.x, a.to[i].x, k); o.p.y = U.lerp(o.y, a.to[i].y, k); });
        if (a.t >= a.dur) this.anim = null;
      }
    }
    basketW() { return C.basketW * (this.b.has('clockwork') ? 1.3 : 1); }

    // ---------- 물리 ----------
    makeBall(angle, orbId, lv) {
      const sp = C.launchSpeed;
      const r = C.ballR * (orbId === 'giant_orb' ? 2 : 1);
      return {
        x: C.launchX, y: C.launchY, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r,
        orb: orbId, lv, grav: orbId === 'iron_orb' ? 1.55 : 1, pierce: orbId === 'pierce_orb' ? [5, 7, 9][lv - 1] : 0,
        ghost: orbId === 'ghost_orb', alive: true, rot: 0, trail: [], lastMove: { x: C.launchX, y: C.launchY, t: 0 }, age: 0, split: false, saved: false, id: Math.random(),
      };
    }

    // 한 단계 진행. hit 콜백: (peg, ball) / wall: (ball) / basket: (ball) / lost: (ball)
    stepBall(b, dt, cb, sim) {
      b.vy += C.gravity * b.grav * dt;
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      b.rot += (b.vx * dt) / b.r;
      // 벽
      if (b.ghost) {
        if (b.x < C.boardLeft) b.x += C.boardRight - C.boardLeft; else if (b.x > C.boardRight) b.x -= C.boardRight - C.boardLeft;
      } else {
        if (b.x < C.boardLeft + b.r) { b.x = C.boardLeft + b.r; b.vx = Math.abs(b.vx) * C.restWall; cb.wall && cb.wall(b); }
        else if (b.x > C.boardRight - b.r) { b.x = C.boardRight - b.r; b.vx = -Math.abs(b.vx) * C.restWall; cb.wall && cb.wall(b); }
      }
      if (b.y < C.boardTop + b.r) { b.y = C.boardTop + b.r; b.vy = Math.abs(b.vy) * C.restWall; }
      // 핀
      for (let i = 0; i < this.pegs.length; i++) {
        const p = this.pegs[i]; if (p.gone) continue;
        const rr = b.r + p.r, dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
        // 관통: 아직 남았으면 튕기지 않고 지나감
        if (b.pierce > 0 && !p.blocked) {
          if (!p.lit && (sim ? !sim.seen.has(p.id) : this.ptime - p.lastHit > 0.12)) { b.pierce--; cb.hit && cb.hit(p, b); }
          continue;
        }
        b.x = p.x + nx * rr; b.y = p.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          const e = C.restPeg;
          b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
          // 아주 조금 옆으로 미끄러지게 해서 핀 꼭대기에 멈추지 않게
          if (Math.abs(nx) < 0.04) b.vx += (b.vx >= 0 ? 1 : -1) * 18;
          cb.hit && cb.hit(p, b);
        }
      }
      // 바구니
      const bk = this.basket;
      if (!bk.gone && oy < C.basketY && b.y >= C.basketY && Math.abs(b.x - bk.x) < this.basketW() / 2) { b.alive = false; cb.basket && cb.basket(b); return; }
      if (b.y > C.H + b.r) { cb.lost && cb.lost(b); }
    }

    // 궤적 미리보기: 첫 핀에 닿는 지점까지 + 튕겨 나갈 방향만 짧게
    preview(angle, orbId, lv) {
      const b = this.makeBall(angle, orbId, lv);
      const pts = [{ x: b.x, y: b.y }];
      const sim = { seen: new Set() };
      let hit = null, after = 0, done = false;
      const cb = {
        hit: (p) => { if (!hit) { sim.seen.add(p.id); hit = { x: b.x, y: b.y, n: pts.length }; } },
        basket: () => { done = true; }, lost: () => { done = true; },
      };
      for (let i = 0; i < 240 * 3 && !done; i++) {
        this.stepBall(b, STEP, cb, sim);
        if (hit && ++after > 22) break; // 튕긴 뒤 약 0.09초만
        if (i % 3 === 0) pts.push({ x: b.x, y: b.y });
      }
      pts.push({ x: b.x, y: b.y });
      pts.hit = hit;
      return pts;
    }
  }
  Board.STEP = STEP;
  G.Board = Board;
})();
