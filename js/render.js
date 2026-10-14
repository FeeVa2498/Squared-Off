'use strict';
// =============================================================================
// SQUARED OFF - Render: phong cách nét chì / crayon rung (boiling line)
// =============================================================================
(function () {
  const SO = window.SO;
  const C = SO.CFG;
  const R = (SO.R = { debug: false, frameData: true, W: 1920, H: 1080, GROUND: 850, cam: { x: 440, scale: 1, offY: 0, init: false } });
  const FONT = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", cursive';
  R.FONT = FONT;
  const INK = '#2a2a2a';

  R.seed = 0; // đổi mỗi 6 frame => nét rung
  const jit = (i, s, a) => (SO.hash(i * 7 + 3, s) - 0.5) * 2 * a;

  R.shade = function (hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  // vẽ đa giác với nét rung
  R.sketchPoly = function (ctx, pts, seed, o) {
    o = o || {};
    const s = R.seed + seed * 13;
    const amp = o.amp === undefined ? 2.2 : o.amp;
    // chia nhỏ cạnh
    const sub = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const n = o.noSub ? 1 : Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 22));
      for (let k = 0; k < n; k++) sub.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.beginPath();
      sub.forEach((p, i) => {
        const x = p[0] + jit(i, s + 5, amp * 0.6), y = p[1] + jit(i + 99, s + 5, amp * 0.6);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      if (o.hatch) R.hatch(ctx, sub, s, o.hatch);
    }
    if (o.stroke !== null) {
      ctx.strokeStyle = o.stroke || INK;
      ctx.lineWidth = o.width || 3.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let pass = 0; pass < (o.passes || 2); pass++) {
        ctx.beginPath();
        sub.forEach((p, i) => {
          const x = p[0] + jit(i, s + pass * 31, amp), y = p[1] + jit(i + 57, s + pass * 31, amp);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.globalAlpha *= pass ? 0.55 : 1;
        ctx.stroke();
        if (pass) ctx.globalAlpha /= 0.55;
      }
    }
  };
  R.hatch = function (ctx, pts, s, color) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    pts.forEach((p) => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    for (let x = minx - (maxy - miny); x < maxx; x += 11) {
      ctx.moveTo(x + jit(x, s, 2), maxy);
      ctx.lineTo(x + (maxy - miny) + jit(x + 1, s, 2), miny);
    }
    ctx.stroke();
    ctx.restore();
  };
  R.sketchEllipse = function (ctx, cx, cy, rx, ry, seed, o) {
    const pts = [];
    const n = Math.max(14, Math.round((rx + ry) / 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    R.sketchPoly(ctx, pts, seed, Object.assign({ noSub: true }, o));
  };
  R.sketchRect = function (ctx, x, y, w, h, seed, o) {
    R.sketchPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], seed, o);
  };
  R.sketchLine = function (ctx, x1, y1, x2, y2, seed, o) {
    o = o || {};
    const s = R.seed + seed * 17;
    const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 18));
    ctx.strokeStyle = o.stroke || INK;
    ctx.lineWidth = o.width || 4;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const x = x1 + ((x2 - x1) * k) / n + (k && k < n ? jit(k, s + pass * 9, 2.2) : jit(k, s, 0.8));
        const y = y1 + ((y2 - y1) * k) / n + (k && k < n ? jit(k + 40, s + pass * 9, 2.2) : jit(k + 3, s, 0.8));
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.globalAlpha *= pass ? 0.5 : 1;
      ctx.stroke();
      if (pass) ctx.globalAlpha /= 0.5;
    }
  };
  // đường gấp khúc (tay/chân) qua khớp
  R.limb = function (ctx, pts, seed, o) {
    for (let i = 0; i + 1 < pts.length; i++) R.sketchLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], seed + i * 3, o);
  };

  R.shapePoints = function (shape, w, h, extra) {
    const pts = [];
    const poly = (n, rot) => {
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        pts.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]);
      }
    };
    switch (shape) {
      case 'circle': case 'oval': poly(26, 0); break;
      case 'square': pts.push([-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]); break;
      case 'triangle': pts.push([0, -h / 2 - 6], [w / 2 + 4, h / 2], [-w / 2 - 4, h / 2]); break;
      case 'cone': pts.push([0, -h / 2 - 10], [w / 2, h / 2], [-w / 2, h / 2]); break;
      case 'rhombus': pts.push([0, -h / 2 - 6], [w / 2 + 6, 0], [0, h / 2 + 6], [-w / 2 - 6, 0]); break;
      case 'hexagon': poly(6, 0); break;
      case 'octagon': poly(8, Math.PI / 8); break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.45 : 1;
          pts.push([Math.cos(a) * w / 2 * r * 1.12, Math.sin(a) * h / 2 * r * 1.12 + 4]);
        }
        break;
      case 'semicircle': {
        const flatDown = extra !== 'Arc';
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI + (i / 14) * Math.PI;
          pts.push([Math.cos(a) * w / 2, (flatDown ? h / 4 : -h / 4) + Math.sin(a) * h * 0.75 * (flatDown ? 1 : -1)]);
        }
        break;
      }
      default: poly(20, 0);
    }
    return pts;
  };

  R.box = function (ctx, b, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.fillRect(b.cx - b.w / 2, -(b.cy + b.h / 2), b.w, b.h);
    ctx.strokeRect(b.cx - b.w / 2, -(b.cy + b.h / 2), b.w, b.h);
  };

  // ------------------------------------------------------------------ camera
  R.updateCam = function (W) {
    const [a, b] = W.f;
    const mid = (a.x + b.x) / 2;
    const viewW = C.VIEW_W; // zoom cố định
    const scale = R.W / viewW;
    const camX = SO.clamp(mid - viewW / 2, 0, C.STAGE_W - viewW);
    const top = Math.max(a.y + a.c.h, b.y + b.c.h);
    const offY = Math.max(0, top - 720) * 0.7;
    const cam = R.cam;
    if (!cam.init) { cam.x = camX; cam.scale = scale; cam.offY = offY; cam.init = true; }
    cam.x = camX;
    cam.scale = scale;
    cam.offY += (offY - cam.offY) * 0.15;
    // cố định trong biên
    const vw = R.W / cam.scale;
    cam.x = SO.clamp(cam.x, 0, C.STAGE_W - vw);
  };
  R.worldTransform = function (ctx, shake) {
    const cam = R.cam;
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale + sx, R.GROUND + cam.offY * cam.scale + sy);
  };

  // ------------------------------------------------------------------ background
  R.drawPaper = function (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f6f1e3';
    ctx.fillRect(0, 0, R.W, R.H);
    ctx.strokeStyle = 'rgba(80,130,200,0.18)';
    ctx.lineWidth = 2;
    for (let y = 70; y < R.H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(R.W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,80,80,0.25)';
    ctx.beginPath(); ctx.moveTo(130, 0); ctx.lineTo(130, R.H); ctx.stroke();
  };
  R.drawStage = function (ctx, W) {
    const cam = R.cam;
    // parallax doodles
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale * 0.4, R.GROUND + cam.offY * cam.scale);
    ctx.globalAlpha = 0.55;
    // mặt trời
    R.sketchEllipse(ctx, 900, -720, 70, 70, 1, { stroke: '#e0a020', width: 4, fill: 'rgba(255,214,90,0.35)' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + W.frame * 0.002;
      R.sketchLine(ctx, 900 + Math.cos(a) * 95, -720 + Math.sin(a) * 95, 900 + Math.cos(a) * 125, -720 + Math.sin(a) * 125, 5 + i, { stroke: '#e0a020', width: 3 });
    }
    // núi
    R.sketchPoly(ctx, [[-200, 0], [250, -330], [600, 0]], 2, { stroke: '#7a8b9a', width: 3, fill: 'rgba(160,180,200,0.25)' });
    R.sketchPoly(ctx, [[400, 0], [800, -260], [1150, 0]], 3, { stroke: '#7a8b9a', width: 3, fill: 'rgba(160,180,200,0.2)' });
    R.sketchPoly(ctx, [[1300, 0], [1700, -380], [2100, 0]], 4, { stroke: '#7a8b9a', width: 3, fill: 'rgba(160,180,200,0.22)' });
    // mây
    for (const [cx, cy, s] of [[200, -600, 1], [1450, -680, 1.3], [2000, -560, 0.9]]) {
      const x = cx + ((W.frame * 0.15 * s) % 400);
      R.sketchEllipse(ctx, x, cy, 70 * s, 30 * s, 8, { stroke: '#8aa', width: 3, fill: 'rgba(255,255,255,0.6)' });
      R.sketchEllipse(ctx, x + 50 * s, cy - 18 * s, 50 * s, 28 * s, 9, { stroke: '#8aa', width: 3, fill: 'rgba(255,255,255,0.6)' });
    }
    ctx.restore();
    // mặt đất
    R.worldTransform(ctx, W.shake);
    ctx.fillStyle = 'rgba(120,170,90,0.18)';
    ctx.fillRect(-100, 0, C.STAGE_W + 200, 400);
    R.sketchLine(ctx, -50, 0, C.STAGE_W + 50, 0, 11, { stroke: '#4c6b3c', width: 5 });
    for (let x = 40; x < C.STAGE_W; x += 90) {
      const h = 10 + SO.hash(x, 3) * 14;
      R.sketchLine(ctx, x, 0, x - 6, -h, x, { stroke: '#5b8a46', width: 2.5 });
      R.sketchLine(ctx, x + 8, 0, x + 12, -h * 0.8, x + 1, { stroke: '#5b8a46', width: 2.5 });
    }
    // tường hai bên
    for (const wx of [80, C.STAGE_W - 80]) {
      R.sketchRect(ctx, wx - (wx < 100 ? 70 : 0), -900, 70, 900, wx, { fill: 'rgba(150,120,90,0.25)', stroke: '#6b5440', width: 4, hatch: '#6b5440' });
    }
  };

  // ------------------------------------------------------------------ fighters
  function fighterColor(f) {
    let col = f.c.color;
    if (f.G && f.G.color) col = f.G.color(f);
    if (f.idx === 1 && f.w.f[0].name === f.name) col = R.shade(col, -0.3);
    return col;
  }
  R.fighterColor = fighterColor;

  function pose(f) {
    const c = f.c, s = f.state, W = f.w;
    const P = {
      crouch: f.isCrouchPose() ? 1 : 0, lean: 0, lying: false, armT: null, legT: null, tuck: 0,
      hurt: false, guard: false, walk: 0, rot: 0, squash: 1,
    };
    if (s === 'walk' || s === 'dash') P.walk = W.frame * (s === 'dash' ? 0.45 : 0.22);
    if (s === 'idle') P.squash = 1 + Math.sin(W.frame * 0.08 + f.idx) * 0.02;
    if (s === 'prejump' || s === 'land') { P.crouch = 0.5; }
    if (s === 'air' || s === 'airdash' || (s === 'attack' && f.moveAir)) P.tuck = 1;
    if (s === 'airdash') P.lean = 0.35;
    if (s === 'hitstun' || s === 'airhit' || s === 'thrown' || s === 'recoil') { P.hurt = true; P.lean = -0.3; }
    if (s === 'airhit') P.rot = -0.6 * f.facing + Math.sin(f.sf * 0.2) * 0.2;
    if (s === 'knockdown' || s === 'wakeup' || (s === 'ko' && f.y <= 1)) {
      P.lying = true;
      if (s === 'wakeup') P.lyingT = f.sf / C.WAKEUP;
    }
    if (s === 'block' || f.guard) P.guard = true;
    if (s === 'backdash') P.lean = -0.25;
    if (s === 'dash') P.lean = 0.25;
    if (s === 'throwing') P.armT = { x: f.facing * (c.w * 0.75), y: c.h * 0.55 };
    if (s === 'attack' && f.move) {
      const m = f.move, t = f.mf;
      const hb = m.hb;
      if (m.d.hasHitbox && !m.d.isProj && hb.w > 0) {
        let k;
        if (t < m.su) k = t / m.su;
        else if (t < m.su + m.act) k = 1;
        else k = Math.max(0, 1 - (t - m.su - m.act) / Math.max(1, m.rec * 0.7));
        const tx = f.facing * (hb.x + hb.w * 0.35), ty = hb.y;
        const kick = hb.y < c.h * 0.42 || (m.d.btn === 'H' && f.moveAir && hb.y < c.h * 0.6);
        if (kick && !(R.WEAPONS[c.weapon] && (R.WEAPONS[c.weapon].blade || R.WEAPONS[c.weapon].pole) && m.d.btn !== 'L' && hb.y > 30)) P.legT = { x: tx, y: ty, k };
        else P.armT = { x: tx, y: ty, k, hit: true };
        P.lean = 0.18 * k * (hb.y > c.h ? -1 : 1);
      } else if (m.d.isProj || m.d.type === 'Spell' || m.d.kv.Detonate || m.d.type === 'Unique') {
        const k = t < m.su ? t / m.su : Math.max(0, 1 - (t - m.su) / Math.max(1, m.rec));
        P.armT = { x: f.facing * c.w * 0.85, y: c.h * 0.62, k };
      }
      if (m.d.vel.length && m.d.vel.some((v) => v.vy > 0) && t >= m.su) P.armT = { x: f.facing * c.w * 0.3, y: c.h * 1.15, k: 1 };
    }
    return P;
  }

  // ------------------------------------------------------------------ vũ khí
  // len = chiều dài lưỡi/cán (px), idle = góc cầm khi đứng yên (rad, âm = chĩa lên trước)
  R.WEAPONS = {
    greatsword: { blade: true, len: 175, w: 30, twoHand: true, color: '#c9d1d8', idle: -1.0, grip: 30 },
    longsword: { blade: true, len: 140, w: 17, color: '#d6dde3', idle: -1.15, grip: 22 },
    katana: { blade: true, len: 132, w: 11, curve: 0.12, color: '#e7ecf0', idle: -1.25, grip: 26 },
    dual_blades: { blade: true, len: 74, w: 13, dual: true, color: '#dfe5ea', idle: -0.55, grip: 14 },
    staff: { pole: true, len: 185, color: '#8a6a45', idle: -1.42, tipKind: 'hex' },
    stop_sign: { pole: true, len: 160, color: '#9aa1a8', idle: -1.42, tipKind: 'stop' },
    knuckles: { gloves: true },
    spellbook: { book: true },
    slingshot: { sling: true },
    marionette: { cross: true },
  };

  R.weaponPose = function (w, WP) {
    const f = w.f, fc = w.fc, h = w.front.hand;
    const rev = f.c.weapon === 'katana' && f.gim && f.gim.stance === 'Arc';
    let ang;
    if (w.target) {
      ang = Math.atan2(w.target.y - h[1], w.target.x - h[0]);
      // cầm ngược: lưỡi xoay từ phía sau ra trước theo tiến độ đòn
      if (rev && w.target.k < 1) ang += fc * 2.4 * (1 - w.target.k);
    } else if (w.P.lying) ang = fc > 0 ? 0.2 : Math.PI - 0.2;
    else if (w.P.hurt) ang = fc > 0 ? 2.5 : Math.PI - 2.5;
    else {
      let a = WP.idle || -1;
      if (rev) a = 1.95;
      if (w.P.guard) a = rev ? 1.6 : -1.5;
      if (w.P.crouch && !rev) a += 0.35;
      if (f.state === 'attack' && f.move && !w.target) a = rev ? 1.2 : -0.35; // chiêu không có hitbox (cast, lao...)
      ang = fc > 0 ? a : Math.PI - a;
    }
    const len = WP.len || 0;
    return { ang, base: h, tip: [h[0] + Math.cos(ang) * len, h[1] + Math.sin(ang) * len] };
  };

  function bladePoly(h, ang, len, wd, grip, curve) {
    const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
    const pts = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N, wd2 = wd * (i === N ? 0 : 1 - t * 0.25) * 0.5;
      const bend = curve ? Math.sin(t * Math.PI * 0.5) * curve * len : 0;
      pts.push([h[0] + ca * len * t + px * (wd2 + bend), h[1] + sa * len * t + py * (wd2 + bend)]);
    }
    for (let i = N - 1; i >= 0; i--) {
      const t = i / N, wd2 = wd * (1 - t * 0.25) * 0.5;
      const bend = curve ? Math.sin(t * Math.PI * 0.5) * curve * len : 0;
      pts.push([h[0] + ca * len * t + px * (-wd2 + bend), h[1] + sa * len * t + py * (-wd2 + bend)]);
    }
    return pts;
  }
  function drawBlade(ctx, h, ang, WP, colBlade, ink, seed, scale) {
    scale = scale || 1;
    const len = WP.len * scale, wd = WP.w * scale, ca = Math.cos(ang), sa = Math.sin(ang);
    // chuôi
    R.sketchLine(ctx, h[0] - ca * WP.grip, h[1] - sa * WP.grip, h[0], h[1], seed + 1, { stroke: '#3a2a1e', width: Math.max(6, wd * 0.45) });
    // lưỡi
    R.sketchPoly(ctx, bladePoly([h[0] + ca * 6, h[1] + sa * 6], ang, len, wd, 0, WP.curve), seed, { fill: colBlade, stroke: ink, width: 3, noSub: true, amp: 1.1 });
    // đường gân lưỡi
    ctx.strokeStyle = 'rgba(80,90,100,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(h[0] + ca * 14, h[1] + sa * 14); ctx.lineTo(h[0] + ca * len * 0.8, h[1] + sa * len * 0.8); ctx.stroke();
    // chắn tay
    const px = -sa, py = ca, gw = Math.max(16, wd * 1.3);
    R.sketchLine(ctx, h[0] + px * gw, h[1] + py * gw, h[0] - px * gw, h[1] - py * gw, seed + 2, { stroke: ink, width: 6 });
  }

  R.drawWeapon = function (ctx, w, WP, layer, wt) {
    const ghost = w.ghost, ink = ghost ? w.ink : INK;
    const seed = 600 + w.f.idx * 40;
    const metal = (c) => (ghost ? w.col : c);
    const f = w.f, fc = w.fc;
    if (WP.blade) {
      if (layer === 'back' && WP.dual) {
        const h = w.back.hand;
        const a = w.target ? wt.ang + fc * 0.5 : fc > 0 ? -0.2 : Math.PI + 0.2;
        drawBlade(ctx, h, a, WP, metal(WP.color), ink, seed + 10);
      }
      if (layer === 'front') drawBlade(ctx, wt.base, wt.ang, WP, metal(WP.color), ink, seed);
      return;
    }
    if (WP.pole && layer === 'front') {
      const h = wt.base, ca = Math.cos(wt.ang), sa = Math.sin(wt.ang);
      const b0 = [h[0] - ca * WP.len * 0.3, h[1] - sa * WP.len * 0.3];
      R.sketchLine(ctx, b0[0], b0[1], wt.tip[0], wt.tip[1], seed, { stroke: metal(WP.color), width: 9 });
      R.sketchLine(ctx, b0[0], b0[1], wt.tip[0], wt.tip[1], seed + 1, { stroke: ink, width: 2 });
      const tx = wt.tip[0], ty = wt.tip[1];
      if (WP.tipKind === 'stop') {
        const pts = [];
        for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * Math.PI * 2; pts.push([tx + Math.cos(a) * 32, ty + Math.sin(a) * 32]); }
        R.sketchPoly(ctx, pts, seed + 2, { fill: ghost ? w.col : '#d23a32', stroke: ghost ? ink : '#fff', width: 4, noSub: true, amp: 1 });
        if (!ghost) {
          ctx.fillStyle = '#fff'; ctx.font = 'bold 17px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('STOP', tx, ty + 6);
        }
      } else {
        const pts = [];
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pts.push([tx + Math.cos(a) * 20, ty + Math.sin(a) * 20]); }
        if (!ghost && f.state === 'attack') { ctx.globalAlpha *= 0.4; R.sketchEllipse(ctx, tx, ty, 34, 34, seed + 5, { fill: '#7ff0c0', stroke: null }); ctx.globalAlpha /= 0.4; }
        R.sketchPoly(ctx, pts, seed + 3, { fill: ghost ? w.col : '#bdf0d8', stroke: ghost ? ink : '#1f7a58', width: 4, noSub: true, amp: 1 });
      }
      return;
    }
    if (WP.gloves && layer === 'hand') {
      for (const arm of [w.back, w.front]) {
        const [x, y] = arm.hand;
        const r = f.c.w * 0.17;
        R.sketchEllipse(ctx, x, y, r * 1.15, r, seed + (arm === w.front ? 7 : 8), { fill: ghost ? w.col : '#d8a62a', stroke: ink, width: 4, hatch: ghost ? null : '#8a6410' });
        if (!ghost) {
          ctx.fillStyle = '#5b4a3a';
          for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + fc * r * 0.8, y + i * r * 0.5, 4.5, 0, 7); ctx.fill(); }
        }
      }
      return;
    }
    if (WP.book) {
      const casting = f.state === 'attack' && f.move;
      if ((layer === 'back' && !casting) || (layer === 'hand' && casting)) {
        const base = casting ? [w.front.hand[0] + fc * 26, w.front.hand[1] - 10] : [w.back.hand[0] - fc * 6, w.back.hand[1] - 6];
        const bob = Math.sin((f.w.frame || 0) * 0.12) * 3;
        const x = base[0], y = base[1] + bob;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fc * (casting ? -0.15 : 0.25));
        if (casting && !ghost) {
          ctx.globalAlpha *= 0.35;
          R.sketchEllipse(ctx, 0, 0, 46, 38, seed + 4, { fill: '#fff2a6', stroke: null });
          ctx.globalAlpha /= 0.35;
          R.sketchPoly(ctx, [[-30, -20], [0, -14], [30, -20], [30, 18], [0, 22], [-30, 18]], seed + 5, { fill: ghost ? w.col : '#fffaf0', stroke: ink, width: 3, noSub: true, amp: 1 });
          ctx.strokeStyle = ink; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 22); ctx.stroke();
          ctx.strokeStyle = 'rgba(90,90,90,0.5)';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-24, -8 + i * 9); ctx.lineTo(-6, -6 + i * 9); ctx.moveTo(6, -6 + i * 9); ctx.lineTo(24, -8 + i * 9); ctx.stroke(); }
        } else {
          R.sketchRect(ctx, -20, -26, 40, 52, seed + 6, { fill: ghost ? w.col : '#6b3fa0', stroke: ink, width: 3, hatch: ghost ? null : '#3d2160' });
          if (!ghost) {
            ctx.fillStyle = '#f2d06b';
            ctx.beginPath();
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 4 : 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
            ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      }
      return;
    }
    if (WP.sling && layer === 'hand') {
      const [x, y] = w.front.hand;
      const wood = ghost ? w.col : '#8a5a2a';
      R.sketchLine(ctx, x, y + 4, x, y + 26, seed, { stroke: wood, width: 6 });
      R.sketchLine(ctx, x, y + 4, x + fc * 6 - 10, y - 20, seed + 1, { stroke: wood, width: 5 });
      R.sketchLine(ctx, x, y + 4, x + fc * 6 + 10, y - 20, seed + 2, { stroke: wood, width: 5 });
      if (!ghost) {
        const pull = f.state === 'attack' && f.move && f.mf < f.move.su ? 26 : 6;
        ctx.strokeStyle = '#d65ba3'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + fc * 6 - 10, y - 20); ctx.lineTo(x - fc * pull, y - 12); ctx.lineTo(x + fc * 6 + 10, y - 20); ctx.stroke();
      }
      return;
    }
    if (WP.cross && layer === 'hand') {
      const [x, y] = w.front.hand;
      const wood = ghost ? w.col : '#a0703a';
      R.sketchLine(ctx, x - 24, y - 14, x + 24, y - 14, seed, { stroke: wood, width: 6 });
      R.sketchLine(ctx, x, y - 34, x, y + 6, seed + 1, { stroke: wood, width: 6 });
      if (!ghost) {
        ctx.strokeStyle = 'rgba(60,50,40,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
        for (const ox of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(x + ox, y - 14); ctx.lineTo(x + ox + fc * 8, y + 70); ctx.stroke(); }
        ctx.setLineDash([]);
      }
    }
  };

  R.drawFighter = function (ctx, f, opt) {
    opt = opt || {};
    const ghost = !!opt.ghost;
    ctx.globalAlpha = ghost ? opt.alpha : f.vanish ? 0.12 : 1;
    const c = f.c, P = pose(f), fc = f.facing;
    const col = ghost ? opt.color : fighterColor(f);
    const ink = ghost ? R.shade(opt.color, -0.25) : INK;
    const limbInk = ghost ? ink : '#3a3a3a';
    const seed = 20 + f.idx * 50;
    if (!ghost && f.invT > 0 && (f.w.frame >> 1) % 2) ctx.globalAlpha *= 0.55;
    ctx.save();
    ctx.translate(f.x, -f.y);
    if (P.lying) {
      const k = P.lyingT || 0;
      ctx.rotate(-fc * (Math.PI / 2) * (1 - k));
      ctx.translate(0, -c.w * 0.35 * (1 - k));
    } else if (P.rot) {
      ctx.translate(0, -c.h * 0.5);
      ctx.rotate(P.rot);
      ctx.translate(0, c.h * 0.5);
    }
    const crouch = P.crouch;
    const bodyCY = -(c.h * 0.62 * (1 - 0.32 * crouch) - (P.tuck ? -c.h * 0.05 : 0));
    const bw = c.w * 0.92 * (P.squash > 1 ? P.squash : 1), bh = c.h * 0.48 * (2 - P.squash);
    const bx = fc * P.lean * 22;
    const hipY = -(c.h * 0.34 * (1 - 0.45 * crouch)) + (P.tuck ? -c.h * 0.08 : 0);
    const legLen = c.h * 0.34;
    const legs = [-1, 1].map((side) => {
      const ph = P.walk ? Math.sin(P.walk + (side > 0 ? 0 : Math.PI)) : 0;
      let fx = side * c.w * 0.22 + ph * 22 * fc;
      let fy = 0;
      let kx = side * c.w * 0.18 + fc * (crouch ? 26 : 8), ky = hipY / 2 + (crouch ? -6 : 0);
      if (P.tuck) { fx = side * c.w * 0.18 + fc * 10; fy = hipY + legLen * 0.45; kx = fc * 24 + side * 10; ky = hipY + legLen * 0.1; }
      if (crouch && !P.tuck) { fx = side * c.w * 0.36; kx = side * c.w * 0.32 + fc * 18; ky = hipY * 0.55; }
      if (P.walk && !P.tuck) fy = -Math.max(0, ph) * 12;
      return { hip: [side * c.w * 0.15, hipY], knee: [kx, ky], foot: [fx, fy] };
    });
    const shY = bodyCY + bh * 0.05;
    const arms = [-1, 1].map((side) => {
      const sh = [bx + side * bw * 0.42, shY];
      let hand = [bx + fc * bw * (side === fc ? 0.75 : 0.35), shY + 18];
      if (P.guard) hand = [bx + fc * bw * 0.6, shY - 10 + side * 14];
      if (P.hurt) hand = [bx - fc * bw * 0.7, shY - 40 + side * 20];
      return { sh, hand };
    });
    const front = fc > 0 ? 1 : -1;
    const frontArm = arms[front > 0 ? 1 : 0], backArm = arms[front > 0 ? 0 : 1];
    const frontLeg = legs[front > 0 ? 1 : 0], backLeg = legs[front > 0 ? 0 : 1];
    const WP = R.WEAPONS[c.weapon] || null;
    let wTarget = null, magicT = null;
    if (P.armT) {
      const k = P.armT.k === undefined ? 1 : P.armT.k;
      let tx = P.armT.x, ty = -P.armT.y;
      // tay thường không dài ra quá tầm (trừ Oval - nhân vật co giãn); đòn xa của Star hiện phép tại hitbox
      if (P.armT.hit && !(WP && (WP.blade || WP.pole)) && c.weapon !== 'slingshot') {
        const sx = frontArm.sh[0], sy = frontArm.sh[1], dx = tx - sx, dy = ty - sy, dd = Math.hypot(dx, dy) || 1;
        const maxR = c.h * 0.5;
        if (dd > maxR) { magicT = { x: tx, y: ty, k }; tx = sx + (dx / dd) * maxR; ty = sy + (dy / dd) * maxR; }
      }
      if (WP && (WP.blade || WP.pole) && P.armT.hit) {
        // vũ khí dài: tay chỉ vươn tới gần, phần lưỡi chạm vào vùng hitbox
        const sx = frontArm.sh[0], sy = frontArm.sh[1], dx = tx - sx, dy = ty - sy, dd = Math.hypot(dx, dy) || 1;
        const reach = Math.max(dd * 0.35, dd - WP.len * 0.75);
        wTarget = { x: tx, y: ty, k };
        tx = sx + (dx / dd) * reach; ty = sy + (dy / dd) * reach;
      }
      frontArm.hand = [frontArm.hand[0] + (tx - frontArm.hand[0]) * k, frontArm.hand[1] + (ty - frontArm.hand[1]) * k];
    }
    if (P.legT) {
      const k = P.legT.k;
      frontLeg.foot = [frontLeg.foot[0] + (P.legT.x - frontLeg.foot[0]) * k, frontLeg.foot[1] + (-P.legT.y - frontLeg.foot[1]) * k];
      frontLeg.knee = [(frontLeg.hip[0] + frontLeg.foot[0]) / 2 + fc * 10 * k, (frontLeg.hip[1] + frontLeg.foot[1]) / 2 - 12 * k];
    }
    const elbow = (a) => [(a.sh[0] + a.hand[0]) / 2 - fc * 6, (a.sh[1] + a.hand[1]) / 2 + 14];
    const limbW = Math.max(4, c.w * 0.045);
    if (!ghost) {
      if (f.buffs.burst > 0) {
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(f.w.frame * 0.3);
        R.sketchEllipse(ctx, bx, bodyCY, bw * 0.9, bh * 1.1, seed + 9, { stroke: '#e6a700', width: 8, fill: 'rgba(255,215,80,0.25)' });
        ctx.globalAlpha = 1;
      }
      if (f.gim.shift) {
        ctx.globalAlpha = 0.45;
        R.sketchPoly(ctx, R.shapePoints('rhombus', bw * 1.35, bh * 1.35).map((p) => [bx + p[0], bodyCY + p[1]]), seed + 8, { stroke: '#8a5ac8', width: 6, fill: null });
        ctx.globalAlpha = 1;
      }
      if (f.gim.install > 0) {
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) {
          const a = f.w.frame * 0.25 + i * 2.1;
          R.sketchLine(ctx, bx + Math.cos(a) * bw * 0.7, bodyCY + Math.sin(a) * bh * 0.7, bx + Math.cos(a + 0.6) * bw * 0.8, bodyCY + Math.sin(a + 0.6) * bh * 0.8, seed + i, { stroke: '#e0574a', width: 4 });
        }
        ctx.globalAlpha = 1;
      }
    }
    const wctx = { f, P, fc, ghost, col, ink, front: frontArm, back: backArm, target: wTarget, bx, bodyCY, bw, bh, c };
    const wtip = WP ? R.weaponPose(wctx, WP) : null;
    if (WP && WP.twoHand && wtip) backArm.hand = [frontArm.hand[0] - Math.cos(wtip.ang) * 18, frontArm.hand[1] - Math.sin(wtip.ang) * 18];
    if (WP) R.drawWeapon(ctx, wctx, WP, 'back', wtip);
    R.limb(ctx, [backArm.sh, elbow(backArm), backArm.hand], seed + 1, { width: limbW, stroke: limbInk });
    R.limb(ctx, [backLeg.hip, backLeg.knee, backLeg.foot], seed + 2, { width: limbW + 1, stroke: limbInk });
    const pts = R.shapePoints(c.shape, bw, bh, f.gim.stance).map((p) => [bx + p[0], bodyCY + p[1]]);
    R.sketchPoly(ctx, pts, seed + 3, { fill: col, stroke: ink, width: 4.5, hatch: ghost ? null : R.shade(col, -0.35) });
    if (!ghost) {
      // mắt (không vẽ miệng)
      const ex = bx + fc * bw * 0.16, ey = bodyCY - bh * 0.08;
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      if (P.hurt || f.state === 'ko' || f.state === 'knockdown') {
        for (const ox of [-10, 12]) {
          ctx.beginPath(); ctx.moveTo(ex + ox - 5, ey - 5); ctx.lineTo(ex + ox + 5, ey + 5); ctx.moveTo(ex + ox + 5, ey - 5); ctx.lineTo(ex + ox - 5, ey + 5); ctx.stroke();
        }
      } else {
        const blink = (f.w.frame + f.idx * 37) % 160 < 6;
        const focus = f.state === 'attack';
        for (const ox of [-10, 12]) {
          if (blink) { ctx.beginPath(); ctx.moveTo(ex + ox - 5, ey); ctx.lineTo(ex + ox + 5, ey); ctx.stroke(); }
          else if (focus) { ctx.beginPath(); ctx.moveTo(ex + ox - 6, ey - 4 - (ox < 0 ? 0 : 2) * fc); ctx.lineTo(ex + ox + 6, ey - 1); ctx.stroke(); ctx.beginPath(); ctx.arc(ex + ox + fc * 2, ey + 3, 4, 0, 7); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(ex + ox + fc * 2, ey, 4.5, 0, 7); ctx.fill(); }
        }
      }
    }
    if (WP) R.drawWeapon(ctx, wctx, WP, 'front', wtip);
    R.limb(ctx, [frontLeg.hip, frontLeg.knee, frontLeg.foot], seed + 4, { width: limbW + 1, stroke: ghost ? ink : INK });
    R.limb(ctx, [frontArm.sh, elbow(frontArm), frontArm.hand], seed + 5, { width: limbW, stroke: ghost ? ink : INK });
    if (WP) R.drawWeapon(ctx, wctx, WP, 'hand', wtip);
    if (!ghost) {
      if (!WP || !WP.gloves) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(frontArm.hand[0], frontArm.hand[1], limbW * 1.4, 0, 7); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      }
      R.drawMoveFx(ctx, f, { bx, bodyCY, bw, bh, magic: magicT, hand: magicT ? [magicT.x, magicT.y] : wtip && (WP.blade || WP.pole) ? wtip.tip : frontArm.hand, realHand: frontArm.hand, foot: frontLeg.foot, hip: frontLeg.hip, sh: frontArm.sh, useLeg: !!P.legT });
      if (f.state === 'block') {
        ctx.globalAlpha = 0.5;
        R.sketchEllipse(ctx, bx + fc * bw * 0.75, bodyCY + (f.crouchBlock ? 20 : 0), 22, bh * 0.8, seed + 7, { stroke: f.fd ? '#3b3' : '#38f', width: 6, fill: f.fd ? 'rgba(80,220,80,0.25)' : 'rgba(80,150,255,0.18)' });
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ hiệu ứng trên người (tọa độ local)
  function flameShape(ctx, x, y, r, color, flick) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * 0.15 + (i / n) * Math.PI * 0.7; // nửa dưới tròn
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.9;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    // ba lưỡi lửa phía trên
    const tips = [[-0.7, 1.5], [0, 2.4], [0.7, 1.7]];
    for (let i = tips.length - 1; i >= 0; i--) {
      const [ox, h] = tips[i];
      ctx.quadraticCurveTo(x + ox * r * 1.2, y - r * 0.2, x + ox * r * 0.6 + flick * r * 0.3, y - r * h * (0.85 + Math.random() * 0.3));
    }
    ctx.closePath();
    ctx.fill();
  }
  function crescent(ctx, cx, cy, R0, a0, a1, thick, fill, stroke, alpha) {
    const N = 18, outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, a = a0 + (a1 - a0) * k;
      const w = thick * Math.sin(Math.PI * Math.pow(k, 0.8));
      outer.push([cx + Math.cos(a) * R0, cy + Math.sin(a) * R0]);
      inner.push([cx + Math.cos(a) * (R0 - w), cy + Math.sin(a) * (R0 - w)]);
    }
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    inner.reverse().forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.globalAlpha /= alpha;
  }
  R.drawMoveFx = function (ctx, f, g) {
    if (f.state !== 'attack' || !f.move) return;
    const m = f.move, d = m.d, t = f.mf, fc = f.facing;
    const act = t >= m.su && t < m.su + Math.max(1, m.act);
    const after = !act && t >= m.su + m.act && t < m.su + m.act + 6;
    const pre = t >= m.su - 4 && t < m.su;
    const fxs = d.fxSet || new Set();
    const fxCol = (n) => ((d.fx || []).find((x) => x.name === n) || {}).color;
    const tip = g.useLeg ? g.foot : g.hand;
    const big = d.dmg >= 90 || d.type === 'Super';
    // vệt chém / smear cho mọi đòn đánh tay chân
    const melee = d.hasHitbox && !d.isProj && !d.kv.Detonate && !['Throw', 'CmdGrab', 'AirGrab'].includes(d.type);
    if (g.magic && (act || pre)) {
      // phép đánh xa: vòng phù chú tại hitbox + tia nối từ tay
      const ec = (d.fx && d.fx[0] && ({ fire: '#ff8a1c', ice: '#5fc4ef', elec: '#ffd21f' })[d.fx[0].name]) || R.fighterColor(f);
      const k = act ? 1 : 0.4;
      ctx.globalAlpha = 0.85 * k;
      ctx.strokeStyle = ec; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(g.realHand[0], g.realHand[1]); ctx.lineTo(g.magic.x, g.magic.y); ctx.stroke();
      ctx.setLineDash([]);
      const r = 26 + (act ? 10 : 0);
      R.sketchEllipse(ctx, g.magic.x, g.magic.y, r, r, 950, { fill: 'rgba(255,255,255,0.55)', stroke: ec, width: 5 });
      for (let i = 0; i < 6; i++) {
        const a = f.w.frame * 0.2 + (i / 6) * 6.28;
        R.sketchLine(ctx, g.magic.x + Math.cos(a) * r * 0.5, g.magic.y + Math.sin(a) * r * 0.5, g.magic.x + Math.cos(a) * r * 1.4, g.magic.y + Math.sin(a) * r * 1.4, 960 + i, { stroke: ec, width: 3 });
      }
      ctx.globalAlpha = 1;
    } else if (melee && (act || after)) {
      const slash = fxs.has('slash');
      const k = act ? 1 : 1 - (t - m.su - m.act) / 6;
      const px = g.useLeg ? g.hip[0] : g.bx, py = g.useLeg ? g.hip[1] : g.bodyCY;
      const dx = tip[0] - px, dy = tip[1] - py;
      const ang = Math.atan2(dy, dx), dist = Math.hypot(dx, dy) + (slash ? 30 : 12);
      const sweep = slash ? 1.9 : d.btn === 'L' ? 0.7 : 1.15;
      const a0 = ang - fc * sweep, a1 = ang + fc * 0.18;
      const thick = (slash ? 46 : d.btn === 'H' || d.type !== 'Normal' ? 30 : 18) * (big ? 1.4 : 1);
      const sc = fxCol('slash') || (slash ? '#c8d8ff' : '#b8b8b8');
      crescent(ctx, px, py, dist, a0, a1, thick, slash ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.8)', sc, 0.95 * k);
      if (slash) crescent(ctx, px, py, dist - thick * 0.45, a0 + fc * 0.2, a1, thick * 0.4, sc, sc, 0.6 * k);
    }
    if (fxs.has('fire') && (act || pre || after)) {
      const r = (big ? 38 : 26) * (pre ? 0.6 : after ? 0.8 : 1);
      const fl = Math.sin(f.w.frame * 1.7);
      ctx.globalAlpha = 0.9;
      flameShape(ctx, tip[0], tip[1] + r * 0.3, r * 1.4, '#7a1f0c', fl);
      flameShape(ctx, tip[0], tip[1] + r * 0.3, r * 1.25, '#e2401b', fl);
      flameShape(ctx, tip[0], tip[1] + r * 0.3, r * 0.95, '#ff9d1c', -fl);
      flameShape(ctx, tip[0], tip[1] + r * 0.35, r * 0.55, '#fff2a6', fl * 0.5);
      ctx.globalAlpha = 1;
    }
    if (fxs.has('spin') && act) {
      ctx.strokeStyle = R.fighterColor(f);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = f.w.frame * 0.5 + i * 2.09;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(g.bx, g.bodyCY, g.bw * 0.95, g.bh * 0.75, 0, a, a + 1.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (fxs.has('elec') && act) {
      const ec = fxCol('elec') || '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.28;
        let x = tip[0], y = tip[1];
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += Math.cos(a) * 14 + (Math.random() - 0.5) * 16; y += Math.sin(a) * 14 + (Math.random() - 0.5) * 16; ctx.lineTo(x, y); }
        ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = ec; ctx.lineWidth = 3.5; ctx.stroke();
      }
    }
    if (fxs.has('ice') && act) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * 6.28 + f.w.frame * 0.2, r = 30;
        const x = tip[0] + Math.cos(a) * r, y = tip[1] + Math.sin(a) * r;
        R.sketchPoly(ctx, [[x, y - 12], [x + 6, y], [x, y + 12], [x - 6, y]], 900 + i, { fill: '#dff6ff', stroke: '#4aa7d6', width: 2, noSub: true, amp: 1 });
      }
    }
    if (fxs.has('stretch') && act) {
      ctx.strokeStyle = '#d65ba3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const x = g.sh[0] + ((tip[0] - g.sh[0]) * i) / n, y = g.sh[1] + ((tip[1] - g.sh[1]) * i) / n + (i % 2 ? -10 : 10) * (i && i < n ? 1 : 0);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    if (fxs.has('wind') && act) {
      ctx.strokeStyle = 'rgba(100,120,150,0.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(g.bx, g.bodyCY + 20 - i * 30, g.bw * (0.9 + i * 0.15), 18, 0, f.w.frame * 0.4 + i, f.w.frame * 0.4 + i + 2.5);
        ctx.stroke();
      }
    }
  };

  // ------------------------------------------------------------------ projectiles
  function spellColors(p) {
    const key = p.inst.spellKey || p.inst.d.kv.Spell;
    if (!key) return null;
    return key.split('').map((k) => SO.EL_COLOR[k]);
  }
  R.drawProj = function (ctx, p, W) {
    const seed = 400 + (p.id % 50);
    const cols = spellColors(p);
    const col = cols ? cols[0] : p.color;
    const col2 = cols ? cols[cols.length - 1] : R.shade(p.color, 0.4);
    if (p.delay > 0) {
      if (p.travel) {
        const k = 1 - p.delay / Math.max(1, p.fuse);
        const x = p.x0 + (p.x - p.x0) * Math.max(0, k), y = p.y0 + (p.y - p.y0) * Math.max(0, k);
        R.sketchEllipse(ctx, x, -y, 26, 24, seed, { fill: col, stroke: INK, width: 3 });
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(x - 8, -y - 4, 4, 0, 7); ctx.arc(x + 8, -y - 4, 4, 0, 7); ctx.fill();
      } else if (p.warn) {
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([8, 8]);
        R.sketchEllipse(ctx, p.x, -4, p.w / 2, 10, seed, { stroke: col, width: 4, fill: null });
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (p.fall) {
        ctx.globalAlpha = 0.4;
        R.sketchEllipse(ctx, p.x, -4, p.w / 2, 8, seed, { stroke: col, width: 3, fill: null });
        ctx.globalAlpha = 1;
      }
      return;
    }
    const armed = p.t >= (p.arm || 0);
    const fadeIn = armed ? Math.min(1, p.t / 3) : 0.35 + 0.25 * Math.sin(p.t * 0.4);
    ctx.globalAlpha = fadeIn;
    switch (p.kind) {
      case 'straight': case 'angled': {
        R.sketchEllipse(ctx, p.x, -p.y, p.w / 2, p.h / 2, seed, { fill: col, stroke: INK, width: 3.5, hatch: col2 });
        for (let i = 1; i <= 3; i++) R.sketchLine(ctx, p.x - SO.sign(p.vx || p.facing) * (p.w / 2 + i * 12), -p.y + (i - 2) * 10, p.x - SO.sign(p.vx || p.facing) * (p.w / 2 + i * 12 + 18), -p.y + (i - 2) * 10, seed + i, { stroke: col2, width: 3 });
        if (p.boosted) R.sketchEllipse(ctx, p.x, -p.y, p.w / 2 + 10, p.h / 2 + 10, seed + 4, { stroke: '#3f7fd8', width: 3, fill: null });
        break;
      }
      case 'orb': {
        const r = Math.min(p.w, p.h) / 2;
        R.sketchEllipse(ctx, p.x, -p.y, r, r, seed, { fill: 'rgba(255,255,255,0.4)', stroke: col, width: 5 });
        for (let i = 0; i < 4; i++) {
          const a = W.frame * 0.3 + i * 1.6;
          R.sketchLine(ctx, p.x, -p.y, p.x + Math.cos(a) * r * 0.9, -p.y + Math.sin(a) * r * 0.9, seed + i, { stroke: col2, width: 3 });
        }
        break;
      }
      case 'disc': {
        ctx.save(); ctx.translate(p.x, -p.y);
        R.sketchEllipse(ctx, 0, 0, p.w / 2, p.h / 2, seed, { fill: col, stroke: INK, width: 3 });
        R.sketchLine(ctx, -p.w / 2 * Math.cos(W.frame * 0.4), 0, p.w / 2 * Math.cos(W.frame * 0.4), 0, seed + 1, { stroke: INK, width: 2 });
        ctx.restore();
        break;
      }
      case 'bomb': case 'burst': {
        const k = p.t / Math.max(1, p.t + p.life);
        R.sketchEllipse(ctx, p.x, -p.y, p.w / 2 * (0.7 + k), p.h / 2 * (0.7 + k), seed, { fill: 'rgba(255,200,80,0.35)', stroke: col, width: 6 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          R.sketchLine(ctx, p.x + Math.cos(a) * p.w * 0.3, -p.y + Math.sin(a) * p.h * 0.3, p.x + Math.cos(a) * p.w * 0.55, -p.y + Math.sin(a) * p.h * 0.55, seed + i, { stroke: col2, width: 4 });
        }
        break;
      }
      case 'pillar': case 'wave': {
        const grow = Math.min(1, p.t / 4);
        const h = p.h * grow;
        R.sketchRect(ctx, p.x - p.w / 2, -(p.y - p.h / 2) - h, p.w, h, seed, { fill: col, stroke: INK, width: 4, hatch: col2 });
        break;
      }
      case 'cloud': {
        ctx.globalAlpha = 0.6 * fadeIn;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + W.frame * 0.03;
          R.sketchEllipse(ctx, p.x + Math.cos(a) * p.w * 0.25, -p.y + Math.sin(a) * p.h * 0.2, p.w * 0.3, p.h * 0.25, seed + i, { fill: col, stroke: col2, width: 3 });
        }
        break;
      }
      case 'beam': {
        const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2;
        R.sketchRect(ctx, x0, -p.y - p.h / 2, p.w, p.h, seed, { fill: 'rgba(255,255,255,0.65)', stroke: col, width: 6 });
        const n = Math.round(p.w / 60);
        ctx.strokeStyle = col2; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const xx = x0 + (i / n) * p.w, yy = -p.y + (i % 2 ? -1 : 1) * p.h * 0.3 * Math.sin(W.frame + i);
          i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
        void x1;
        break;
      }
      case 'rain': {
        R.sketchPoly(ctx, [[p.x, -p.y + p.h / 2], [p.x + p.w / 2, -p.y - p.h / 2], [p.x - p.w / 2, -p.y - p.h / 2]], seed, { fill: col, stroke: INK, width: 3, hatch: col2 });
        if (!p.landed) R.sketchLine(ctx, p.x, -p.y - p.h / 2, p.x, -p.y - p.h / 2 - 80, seed + 2, { stroke: col2, width: 3 });
        break;
      }
      case 'line': {
        ctx.strokeStyle = col;
        ctx.lineWidth = p.thick * 0.6;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        const n = 10;
        for (let i = 0; i <= n; i++) {
          const x = p.x1 + ((p.x2 - p.x1) * i) / n, y = p.y1 + ((p.y2 - p.y1) * i) / n + (i && i < n ? (Math.random() - 0.5) * 18 : 0);
          i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y);
        }
        ctx.stroke();
        break;
      }
      default:
        R.sketchEllipse(ctx, p.x, -p.y, p.w / 2, p.h / 2, seed, { fill: col, stroke: INK });
    }
    ctx.globalAlpha = 1;
    if (R.debug) {
      if (p.kind === 'line') {
        ctx.strokeStyle = '#f22'; ctx.lineWidth = p.thick; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.moveTo(p.x1, -p.y1); ctx.lineTo(p.x2, -p.y2); ctx.stroke(); ctx.globalAlpha = 1;
      } else R.box(ctx, { cx: p.x, cy: p.y, w: p.w, h: p.h }, 'rgba(255,40,40,0.25)', '#f22');
    }
  };

  // ------------------------------------------------------------------ effects
  R.drawFx = function (ctx, e) {
    const k = e.t / e.life;
    ctx.globalAlpha = 1 - k * 0.9;
    const s = 700 + e.t;
    switch (e.type) {
      case 'hit': {
        const r = e.size * (0.6 + k * 0.6);
        const pts = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r;
          pts.push([e.x + Math.cos(a) * rr, -e.y + Math.sin(a) * rr]);
        }
        R.sketchPoly(ctx, pts, s, { fill: 'rgba(255,255,255,0.85)', stroke: e.color || INK, width: 4, noSub: true });
        break;
      }
      case 'spark': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + e.t * 0.1;
          R.sketchLine(ctx, e.x, -e.y, e.x + Math.cos(a) * e.size * (0.3 + k), -e.y + Math.sin(a) * e.size * (0.3 + k), s + i, { stroke: e.color, width: 3 });
        }
        break;
      }
      case 'block': {
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.35;
          const d = e.dir || 1;
          R.sketchLine(ctx, e.x, -e.y, e.x + Math.cos(a) * 50 * d * (0.4 + k), -e.y + Math.sin(a) * 50 * (0.4 + k), s + i, { stroke: e.color, width: 4 });
        }
        break;
      }
      case 'ring':
        R.sketchEllipse(ctx, e.x, -e.y, e.r * (0.4 + k * 0.8), e.r * (0.4 + k * 0.8), s, { stroke: e.color, width: e.thick || 4, fill: null });
        break;
      case 'dust':
        for (let i = 0; i < (e.big ? 5 : 2); i++) {
          R.sketchEllipse(ctx, e.x + (i - 2) * 22 * (1 + k), -10 - k * 20, 14 * (1 + k), 9 * (1 + k), s + i, { stroke: '#8a7a6a', width: 2.5, fill: 'rgba(200,190,170,0.4)' });
        }
        break;
      case 'petals':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + k * 2;
          R.sketchEllipse(ctx, e.x + Math.cos(a) * 90 * k, -e.y + Math.sin(a) * 90 * k, 10, 6, s + i, { fill: e.color, stroke: R.shade(e.color, -0.3), width: 2 });
        }
        break;
      case 'stop': {
        const r = 70 * (0.6 + Math.min(1, k * 3) * 0.4);
        const pts = [];
        for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * Math.PI * 2; pts.push([e.x + Math.cos(a) * r, -e.y + Math.sin(a) * r]); }
        R.sketchPoly(ctx, pts, s, { fill: '#d33', stroke: '#fff', width: 6, noSub: true });
        ctx.fillStyle = '#fff'; ctx.font = 'bold 34px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('STOP', e.x, -e.y + 12);
        break;
      }
      case 'text': {
        ctx.font = (e.big ? 'bold 52px ' : 'bold 36px ') + FONT;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#fff';
        const y = -e.y - k * 40;
        ctx.strokeText(e.text, e.x, y);
        ctx.fillStyle = e.color || INK;
        ctx.fillText(e.text, e.x, y);
        break;
      }
    }
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ debug boxes
  R.drawBoxes = function (ctx, f) {
    const pb = f.pushbox();
    R.box(ctx, pb, 'rgba(40,200,40,0.08)', '#2a2');
    f.hurtboxes().forEach((b) => R.box(ctx, b, b.ext ? 'rgba(40,90,255,0.12)' : 'rgba(40,90,255,0.2)', '#2a5aff'));
    if (f.state === 'attack' && f.move) {
      const m = f.move, d = m.d;
      if (d.hasHitbox && !d.isProj && !d.kv.Detonate && f.mf >= m.su && f.mf < m.su + m.act) {
        const b = { cx: f.x + f.facing * m.hb.x, cy: f.y + m.hb.y, w: m.hb.w, h: m.hb.h };
        const grab = d.type === 'CmdGrab' || d.type === 'AirGrab' || d.tags.has('CmdGrab');
        R.box(ctx, b, grab ? 'rgba(255,220,0,0.3)' : 'rgba(255,40,40,0.3)', grab ? '#cc0' : '#f22');
      }
      if (d.type === 'Throw' && f.mf >= m.su && f.mf < m.su + Math.max(1, m.act)) {
        R.box(ctx, { cx: f.x + f.facing * f.c.throwR / 2, cy: f.y + 100, w: f.c.throwR, h: 160 }, 'rgba(255,220,0,0.3)', '#cc0');
      }
    }
  };

  // ------------------------------------------------------------------ particles
  R.drawParts = function (ctx, W) {
    for (const p of W.parts) {
      const k = p.t / p.life;
      const x = p.x, y = -p.y;
      switch (p.k) {
        case 'flame': {
          const r = p.size * (1 - k * 0.6);
          const c = k < 0.18 ? '#ffd84a' : k < 0.45 ? '#ff9a1f' : k < 0.78 ? '#e2401b' : 'rgba(90,80,80,0.45)';
          ctx.globalAlpha = 1 - k * 0.6;
          ctx.fillStyle = c;
          ctx.strokeStyle = k < 0.78 ? 'rgba(110,30,10,0.55)' : 'rgba(60,60,60,0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - r * 0.7, y);
          ctx.quadraticCurveTo(x - r * 0.6, y - r * 1.2, x + (Math.sin(p.rot) * r * 0.3), y - r * 1.8);
          ctx.quadraticCurveTo(x + r * 0.6, y - r * 1.2, x + r * 0.7, y);
          ctx.arc(x, y, r * 0.7, 0, Math.PI);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.globalAlpha = 1 - k * 0.8;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.strokeStyle = '#4aa7d6'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.45, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.45, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'bolt': {
          ctx.globalAlpha = 1 - k * 0.6;
          let bx = x, by = y;
          const a = p.rot;
          ctx.beginPath(); ctx.moveTo(bx, by);
          for (let i = 0; i < 4; i++) { bx += Math.cos(a) * p.size / 4 + (Math.random() - 0.5) * 14; by += Math.sin(a) * p.size / 4 + (Math.random() - 0.5) * 14; ctx.lineTo(bx, by); }
          ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 6; ctx.stroke();
          ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.stroke();
          break;
        }
        case 'spark': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 2.2, y + p.vy * 2.2); ctx.stroke();
          break;
        }
        case 'streak': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = p.color; ctx.lineWidth = 3;
          const len = p.size * (1 - k * 0.5), n = Math.hypot(p.vx, p.vy) || 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (p.vx / n) * len, y + (p.vy / n) * len); ctx.stroke();
          break;
        }
        case 'smoke': case 'dust': {
          ctx.globalAlpha = (1 - k) * 0.9;
          const r = p.size * (0.5 + k * 0.8);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(80,70,60,0.35)'; ctx.lineWidth = 2; ctx.stroke();
          break;
        }
        case 'petal': {
          ctx.globalAlpha = 1 - k * 0.7;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.strokeStyle = R.shade(p.color, -0.3); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'debris': {
          ctx.globalAlpha = 1 - k * 0.5;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 2;
          const s = p.size;
          ctx.beginPath(); ctx.moveTo(-s, -s * 0.4); ctx.lineTo(-s * 0.2, -s); ctx.lineTo(s, -s * 0.3); ctx.lineTo(s * 0.6, s * 0.7); ctx.lineTo(-s * 0.7, s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'star': {
          ctx.globalAlpha = 1 - k;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.strokeStyle = '#6b5a10'; ctx.lineWidth = 1.5;
          const s = p.size * (1 - k * 0.4);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28, r = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'rainbow': {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = 'hsl(' + ((p.hue + p.t * 8) % 360) + ',85%,62%)';
          ctx.beginPath(); ctx.arc(x, y, p.size * (1 - k * 0.5), 0, 7); ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  // hiệu ứng thế giới bổ sung (impact, nứt đất, vết chém)
  R.drawFx2 = function (ctx, e) {
    const k = e.t / e.life;
    if (e.type === 'impact') {
      ctx.globalAlpha = 1 - k;
      const n = 8 + e.lvl * 4, r0 = e.size * (0.3 + k), r1 = e.size * (0.8 + k * 1.6);
      ctx.strokeStyle = e.color; ctx.lineWidth = 3 + e.lvl; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + e.x * 0.01;
        ctx.moveTo(e.x + Math.cos(a) * r0, -e.y + Math.sin(a) * r0);
        ctx.lineTo(e.x + Math.cos(a) * r1 * (i % 2 ? 0.7 : 1), -e.y + Math.sin(a) * r1 * (i % 2 ? 0.7 : 1));
      }
      ctx.stroke();
      if (e.lvl >= 1) { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, -e.y, e.size * (0.4 + k * 1.4), 0, 7); ctx.stroke(); }
    } else if (e.type === 'crack') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const dir of [-1, 1]) {
        let x = e.x, y = 2;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 6; i++) { x += dir * (22 + SO.hash(i, e.x) * 20); y = 2 + (SO.hash(i + 9, e.x) - 0.5) * 16; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else if (e.type === 'slashhit') {
      ctx.globalAlpha = 1 - k;
      const len = 170 * (0.6 + k * 0.6), w = 16 * (1 - k);
      const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x - ca * len, -e.y - sa * len);
      ctx.lineTo(e.x - sa * w, -e.y + ca * w);
      ctx.lineTo(e.x + ca * len, -e.y + sa * len);
      ctx.lineTo(e.x + sa * w, -e.y - ca * w);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  function ghostColor(f, g) {
    if (g.ghostKind === 'super') return R.shade(R.fighterColor(f), 0.15);
    if (g.ghostKind === 'burst') return '#ffcc33';
    return R.shade(R.fighterColor(f), 0.4);
  }

  // cut-in khi tung Super
  R.drawCutIn = function (ctx, W) {
    const fl = W.flash, o = fl.owner, t = fl.t;
    const left = o.idx === 0;
    const kin = Math.min(1, t / 7), kout = t > 22 ? (t - 22) / 8 : 0;
    const ease = (v) => 1 - Math.pow(1 - v, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(20,18,30,' + (0.5 * (1 - kout)) + ')';
    ctx.fillRect(0, 0, R.W, R.H);
    const col = R.fighterColor(o);
    const slide = (left ? -1 : 1) * (1 - ease(kin)) * 900 + (left ? 1 : -1) * kout * 1400;
    ctx.save();
    ctx.translate(slide, 0);
    const band = [[-200, 360], [R.W + 200, 270], [R.W + 200, 600], [-200, 690]];
    R.sketchPoly(ctx, band, 61, { fill: col, stroke: INK, width: 8, hatch: R.shade(col, -0.35) });
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 14; i++) {
      const y = 330 + ((i * 37 + t * 9) % 320);
      const x = ((i * 211 + t * 70 * (left ? 1 : -1)) % 2400 + 2400) % 2400 - 200;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (left ? -1 : 1) * 260, y); ctx.stroke();
    }
    ctx.restore();
    // chân dung lớn
    const snap = o.snapshot();
    snap.x = 0; snap.y = 0; snap.state = 'idle'; snap.move = null; snap.facing = left ? 1 : -1;
    const sc = 2.3;
    const px = (left ? 420 : R.W - 420) + slide * 1.2;
    ctx.setTransform(sc, 0, 0, sc, px, 690);
    R.drawFighter(ctx, snap);
    // tên super
    ctx.setTransform(1, 0, -0.22, 1, 0, 0);
    ctx.font = 'italic bold 104px ' + FONT;
    ctx.textAlign = left ? 'right' : 'left';
    const tx = (left ? R.W - 40 : 260) - slide * 0.6, ty = 520;
    ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.strokeText(fl.name.toUpperCase(), tx, ty);
    ctx.fillStyle = '#fff'; ctx.fillText(fl.name.toUpperCase(), tx, ty);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  R.render = function (ctx, W) {
    R.seed = Math.floor(W.frame / 6);
    R.updateCam(W);
    R.drawPaper(ctx);
    let shake = W.quake || 0;
    for (const f of W.f) if (f.hitstop > 0 && (f.state === 'hitstun' || f.state === 'airhit')) shake = Math.max(shake, f.hitstop * 0.9);
    W.shake = shake;
    R.drawStage(ctx, W);
    R.worldTransform(ctx, shake);
    for (const f of W.f) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(f.x, 4, f.c.w * 0.55 * Math.max(0.4, 1 - f.y / 600), 10, 0, 0, 7);
      ctx.fill();
    }
    for (const f of W.f) if (f.G.draw) f.G.draw(f, ctx, R);
    // afterimage
    for (const f of W.f) {
      for (const g of f.ghosts || []) {
        R.drawFighter(ctx, g, { ghost: true, alpha: 0.62 * (1 - g.age / 14), color: ghostColor(f, g) });
      }
    }
    const order = W.f.slice().sort((a, b) => (a.state === 'attack') - (b.state === 'attack'));
    for (const f of order) R.drawFighter(ctx, f);
    for (const p of W.projs) R.drawProj(ctx, p, W);
    R.drawParts(ctx, W);
    if (R.debug) for (const f of W.f) R.drawBoxes(ctx, f);
    for (const e of W.fx) {
      if (e.type === 'impact' || e.type === 'crack' || e.type === 'slashhit') R.drawFx2(ctx, e);
      else if (e.type !== 'banner') R.drawFx(ctx, e);
    }
    if (W.screenFlash) {
      const sf = W.screenFlash;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - sf.t / sf.life;
      ctx.fillStyle = sf.color;
      ctx.fillRect(0, 0, R.W, R.H);
      ctx.globalAlpha = 1;
    }
  };
})();
