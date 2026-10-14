'use strict';
// =============================================================================
// SQUARED OFF - World: vòng lặp trận đấu, va chạm, projectile, throw, round
// =============================================================================
(function () {
  const SO = window.SO;
  const C = SO.CFG;
  let projId = 0;

  class World {
    constructor(p1, p2, mode) {
      this.mode = mode; // 'versus' | 'training'
      this.training = mode === 'training';
      this.f = [new SO.Fighter(this, 0, p1), new SO.Fighter(this, 1, p2)];
      this.frame = 0;
      this.score = [0, 0];
      this.round = 1;
      this.dummy = { stance: 'stand', block: 'none', tech: true, refill: true, p1Meter: false };
      this.stats = { lastAdv: null, lastMove: [null, null], comboDmg: 0, comboHits: 0, comboShowT: 0 };
      this.startRound();
    }

    startRound() {
      const mid = C.STAGE_W / 2;
      this.f[0].resetRound(mid - 230, 1);
      this.f[1].resetRound(mid + 230, -1);
      this.projs = [];
      this.fx = [];
      this.parts = [];
      this.screenFlash = null;
      this.quake = 0;
      this.eq = 0;
      this.timer = C.ROUND_TIME * 60;
      this.freeze = 0;
      this.flash = null;
      this.grab = null;
      this.koSlow = 0;
      this.phase = this.training ? 'fight' : 'intro';
      this.phaseT = 0;
      this.winner = -1;
      this.rnd = 0;
    }

    // ---------------------------------------------------------------- Equilibrium
    res(i) { return i === 0 ? (this.eq + 100) / 2 : (100 - this.eq) / 2; }
    gain(i, amt) {
      const lim = 100 - 2 * C.EQ_FLOOR; // 50
      this.eq = SO.clamp(this.eq + (i === 0 ? 2 * amt : -2 * amt), -lim, lim);
    }
    spend(i, amt) {
      if (this.res(i) < amt - 1e-6) return false;
      this.gain(i, -amt);
      return true;
    }

    // ---------------------------------------------------------------- input
    inputFor(i) {
      if (this.training && i === 1 && this.dummy.stance !== 'manual') return this.dummyInput();
      if (this.cpuInput && this.cpuInput[i]) return this.cpuInput[i](this, i);
      return SO.readRaw(i);
    }
    dummyInput() {
      const d = this.f[1], a = this.f[0], set = this.dummy;
      const r = { up: false, down: false, left: false, right: false, L: false, M: false, H: false, U: false, pause: false };
      if (set.stance === 'crouch') r.down = true;
      if (set.stance === 'jump' && (d.state === 'idle' || d.state === 'land' || d.state === 'walk')) r.up = true;
      let block = set.block === 'all' || (set.block === 'after' && d.blockArm > 0) || (set.block === 'random' && this.rnd < 0.5);
      if (block && (d.threatened() || d.state === 'block')) {
        let srcX = a.x;
        const near = this.projs.find((p) => p.owner === a && !p.dead);
        if (near && !(a.state === 'attack')) srcX = near.x;
        if (srcX < d.x) r.right = true; else r.left = true;
        let blk = a.move ? a.move.d.blk : 'Mid';
        if (near && a.state !== 'attack') blk = near.inst.d.blk;
        if (blk === 'Low') r.down = true;
        else if (blk === 'High') r.down = false;
        r.up = false;
      }
      if (set.tech && d.state === 'airhit' && d.sf >= d.untech) r.L = this.frame % 2 === 0;
      return r;
    }

    // ---------------------------------------------------------------- main step
    step() {
      this.frame++;
      for (const f of this.f) f.readInput(this.inputFor(f.idx));
      this.updateFx();
      if (this.phase === 'intro') {
        this.phaseT++;
        for (const f of this.f) { f.vx = 0; f.faceOpp(); }
        if (this.phaseT >= 100) { this.phase = 'fight'; this.phaseT = 0; }
        return;
      }
      if (this.phase === 'roundEnd' || this.phase === 'matchEnd') {
        this.phaseT++;
      }
      if (this.freeze > 0) {
        this.freeze--;
        if (this.freeze === 0) this.flash = null;
        return;
      }
      if (this.koSlow > 0) {
        this.koSlow--;
        if (this.koSlow % 3) return;
      }
      for (const f of this.f) f.px = f.x;
      for (const f of this.f) f.tick();
      this.updateGrab();
      for (const p of this.projs) this.updateProj(p);
      SO.FXR.tick(this);
      for (const f of this.f) if (f.G.worldUpdate) f.G.worldUpdate(f);
      this.resolvePush();
      this.resolveCombat();
      this.projs = this.projs.filter((p) => !p.dead);
      this.gauges();
      this.rounds();
    }

    hitstopBoth(n) {
      for (const f of this.f) f.hitstop = Math.max(f.hitstop, n);
    }
    superFlash(f, m) {
      this.freeze = C.SUPER_FLASH;
      this.flash = { owner: f, t: 0, name: m.name };
      this.fx.push({ type: 'text', x: f.x, y: f.y + 260, text: m.name.toUpperCase(), t: 0, life: 50, big: true });
    }

    onMoveStart(f, inst) {
      this.stats.lastMove[f.idx] = { inst, startFrame: this.frame };
      if (f.idx === 0 && this.dummy.block === 'random') this.rnd = Math.random();
    }
    onRecover(f, prev) {
      if (prev === 'hitstun' || prev === 'airhit' || prev === 'knockdown' || prev === 'wakeup') f.blockArm = 50;
      // frame advantage: khi người bị đánh/block thoát stun, so với người tấn công
      if (prev === 'block' || prev === 'hitstun') {
        this.advPending = { def: f.idx, frame: this.frame };
      }
    }

    // ---------------------------------------------------------------- push / walls
    resolvePush() {
      const [a, b] = this.f;
      const lo = (f) => 80 + f.c.w / 2, hi = (f) => C.STAGE_W - 80 - f.c.w / 2;
      const pass = (f) => (f.state === 'attack' && f.move && f.move.d.tags.has('PassThrough') && f.mf >= f.move.su - 1 && f.mf < (f.move.act > 0 ? f.move.su + f.move.act + 6 : f.move.total)) || f.vanish;
      if (!this.grab && !pass(a) && !pass(b) && a.state !== 'ko' && b.state !== 'ko') {
        const pa = a.pushbox(), pb = b.pushbox();
        if (SO.overlap(pa, pb)) {
          const ov = (pa.w + pb.w) / 2 - Math.abs(pa.cx - pb.cx);
          let dir = SO.sign(b.x - a.x);
          if (dir === 0) dir = a.facing;
          a.x -= (dir * ov) / 2;
          b.x += (dir * ov) / 2;
        }
      }
      for (const f of this.f) f.x = SO.clamp(f.x, lo(f), hi(f));
      // lại đẩy sau khi chạm tường
      if (!this.grab && !pass(a) && !pass(b)) {
        const pa = a.pushbox(), pb = b.pushbox();
        if (SO.overlap(pa, pb)) {
          const ov = (pa.w + pb.w) / 2 - Math.abs(pa.cx - pb.cx);
          let dir = SO.sign(b.x - a.x) || a.facing;
          if (a.x <= lo(a) + 1 || a.x >= hi(a) - 1) b.x += dir * ov;
          else a.x -= dir * ov;
          for (const f of this.f) f.x = SO.clamp(f.x, lo(f), hi(f));
        }
      }
      // mép màn hình: camera cố định zoom nên hai người không thể xa nhau quá bề rộng khung nhìn.
      // Ai đang di chuyển ra xa thì bị chặn (như đụng tường), người kia không bị kéo theo.
      const maxD = C.VIEW_W - a.c.w * 0.5 - b.c.w * 0.5 - C.SCREEN_MARGIN * 2;
      const d = b.x - a.x;
      if (Math.abs(d) > maxD) {
        const over = Math.abs(d) - maxD;
        const s = SO.sign(d) || 1;
        const awayA = Math.max(0, -(a.x - (a.px ?? a.x)) * s), awayB = Math.max(0, (b.x - (b.px ?? b.x)) * s);
        const tot = awayA + awayB;
        const ka = tot > 0 ? awayA / tot : 0.5;
        a.x += s * over * ka;
        b.x -= s * over * (1 - ka);
        for (const f of this.f) f.x = SO.clamp(f.x, lo(f), hi(f));
      }
    }

    // ---------------------------------------------------------------- projectiles
    spawnProj(f, inst) {
      const d = inst.d;
      const kind = d.kv.Proj;
      const count = Math.max(1, +d.kv.Count || 1);
      for (let k = 0; k < count; k++) {
        const p = this.makeProj(f, inst, kind, k, count);
        if (p) this.projs.push(p);
      }
      if (f.G.onSpawn) f.G.onSpawn(f, inst);
    }
    makeProj(f, inst, kind, k, count, override) {
      const d = inst.d, fc = f.facing, hb = inst.hb;
      const p = {
        id: ++projId, owner: f, inst, kind, t: 0, delay: 0, life: Math.max(1, inst.act),
        hitsLeft: Math.max(1, Math.round(inst.hits / count)), cool: 0, hitstop: 0, facing: fc,
        w: hb.w, h: hb.h, x: 0, y: 0, vx: 0, vy: 0, dead: false, boosted: false, clash: false,
        color: f.c.color,
      };
      const dist = +d.kv.Dist || 0, gap = +d.kv.Gap || 0, stepF = +d.kv.Step || 0, delayK = +d.kv.Delay || 0;
      switch (kind) {
        case 'straight': case 'orb':
          p.x = f.x + fc * hb.x; p.y = f.y + hb.y; p.vx = fc * d.spd; p.clash = true; p.delay = k * stepF;
          if (kind === 'orb') p.hitsLeft = Math.max(1, Math.round(inst.hits / count));
          break;
        case 'disc':
          p.x = f.x + fc * (hb.x + k * 40); p.y = hb.y; p.vx = fc * d.spd; p.clash = true; p.delay = k * stepF;
          break;
        case 'angled': {
          const a = ((+d.kv.Angle || 0) * Math.PI) / 180;
          p.x = f.x + fc * hb.x; p.y = f.y + hb.y; p.vx = fc * d.spd * Math.cos(a); p.vy = d.spd * Math.sin(a); p.clash = true;
          break;
        }
        case 'bomb':
          p.x0 = f.x + fc * 40; p.y0 = f.y + hb.y;
          p.x = f.x + fc * dist; p.y = Math.max(hb.y, f.y + hb.y * 0.6);
          p.fuse = +d.kv.Fuse || 15; p.delay = p.fuse + k * stepF; p.travel = true;
          break;
        case 'pillar': case 'wave':
          p.x = f.x + fc * (dist + k * gap); p.y = hb.y; p.delay = delayK + k * stepF; p.warn = true;
          break;
        case 'cloud':
          p.x = f.x + fc * dist; p.y = hb.y;
          break;
        case 'beam':
          p.anchor = true; p.offX = hb.x + hb.w / 2; p.offY = hb.y; p.x = f.x + fc * p.offX; p.y = f.y + hb.y;
          break;
        case 'burst':
          p.anchor = true; p.offX = hb.x; p.offY = hb.y; p.x = f.x + fc * hb.x; p.y = f.y + hb.y;
          break;
        case 'rain': {
          const o = f.opp, spread = +d.kv.Spread || 0;
          p.x = o.x + (k - (count - 1) / 2) * spread; p.y = 950 + k * 30; p.vy = -28; p.delay = k * stepF;
          p.life = inst.act + 45; p.fall = true;
          break;
        }
        case 'line':
          break;
        default:
          p.x = f.x + fc * hb.x; p.y = f.y + hb.y; p.vx = fc * d.spd;
      }
      if (kind === 'wave') {
        p.hitsLeft = 1;
      }
      // projectile có tag Fullscreen bay tới hết màn hình (Active chỉ còn ý nghĩa hiển thị)
      if (d.tags.has('Fullscreen') && (kind === 'straight' || kind === 'angled' || kind === 'orb')) p.life = 400;
      if (d.kv.Life) p.life = +d.kv.Life;
      // Arm=N: projectile hiện ra nhưng chưa gây sát thương trong N frame (đĩa đặt bẫy của Triangle)
      p.arm = +d.kv.Arm || 0;
      p.life += p.arm;
      p.friction = +d.kv.Friction || 1;
      if (override) Object.assign(p, override);
      const multi = ['orb', 'cloud', 'beam', 'pillar', 'burst', 'wave', 'line', 'rain'].includes(kind);
      p.interval = multi || p.arm ? Math.max(3, Math.floor((p.life - (p.arm || 0)) / Math.max(1, p.hitsLeft))) : 6;
      if (kind === 'pillar' && p.hitsLeft > 1) p.interval = Math.max(3, Math.floor(p.life / p.hitsLeft));
      return p;
    }
    projActive(p) { return !p.dead && p.delay <= 0 && p.t >= (p.arm || 0); }
    updateProj(p) {
      if (p.dead) return;
      if (p.hitstop > 0) { p.hitstop--; return; }
      if (p.delay > 0) { p.delay--; return; }
      p.t++;
      const o = p.owner;
      if (p.anchor) {
        p.x = o.x + o.facing * p.offX;
        p.y = o.y + p.offY;
        p.facing = o.facing;
        if (o.state === 'hitstun' || o.state === 'airhit' || o.state === 'thrown') p.dead = true;
      }
      if (p.friction !== 1) p.vx *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      if (p.fall && p.y - p.h / 2 <= 0) { p.y = p.h / 2; p.vy = 0; if (!p.landed) { p.landed = true; p.life = Math.min(p.life, 14); this.fx.push({ type: 'dust', x: p.x, y: 0, t: 0, life: 16, big: true }); } }
      if (p.kind === 'angled' && p.y <= 8) { p.dead = true; this.fx.push({ type: 'spark', x: p.x, y: 10, t: 0, life: 10, color: p.color, size: 30 }); }
      if (p.cool > 0) p.cool--;
      if (p.kind === 'orb' && p.inst.d.tags.has('Push')) {
        const d = o.opp;
        if (Math.abs(d.x - p.x) < p.w / 2 + 40 && d.y < p.y + p.h / 2) d.x += SO.sign(p.vx) * 1.5;
      }
      if (p.kind === 'cloud' && p.inst.d.tags.has('BlockProj')) {
        for (const q of this.projs) if (q.owner !== o && q.clash && !q.dead && Math.abs(q.x - p.x) < p.w / 2 && Math.abs(q.y - p.y) < p.h / 2) { q.dead = true; this.fx.push({ type: 'spark', x: q.x, y: q.y, t: 0, life: 10, color: '#ccc', size: 30 }); }
      }
      p.life--;
      if (p.life <= 0) p.dead = true;
      if (p.x < -200 || p.x > C.STAGE_W + 200) p.dead = true;
    }
    projBox(p) {
      return { cx: p.x, cy: p.y, w: p.w, h: p.h };
    }
    projHits(p, box) {
      if (p.kind === 'line') {
        for (let s = 0; s <= 14; s++) {
          const x = p.x1 + ((p.x2 - p.x1) * s) / 14, y = p.y1 + ((p.y2 - p.y1) * s) / 14;
          if (Math.abs(x - box.cx) * 2 < box.w + p.thick && Math.abs(y - box.cy) * 2 < box.h + p.thick) return true;
        }
        return false;
      }
      return SO.overlap(this.projBox(p), box);
    }

    // ---------------------------------------------------------------- combat
    resolveCombat() {
      const contacts = [];
      for (const a of this.f) {
        const d = a.opp;
        if (a.state === 'ko') continue;
        const hb = a.activeHitbox();
        if (hb) {
          const cylHit = d.G.puppetHurt && d.G.puppetHurt(d, hb.box);
          if (cylHit) {
            a.hitIdx = hb.idx;
            a.contact = a.contact || 'hit';
            a.hitstop = 6;
            d.G.puppetStun(d);
          } else if (!d.isInvuln('strike') && d.state !== 'ko' && d.hurtboxes().some((h) => SO.overlap(hb.box, h))) {
            contacts.push({ type: 'strike', att: a, def: d, inst: a.move, idx: hb.idx, srcX: a.x, box: hb.box });
          }
        }
        if (a.G.puppetHit) {
          const ph = a.G.puppetHit(a);
          if (ph && !d.isInvuln('strike') && d.state !== 'ko' && d.hurtboxes().some((h) => SO.overlap(ph.box, h))) {
            contacts.push({ type: 'puppet', att: a, def: d, inst: ph.inst, idx: ph.idx, srcX: ph.x, box: ph.box, cyl: ph.cyl });
          }
        }
      }
      for (const p of this.projs) {
        if (!this.projActive(p) || p.cool > 0 || p.hitsLeft <= 0) continue;
        const o = p.owner, d = o.opp;
        if (d.G.puppetHurt && d.G.puppetHurt(d, this.projBox(p))) {
          d.G.puppetStun(d);
          p.hitsLeft--; p.cool = p.interval;
          if (p.hitsLeft <= 0 && p.clash) p.dead = true;
          continue;
        }
        if (d.state === 'ko' || d.isInvuln('proj')) continue;
        if (d.hurtboxes().some((h) => this.projHits(p, h))) {
          const srcX = p.anchor || p.kind === 'line' || p.kind === 'pillar' || p.kind === 'wave' || p.kind === 'cloud' || p.kind === 'rain' || p.kind === 'bomb' ? (p.kind === 'line' ? (p.x1 + p.x2) / 2 : p.anchor ? o.x : p.x) : p.x - SO.sign(p.vx || p.facing) * 30;
          contacts.push({ type: 'proj', att: o, def: d, inst: p.inst, proj: p, srcX: srcX === d.x ? o.x : srcX, box: this.projBox(p) });
        }
      }
      // projectile đụng nhau
      for (let i = 0; i < this.projs.length; i++) {
        const p = this.projs[i];
        if (!p.clash || !this.projActive(p) || p.dead) continue;
        for (let j = i + 1; j < this.projs.length; j++) {
          const q = this.projs[j];
          if (!q.clash || q.owner === p.owner || !this.projActive(q) || q.dead) continue;
          if (SO.overlap(this.projBox(p), this.projBox(q))) {
            p.hitsLeft--; q.hitsLeft--;
            if (p.hitsLeft <= 0) p.dead = true;
            if (q.hitsLeft <= 0) q.dead = true;
            p.hitstop = q.hitstop = 4;
            this.fx.push({ type: 'spark', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, t: 0, life: 12, color: '#888', size: 50 });
          }
        }
      }
      for (const c of contacts) this.applyContact(c);
    }

    applyContact(c) {
      const { att, def, inst } = c;
      const d = inst.d;
      if (c.type === 'strike') att.hitIdx = c.idx;
      if (c.type === 'puppet' && c.cyl) c.cyl.hitIdx = c.idx;
      if (c.proj) { c.proj.hitsLeft--; c.proj.cool = c.proj.interval; }
      // parry (Octagon)
      if (def.G.parry && def.G.parry(def, att, c)) {
        this.afterProj(c);
        return;
      }
      // auto-guard
      if (def.state === 'attack' && def.move && def.move.d.kv.AutoGuard && d.type !== 'Super' && d.type !== 'Throw') {
        const r = SO.range(def.move.d.kv.AutoGuard);
        if (r && def.mf >= r[0] && def.mf <= r[1]) {
          const fu = def.c.byId[def.move.d.kv.Followup];
          def.hitstop = 8;
          if (c.type === 'strike') { att.hitstop = 8; att.contact = 'block'; }
          if (fu) def.startMove(fu, { force: true });
          this.fx.push({ type: 'text', x: def.x, y: def.y + 220, text: 'GUARD!', t: 0, life: 30 });
          this.fx.push({ type: 'block', x: (c.box.cx + def.x) / 2, y: c.box.cy, t: 0, life: 12, color: '#fff' });
          this.afterProj(c, true);
          return;
        }
      }
      // armor
      if (def.state === 'attack' && def.move && def.move.armorLeft > 0 && def.mf <= def.move.su + Math.max(0, def.move.act - 1) &&
          d.type !== 'Super' && armorOK(def.move.armorVs, d.blk)) {
        def.move.armorLeft--;
        let dmg = Math.round((d.dmg / inst.hits) * inst.dmgMul * 0.8);
        def.takeDamage(dmg);
        if (c.type === 'strike') { att.hitstop = d.hsa; att.contact = 'block'; }
        def.hitstop = d.hsd;
        this.fx.push({ type: 'spark', x: c.box.cx, y: c.box.cy, t: 0, life: 12, color: '#a0a', size: 60 });
        this.fx.push({ type: 'text', x: def.x, y: def.y + 230, text: 'ARMOR', t: 0, life: 30 });
        this.koCheck(def, att);
        this.afterProj(c);
        return;
      }
      if (this.wantsBlock(def, c, d)) this.doBlock(c);
      else this.doHit(c);
      this.afterProj(c);
    }
    afterProj(c, kill) {
      const p = c.proj;
      if (!p) return;
      if (kill || p.hitsLeft <= 0) {
        if (p.clash || kill) p.dead = true;
        else p.hitsLeft = 0;
      }
    }

    wantsBlock(def, c, d) {
      if (d.blk === 'Unblockable') return false;
      if (!def.canBlockNow()) return false;
      if (!def.holdingAwayFrom(c.srcX)) return false;
      if (!def.isAir()) {
        const crouch = def.inp.rel === 1;
        if (d.blk === 'High' && crouch) return false;
        if (d.blk === 'Low' && !crouch) return false;
      }
      return true;
    }

    doBlock(c) {
      const { att, def, inst } = c;
      const d = inst.d;
      const ib = def.inp.frame - def.inp.backStartT <= C.IB_WINDOW && def.state !== 'block';
      const fd = def.inp.heldCount() >= 2 && this.res(def.idx) > C.EQ_FLOOR + 0.01;
      let stun = def.stunBase(inst, true);
      if (ib) stun -= C.IB_STUN;
      const air = def.isAir();
      def.crouchBlock = !air && def.inp.rel === 1;
      def.airBlock = air;
      def.setState('block');
      def.stun = Math.max(C.MIN_STUN, stun);
      def.fd = fd;
      if (!fd && d.chip > 0) {
        const chip = Math.max(1, Math.round((d.chip / inst.hits) * inst.dmgMul));
        def.hp -= chip;
      }
      const dir = SO.sign(def.x - c.srcX) || att.facing;
      const push = d.kbx * C.KBX_GROUND * (fd ? C.FD_PUSH : 1) * 0.9;
      def.vx = dir * push;
      if (air) def.vy = Math.max(def.vy, 2);
      if (c.type === 'strike' && def.atWall(dir)) att.pushV = -dir * push * 0.8;
      this.gain(att.idx, d.gain * 0.5);
      if (ib) {
        this.gain(def.idx, C.IB_GAIN);
        this.fx.push({ type: 'text', x: def.x, y: def.y + 220, text: 'INSTANT BLOCK', t: 0, life: 30 });
      }
      if (c.type === 'strike') { att.contact = att.contact || 'block'; att.hitstop = d.hsa; }
      else if (c.type === 'puppet' && c.cyl) { c.cyl.hitstop = d.hsa; c.cyl.contact = c.cyl.contact || 'block'; }
      def.hitstop = d.hsd;
      if (c.proj) c.proj.hitstop = Math.min(d.hsd, 6);
      this.fx.push({ type: 'block', x: c.box.cx - SO.sign(c.box.cx - def.x) * c.box.w * 0.3, y: c.box.cy, t: 0, life: 12, color: fd ? '#5c5' : '#5af', dir: -dir });
      SO.FXR.onBlock(this, c, fd);
      if (att.G.onContact) att.G.onContact(att, inst, 'block', c);
      if (def.hp <= 0) { def.hp = 0; this.koCheck(def, att); }
    }

    doHit(c) {
      const { att, def, inst } = c;
      const d = inst.d;
      const ch = def.state === 'attack' && def.move && def.mf < def.move.su + def.move.act && def.move.d.type !== 'Burst' && def.move.d.type !== 'Throw';
      if (def.combo.hits === 0) { def.combo.scale = 1; def.combo.dmg = 0; }
      const wasCrouch = def.isCrouchPose() && !def.isAir();
      let dmg = 0;
      if (d.dmg > 0) {
        dmg = Math.max(1, Math.round((d.dmg / inst.hits) * inst.dmgMul * def.combo.scale * (ch ? C.CH_DMG : 1)));
      }
      def.takeDamage(dmg);
      def.combo.scale = Math.max(C.PRORATION_FLOOR, def.combo.scale * d.pr);
      def.combo.hits++;
      def.combo.dmg += dmg;
      def.burst = Math.min(100, def.burst + dmg * C.BURST_ON_DMG);
      const away = SO.sign(def.x - c.srcX) || att.facing;
      const freeze = +d.kv.Freeze || 0;
      const airborneHit = def.isAir() || d.kbt === 'Launch' || d.kbt === 'Knockdown' || d.kbt === 'Hard_Knockdown';
      def.move = null;
      def.moveAir = false;
      def.guard = false;
      def.vanish = false;
      if (!airborneHit) {
        def.setState('hitstun');
        def.crouchHit = wasCrouch;
        def.stun = Math.max(C.MIN_STUN, def.stunBase(inst, false) + (wasCrouch ? C.CROUCH_HITSTUN : 0) + (ch ? C.CH_HITSTUN : 0) + freeze - Math.floor(def.combo.hits / 8));
        def.vx = away * d.kbx * C.KBX_GROUND;
        def.vy = 0;
      } else {
        def.setState('airhit');
        def.kdType = d.kbt;
        if (d.kby > 0) def.vy = d.kby * C.KBY;
        else def.vy = def.y > 0 ? 7 : 6;
        def.vx = away * Math.max(0.5, d.kbx) * C.KBX_AIR;
        let unt = d.unt > 0 ? d.unt : def.stunBase(inst, false) + 8;
        unt += freeze + (ch ? C.CH_HITSTUN : 0);
        unt = Math.round(unt * Math.max(C.JUGGLE_MIN, 1 - C.JUGGLE_DECAY * (def.combo.hits - 1)));
        def.untech = Math.max(6, unt);
        def.y = Math.max(def.y, 1);
        if (d.tags.has('WallBounce') || (d.tags.has('WallBounceCorner') && def.nearWall(180))) def.wallBounce = true;
      }
      if (c.type === 'strike' && !def.isAir() && def.atWall(away)) att.pushV = -away * d.kbx * C.KBX_GROUND * 0.8;
      if (c.type === 'strike') { att.contact = 'hit'; att.hitstop = d.hsa; }
      else if (c.type === 'puppet' && c.cyl) { c.cyl.hitstop = d.hsa; c.cyl.contact = 'hit'; }
      def.hitstop = d.hsd;
      if (c.proj) c.proj.hitstop = Math.min(d.hsd, 6);
      this.gain(att.idx, d.gain);
      if (ch) this.fx.push({ type: 'text', x: def.x, y: def.y + 240, text: 'COUNTER', t: 0, life: 40, color: '#d22' });
      this.fx.push({ type: 'hit', x: c.box.cx - SO.sign(c.box.cx - def.x) * c.box.w * 0.25, y: c.box.cy, t: 0, life: 14, size: 18 + Math.min(40, dmg * 0.6), color: ch ? '#d22' : '#222' });
      SO.FXR.onHit(this, c, dmg, ch);
      this.stats.comboDmg = def.combo.dmg;
      this.stats.comboHits = def.combo.hits;
      this.stats.comboOwner = att.idx;
      this.stats.comboShowT = 120;
      if (att.G.onContact) att.G.onContact(att, inst, 'hit', c);
      this.koCheck(def, att);
    }

    koCheck(def, att) {
      if (def.hp > 0) return;
      if (this.training) { def.hp = 1; return; }
      if (this.phase !== 'fight') { def.hp = Math.max(def.hp, 1); return; }
      def.hp = 0;
      def.ko = true;
      def.move = null;
      if (def.state !== 'airhit') {
        def.setState('airhit');
        def.vy = 9;
        def.vx = SO.sign(def.x - att.x) * 5;
      }
      def.kdType = 'Hard_Knockdown';
      def.y = Math.max(1, def.y);
      this.koSlow = 90;
      SO.FXR.onKO(this);
      this.endRound(att.idx, 'K.O.');
    }

    endRound(winner, text) {
      this.phase = 'roundEnd';
      this.phaseT = 0;
      this.winner = winner;
      this.endText = text;
      if (winner >= 0) this.score[winner]++;
      this.fx.push({ type: 'banner', text, t: 0, life: 120 });
    }

    rounds() {
      if (this.phase === 'fight' && !this.training) {
        this.timer--;
        if (this.timer <= 0) {
          this.timer = 0;
          const r0 = this.f[0].hp / this.f[0].c.hp, r1 = this.f[1].hp / this.f[1].c.hp;
          const w = r0 > r1 ? 0 : r1 > r0 ? 1 : -1;
          this.endRound(w, 'TIME OVER');
        }
      }
      if (this.phase === 'roundEnd' && this.phaseT > 200) {
        if (this.score[0] >= C.ROUNDS_TO_WIN || this.score[1] >= C.ROUNDS_TO_WIN) {
          this.phase = 'matchEnd';
          this.phaseT = 0;
        } else {
          this.round++;
          this.startRound();
        }
      }
    }

    gauges() {
      for (const f of this.f) {
        if (f.burst < 100) f.burst = Math.min(100, f.burst + C.BURST_REGEN);
      }
      if (this.stats.comboShowT > 0) this.stats.comboShowT--;
      // frame advantage
      if (this.advPending) {
        const defI = this.advPending.def, def = this.f[defI], att = this.f[1 - defI];
        const attFree = att.state !== 'attack' && att.state !== 'land' && att.state !== 'recoil';
        if (attFree) {
          const attFreeFrame = att.freeAt || this.frame;
          this.stats.lastAdv = this.advPending.frame - attFreeFrame;
          this.advPending = null;
        } else if (this.frame - this.advPending.frame > 120) this.advPending = null;
      }
      for (const f of this.f) {
        const free = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'air';
        if (free && !f.wasFree) f.freeAt = this.frame;
        f.wasFree = free;
      }
      if (this.training) {
        const [p1, p2] = this.f;
        if (this.dummy.p1Meter) this.eq = Math.max(this.eq, 50);
        if (this.dummy.refill) {
          const calm = (f) => (f.state === 'idle' || f.state === 'crouch' || f.state === 'walk') && f.sf > 40;
          if (calm(p2) && calm(p1)) {
            p2.hp = p2.c.hp; p2.gray = 0; p1.hp = p1.c.hp; p1.gray = 0;
            p1.burst = 100; p2.burst = 100;
            if (!this.dummy.p1Meter) this.eq = 0;
          }
        }
      }
    }

    // ---------------------------------------------------------------- throws
    tryGrab(att, inst) {
      const def = att.opp, d = inst.d;
      if (att.grabbed || this.grab) return;
      const isAirGrab = d.type === 'AirGrab';
      if (def.state === 'ko' || def.state === 'knockdown' || def.state === 'wakeup' || def.state === 'thrown') return;
      if (isAirGrab) {
        if (!def.isAir() || def.state === 'airhit' || def.invT > 0 || def.vanish) return;
        if (def.state === 'attack' && def.move && def.move.d.inv && def.mf >= def.move.d.inv[0] && def.mf <= def.move.d.inv[1] && def.move.d.invType === 'Full') return;
      } else {
        if (def.isInvuln('throw')) return;
        if (def.state === 'prejump' && def.sf >= 2) return;
      }
      let inRange;
      if (d.type === 'Throw') inRange = Math.abs(def.x - att.x) <= att.c.throwR && Math.abs(def.y - att.y) < 40;
      else {
        const box = { cx: att.x + att.facing * inst.hb.x, cy: att.y + inst.hb.y, w: inst.hb.w, h: inst.hb.h };
        inRange = def.hurtboxes().some((h) => SO.overlap(box, h));
      }
      if (!inRange) return;
      // throw tech khi cả hai cùng throw
      if (d.type === 'Throw' && def.state === 'attack' && def.move && def.move.d.type === 'Throw' && def.mf >= def.move.su - 1 && !def.grabbed) {
        this.techBoth(att, def);
        return;
      }
      att.grabbed = true;
      this.grab = {
        att, def, inst, t: 0, dur: +d.kv.Grab || 20,
        breakable: d.type === 'Throw', back: att.inp.isBack(), air: isAirGrab, gy: def.y,
      };
      att.setState('throwing');
      def.setState('thrown');
      def.vx = att.vx = 0;
      att.vy = 0;
      def.vy = 0;
      this.fx.push({ type: 'text', x: def.x, y: def.y + 230, text: d.type === 'Throw' ? 'THROW' : 'GRAB!', t: 0, life: 30 });
    }
    updateGrab() {
      const g = this.grab;
      if (!g) return;
      if (g.att.hitstop > 0) return;
      g.t++;
      const { att, def } = g;
      def.x = att.x + att.facing * (att.c.w * 0.5 + def.c.w * 0.4);
      if (g.air) {
        def.y = Math.max(0, g.gy - g.t * 4);
        att.y = Math.max(0, def.y - 20);
      } else def.y = 0;
      if (g.t >= g.dur) {
        if (g.back) {
          def.x = att.x - att.facing * (att.c.w * 0.5 + def.c.w * 0.4);
          att.facing = -att.facing;
        }
        this.grab = null;
        const inst = g.inst;
        att.setState('attack');
        att.move = inst;
        att.mf = Math.max(inst.su, inst.total - 14);
        att.moveAir = att.y > 0;
        att.grabbed = true;
        def.setState('idle');
        this.doHit({ type: 'throw', att, def, inst, srcX: att.x, box: { cx: def.x, cy: def.y + def.c.h / 2, w: 60, h: 60 } });
        def.hitstop = 10;
        att.hitstop = 0;
      }
    }
    throwBreak(def) {
      const g = this.grab;
      if (!g || g.def !== def || !g.breakable || g.t > C.THROW_BREAK) return;
      this.grab = null;
      this.techBoth(g.att, def);
    }
    techBoth(a, b) {
      for (const f of [a, b]) {
        f.setState('recoil');
        f.recoilT = 14;
        f.vx = -f.facing * 8;
        f.grabbed = false;
        f.move = null;
      }
      this.fx.push({ type: 'ring', x: (a.x + b.x) / 2, y: 110, t: 0, life: 16, r: 90, color: '#fff' });
      this.fx.push({ type: 'text', x: (a.x + b.x) / 2, y: 260, text: 'THROW BREAK', t: 0, life: 40 });
      this.hitstopBoth(8);
    }

    updateFx() {
      for (const e of this.fx) e.t++;
      this.fx = this.fx.filter((e) => e.t < e.life);
      SO.FXR.update(this);
      if (this.flash) this.flash.t++;
    }
  }

  function armorOK(vs, blk) {
    if (!vs) return true;
    if (vs === 'HM') return blk === 'High' || blk === 'Mid';
    if (vs === 'LM') return blk === 'Low' || blk === 'Mid';
    return true;
  }

  SO.World = World;
})();
