'use strict';
// =============================================================================
// SQUARED OFF - Hiệu ứng: particle + emitter theo tag Fx của từng chiêu
// Tag Fx đặt trong cột Properties của moves.csv, ví dụ: Fx=fire,heavy  hoặc  Fx=slash:#4aa3d9
// =============================================================================
(function () {
  const SO = window.SO;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const MAX_PARTS = 700;

  function emit(W, k, x, y, o) {
    if (W.parts.length > MAX_PARTS) W.parts.shift();
    W.parts.push(Object.assign({ k, x, y, vx: 0, vy: 0, g: 0, drag: 0.96, life: 20, t: 0, size: 10, color: '#fff', rot: Math.random() * 6.28, vr: rnd(-0.2, 0.2) }, o));
  }
  SO.emit = emit;

  // điểm "tay" của chiêu: tâm hitbox khi active, cạnh người khi startup
  function hand(src, inst) {
    const hb = inst && inst.hb;
    if (hb && hb.w > 0) return { x: src.x + src.facing * hb.x, y: src.y + hb.y, w: hb.w, h: hb.h };
    return { x: src.x + src.facing * src.c.w * 0.55, y: src.y + src.c.h * 0.6, w: 60, h: 60 };
  }

  const EMIT = {
    fire(W, src, inst, t, col, ph) {
      if (!(ph.active || ph.late)) return;
      const h = hand(src, inst);
      const n = ph.big ? 5 : 3;
      for (let i = 0; i < n; i++) {
        emit(W, 'flame', h.x + rnd(-h.w, h.w) * 0.35, h.y + rnd(-h.h, h.h) * 0.3, {
          vx: src.facing * rnd(-1, 2) + rnd(-1, 1), vy: rnd(2, 6), drag: 0.92, life: rnd(14, 24) | 0, size: rnd(16, 32) * (ph.big ? 1.3 : 1),
        });
      }
    },
    ice(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      for (let i = 0; i < 2; i++) emit(W, 'shard', h.x + rnd(-20, 20), h.y + rnd(-20, 20), { vx: rnd(-6, 6) + src.facing * 3, vy: rnd(-2, 8), g: 0.5, life: 22, size: rnd(8, 16), color: '#cfefff' });
      if (t % 2 === 0) emit(W, 'smoke', h.x, h.y, { vx: src.facing * 2, vy: 1, life: 20, size: 26, color: 'rgba(200,235,255,0.6)' });
    },
    elec(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      emit(W, 'bolt', h.x + rnd(-h.w, h.w) * 0.4, h.y + rnd(-h.h, h.h) * 0.4, { life: 6, size: rnd(30, 60), color: col || '#ffe14d', drag: 1 });
      emit(W, 'spark', h.x, h.y, { vx: rnd(-9, 9), vy: rnd(-6, 9), life: 10, size: 3, color: col || '#ffe14d' });
    },
    prism(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      emit(W, 'rainbow', h.x + rnd(-30, 30), h.y + rnd(-30, 30), { vx: rnd(-2, 2), vy: rnd(-1, 3), life: 22, size: rnd(5, 10), hue: (W.frame * 12) % 360 });
    },
    wind(W, src, inst, t, col, ph) {
      if (!ph.active || t % 2) return;
      for (let i = 0; i < 2; i++) emit(W, 'streak', src.x + rnd(-80, 80), src.y + rnd(20, src.c.h), { vx: -src.facing * rnd(8, 14), vy: rnd(-1, 1), life: 10, size: rnd(30, 60), color: col || 'rgba(120,140,160,0.7)', drag: 0.9 });
    },
    spin() {},
    quake(W, src, inst, t, col, ph) {
      if (!ph.first || src.y > 10) return;
      const h = hand(src, inst);
      for (let i = 0; i < 12; i++) emit(W, 'debris', h.x + rnd(-60, 60), 5, { vx: rnd(-7, 7), vy: rnd(6, 16), g: 0.8, life: 40, size: rnd(8, 18), color: '#8d7457', drag: 0.99 });
      for (let i = 0; i < 6; i++) emit(W, 'dust', h.x + rnd(-90, 90), 10, { vx: rnd(-3, 3), vy: rnd(0, 2), life: 30, size: rnd(30, 50), color: 'rgba(170,150,120,0.55)' });
      W.fx.push({ type: 'crack', x: h.x, y: 0, t: 0, life: 50 });
      W.quake = Math.max(W.quake, 14);
    },
    heavy(W, src, inst, t, col, ph) {
      if (!ph.first) return;
      const h = hand(src, inst);
      W.fx.push({ type: 'ring', x: h.x, y: h.y, t: 0, life: 12, r: 90, color: col || '#444', thick: 5 });
      for (let i = 0; i < 6; i++) emit(W, 'streak', h.x, h.y, { vx: Math.cos(i) * 10, vy: Math.sin(i) * 10, life: 8, size: 40, color: 'rgba(60,60,60,0.6)', drag: 0.85 });
    },
    slash(W, src, inst, t, col, ph) {
      if (!ph.first) return;
      const h = hand(src, inst);
      for (let i = 0; i < 8; i++) emit(W, 'star', h.x + rnd(-h.w, h.w) * 0.5, h.y + rnd(-h.h, h.h) * 0.5, { vx: rnd(-3, 3), vy: rnd(-2, 4), life: 18, size: rnd(6, 12), color: col || '#fff7c0' });
    },
    petal(W, src, inst, t, col, ph) {
      if (!(ph.active || ph.late) || t % 2) return;
      emit(W, 'petal', src.x + rnd(-60, 60), src.y + rnd(40, 160), { vx: rnd(-3, 3) - src.facing * 2, vy: rnd(-1, 3), g: -0.02, life: 40, size: rnd(9, 14), color: '#ef6fae', vr: rnd(-0.3, 0.3) });
    },
    smoke(W, src, inst, t) {
      if (t !== 1) return;
      for (let i = 0; i < 10; i++) emit(W, 'smoke', src.x + rnd(-50, 50), src.y + rnd(20, 160), { vx: rnd(-3, 3), vy: rnd(0, 3), life: 30, size: rnd(30, 50), color: 'rgba(120,110,130,0.5)' });
    },
    dust(W, src, inst, t, col, ph) {
      if (!ph.active || src.y > 10 || t % 2) return;
      emit(W, 'dust', src.x - src.facing * 30 + rnd(-20, 20), 8, { vx: -src.facing * rnd(1, 4), vy: rnd(0.5, 2), life: 22, size: rnd(20, 34), color: 'rgba(170,150,120,0.5)' });
    },
    spark(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      for (let i = 0; i < 2; i++) emit(W, 'spark', h.x, h.y, { vx: rnd(-10, 10), vy: rnd(-4, 10), g: 0.4, life: 12, size: 3, color: col || '#ffcf3f' });
    },
    metal(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      emit(W, 'spark', h.x, h.y, { vx: rnd(-10, 10), vy: rnd(-2, 10), g: 0.5, life: 12, size: 3, color: '#cfd6dd' });
    },
    stretch(W, src, inst, t, col, ph) {
      if (!ph.active) return;
      const h = hand(src, inst);
      emit(W, 'streak', (src.x + h.x) / 2 + rnd(-40, 40), h.y + rnd(-20, 20), { vx: src.facing * 12, life: 8, size: 50, color: 'rgba(214,91,163,0.6)', drag: 0.9 });
    },
    bounce() {},
    stop() {},
    burst(W, src, inst, t) {
      if (t !== 1) return;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        emit(W, 'star', src.x, src.y + 100, { vx: Math.cos(a) * rnd(8, 16), vy: Math.sin(a) * rnd(8, 16), drag: 0.9, life: 30, size: rnd(8, 16), color: '#ffd23f' });
      }
      W.screenFlash = { t: 0, life: 10, color: 'rgba(255,230,140,0.5)' };
    },
  };

  // vệt bay theo projectile
  const TRAIL = {
    fire(W, p) { emit(W, 'flame', p.x + rnd(-10, 10), p.y + rnd(-10, 10), { vx: -SO.sign(p.vx) * 2, vy: rnd(1, 3), life: 16, size: rnd(14, 24) * Math.min(1.6, p.h / 50) }); },
    ice(W, p) { emit(W, 'shard', p.x, p.y, { vx: rnd(-3, 3), vy: rnd(-1, 4), g: 0.4, life: 18, size: rnd(6, 12), color: '#cfefff' }); },
    elec(W, p, col) { emit(W, 'bolt', p.x + rnd(-p.w, p.w) * 0.4, p.y + rnd(-p.h, p.h) * 0.4, { life: 5, size: rnd(20, 40), color: col || '#ffe14d', drag: 1 }); },
    prism(W, p) { emit(W, 'rainbow', p.x - SO.sign(p.vx) * p.w * 0.4, p.y + rnd(-p.h, p.h) * 0.3, { vx: -SO.sign(p.vx) * 2, vy: rnd(-1, 1), life: 20, size: rnd(5, 9), hue: (W.frame * 15 + p.id * 40) % 360 }); },
    bounce(W, p) { emit(W, 'star', p.x, p.y, { vx: -SO.sign(p.vx) * 2, vy: rnd(-1, 2), life: 14, size: 7, color: '#d65ba3' }); },
    stop(W, p) { emit(W, 'smoke', p.x, p.y, { vx: -SO.sign(p.vx), life: 14, size: 18, color: 'rgba(201,58,58,0.35)' }); },
    spin(W, p) { emit(W, 'spark', p.x, p.y - p.h * 0.3, { vx: rnd(-6, 6), vy: rnd(0, 6), g: 0.4, life: 10, size: 3, color: '#d2683a' }); },
    spark(W, p) { emit(W, 'spark', p.x, p.y, { vx: rnd(-5, 5), vy: rnd(0, 5), g: 0.4, life: 10, size: 3, color: '#ffcf3f' }); },
    default(W, p) { emit(W, 'dust', p.x - SO.sign(p.vx) * p.w * 0.4, p.y, { vx: -SO.sign(p.vx), life: 12, size: 12, color: 'rgba(120,120,140,0.35)' }); },
  };

  function phase(inst, t) {
    const su = inst.su, act = Math.max(1, inst.d.isProj ? 1 : inst.act);
    return {
      startup: t < su, active: t >= su && t < su + act, first: t === su,
      late: t >= su - 3 && t < su, big: (inst.d.dmg || 0) >= 90 || inst.d.type === 'Super',
    };
  }

  function runEmitters(W, src, inst, t) {
    const d = inst.d;
    if (!d.fx || !d.fx.length) return;
    const ph = phase(inst, t);
    for (const fx of d.fx) if (EMIT[fx.name]) EMIT[fx.name](W, src, inst, t, fx.color, ph);
  }

  SO.FXR = {
    tick(W) {
      for (const f of W.f) {
        if (f.state === 'attack' && f.move && f.hitstop <= 0) runEmitters(W, f, f.move, f.mf);
        const cy = f.gim && f.gim.cyl;
        if (cy && cy.st === 'attack' && cy.inst) runEmitters(W, { x: cy.x, y: cy.y, facing: cy.facing, c: { w: 64, h: 110 } }, cy.inst, cy.mf);
        // bụi khi dash / chạm đất
        if (f.state === 'dash' && W.frame % 3 === 0) emit(W, 'dust', f.x - f.facing * 30, 6, { vx: -f.facing * 2, vy: 1, life: 18, size: 22, color: 'rgba(170,150,120,0.45)' });
        if (f.state === 'airhit' && f.sf < 12 && f.vy > 5 && W.frame % 2 === 0) for (let i = 0; i < 2; i++) emit(W, 'streak', f.x + rnd(-40, 40), f.y + rnd(20, f.c.h * 0.8), { vx: -f.vx * 1.5, vy: -f.vy * 1.2, drag: 0.8, life: 10, size: 70, color: 'rgba(80,80,80,0.55)' });
        if (f.state === 'airdash' && f.sf < 3) for (let i = 0; i < 3; i++) emit(W, 'streak', f.x - f.facing * f.adDir * 40, f.y + rnd(30, f.c.h), { vx: -f.facing * f.adDir * 14, life: 8, size: 60, color: 'rgba(90,110,140,0.6)', drag: 0.85 });
      }
      for (const p of W.projs) {
        if (p.dead || p.delay > 0 || p.hitstop > 0 || W.frame % 2) continue;
        if (p.kind === 'beam' || p.kind === 'line') continue;
        const fx = p.inst.d.fx;
        if (fx && fx.length) { for (const x of fx) (TRAIL[x.name] || (() => {}))(W, p, x.color); }
        else if (p.kind === 'straight' || p.kind === 'orb' || p.kind === 'angled' || p.kind === 'disc') TRAIL.default(W, p);
      }
    },
    update(W) {
      for (const p of W.parts) {
        p.t++;
        p.vy -= p.g;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.k === 'debris' && p.y < 4) { p.y = 4; p.vy = -p.vy * 0.3; p.vx *= 0.6; }
      }
      W.parts = W.parts.filter((p) => p.t < p.life);
      if (W.quake > 0) W.quake--;
      if (W.screenFlash) { W.screenFlash.t++; if (W.screenFlash.t >= W.screenFlash.life) W.screenFlash = null; }
    },
    onHit(W, c, dmg, ch) {
      const d = c.inst.d, b = c.box;
      const x = b.cx - SO.sign(b.cx - c.def.x) * b.w * 0.25, y = b.cy;
      const lvl = d.type === 'Super' ? 3 : d.hsd >= 10 || dmg >= 60 ? 2 : d.hsd >= 6 ? 1 : 0;
      const n = [5, 9, 14, 20][lvl];
      const col = ch ? '#ff4433' : '#ffffff';
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = rnd(6, 12 + lvl * 4);
        emit(W, 'spark', x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.86, life: 10 + lvl * 2, size: 3 + lvl, color: i % 3 ? col : (ch ? '#ffb000' : '#ffe680') });
      }
      W.fx.push({ type: 'impact', x, y, t: 0, life: 8 + lvl * 3, size: 40 + lvl * 30, color: ch ? '#d22' : '#222', lvl });
      if (lvl >= 2) W.screenFlash = { t: 0, life: lvl === 3 ? 8 : 4, color: ch ? 'rgba(255,60,40,0.3)' : 'rgba(255,255,255,0.35)' };
      if (lvl >= 2) W.quake = Math.max(W.quake, 4 + lvl * 2);
      // hiệu ứng theo nguyên tố khi trúng
      for (const fx of d.fx || []) {
        if (fx.name === 'fire') for (let i = 0; i < 10; i++) emit(W, 'flame', x + rnd(-30, 30), y + rnd(-30, 30), { vx: rnd(-4, 4), vy: rnd(2, 7), life: 20, size: rnd(20, 36) });
        if (fx.name === 'ice') for (let i = 0; i < 10; i++) emit(W, 'shard', x, y, { vx: rnd(-9, 9), vy: rnd(-3, 10), g: 0.5, life: 26, size: rnd(8, 16), color: '#cfefff' });
        if (fx.name === 'elec') for (let i = 0; i < 4; i++) emit(W, 'bolt', x + rnd(-40, 40), y + rnd(-40, 40), { life: 8, size: rnd(40, 80), color: fx.color || '#ffe14d', drag: 1 });
        if (fx.name === 'slash') W.fx.push({ type: 'slashhit', x, y, t: 0, life: 12, color: fx.color || '#fff', ang: rnd(-0.9, -0.4) });
        if (fx.name === 'petal') for (let i = 0; i < 8; i++) emit(W, 'petal', x, y, { vx: rnd(-6, 6), vy: rnd(-2, 7), g: 0.05, life: 36, size: rnd(9, 14), color: '#ef6fae' });
        if (fx.name === 'prism') for (let i = 0; i < 10; i++) emit(W, 'rainbow', x, y, { vx: rnd(-8, 8), vy: rnd(-6, 8), drag: 0.9, life: 24, size: rnd(6, 10), hue: i * 36 });
      }
    },
    onBlock(W, c, fd) {
      const b = c.box;
      const x = b.cx - SO.sign(b.cx - c.def.x) * b.w * 0.3, y = b.cy;
      for (let i = 0; i < 6; i++) emit(W, 'spark', x, y, { vx: -SO.sign(b.cx - c.def.x) * rnd(-2, 8) * -1, vy: rnd(-6, 6), drag: 0.85, life: 9, size: 3, color: fd ? '#5c5' : '#8cf' });
    },
    onKO(W) {
      W.screenFlash = { t: 0, life: 24, color: 'rgba(255,255,255,0.6)' };
      W.quake = 20;
    },
  };
})();
