'use strict';
// =============================================================================
// SQUARED OFF - Gimmick nút U của từng nhân vật
// Mỗi nhân vật có thể khai báo các hook:
//   init(f) update(f) press(f,b,p) modify(f,inst) frame(f,inst,t) canStart(f,m)
//   onContact(f,inst,result,c) walkMul(f) suppressMove(f) gatling(f,cur,next)
//   worldUpdate(f) puppetHit(f) puppetHurt(f,box) puppetStun(f) puppet(f,id)
//   parry(def,att,c) threat(f,target) hud(f) draw(f,ctx,R)
// Các con số chỉnh được đều nằm trong cột Properties của moves.csv.
// =============================================================================
(function () {
  const SO = window.SO;
  const C = SO.CFG;
  const GIM = (SO.GIM = {});
  const S = SO.SCRIPTS;
  const NORMAL_T = new Set(['Normal', 'Command']);
  const STUNNED = new Set(['hitstun', 'airhit', 'block', 'knockdown', 'wakeup', 'thrown', 'throwing', 'ko', 'recoil']);
  const fx = (f, e) => f.w.fx.push(Object.assign({ t: 0 }, e));

  // ---------------------------------------------------------------- Roman Cancel (dùng chung)
  S.rc = function () {};

  // ================================================================ CIRCLE
  GIM.Circle = {
    init(f) { f.gim.install = 0; },
    update(f) { if (f.gim.install > 0) f.gim.install--; },
    press(f, b) {
      if (b !== 'U') return null;
      const m = f.c.byId.CR_U_INSTALL;
      if (m && f.state === 'attack' && f.move && f.move.d.type === 'Special' && f.mf >= f.move.su && f.res() >= m.cost) {
        f.startMove(m, { force: true });
        return { done: true };
      }
      return null;
    },
    modify(f, inst) {
      if (inst.d.type === 'Special' && f.gim.install > 0) {
        const k = f.c.byId.CR_U_INSTALL.kv;
        inst.hits += +k.ExtraHits || 1;
        inst.dmgMul *= 1 + (+k.DmgUp || 0.2);
        inst.su = Math.max(3, inst.su - (+k.Faster || 2));
        inst.enhanced = true;
        f.gim.install = 0;
        fx(f, { type: 'ring', x: f.x, y: f.y + 90, life: 14, r: 90, color: '#e0574a', thick: 5 });
      }
    },
    hud(f) { return f.gim.install > 0 ? [{ text: 'INSTALL ' + (f.gim.install / 60).toFixed(1) + 's', color: '#e0574a' }] : []; },
  };
  S.install = function (f, inst) {
    f.gim.install = +inst.d.kv.Dur || 180;
    fx(f, { type: 'ring', x: f.x, y: f.y + 90, life: 20, r: 120, color: '#e0574a', thick: 6 });
    fx(f, { type: 'text', x: f.x, y: f.y + 230, text: 'ROLLING INSTALL', life: 40, color: '#e0574a' });
  };

  // ================================================================ SQUARE
  GIM.Square = {
    init(f) { f.gim.ring = null; f.gim.ringCD = 0; },
    update(f) {
      if (f.gim.ringCD > 0) f.gim.ringCD--;
      const r = f.gim.ring;
      if (r) { r.t++; if (r.t >= r.life) f.gim.ring = null; }
    },
    canStart(f, m) {
      if (m.kv.Script === 'ring' && f.gim.ringCD > 0) return false;
    },
    worldUpdate(f) {
      const r = f.gim.ring;
      if (!r) return;
      for (const p of f.w.projs) {
        if (p.owner !== f || !p.clash || p.boosted || p.dead || p.delay > 0) continue;
        if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + Math.max(p.w, p.h) * 0.3) {
          p.boosted = true;
          p.vx *= 1.5; p.vy *= 1.5; p.w *= 1.5; p.h *= 1.5;
          p.hitsLeft += 1;
          p.interval = 4;
          p.life += 20;
          fx(f, { type: 'ring', x: r.x, y: r.y, life: 14, r: r.r * 1.4, color: '#3f7fd8', thick: 6 });
        }
      }
    },
    hud(f) {
      const out = [];
      if (f.gim.ring) out.push({ text: 'RING ' + ((f.gim.ring.life - f.gim.ring.t) / 60).toFixed(1) + 's', color: '#3f7fd8' });
      if (f.gim.ringCD > 0) out.push({ text: 'Ring CD ' + (f.gim.ringCD / 60).toFixed(1) + 's', color: '#888' });
      return out;
    },
    draw(f, ctx, R) {
      const r = f.gim.ring;
      if (!r) return;
      const fade = Math.min(1, (r.life - r.t) / 30);
      ctx.globalAlpha = 0.85 * fade;
      R.sketchEllipse(ctx, r.x, -r.y, r.r * 0.55, r.r, 77 + f.idx, { stroke: '#3f7fd8', width: 7, fill: null });
      R.sketchEllipse(ctx, r.x, -r.y, r.r * 0.35, r.r * 0.75, 91 + f.idx, { stroke: '#9cc3f5', width: 3, fill: null });
      ctx.globalAlpha = 1;
    },
  };
  S.ring = function (f, inst) {
    const k = inst.d.kv;
    f.gim.ring = { x: f.x + f.facing * (+k.RingX || 260), y: Math.max(30, f.y + (+k.RingY || 120)), r: +k.RingR || 70, t: 0, life: +k.RingLife || 240 };
    f.gim.ringCD = +k.RingCD || 180;
  };

  // ================================================================ TRIANGLE
  GIM.Triangle = {
    canStart(f, m) {
      if (m.kv.Script === 'apex' && m.air && f.airDashes <= 0) return false;
    },
  };
  S.apex = function (f) {
    f.airdashed = true;
    f.airDashes = Math.max(0, f.airDashes - 1);
    f.airJumps = 0;
    f.afterimg = 18;
  };

  // ================================================================ RHOMBUS
  GIM.Rhombus = {
    init(f) { f.gim.shift = null; },
    update(f) {
      const s = f.gim.shift;
      if (s) { s.t--; if (s.t <= 0) f.gim.shift = null; }
    },
    walkMul(f) { return f.gim.shift ? f.gim.shift.walk : 1; },
    modify(f, inst) {
      const s = f.gim.shift;
      if (s && NORMAL_T.has(inst.d.type)) {
        inst.armorLeft = Math.max(inst.armorLeft, 1);
        inst.armorVs = s.vs;
      }
    },
    hud(f) { return f.gim.shift ? [{ text: 'GRIP SHIFT ' + (f.gim.shift.vs === 'HM' ? 'HIGH' : 'LOW') + ' ' + (f.gim.shift.t / 60).toFixed(1) + 's', color: '#8a5ac8' }] : []; },
  };
  S.shift = function (f, inst) {
    const k = inst.d.kv;
    f.gim.shift = { t: +k.Dur || 90, vs: k.Shift || 'HM', walk: +k.WalkMul || 0.6 };
    fx(f, { type: 'ring', x: f.x, y: f.y + 100, life: 16, r: 110, color: '#8a5ac8', thick: 6 });
  };

  // ================================================================ HEXAGON
  GIM.Hexagon = {
    init(f) { f.gim.nodes = []; },
    update(f) {
      for (const n of f.gim.nodes) n.life--;
      f.gim.nodes = f.gim.nodes.filter((n) => n.life > 0);
    },
    hud(f) {
      const max = +(f.c.byId.HX_5U && f.c.byId.HX_5U.kv.NodeMax) || 3;
      let s = 'NODE ';
      for (let i = 0; i < max; i++) s += i < f.gim.nodes.length ? '⬢' : '⬡';
      return [{ text: s, color: '#2fa37a' }];
    },
    draw(f, ctx, R) {
      f.gim.nodes.forEach((n, i) => {
        const pts = [];
        for (let k = 0; k < 6; k++) pts.push([n.x + Math.cos((k * Math.PI) / 3) * 24, -n.y + Math.sin((k * Math.PI) / 3) * 24]);
        const blink = n.life < 90 && (f.w.frame >> 3) % 2;
        ctx.globalAlpha = blink ? 0.4 : 0.95;
        R.sketchPoly(ctx, pts, 300 + i * 7 + f.idx, { fill: '#bdf0d8', stroke: '#2fa37a', width: 4 });
        ctx.fillStyle = '#1b5e45';
        ctx.font = 'bold 22px "Patrick Hand", "Comic Sans MS", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), n.x, -n.y + 8);
        ctx.globalAlpha = 1;
      });
      // tia nối mờ giữa các node
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = 'rgba(47,163,122,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i + 1 < f.gim.nodes.length; i++) {
        const a = f.gim.nodes[i], b = f.gim.nodes[i + 1];
        ctx.beginPath(); ctx.moveTo(a.x, -a.y); ctx.lineTo(b.x, -b.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    },
  };
  S.node = function (f, inst) {
    const k = inst.d.kv;
    const max = +k.NodeMax || 3;
    if (f.gim.nodes.length >= max) f.gim.nodes.shift();
    const n = { x: SO.clamp(f.x + f.facing * (+k.NodeX || 0), 60, C.STAGE_W - 60), y: Math.max(20, f.y + (+k.NodeY || 60)), life: +k.NodeLife || 900 };
    f.gim.nodes.push(n);
    fx(f, { type: 'ring', x: n.x, y: n.y, life: 12, r: 40, color: '#2fa37a' });
  };
  S.node3 = function (f) {
    const k = (f.c.byId.HX_5U && f.c.byId.HX_5U.kv) || {};
    f.gim.nodes = [200, 400, 600].map((d) => ({ x: SO.clamp(f.x + f.facing * d, 60, C.STAGE_W - 60), y: 70, life: +k.NodeLife || 900 }));
    f.gim.nodes.forEach((n) => fx(f, { type: 'ring', x: n.x, y: n.y, life: 14, r: 50, color: '#2fa37a' }));
  };
  S.detonate = function (f, inst) {
    const W = f.w, k = inst.d.kv.Detonate;
    const nodes = f.gim.nodes;
    let list;
    if (k === 'all') list = nodes.slice();
    else { const n = nodes[(+k || 1) - 1]; list = n ? [n] : []; }
    if (!list.length) {
      if (k === 'all') list = [{ x: f.x + f.facing * 140, y: 100, fake: true }];
      else { fx(f, { type: 'text', x: f.x, y: f.y + 220, text: 'NO NODE', life: 30, color: '#888' }); return; }
    }
    const lineDmg = +inst.d.kv.LineDmg || 30;
    const lineInst = Object.assign({}, inst, { dmgMul: inst.dmgMul * (lineDmg / Math.max(1, inst.d.dmg)) });
    for (const n of list) {
      W.projs.push(W.makeProj(f, inst, 'burst', 0, 1, { anchor: false, x: n.x, y: n.y, life: Math.max(4, inst.act), hitsLeft: 1 }));
      fx(f, { type: 'hit', x: n.x, y: n.y, life: 16, size: 110, color: '#2fa37a' });
    }
    // tia nối
    const pairs = [];
    if (k === 'all') { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]); }
    else for (const o of nodes) if (o !== list[0]) pairs.push([list[0], o]);
    for (const [a, b] of pairs) {
      W.projs.push(W.makeProj(f, lineInst, 'line', 0, 1, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, thick: 30, life: Math.max(6, inst.act), hitsLeft: 1, color: '#2fa37a' }));
    }
    if (k === 'all') f.gim.nodes = [];
    else f.gim.nodes = nodes.filter((n) => n !== list[0]);
  };

  // ================================================================ OVAL
  GIM.Oval = {
    init(f) { f.gim.stretch = 0; f.gim.cd = 0; },
    kv(f) { return (f.c.byId.OV_5U && f.c.byId.OV_5U.kv) || {}; },
    update(f) {
      if (f.gim.stretch > 0) {
        f.gim.stretch--;
        if (f.gim.stretch === 0) f.gim.cd = +GIM.Oval.kv(f).CD || 480;
      } else if (f.gim.cd > 0) f.gim.cd--;
    },
    canStart(f, m) {
      if (m.kv.Script === 'stretch' && f.gim.stretch <= 0 && f.gim.cd > 0) return false;
    },
    modify(f, inst) {
      if (f.gim.stretch > 0 && NORMAL_T.has(inst.d.type)) {
        const k = GIM.Oval.kv(f), mul = +k.ReachMul || 1.6;
        inst.hb.x *= mul;
        inst.hb.w *= mul;
        inst.rec += +k.RecAdd || 3;
        inst.stretched = true;
      }
    },
    hud(f) {
      if (f.gim.stretch > 0) return [{ text: 'STRETCH ' + (f.gim.stretch / 60).toFixed(1) + 's', color: '#d65ba3' }];
      if (f.gim.cd > 0) return [{ text: 'Stretch CD ' + (f.gim.cd / 60).toFixed(1) + 's', color: '#888' }];
      return [];
    },
  };
  S.stretch = function (f, inst) {
    const k = inst.d.kv;
    if (f.gim.stretch > 0) { f.gim.stretch = 0; f.gim.cd = +k.CD || 480; }
    else if (f.gim.cd <= 0) {
      f.gim.stretch = +k.Dur || 300;
      fx(f, { type: 'ring', x: f.x, y: f.y + 100, life: 16, r: 120, color: '#d65ba3', thick: 6 });
    }
  };

  // ================================================================ CONE & CYL
  const CYL_W = 64, CYL_H = 110;
  function cylKV(f) { return (f.c.byId.CC_5U && f.c.byId.CC_5U.kv) || {}; }
  function startCyl(f, m) {
    const cy = f.gim.cyl;
    if (!m || cy.stun > 0) return;
    cy.st = 'attack';
    const inst = { d: m, su: m.su, act: m.act, rec: m.rec, hits: m.hits, hb: Object.assign({}, m.hb), dmgMul: f.buffs.burst > 0 ? 1 + f.buffs.dmgUp : 1, casterAct: m.casterAct, vel: m.vel };
    inst.total = inst.su - 1 + inst.casterAct + inst.rec;
    cy.inst = inst;
    cy.mf = 0;
    cy.hitIdx = -1;
    cy.contact = null;
    cy.facing = SO.sign(f.opp.x - cy.x) || f.facing;
    if (m.tags.has('CylHop')) cy.y = Math.max(cy.y, 1);
  }
  GIM['Cone & Cyl'] = {
    init(f) {
      f.gim.cyl = { x: f.x - f.facing * 70, y: 0, vy: 0, facing: f.facing, st: 'follow', inst: null, mf: 0, stun: 0, hitIdx: -1, hitstop: 0, contact: null, ctrl: false };
    },
    update(f) {
      const cy = f.gim.cyl, i = f.inp, K = cylKV(f);
      if (cy.stun > 0) {
        cy.stun--;
        if (cy.stun === 0) {
          cy.st = 'follow'; cy.x = f.x - f.facing * 70; cy.y = 0; cy.vy = 0;
          fx(f, { type: 'ring', x: cy.x, y: 55, life: 14, r: 60, color: '#d2683a' });
        }
        return;
      }
      cy.ctrl = i.held.U && i.frame - i.pressT.U > C.COMPOSITE && !STUNNED.has(f.state) && f.w.phase === 'fight';
      if (cy.hitstop > 0) { cy.hitstop--; return; }
      if (cy.st === 'attack') {
        cy.mf++;
        let velSet = false;
        for (const s of cy.inst.vel) if (cy.mf >= s.a && cy.mf <= s.b) { cy.x += s.vx * cy.facing; if (s.vy) cy.vy = s.vy; velSet = true; }
        if (cy.mf >= cy.inst.total) cy.st = 'follow';
      } else if (cy.ctrl) {
        const a = i.abs;
        const dx = a % 3 === 0 ? 1 : a % 3 === 1 ? -1 : 0;
        cy.x += dx * (+K.CylSpeed || 6);
        cy.st = 'ctrl';
        cy.facing = SO.sign(f.opp.x - cy.x) || cy.facing;
      } else {
        const tx = f.x - f.facing * 70;
        const sp = cy.st === 'return' ? 16 : 7;
        if (Math.abs(tx - cy.x) <= sp) { cy.x = tx; if (cy.st !== 'follow') cy.st = 'follow'; }
        else cy.x += SO.sign(tx - cy.x) * sp;
        cy.facing = SO.sign(f.opp.x - cy.x) || f.facing;
      }
      if (cy.y > 0 || cy.vy > 0) {
        cy.vy -= 1;
        cy.y += cy.vy;
        if (cy.y <= 0) { cy.y = 0; cy.vy = 0; }
      }
      cy.x = SO.clamp(cy.x, 60, C.STAGE_W - 60);
    },
    suppressMove(f) { return f.gim.cyl.ctrl; },
    blockThrow(f) { return f.gim.cyl.ctrl; },
    press(f, b, p) {
      const cy = f.gim.cyl;
      if (b === 'U') {
        if (STUNNED.has(f.state)) return { done: true };
        if (f.isAir()) { if (cy.st !== 'attack') startCyl(f, f.c.byId.CC_jU); return { done: true }; }
        if (p.rel <= 3) { if (cy.stun <= 0) cy.st = 'return'; return { done: true }; }
        return { done: true };
      }
      if (cy.ctrl && (b === 'L' || b === 'M' || b === 'H')) {
        if (cy.st !== 'attack') startCyl(f, f.c.byId['CC_CYL_' + b]);
        return { done: true };
      }
      return null;
    },
    puppet(f, id) {
      const cy = f.gim.cyl;
      if (cy.stun > 0) return;
      cy.x = f.x + f.facing * 20;
      cy.y = 0;
      startCyl(f, f.c.byId[id]);
      cy.facing = f.facing;
    },
    puppetHit(f) {
      const cy = f.gim.cyl;
      if (cy.st !== 'attack' || cy.stun > 0 || cy.hitstop > 0) return null;
      const m = cy.inst, t = cy.mf;
      if (t < m.su || t >= m.su + m.act || !m.d.hasHitbox) return null;
      const interval = Math.max(1, Math.ceil(m.act / m.hits));
      const idx = Math.min(m.hits - 1, Math.floor((t - m.su) / interval));
      if (idx <= cy.hitIdx) return null;
      return { box: { cx: cy.x + cy.facing * m.hb.x, cy: cy.y + m.hb.y, w: m.hb.w, h: m.hb.h }, idx, inst: m, x: cy.x, cyl: cy };
    },
    puppetHurt(f, box) {
      const cy = f.gim.cyl;
      if (cy.stun > 0) return false;
      return SO.overlap(box, { cx: cy.x, cy: cy.y + CYL_H / 2, w: CYL_W, h: CYL_H });
    },
    puppetStun(f) {
      const cy = f.gim.cyl;
      cy.stun = +cylKV(f).CylStun || 180;
      cy.st = 'stun';
      fx(f, { type: 'hit', x: cy.x, y: cy.y + 60, life: 14, size: 60, color: '#d2683a' });
      fx(f, { type: 'text', x: cy.x, y: cy.y + 170, text: 'CYLINDER DOWN', life: 40, color: '#d2683a' });
    },
    threat(f, target) {
      const cy = f.gim.cyl;
      return cy.st === 'attack' && Math.abs(cy.x - target.x) < 300;
    },
    hud(f) {
      const cy = f.gim.cyl;
      if (cy.stun > 0) return [{ text: 'CYLINDER ' + (cy.stun / 60).toFixed(1) + 's', color: '#888' }];
      return [{ text: cy.ctrl ? 'CYLINDER: CONTROL' : 'CYLINDER OK', color: '#d2683a' }];
    },
    draw(f, ctx, R) {
      const cy = f.gim.cyl;
      if (cy.stun > 0) {
        ctx.globalAlpha = 0.25;
      }
      const x = cy.x, y = -cy.y;
      let lean = 0;
      if (cy.st === 'attack' && cy.inst) {
        const m = cy.inst;
        if (cy.mf >= m.su && cy.mf < m.su + m.act) lean = 0.25 * cy.facing;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lean);
      const col = f.idx === 1 && f.w.f[0].name === f.name ? R.shade('#b87333', -0.25) : '#b87333';
      R.sketchRect(ctx, -CYL_W / 2, -CYL_H, CYL_W, CYL_H, 500 + f.idx, { fill: col, stroke: '#2a2a2a', width: 4 });
      R.sketchEllipse(ctx, 0, -CYL_H, CYL_W / 2, 10, 510 + f.idx, { fill: R.shade(col, 0.25), stroke: '#2a2a2a', width: 3 });
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(cy.facing * 10, -CYL_H * 0.65, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cy.facing * 22, -CYL_H * 0.65, 4, 0, 7); ctx.fill();
      if (cy.ctrl) { ctx.strokeStyle = '#d2683a'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeRect(-CYL_W / 2 - 8, -CYL_H - 8, CYL_W + 16, CYL_H + 16); ctx.setLineDash([]); }
      ctx.restore();
      ctx.globalAlpha = 1;
      // dây nối
      if (cy.stun <= 0) {
        ctx.strokeStyle = 'rgba(80,60,40,0.35)';
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(f.x, -(f.y + f.c.h * 0.6)); ctx.lineTo(cy.x, -(cy.y + CYL_H * 0.8)); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (R.debug) {
        R.box(ctx, { cx: cy.x, cy: cy.y + CYL_H / 2, w: CYL_W, h: CYL_H }, 'rgba(40,90,255,0.25)', '#2a5aff');
        const ph = this.puppetHitBox(f);
        if (ph) R.box(ctx, ph, 'rgba(255,40,40,0.3)', '#f22');
      }
    },
    puppetHitBox(f) {
      const cy = f.gim.cyl;
      if (cy.st !== 'attack' || !cy.inst) return null;
      const m = cy.inst;
      if (cy.mf < m.su || cy.mf >= m.su + m.act) return null;
      return { cx: cy.x + cy.facing * m.hb.x, cy: cy.y + m.hb.y, w: m.hb.w, h: m.hb.h };
    },
  };
  S.control = function () {};
  S.recall = function (f) { if (f.gim.cyl) f.gim.cyl.st = 'return'; };

  // ================================================================ OCTAGON
  GIM.Octagon = {
    parry(def, att, c) {
      if (def.state !== 'attack' || !def.move || !def.move.d.kv.Parry) return false;
      const m = def.move, t = def.mf;
      if (t < m.su || t >= m.su + m.act) return false;
      const d = c.inst.d;
      if (d.type === 'Super' || d.type === 'Throw' || d.type === 'CmdGrab' || d.type === 'AirGrab') return false;
      const P = m.d.kv.Parry;
      let ok;
      if (P === 'HM') ok = !def.isAir() && d.blk !== 'Low';
      else if (P === 'LM') ok = !def.isAir() && d.blk !== 'High';
      else ok = def.isAir() || att.isAir();
      if (!ok) return false;
      const W = def.w;
      def.move = null;
      def.setState(def.isAir() ? 'air' : 'idle');
      def.invT = 4;
      def.hitstop = 12;
      const st = +m.d.kv.ParryStun || 30;
      if (c.type === 'strike') {
        att.move = null;
        if (att.isAir()) { att.setState('airhit'); att.kdType = 'Normal'; att.untech = st; att.vy = 4; att.vx = -att.facing * 2; att.y = Math.max(att.y, 1); }
        else { att.setState('hitstun'); att.stun = st; att.vx = 0; }
        att.hitstop = 12;
      } else if (c.type === 'puppet' && att.G.puppetStun) att.G.puppetStun(att);
      else if (c.proj) c.proj.dead = true;
      W.gain(def.idx, 5);
      W.fx.push({ type: 'stop', x: (def.x + (c.box ? c.box.cx : att.x)) / 2, y: c.box ? c.box.cy : def.y + 120, t: 0, life: 24 });
      W.fx.push({ type: 'text', x: def.x, y: def.y + 240, text: 'STOP!', t: 0, life: 40, color: '#c93a3a', big: true });
      return true;
    },
  };

  // ================================================================ SEMICIRCLE
  GIM.Semicircle = {
    init(f) { f.gim.stance = 'Flat'; f.gim.swap = 0; },
    kv(f) { return (f.c.byId.SC_U && f.c.byId.SC_U.kv) || {}; },
    update(f) { if (f.gim.swap > 0) f.gim.swap--; },
    press(f, b) {
      if (b !== 'U') return null;
      if (STUNNED.has(f.state)) return { done: true };
      f.gim.stance = f.gim.stance === 'Flat' ? 'Arc' : 'Flat';
      f.gim.swap = 18;
      fx(f, { type: 'ring', x: f.x, y: f.y + 85, life: 16, r: 95, color: f.gim.stance === 'Flat' ? '#4aa3d9' : '#ef6fae', thick: 6 });
      fx(f, { type: 'petals', x: f.x, y: f.y + 90, life: 22, color: f.gim.stance === 'Flat' ? '#4aa3d9' : '#ef6fae' });
      return { done: true };
    },
    walkMul(f) {
      const k = GIM.Semicircle.kv(f);
      return f.gim.stance === 'Flat' ? +k.FlatWalk || 0.85 : +k.ArcWalk || 1.25;
    },
    modify(f, inst) {
      if (!NORMAL_T.has(inst.d.type)) return;
      const k = GIM.Semicircle.kv(f);
      if (f.gim.stance === 'Flat') {
        const r = +k.FlatReach || 1.2;
        inst.hb.x *= r; inst.hb.w *= r;
        if (inst.d.btn === 'H') inst.armorLeft = Math.max(inst.armorLeft, 1);
      } else {
        inst.su = Math.max(1, inst.su - (+k.ArcFaster || 1));
        inst.dc = true;
      }
    },
    color(f) { return f.gim.stance === 'Flat' ? '#4aa3d9' : '#ef6fae'; },
    hud(f) { return [{ text: f.gim.stance === 'Flat' ? 'FLAT STANCE' : 'ARC STANCE', color: GIM.Semicircle.color(f) }]; },
  };
  S.stance = function () {};

  // ================================================================ STAR
  const EL_ORDER = { F: 0, I: 1, L: 2 };
  const EL_COLOR = { F: '#ec5b2b', I: '#5fc4ef', L: '#f5d020' };
  SO.EL_COLOR = EL_COLOR;
  const keyOf = (arr) => arr.slice().sort((a, b) => EL_ORDER[a] - EL_ORDER[b]).join('');
  GIM.Star = {
    init(f) { f.gim.el = []; f.gim.stock = null; },
    press(f, b, p) {
      if (b !== 'U') return null;
      const i = f.inp;
      if (i.motion('214', i.frame, i.frame - p.t + 4)) return null; // để 214U (Stock) xử lý
      let key = null, fromStock = false;
      if (f.gim.el.length) key = keyOf(f.gim.el);
      else if (f.gim.stock) { key = f.gim.stock; fromStock = true; }
      if (!key) return { done: true };
      const m = f.c.spells[key];
      if (!m) return { done: true };
      return { move: m, opts: { inst: { spellKey: key, fromStock } } };
    },
    frame(f, inst, t) {
      if (inst.d.type === 'Spell' && t === inst.su && !inst.consumed) {
        inst.consumed = true;
        if (inst.fromStock) f.gim.stock = null;
        else f.gim.el = [];
      }
    },
    onContact(f, inst) {
      const e = inst.d.kv.Element;
      if (e && inst.d.type !== 'Spell') {
        f.gim.el.push(e);
        if (f.gim.el.length > 3) f.gim.el.shift();
      }
    },
    gatling(f, cur, next) { return !f.chain.includes(next.id); },
    hud(f) {
      return [{ elements: f.gim.el.slice(), stock: f.gim.stock }];
    },
  };
  S.stock = function (f) {
    if (!f.gim.stock && f.gim.el.length) {
      f.gim.stock = keyOf(f.gim.el);
      f.gim.el = [];
      fx(f, { type: 'ring', x: f.x, y: f.y + 100, life: 16, r: 80, color: '#e8c228', thick: 5 });
      fx(f, { type: 'text', x: f.x, y: f.y + 230, text: 'STOCK', life: 30, color: '#b38f00' });
    }
  };
  S.overload = function (f) {
    f.gim.el = ['F', 'I', 'L'];
    fx(f, { type: 'ring', x: f.x, y: f.y + 100, life: 24, r: 160, color: '#e8c228', thick: 8 });
  };
  SO.spellKeyOf = keyOf;
})();
