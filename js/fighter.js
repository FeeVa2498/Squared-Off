'use strict';
// =============================================================================
// SQUARED OFF - Fighter: FSM, chọn chiêu, cancel, di chuyển
// =============================================================================
(function () {
  const SO = window.SO;
  const C = SO.CFG;

  const NEUTRAL = new Set(['idle', 'walk', 'crouch']);
  const STUN = new Set(['hitstun', 'airhit', 'block', 'knockdown', 'wakeup', 'thrown', 'recoil']);
  const NORMAL_T = new Set(['Normal', 'Command']);

  function tier(m) {
    return m.btn === 'L' ? 1 : m.btn === 'M' ? 2 : m.btn === 'H' ? 3 : 2;
  }

  class Fighter {
    constructor(world, idx, name) {
      this.w = world;
      this.idx = idx;
      this.inp = new SO.PlayerInput();
      this.setChar(name);
    }
    setChar(name) {
      this.name = name;
      this.c = SO.DB.chars[name];
      this.G = (SO.GIM && SO.GIM[name]) || {};
    }
    refreshData() {
      this.c = SO.DB.chars[this.name];
    }
    get opp() { return this.w.f[1 - this.idx]; }

    resetRound(x, facing) {
      const c = this.c;
      this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.pushV = 0;
      this.facing = facing;
      this.hp = c.hp; this.gray = 0; this.burst = 100;
      this.state = 'idle'; this.sf = 0;
      this.move = null; this.mf = 0; this.moveAir = false;
      this.hitstop = 0; this.stun = 0; this.untech = 0; this.kdType = ''; this.slow = 0;
      this.resetAir();
      this.invT = 0; this.throwInvT = 0;
      this.combo = { hits: 0, scale: 1, dmg: 0 };
      this.buffs = { burst: 0, dmgUp: 0, grayRegen: 0 };
      this.contact = null; this.hitIdx = -1; this.chain = []; this.grabbed = false;
      this.wallBounce = false; this.momentum = 0; this.guard = false; this.fd = false;
      this.crouchBlock = false; this.crouchHit = false; this.vanish = false;
      this.jumpDir = 0; this.afterimg = 0; this.ko = false; this.recoilT = 0; this.ghosts = []; this.iadQueued = 0;
      this.lastHS = 0; this.landT = C.LANDING; this.kdT = 0;
      this.blockArm = 0; this.freeFrame = 0;
      this.gim = {};
      if (this.G.init) this.G.init(this);
      this.inp.reset();
    }
    resetAir() {
      this.airJumps = this.c.airJumps;
      this.airDashes = this.c.airDashes;
      this.superJump = false;
      this.airdashed = false;
    }

    // ------------------------------------------------------------------ helpers
    isAir() { return this.y > 0.01 || (this.state === 'attack' && this.moveAir); }
    setState(s) {
      const prev = this.state;
      this.state = s;
      this.sf = 0;
      if (s !== 'attack') this.move = null;
      if (STUN.has(prev) && !STUN.has(s)) {
        this.combo = { hits: 0, scale: 1, dmg: 0 };
        this.wallBounce = false;
        this.freeFrame = this.w.frame;
        this.w.onRecover(this, prev);
      }
      if (s === 'hitstun' || s === 'airhit' || s === 'block') this.guard = false;
    }
    faceOpp() {
      const dx = this.opp.x - this.x;
      if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1;
    }
    res() { return this.w.res(this.idx); }
    walkMul() { return this.G.walkMul ? this.G.walkMul(this) : 1; }
    canActNow() {
      const s = this.state;
      if (this.w.phase !== 'fight') return false;
      if (NEUTRAL.has(s)) return true;
      if (s === 'air') return true;
      if (s === 'dash') return true;
      if (s === 'airdash' && this.sf >= 4) return true;
      return false;
    }
    isCrouchPose() {
      const s = this.state;
      if (s === 'crouch') return true;
      if (s === 'block') return this.crouchBlock;
      if (s === 'hitstun') return this.crouchHit;
      if (s === 'attack' && this.move) {
        const d = this.move.d;
        return !d.air && !d.motion && d.dir <= 3 && !this.moveAir;
      }
      return false;
    }
    nearWall(m) {
      return this.x < 80 + this.c.w / 2 + m || this.x > C.STAGE_W - 80 - this.c.w / 2 - m;
    }
    atWall(dir) {
      const lo = 80 + this.c.w / 2, hi = C.STAGE_W - 80 - this.c.w / 2;
      return dir < 0 ? this.x <= lo + 2 : this.x >= hi - 2;
    }
    stunBase(inst, blocked) {
      const adv = blocked ? inst.d.ob : inst.d.oh;
      return inst.casterAct - 1 + inst.rec + adv;
    }

    // ------------------------------------------------------------------ boxes
    hurtboxes() {
      if (this.vanish) return [];
      const c = this.c, s = this.state;
      let w = c.w * 0.78, h = c.h;
      if (s === 'knockdown' || s === 'wakeup') { h = 40; w = c.w * 1.4; }
      else if (this.isCrouchPose()) h = c.h * 0.62;
      else if (this.isAir()) h = c.h * 0.8;
      const out = [{ cx: this.x, cy: this.y + h / 2, w, h }];
      if (s === 'attack' && this.move) {
        const m = this.move, d = m.d;
        if (d.hasHitbox && !d.isProj && !d.tags.has('NoExtHurt') && !d.kv.Detonate &&
            (NORMAL_T.has(d.type) || d.type === 'Unique' || d.type === 'Special')) {
          const t = this.mf;
          if (t >= m.su - 2 && t < m.su + m.act + Math.floor(m.rec / 2)) {
            out.push({ cx: this.x + this.facing * m.hb.x * 0.95, cy: this.y + m.hb.y, w: m.hb.w * 0.8, h: m.hb.h * 0.9, ext: true });
          }
        }
      }
      return out;
    }
    pushbox() {
      const c = this.c;
      const h = this.isCrouchPose() ? c.h * 0.6 : c.h * 0.8;
      return { cx: this.x, cy: this.y + h / 2, w: c.w * 0.6, h };
    }
    activeHitbox() {
      if (this.state !== 'attack' || !this.move) return null;
      const m = this.move, d = m.d;
      if (!d.hasHitbox || d.isProj || d.kv.Detonate || d.type === 'Throw' || d.type === 'CmdGrab' || d.type === 'AirGrab' || d.type === 'Puppet' || d.tags.has('CmdGrab')) return null;
      const t = this.mf;
      if (t < m.su || t >= m.su + m.act) return null;
      const interval = Math.max(1, Math.ceil(m.act / m.hits));
      const idx = Math.min(m.hits - 1, Math.floor((t - m.su) / interval));
      if (idx <= this.hitIdx) return null;
      return { box: { cx: this.x + this.facing * m.hb.x, cy: this.y + m.hb.y, w: m.hb.w, h: m.hb.h }, idx };
    }
    isInvuln(kind) {
      const s = this.state;
      if (this.invT > 0) return true;
      if (this.vanish) return true;
      if (s === 'knockdown' || s === 'wakeup' || s === 'thrown' || s === 'throwing' || s === 'ko') return true;
      if (kind === 'throw') {
        if (this.throwInvT > 0 || this.isAir()) return true;
        if (s === 'hitstun' || s === 'block' || s === 'airhit' || s === 'recoil') return true;
      }
      if (s === 'backdash' && this.sf <= 7 && kind !== 'throw') return true;
      if (s === 'attack' && this.move) {
        const d = this.move.d;
        if (d.inv && this.mf >= d.inv[0] && this.mf <= d.inv[1]) {
          const T = d.invType;
          if (T === 'Full') return true;
          if (T === 'Strike' && kind !== 'throw') return true;
          if (T === 'Throw' && kind === 'throw') return true;
          if (T === 'Projectile' && kind === 'proj') return true;
        }
      }
      return false;
    }
    canBlockNow() {
      const s = this.state;
      if (this.w.phase !== 'fight') return false;
      return NEUTRAL.has(s) || s === 'block' || s === 'land' || s === 'air';
    }
    holdingAwayFrom(srcX) {
      const a = this.inp.abs;
      const left = a === 1 || a === 4 || a === 7, right = a === 3 || a === 6 || a === 9;
      let side = SO.sign(srcX - this.x);
      if (side === 0) side = this.facing;
      return side > 0 ? left : right;
    }
    threatened() {
      const o = this.opp;
      if (o.state === 'attack' && o.move && o.mf < o.move.su + o.move.act && o.move.d.hasHitbox &&
          Math.abs(o.x - this.x) < C.PROX_GUARD + Math.abs(o.move.hb.x) + o.move.hb.w / 2) return true;
      for (const p of this.w.projs) {
        if (p.owner === o && !p.dead && Math.abs(p.x - this.x) < 420) return true;
      }
      if (o.G.threat && o.G.threat(o, this)) return true;
      return false;
    }

    // ------------------------------------------------------------------ input
    readInput(raw) {
      this.inp.update(raw, this.facing, this.w.frame);
    }

    tick() {
      if (this.hitstop > 0) {
        this.hitstop--;
        this.lastHS++;
        // giữ buffer trong lúc hitstop
        this.inp.shift();
        return;
      }
      if (this.slow > 0) {
        this.slow--;
        if (this.w.frame % 2) return;
      }
      this.step();
      if (this.lastHS > 0 && this.state !== 'attack') this.lastHS = 0;
      this.updateGhosts();
    }

    // ------------------------------------------------------------------ afterimage
    wantsGhost() {
      const s = this.state;
      if (s === 'dash' || s === 'airdash' || s === 'backdash') return true;
      if (s === 'attack' && this.move) {
        const d = this.move.d;
        if (d.type === 'Super' || d.type === 'Burst') return true;
        for (const v of this.move.vel) if (this.mf >= v.a && this.mf <= v.b && (Math.abs(v.vx) >= 8 || Math.abs(v.vy) >= 12)) return true;
      }
      return false;
    }
    snapshot() {
      const s = Object.create(this);
      Object.assign(s, {
        x: this.x, y: this.y, facing: this.facing, state: this.state, sf: this.sf, mf: this.mf, move: this.move,
        moveAir: this.moveAir, guard: this.guard, crouchBlock: this.crouchBlock, crouchHit: this.crouchHit,
        vanish: false, invT: 0, ghosts: null, buffs: { burst: 0 }, adDir: this.adDir, age: 0,
        gim: Object.assign({}, this.gim, { shift: null, install: 0 }),
        ghostKind: this.state === 'attack' && this.move && this.move.d.type === 'Super' ? 'super' : this.buffs.burst > 0 || (this.move && this.move.d.type === 'Burst') ? 'burst' : 'move',
      });
      return s;
    }
    updateGhosts() {
      if (!this.ghosts) this.ghosts = [];
      for (const g of this.ghosts) g.age++;
      this.ghosts = this.ghosts.filter((g) => g.age < 14);
      if (this.wantsGhost()) this.afterimg = Math.max(this.afterimg, 3);
      if (this.afterimg > 0 && this.w.frame % 2 === 0 && !this.vanish) this.ghosts.push(this.snapshot());
    }

    step() {
      this.sf++;
      if (this.invT > 0) this.invT--;
      if (this.throwInvT > 0) this.throwInvT--;
      if (this.afterimg > 0) this.afterimg--;
      if (this.blockArm > 0) this.blockArm--;
      if (this.buffs.burst > 0) {
        this.buffs.burst--;
        if (this.gray > 0) {
          const r = Math.min(this.gray, this.buffs.grayRegen);
          this.hp = Math.min(this.c.hp, this.hp + r);
          this.gray -= r;
        }
      }
      if (this.G.update) this.G.update(this);
      const s = this.state;
      // composite (RC / Burst / Throw / Dead Angle / Throw break)
      if (this.w.phase === 'fight' && s !== 'ko' && s !== 'knockdown' && s !== 'wakeup') {
        if (this.tryComposite()) {
          if (this.state === 'attack' && this.mf === 0) this.attackStep();
          this.physics();
          return;
        }
      }
      switch (s) {
        case 'idle': case 'walk': case 'crouch': this.groundNeutral(); break;
        case 'prejump': this.prejumpStep(); break;
        case 'air': this.airStep(); break;
        case 'land':
          this.vx = 0;
          if (this.sf >= this.landT) { this.faceOpp(); this.setState(this.inp.isDown() ? 'crouch' : 'idle'); this.groundNeutral(); }
          break;
        case 'dash': this.dashStep(); break;
        case 'dashstop':
          this.vx *= 0.7;
          if (this.sf >= C.DASH_LOCK) this.setState('idle');
          break;
        case 'backdash': this.backdashStep(); break;
        case 'airdash': this.airdashStep(); break;
        case 'attack': this.attackStep(); break;
        case 'hitstun':
          this.vx = this.decay(this.vx);
          if (this.sf > this.stun) { this.setState(this.inp.isDown() ? 'crouch' : 'idle'); this.groundNeutral(); }
          break;
        case 'block':
          this.blockStep();
          break;
        case 'airhit': this.airhitStep(); break;
        case 'knockdown':
          this.vx = this.decay(this.vx);
          if (this.sf >= this.kdT) this.setState('wakeup');
          break;
        case 'wakeup':
          this.vx = 0;
          if (this.sf >= C.WAKEUP) { this.throwInvT = 6; this.faceOpp(); this.setState('idle'); }
          break;
        case 'recoil':
          this.vx = this.decay(this.vx);
          if (this.sf >= this.recoilT) this.setState('idle');
          break;
        case 'throwing': case 'thrown': this.vx = 0; break;
        case 'ko':
          this.vx = this.decay(this.vx);
          break;
      }
      if (this.state === 'attack' && this.mf === 0) this.attackStep();
      this.physics();
    }

    decay(v) {
      if (Math.abs(v) <= C.PUSH_DECAY) return 0;
      return v - SO.sign(v) * C.PUSH_DECAY;
    }

    physics() {
      if (Math.abs(this.pushV) > 0) {
        this.x += this.pushV;
        this.pushV = this.decay(this.pushV);
      }
      this.x += this.vx;
      const airStates = this.state === 'air' || this.state === 'airdash' || this.state === 'airhit' ||
        (this.state === 'attack' && this.moveAir) || (this.state === 'block' && this.airBlock) || this.state === 'ko';
      if (airStates || this.y > 0) {
        this.y += this.vy;
        if (this.y <= 0) { this.y = 0; this.onLand(); }
      } else {
        this.y = 0;
        this.vy = 0;
      }
    }

    onLand() {
      const s = this.state;
      this.vy = 0;
      if (s === 'air' || s === 'airdash') {
        this.resetAir();
        this.landT = C.LANDING;
        this.vx = 0;
        this.setState('land');
        this.faceOpp();
      } else if (s === 'attack') {
        const d = this.move.d;
        if ((d.air && d.type !== 'Spell') || d.tags.has('LandEnd') || (d.type === 'Unique' && d.tags.has('Airborne'))) {
          this.resetAir();
          this.landT = C.AIR_ATK_LANDING;
          this.vx = 0;
          this.setState('land');
          this.faceOpp();
        } else {
          this.moveAir = false;
          this.resetAir();
        }
      } else if (s === 'airhit' && this.groundBounce) {
        // ground bounce: nảy lên lại để combo tiếp
        this.groundBounce = false;
        this.y = 1;
        this.vy = 12;
        this.vx *= 0.6;
        this.sf = 0;
        this.untech = Math.max(this.untech - this.sf, 26);
        this.w.fx.push({ type: 'dust', x: this.x, y: 0, t: 0, life: 22, big: true });
        this.w.fx.push({ type: 'crack', x: this.x, y: 0, t: 0, life: 40 });
        this.w.quake = Math.max(this.w.quake || 0, 8);
      } else if (s === 'airhit') {
        this.resetAir();
        this.vx *= 0.3;
        if (this.ko) { this.setState('ko'); return; }
        this.kdT = this.kdType === 'Hard_Knockdown' ? C.KD_HARD : C.KD_SOFT;
        this.setState('knockdown');
        this.w.fx.push({ type: 'dust', x: this.x, y: 0, t: 0, life: 18 });
      } else if (s === 'block') {
        this.airBlock = false;
        this.resetAir();
      } else if (s === 'ko') {
        this.vx *= 0.5;
      } else {
        this.resetAir();
      }
    }

    // ------------------------------------------------------------------ neutral
    groundNeutral() {
      this.faceOpp();
      this.guard = false;
      if (this.canActNow() && this.tryActions()) return;
      const i = this.inp, d = i.rel;
      if (this.w.phase !== 'fight') { this.vx = 0; if (this.state !== 'idle') this.setState('idle'); return; }
      if (this.G.suppressMove && this.G.suppressMove(this)) {
        this.vx = 0;
        if (this.state !== 'idle' && this.state !== 'crouch') this.setState('idle');
        return;
      }
      if (d >= 7) { this.startJump(d); return; }
      if (i.fwdTapT === i.frame && i.frame - i.lastFwdTap <= C.DASH_WINDOW && this.c.dash > 0) { this.setState('dash'); return; }
      if (i.backTapT === i.frame && i.frame - i.lastBackTap <= C.DASH_WINDOW) { this.setState('backdash'); return; }
      const want = d <= 3 ? 'crouch' : (d === 6 || d === 4) ? 'walk' : 'idle';
      if (this.state !== want) this.setState(want);
      if (d === 6) {
        this.vx = this.facing * this.c.walkF * this.walkMul();
        this.w.gain(this.idx, C.WALK_GAIN);
      } else if (d === 4) {
        if (this.threatened()) { this.vx = 0; this.guard = true; }
        else { this.vx = -this.facing * this.c.walkB * this.walkMul(); this.w.gain(this.idx, -C.BACK_PENALTY); }
      } else if (d === 1 && this.threatened()) { this.vx = 0; this.guard = true; }
      else this.vx = 0;
    }

    // IAD: 956 (tiến) / 754 (lùi) — phải đi qua neutral
    iadCheck() {
      const i = this.inp;
      if (i.rel === 6 && i.prevRel === 5 && i.frame - i.t9 <= 10) return 1;
      if (i.rel === 4 && i.prevRel === 5 && i.frame - i.t7 <= 10) return -1;
      return 0;
    }
    startJump(d, fromCancel) {
      this.iadQueued = 0;
      // jump cancel: chỉ thành super jump nếu bấm xuống SAU khi đòn bắt đầu (2H rồi 9 là nhảy thường)
      const sj = this.inp.recentDown(C.SJ_WINDOW) && (!fromCancel || (this.inp.downTaps || 0) > this.downTapsAtMove);
      this.setState('prejump');
      this.jumpDir = d === 7 ? -1 : d === 9 ? 1 : 0;
      this.superJump = sj;
      this.jumpMomentum = this.vx;
    }
    prejumpStep() {
      this.vx *= 0.5;
      // [2]8 + nút trong lúc pre-jump vẫn ra charge move (không bị nhảy mất)
      if (this.c.charges.length && this.tryActions()) return;
      const d = this.inp.rel;
      if (d === 7) this.jumpDir = -1;
      else if (d === 9) this.jumpDir = 1;
      const iad = this.iadCheck();
      if (iad) this.iadQueued = iad;
      if (this.sf >= C.PREJUMP) {
        const c = this.c, sj = this.superJump;
        this.vy = c.jumpV * (sj ? 1.183 : 1);
        this.vx = this.jumpDir * c.jumpX * this.facing * (sj ? 1.15 : 1);
        if (Math.abs(this.jumpMomentum || 0) > c.jumpX && SO.sign(this.jumpMomentum) === SO.sign(this.vx)) this.vx = this.jumpMomentum * 0.85;
        this.y = 1;
        if (sj) {
          this.airJumps = 0;
          this.afterimg = 30;
          this.w.fx.push({ type: 'dust', x: this.x, y: 0, t: 0, life: 22, big: true });
        }
        this.setState('air');
        if (this.iadQueued && this.airDashes > 0 && !this.superJump) {
          this.y = 22;
          this.startAirdash(this.iadQueued);
        }
        this.iadQueued = 0;
      }
    }
    airStep() {
      this.vy -= this.c.grav;
      if (this.canActNow() && this.tryActions()) return;
      if (this.w.phase !== 'fight') return;
      const i = this.inp;
      if (i.rel >= 7 && i.prevRel < 7 && this.airJumps > 0 && !this.superJump && !this.airdashed && this.sf > 4) {
        this.airJumps--;
        const dir = i.rel === 7 ? -1 : i.rel === 9 ? 1 : 0;
        this.vy = this.c.jumpV * 0.9;
        this.vx = dir * this.c.jumpX * this.facing;
        this.w.fx.push({ type: 'ring', x: this.x, y: this.y, t: 0, life: 12, r: 40, color: '#999' });
        this.sf = 1;
        return;
      }
      const iad = this.iadCheck();
      if (iad && this.airDashes > 0 && this.sf <= 14 && !(this.G.noAirdash && this.G.noAirdash(this))) {
        this.y = Math.max(this.y, 22);
        this.startAirdash(iad);
        return;
      }
      if (this.airDashes > 0 && this.y > 50 && !(this.G.noAirdash && this.G.noAirdash(this))) {
        if (i.fwdTapT === i.frame && i.frame - i.lastFwdTap <= C.DASH_WINDOW) { this.startAirdash(1); return; }
        if (i.backTapT === i.frame && i.frame - i.lastBackTap <= C.DASH_WINDOW) { this.startAirdash(-1); return; }
      }
    }
    airJump(d) {
      this.airJumps--;
      const dir = d === 7 ? -1 : d === 9 ? 1 : 0;
      this.move = null;
      this.moveAir = false;
      this.setState('air');
      this.vy = this.c.jumpV * 0.92;
      this.vx = dir * this.c.jumpX * this.facing * 0.8;
      this.sf = 1;
      this.w.fx.push({ type: 'ring', x: this.x, y: this.y, t: 0, life: 12, r: 40, color: '#999' });
    }
    startAirdash(dir) {
      this.airDashes--;
      this.airdashed = true;
      this.adDir = dir;
      this.afterimg = 14;
      this.setState('airdash');
    }
    airdashStep() {
      const c = this.c;
      const len = this.adDir > 0 ? c.adashF : Math.round(c.adashF * 0.75);
      this.vy = 0;
      this.vx = this.adDir * this.facing * c.adash * (this.adDir < 0 ? 0.75 : 1);
      if (this.sf >= 4 && this.tryActions()) return;
      if (this.sf >= len) { this.vx *= 0.6; this.setState('air'); }
    }
    dashStep() {
      const c = this.c;
      this.vx = this.facing * c.dash * this.walkMul() * (this.sf < 3 ? 0.6 : 1);
      if (this.sf % 4 === 0) this.w.fx.push({ type: 'dust', x: this.x - this.facing * 30, y: 0, t: 0, life: 10 });
      this.w.gain(this.idx, C.DASH_GAIN);
      if (this.tryActions()) return;
      const i = this.inp;
      if (i.rel >= 7) { this.startJump(i.rel); return; }
      if (!i.isFwd() && this.sf >= 8) this.setState('dashstop');
    }
    backdashStep() {
      const c = this.c;
      const n = c.backdash;
      this.vx = -this.facing * (this.sf < n * 0.6 ? 9 : 3);
      if (this.sf >= n) { this.vx = 0; this.setState('idle'); }
    }
    blockStep() {
      this.vx = this.decay(this.vx);
      if (this.airBlock) this.vy -= this.c.grav;
      const fdHeld = this.inp.isBack() && this.inp.heldCount() >= 2;
      this.fd = fdHeld && this.w.res(this.idx) > C.EQ_FLOOR + 0.01;
      if (this.fd) this.w.spend(this.idx, Math.min(C.FD_COST, this.w.res(this.idx) - C.EQ_FLOOR));
      if (this.sf > this.stun) {
        this.fd = false;
        if (this.airBlock) { this.airBlock = false; this.setState('air'); }
        else { this.setState(this.inp.isDown() ? 'crouch' : 'idle'); this.groundNeutral(); }
      }
    }
    airhitStep() {
      const juggle = 1 + Math.min(0.5, this.combo.hits * 0.025);
      this.vy -= this.c.grav * juggle;
      this.vx *= 0.995;
      if (this.wallBounce && this.atWall(SO.sign(this.vx))) {
        this.wallBounce = false;
        this.vx = -this.vx * 0.5;
        this.vy = 9;
        this.w.fx.push({ type: 'ring', x: this.x, y: this.y + 80, t: 0, life: 14, r: 70, color: '#c44' });
        this.w.fx.push({ type: 'text', x: this.x, y: this.y + 200, text: 'WALL!', t: 0, life: 40 });
      }
      if (this.ko) return;
      const canTech = this.sf >= this.untech && (this.kdType === 'Normal' || this.kdType === 'Launch' || this.kdType === '');
      if (canTech && this.w.phase === 'fight' && (this.inp.pressed.L || this.inp.pressed.M || this.inp.pressed.H)) {
        this.setState('air');
        this.invT = C.AIRTECH_INV;
        this.vy = 7;
        this.vx = -this.facing * 3;
        this.airJumps = 0;
        this.airDashes = 0;
        this.afterimg = 10;
        this.consumeComposite();
        this.w.fx.push({ type: 'ring', x: this.x, y: this.y + 80, t: 0, life: 14, r: 60, color: '#4a8' });
        this.w.fx.push({ type: 'text', x: this.x, y: this.y + 200, text: 'TECH', t: 0, life: 30 });
      }
    }

    // ------------------------------------------------------------------ actions
    tryComposite() {
      const i = this.inp, s = this.state, W = this.w;
      if (s === 'ko' || s === 'throwing') return false;
      const fresh = (b) => i.frame - i.pressT[b] <= C.BUFFER && i.pressT[b] > i.compUsedT;
      const kara = s === 'attack' && this.move && this.mf <= C.COMPOSITE + 1 && (NORMAL_T.has(this.move.d.type) || this.move.d.type === 'Unique' || this.move.d.type === 'Spell');
      const atkFree = this.canActNow() || kara;
      // L+M+H
      if (i.within(['L', 'M', 'H'], C.COMPOSITE)) {
        if (s === 'block' && W.res(this.idx) >= (SO.sysMove(this.c, 'DEAD_ANGLE').cost || 25)) {
          this.consumeComposite();
          this.startMove(SO.sysMove(this.c, 'DEAD_ANGLE'), { force: true });
          return true;
        }
        const rc = SO.sysMove(this.c, 'RC');
        const okState = NEUTRAL.has(s) || ['air', 'dash', 'attack', 'hitstun', 'airhit', 'land', 'airdash', 'prejump', 'dashstop', 'backdash'].includes(s);
        const notSuper = !(s === 'attack' && this.move && (this.move.d.type === 'Super' || this.move.d.type === 'Burst'));
        const rk = rc && this.rcKind(rc);
        if (rc && okState && notSuper && W.res(this.idx) >= rk.cost) {
          this.consumeComposite();
          this.doRC(rc, rk);
          return true;
        }
      }
      // Burst: U + attack
      if (this.burst >= 100 && fresh('U')) {
        const pair = ['L', 'M', 'H'].some((b) => fresh(b) && Math.abs(i.pressT[b] - i.pressT.U) <= C.COMPOSITE);
        if (pair) {
          if (s === 'hitstun' || s === 'airhit' || s === 'block') {
            this.consumeComposite();
            this.doBurst('D');
            return true;
          }
          const inSuper = s === 'attack' && this.move && (this.move.d.type === 'Super' || this.move.d.type === 'Burst');
          if (!inSuper && (this.canActNow() || s === 'attack' || s === 'land' || s === 'dashstop' || s === 'prejump')) {
            this.consumeComposite();
            this.doBurst('O');
            return true;
          }
        }
      }
      // Throw / Throw break: L + M
      if (i.within(['L', 'M'], C.COMPOSITE)) {
        if (s === 'thrown') {
          this.consumeComposite();
          W.throwBreak(this);
          return true;
        }
        const th = SO.sysMove(this.c, 'THROW');
        if (th && !this.isAir() && atkFree && s !== 'block' && !(this.G.blockThrow && this.G.blockThrow(this))) {
          const inRange = Math.abs(this.opp.x - this.x) <= this.c.throwR + 20;
          if (!inRange && i.isBack()) {
            // xa đối thủ + giữ lùi = thế Faultless Defense, không tung đòn
            this.consumeComposite();
            if (kara) this.endMove();
            return true;
          }
          this.consumeComposite();
          this.startMove(th, { force: true });
          return true;
        }
      }
      return false;
    }
    consumeComposite() {
      this.inp.compUsedT = this.inp.frame;
      this.inp.buf.length = 0;
    }

    tryActions() {
      if (this.w.phase !== 'fight') return false;
      const buf = this.inp.buf;
      for (let k = buf.length - 1; k >= 0; k--) {
        const p = buf[k];
        if (p.t <= this.inp.compUsedT) { buf.splice(k, 1); continue; }
        const r = this.selectMove(p.b, p);
        if (!r) continue;
        if (r.done) { buf.splice(k, 1); return true; }
        if (r.move && this.canStart(r.move)) {
          buf.splice(k, 1);
          this.startMove(r.move, r.opts || {});
          return true;
        }
        if (r.hold) continue;
      }
      return false;
    }

    // chọn chiêu cho một lần bấm nút
    selectMove(b, p) {
      const c = this.c, i = this.inp, air = this.isAir();
      if (this.G.press) {
        const r = this.G.press(this, b, p);
        if (r) return r;
      }
      const extra = (i.frame - p.t) + Math.min(14, this.lastHS);
      const stance = this.gim.stance || '';
      // charge moves: [4]6X / [2]8X
      const okAir = (m) => (m.air ? air : m.airOK ? true : !air) && (!m.stance || m.stance === stance) && (m.type !== 'Super' || this.res() >= m.cost);
      for (const m of c.charges) {
        if (!okAir(m)) continue;
        const toOK = m.charge.to === 6 ? [3, 6, 9].includes(p.rel) || i.isFwd() : [7, 8, 9].includes(p.rel) || i.isUp();
        if (!toOK || !i.charged(m.charge.from)) continue;
        let pick = c.charges.find((x) => x.charge.from === m.charge.from && x.charge.to === m.charge.to && x.btn === b && okAir(x));
        if (!pick && b !== 'U') pick = c.charges.filter((x) => x.charge.from === m.charge.from && x.charge.to === m.charge.to && x.btn !== 'U' && okAir(x))[0];
        if (pick) return { move: pick };
      }
      const done = new Set();
      for (const m0 of c.motions) {
        const mo = m0.motion;
        if (done.has(mo)) continue;
        done.add(mo);
        if (!i.motion(mo, i.frame, extra)) continue;
        const cands = c.motions.filter((m) => m.motion === mo &&
          (m.air ? air : m.airOK ? true : !air) &&
          (!m.stance || m.stance === stance) &&
          (m.type !== 'Super' || this.res() >= m.cost));
        if (!cands.length) continue;
        let pick = cands.find((m) => m.btn === b);
        if (!pick && b !== 'U') {
          const ord = { L: 1, M: 2, H: 3 };
          const lmh = cands.filter((m) => m.btn !== 'U').sort((x, y) => Math.abs(ord[x.btn] - ord[b]) - Math.abs(ord[y.btn] - ord[b]));
          pick = lmh[0];
        }
        // không cancel một chiêu vào chính nó (vd 214L lao rồi bấm H vẫn ra 5H)
        if (pick && this.state === 'attack' && this.move && pick.id === this.move.d.id) continue;
        if (pick) return { move: pick };
      }
      const d = p.rel;
      if (b === 'U') {
        const key = (air ? 'j' : 'g') + (d <= 3 ? '2' : '5');
        const m = c.unique[key] || c.unique[air ? 'j5' : 'g5'];
        return m ? { move: m } : null;
      }
      let m = null;
      if (air) {
        m = (d <= 3 && c.normals['j2' + b]) || c.normals['j5' + b];
      } else {
        if (d === 3) m = c.normals['g3' + b];
        if (!m && d <= 3) m = c.normals['g2' + b];
        if (!m && d === 6) m = c.normals['g6' + b];
        if (!m && d === 4) m = c.normals['g4' + b];
        if (!m && d > 3) {
          if (c.normals['gc' + b]) {
            const close = Math.abs(this.opp.x - this.x) - (this.opp.c.w + c.w) * 0.3 < C.CLOSE_RANGE;
            m = c.normals[(close ? 'gc' : 'gf') + b];
            // đã dùng cM trong chuỗi gatling thì bấm M lần nữa ra fM (và ngược lại)
            if (this.state === 'attack' && this.chain.includes(m.id)) {
              const alt = c.normals[(close ? 'gf' : 'gc') + b];
              if (alt && !this.chain.includes(alt.id)) m = alt;
            }
          } else m = c.normals['g5' + b];
        }
        if (!m) m = c.normals['g5' + b] || c.normals['gf' + b];
      }
      return m ? { move: m } : null;
    }

    canStart(m) {
      const air = this.isAir();
      if (m.air && !air) return false;
      if (!m.air && !m.airOK && air) return false;
      if (m.cost > 0 && this.res() < m.cost) return false;
      if (this.G.canStart && this.G.canStart(this, m) === false) return false;
      if (this.canActNow()) {
        if (this.state === 'airdash' && !(m.air || m.airOK)) return false;
        return true;
      }
      if (this.state === 'prejump' && m.charge && !m.air && this.w.phase === 'fight') return true;
      if (this.state === 'attack') return this.cancelOK(m);
      return false;
    }

    cancelOK(next) {
      const cur = this.move;
      if (!cur) return false;
      const d = cur.d;
      if (cur.airCancel && this.mf >= cur.airCancel && this.isAir() && (next.air || next.airOK)) return true;
      // FreeCancel=N: từ frame N cancel được sang bất kỳ normal/special/super nào (dash lao tới của Triangle)
      if (d.kv.FreeCancel && this.mf >= +d.kv.FreeCancel && next.id !== d.id && next.type !== 'Unique') return true;
      if (this.G.cancelOK) {
        const r = this.G.cancelOK(this, next);
        if (r !== undefined) return r;
      }
      if (!this.contact) return false;
      const t = this.mf;
      if (t > cur.su + cur.act + Math.min(C.CANCEL_EXTRA, cur.rec)) return false;
      const nt = next.type, ct = d.type;
      if (nt === 'Super') return cur.suc || cur.sc; // special cancel được thì super cancel được
      if (nt === 'Special' || nt === 'Spell' || nt === 'Unique' || nt === 'CmdGrab' || nt === 'AirGrab') {
        return NORMAL_T.has(ct) && cur.sc;
      }
      if (NORMAL_T.has(nt)) {
        if (!NORMAL_T.has(ct)) return false;
        if (next.air !== d.air) return false;
        if (this.G.gatling) return this.G.gatling(this, cur, next);
        const tc = tier(d), tn = tier(next);
        // L > M > H (L vào thẳng H cũng được); jab (L) tự gatling vào nhau và vào chính nó
        if (tn > tc) return next.btn === 'L' || !this.chain.includes(next.id);
        if (tn < tc) return false;
        if (tn === 1) return true;
        // cùng nút: bản đứng / ngồi (5X, 2X, 3X, cX, fX) cancel qua lại, mỗi chiêu một lần
        const variant = (m) => !!m.prox || m.dir === 5 || m.dir === 2 || m.dir === 3;
        return !d.air && variant(d) && variant(next) && next.id !== d.id && !this.chain.includes(next.id);
      }
      return false;
    }

    startMove(m, opts) {
      opts = opts || {};
      if (this.G.swap && !opts.noSwap) { const sw = this.G.swap(this, m); if (sw) m = sw; }
      const chCarry = !!(opts.chCarry && this.chMove);
      this.chMove = false;
      const prevAttack = this.state === 'attack' ? this.move : null;
      const inst = {
        d: m, id: m.id, su: m.su, act: m.act, rec: m.rec, hits: m.hits,
        hb: { x: m.hb.x, y: m.hb.y, w: m.hb.w, h: m.hb.h },
        dmgMul: 1, armorLeft: m.armor, armorVs: null,
        sc: m.sc, suc: m.suc, jc: m.jc, dc: m.dc, casterAct: m.casterAct,
        vel: m.vel, airCancel: +m.kv.AirCancel || 0, chCarry,
      };
      Object.assign(inst, opts.inst || {});
      if (this.G.modify) this.G.modify(this, inst);
      inst.su = Math.max(1, inst.su);
      inst.total = inst.su - 1 + inst.casterAct + inst.rec;
      if (this.buffs.burst > 0) inst.dmgMul *= 1 + this.buffs.dmgUp;
      if (m.type === 'Super') {
        this.w.spend(this.idx, m.cost);
        this.w.superFlash(this, m);
      } else if (m.cost > 0) this.w.spend(this.idx, m.cost);
      const fromDash = this.state === 'dash' || (prevAttack && prevAttack.d.kv.FreeCancel);
      this.momentum = fromDash ? this.vx * 0.9 : 0;
      if (m.charge) { const ch = this.inp.chg[m.charge.from]; ch.last = 0; ch.n = 0; }
      if (prevAttack && NORMAL_T.has(m.type)) this.chain.push(m.id);
      else this.chain = [m.id];
      const wasAir = this.isAir();
      this.setState('attack');
      this.move = inst;
      this.mf = 0;
      this.downTapsAtMove = this.inp.downTaps || 0;
      this.contact = null;
      this.hitIdx = -1;
      this.grabbed = false;
      this.moveAir = wasAir;
      if (!wasAir) { this.vy = 0; this.vx = this.momentum; }
      else if (m.type === 'Spell' || m.type === 'Burst' || m.kv.Proj) this.vy = Math.max(this.vy, 0) * 0.3;
      this.guard = false;
      this.vanish = false;
      this.w.onMoveStart(this, inst);
      if (this.G.onStart) this.G.onStart(this, inst);
    }

    attackStep() {
      const inst = this.move, d = inst.d;
      this.mf++;
      const t = this.mf;
      // frame 1 của chiêu được xử lý ngay frame bấm; hết frame `total` thì frame kế tiếp là frame tự do
      if (t > inst.total) {
        // AutoNext=ID: chiêu nhiều phần (vd 6H hất lên rồi bổ xuống) tự nối sang phần sau
        const nx = d.kv.AutoNext && this.c.byId[d.kv.AutoNext];
        if (nx) { this.startMove(nx, { chCarry: true, noSwap: true }); this.attackStep(); return; }
        this.endMove();
        if (this.canActNow()) this.tryActions();
        return;
      }
      let velSet = false;
      for (const s of inst.vel) {
        if (t >= s.a && t <= s.b) {
          this.vx = s.vx * this.facing;
          if (s.vy !== 0 || this.moveAir) this.vy = s.vy;
          if (s.vy > 0) this.moveAir = true;
          velSet = true;
        }
      }
      if (t === 1 && d.tags.has('Airborne')) { this.moveAir = true; this.y = Math.max(this.y, 1); }
      if (!velSet) {
        if (this.moveAir) {
          let g = this.c.grav;
          if (d.type === 'Spell' || d.type === 'Burst' || (d.isProj && t <= inst.su + 4)) g *= 0.3;
          if (d.type === 'Burst' && t < inst.su + inst.act) { g = 0; this.vy = 0; }
          this.vy -= g;
        } else {
          this.vx = this.momentum;
          this.momentum *= 0.88;
          if (Math.abs(this.momentum) < 0.3) this.momentum = 0;
        }
      }
      // teleport
      if (d.kv.Teleport) {
        const mm = d.kv.Teleport.match(/^(\w+)(?::(\d+))?@(\d+)$/);
        if (mm && t === +mm[3]) this.teleport(mm[1], +(mm[2] || 0));
      }
      if (d.kv.Vanish) {
        const r = SO.range(d.kv.Vanish);
        this.vanish = !!(r && t >= r[0] && t <= r[1]);
      }
      if (d.isProj && t === inst.su) this.w.spawnProj(this, inst);
      if (d.kv.Script && t === inst.su && SO.SCRIPTS[d.kv.Script]) SO.SCRIPTS[d.kv.Script](this, inst);
      if (d.kv.Detonate && t === inst.su && SO.SCRIPTS.detonate) SO.SCRIPTS.detonate(this, inst);
      if (d.kv.Puppet && t === 1 && this.G.puppet) this.G.puppet(this, d.kv.Puppet);
      if (this.G.frame) this.G.frame(this, inst, t);
      const isGrab = d.type === 'Throw' || d.type === 'CmdGrab' || d.type === 'AirGrab' || d.tags.has('CmdGrab');
      if (isGrab && t >= inst.su && t < inst.su + Math.max(1, inst.act) && !this.grabbed) this.w.tryGrab(this, inst);
      if (this.state !== 'attack' || this.move !== inst) return; // bị đổi trạng thái trong lúc xử lý
      // jump cancel / dash cancel
      const inWin = t <= inst.su + inst.act + Math.min(C.CANCEL_EXTRA, inst.rec);
      const upBuf = this.inp.frame - this.inp.upT <= C.BUFFER;
      // jump cancel được cả khi trúng lẫn khi bị đỡ
      if (this.contact && inst.jc && inWin && upBuf && !this.moveAir) {
        this.startJump(this.inp.isUp() ? this.inp.rel : this.inp.dirAt(this.inp.upT), true);
        return;
      }
      // jump cancel trên không = nhảy kép
      if (this.contact && inst.jc && inWin && this.moveAir && this.inp.frame - this.inp.upTapT <= C.BUFFER &&
          this.airJumps > 0 && !this.superJump && !this.airdashed) {
        this.airJump(this.inp.dirAt(this.inp.upTapT));
        return;
      }
      if (this.contact && inst.dc && inWin && !this.moveAir) {
        const i = this.inp;
        if ((i.fwdTapT >= i.frame - 2) && i.fwdTapT - i.lastFwdTap <= C.DASH_WINDOW) { this.setState('dash'); return; }
      }
      // cancel bằng nút bấm
      this.tryActions();
    }

    endMove() {
      const d = this.move && this.move.d;
      this.vanish = false;
      if (this.isAir()) {
        this.setState('air');
        if (d && d.kv.Script === 'apex') { /* đã tính trong script */ }
      } else {
        this.setState(this.inp.isDown() ? 'crouch' : 'idle');
        this.faceOpp();
      }
    }

    teleport(kind, dist) {
      const o = this.opp;
      const side = SO.sign(this.x - o.x) || -this.facing;
      let nx = this.x;
      if (kind === 'behind') nx = o.x - side * 110;
      else if (kind === 'front') nx = o.x + side * 140;
      else if (kind === 'fwd') nx = this.x + this.facing * dist;
      else if (kind === 'back') nx = this.x - this.facing * dist;
      const lo = 80 + this.c.w / 2, hi = C.STAGE_W - 80 - this.c.w / 2;
      if (nx < lo || nx > hi) nx = kind === 'behind' ? o.x + side * 110 : SO.clamp(nx, lo, hi);
      this.w.fx.push({ type: 'ring', x: this.x, y: this.y + 90, t: 0, life: 12, r: 50, color: this.c.color });
      this.afterimg = 10;
      this.ghosts = (this.ghosts || []).concat([this.snapshot()]);
      this.x = nx;
      this.faceOpp();
      this.w.fx.push({ type: 'ring', x: this.x, y: this.y + 90, t: 0, life: 12, r: 50, color: this.c.color });
    }

    // Roman Cancel: vàng (đòn đang startup/active, đối thủ không bị stun) 25%,
    // đỏ (đối thủ đang hitstun/blockstun) 50%, tím (đang recovery / tự do / tự mình bị stun) 50%
    rcKind(rc) {
      const o = this.opp;
      const oppStun = o.state === 'hitstun' || o.state === 'airhit' || o.state === 'block';
      if (oppStun && this.state === 'attack') return { kind: 'red', cost: rc.cost, color: '#e03a2e' };
      if (this.state === 'attack' && this.move) {
        const m = this.move;
        const actEnd = m.su + Math.max(1, m.act) + (m.d.isProj ? 4 : 0);
        if (this.mf < actEnd && !oppStun) return { kind: 'yellow', cost: +rc.kv.YellowCost || C.RC_YELLOW, color: '#f2c21b' };
      }
      return { kind: 'purple', cost: rc.cost, color: '#9a4ad8' };
    }
    doRC(rc, rk) {
      const W = this.w;
      rk = rk || this.rcKind(rc);
      W.spend(this.idx, rk.cost);
      const wasStun = this.state === 'hitstun' || this.state === 'airhit';
      const R = +rc.kv.Radius || 260, slow = +rc.kv.Slow || 40, push = +rc.kv.PushBack || 12;
      const keepVx = this.vx;
      this.move = null;
      if (this.isAir()) { this.setState('air'); this.vy = Math.max(this.vy, 3); this.moveAir = false; }
      else this.setState('idle');
      if (rk.kind === 'yellow') this.vx = keepVx; // giữ đà để lao vào sau khi bắn projectile
      this.invT = 6;
      this.hitstop = 0;
      const o = this.opp;
      if (rk.kind === 'yellow') {
        if (Math.abs(o.x - this.x) < R * 2.2) o.slow = Math.max(o.slow, slow - 8);
      } else if (Math.abs(o.x - this.x) < R + 120) {
        o.slow = Math.max(o.slow, slow);
        if (rk.kind === 'red' && (o.state === 'airhit')) o.vy = Math.max(o.vy, 4);
        if (wasStun || rk.kind === 'purple') {
          const pv = SO.sign(o.x - this.x) * push * (wasStun ? 1 : 0.6);
          o.vx = pv;
          if (o.state === 'attack' && !o.isAir()) o.pushV = pv;
        }
      }
      W.fx.push({ type: 'ring', x: this.x, y: this.y + 90, t: 0, life: 22, r: R, color: rk.color, thick: 7 });
      W.fx.push({ type: 'ring', x: this.x, y: this.y + 90, t: 0, life: 14, r: R * 0.6, color: rk.color, thick: 4 });
      W.fx.push({ type: 'text', x: this.x, y: this.y + 230, text: rk.kind.toUpperCase() + ' ROMAN CANCEL', t: 0, life: 40, color: rk.color });
      W.screenFlash = { t: 0, life: 8, color: rk.color + '55' };
      W.hitstopBoth(6);
    }

    doBurst(kind) {
      const m = SO.sysMove(this.c, kind === 'D' ? 'BURST_D' : 'BURST_O');
      this.burst = 0;
      this.combo = { hits: 0, scale: 1, dmg: 0 };
      this.ko = false;
      const wasAir = this.isAir();
      this.setState('attack');
      this.startMove(m, { force: true });
      this.moveAir = wasAir;
      if (kind === 'O') {
        this.buffs.burst = +m.kv.Buff || 300;
        this.buffs.dmgUp = +m.kv.DmgUp || 0.15;
        this.buffs.grayRegen = +m.kv.GrayRegen || 1.5;
      }
      this.w.fx.push({ type: 'ring', x: this.x, y: this.y + 100, t: 0, life: 26, r: 240, color: kind === 'D' ? '#3a7bd5' : '#e6a700', thick: 8 });
      this.w.fx.push({ type: 'text', x: this.x, y: this.y + 250, text: kind === 'D' ? 'BURST!' : 'OFFENSIVE BURST!', t: 0, life: 45 });
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      if (this.buffs.burst > 0) this.gray = 0;
      else this.gray = Math.min(this.gray + dmg * C.GRAY_RATIO, this.c.hp - Math.max(0, this.hp));
      if (this.hp < 0) this.hp = 0;
    }
  }

  SO.Fighter = Fighter;
  SO.SCRIPTS = SO.SCRIPTS || {};
})();
