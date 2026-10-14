'use strict';
// =============================================================================
// SQUARED OFF - Game: menu, chọn nhân vật, HUD, pause, training, nạp CSV, loop
// =============================================================================
(function () {
  const SO = window.SO;
  const C = SO.CFG;
  const R = SO.R;
  const FONT = R.FONT;
  const INK = '#2a2a2a';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = R.W;
  canvas.height = R.H;

  SO.currentText = { moves: window.SO_DATA.moves, chars: window.SO_DATA.characters };

  const G = (SO.Game = {
    scene: 'title',
    menuIdx: 0,
    world: null,
    paused: false,
    pauseIdx: 0,
    mode: 'versus',
    sel: null,
    toast: null,
    moveList: null,
    help: false,
  });

  // ------------------------------------------------------------------ menu input
  const K = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    ok: ['KeyU', 'Enter', 'Space', 'Numpad4', 'Comma'], back: ['KeyI', 'Backspace', 'Numpad5', 'Period'],
    p1up: ['KeyW'], p1down: ['KeyS'], p1left: ['KeyA'], p1right: ['KeyD'], p1ok: ['KeyU', 'Enter', 'Space'], p1back: ['KeyI', 'Backspace'],
    p2up: ['ArrowUp'], p2down: ['ArrowDown'], p2left: ['ArrowLeft'], p2right: ['ArrowRight'], p2ok: ['Numpad4', 'Comma'], p2back: ['Numpad5', 'Period'],
    pause: ['Tab', 'Escape'],
  };
  let pressedNow = [];
  const hit = (name) => pressedNow.some((c) => K[name].includes(c));
  // gamepad -> phím ảo cho menu
  const padPrev = [{}, {}];
  function pollPads() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (let i = 0; i < 2; i++) {
      const p = pads[i];
      if (!p) continue;
      const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const st = {
        up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5,
        ok: b(0) || b(2), back: b(1), pause: b(9),
      };
      const map = i === 0
        ? { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', ok: 'KeyU', back: 'KeyI', pause: 'Tab' }
        : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', ok: 'Numpad4', back: 'Numpad5', pause: 'Escape' };
      for (const k in st) if (st[k] && !padPrev[i][k]) pressedNow.push(map[k]);
      padPrev[i] = st;
    }
  }

  function toast(msg, t) { G.toast = { msg, t: t || 240 }; }

  // ------------------------------------------------------------------ CSV nạp / xuất
  function reloadData(moves, chars) {
    try {
      SO.loadData(moves, chars);
      SO.currentText = { moves, chars };
      if (G.world) {
        for (const f of G.world.f) {
          if (!SO.DB.chars[f.name]) { toast('Character "' + f.name + '" is missing from the new CSV!', 360); continue; }
          f.refreshData();
        }
      }
      const nMoves = Object.values(SO.DB.chars).reduce((s, c) => s + c.moves.length, 0) + Object.keys(SO.DB.all).length;
      return nMoves;
    } catch (e) {
      console.error(e);
      toast('Could not read CSV: ' + e.message, 400);
      return -1;
    }
  }
  document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drag'); });
  document.addEventListener('dragleave', () => document.body.classList.remove('drag'));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drag');
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    Promise.all(files.map((f) => f.text().then((t) => ({ name: f.name, t })))).then((list) => {
      let moves = SO.currentText.moves, chars = SO.currentText.chars, got = [];
      for (const { name, t } of list) {
        const head = t.replace(/^﻿/, '').split(/\r?\n/)[0];
        if (/Move_ID/.test(head)) { moves = t; got.push(name); }
        else if (/Walk_Fwd|Character,Prefix/.test(head)) { chars = t; got.push(name); }
      }
      if (!got.length) { toast('That file is not a moves.csv or characters.csv'); return; }
      const n = reloadData(moves, chars);
      if (n >= 0) toast('Loaded ' + got.join(', ') + ' (' + n + ' moves). Applies from the next move.');
    });
  });
  function download(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ------------------------------------------------------------------ helpers vẽ
  function text(s, x, y, size, color, align, bold) {
    ctx.font = (bold === false ? '' : 'bold ') + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.fillStyle = color || INK;
    ctx.fillText(s, x, y);
  }
  function outlined(s, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = '#fff';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color || INK;
    ctx.fillText(s, x, y);
  }
  function panel(x, y, w, h, alpha) {
    ctx.globalAlpha = alpha || 0.92;
    R.sketchRect(ctx, x, y, w, h, x + y, { fill: '#fffaf0', stroke: INK, width: 3 });
    ctx.globalAlpha = 1;
  }
  function shapeIcon(name, cx, cy, size, color, seed) {
    const c = SO.DB.chars[name];
    if (!c) return;
    const pts = R.shapePoints(c.shape, size, size * (c.shape === 'oval' ? 1.3 : 1)).map((p) => [cx + p[0], cy + p[1]]);
    R.sketchPoly(ctx, pts, seed || 3, { fill: color || c.color, stroke: INK, width: 4, hatch: R.shade(color || c.color, -0.35) });
    if (c.shape === 'cone') R.sketchRect(ctx, cx + size * 0.45, cy - size * 0.1, size * 0.3, size * 0.55, (seed || 3) + 1, { fill: '#b87333', stroke: INK, width: 3 });
  }

  // ------------------------------------------------------------------ TITLE
  const TITLE_ITEMS = [
    { label: 'VERSUS', sub: '2 players, local', act: () => startSelect('versus') },
    { label: 'TRAINING', sub: 'practice against a dummy', act: () => startSelect('training') },
    { label: 'CONTROLS', sub: 'keys and system commands', act: () => { G.help = true; } },
  ];
  function updateTitle() {
    if (G.help) { if (hit('back') || hit('ok') || hit('pause')) G.help = false; return; }
    if (hit('up')) G.menuIdx = (G.menuIdx + TITLE_ITEMS.length - 1) % TITLE_ITEMS.length;
    if (hit('down')) G.menuIdx = (G.menuIdx + 1) % TITLE_ITEMS.length;
    if (hit('ok')) TITLE_ITEMS[G.menuIdx].act();
  }
  let titleT = 0;
  function skewText(s, x, y, size, fill, stroke, align, skew, lw) {
    ctx.save();
    ctx.setTransform(1, 0, skew === undefined ? -0.2 : skew, 1, 0, 0);
    ctx.font = 'italic bold ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    const sx = x - (skew === undefined ? -0.2 : skew) * y;
    if (stroke) { ctx.lineWidth = lw || Math.max(6, size / 7); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, sx, y); }
    ctx.fillStyle = fill;
    ctx.fillText(s, sx, y);
    ctx.restore();
  }
  function drawTitle() {
    titleT++;
    R.seed = Math.floor(titleT / 6);
    R.drawPaper(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const names = SO.DB.order;
    names.forEach((n, i) => {
      const a = (i / names.length) * Math.PI * 2 + titleT * 0.004;
      shapeIcon(n, 960 + Math.cos(a) * 780, 540 + Math.sin(a) * 400, 70, null, i + 10);
    });
    R.sketchPoly(ctx, [[300, 170], [1660, 120], [1620, 360], [260, 400]], 5, { fill: '#2a2a2a', stroke: '#2a2a2a', width: 4 });
    skewText('SQUARED OFF', 960, 330, 170, '#f6f1e3', '#e0574a', 'center', -0.18, 10);
    text('a doodle fighting game prototype · 60 FPS', 960, 450, 34, '#666', 'center', false);
    TITLE_ITEMS.forEach((it, i) => {
      const y = 590 + i * 110;
      const on = i === G.menuIdx;
      if (on) R.sketchPoly(ctx, [[640, y - 70], [1300, y - 82], [1280, y + 30], [620, y + 40]], 50 + i, { fill: '#ffe9a8', stroke: INK, width: 4 });
      skewText(it.label, 960, y, on ? 66 : 54, on ? INK : '#555', on ? '#fff' : null, 'center', -0.2, 8);
      if (on) text(it.sub, 960, y + 30, 26, '#6b5a3a', 'center', false);
    });
    text('W/S move · U or Enter confirm · drop moves.csv / characters.csv onto the window to load new data', 960, 1030, 26, '#555', 'center', false);
    if (G.help) drawHelp();
  }
  function drawHelp() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    panel(170, 90, 1580, 900);
    skewText('CONTROLS', 960, 170, 64, INK, '#fff', 'center');
    const rows = [
      ['', 'P1', 'P2'],
      ['Move', 'W A S D', 'Arrow keys'],
      ['Light (L)', 'U', 'Numpad 4  or  ,'],
      ['Medium (M)', 'I', 'Numpad 5  or  .'],
      ['Heavy (H)', 'O', 'Numpad 6  or  /'],
      ['Unique (U)', 'J', 'Numpad 1  or  Right Shift'],
      ['Pause', 'Tab', 'Esc'],
    ];
    rows.forEach((r, i) => {
      const y = 250 + i * 48;
      text(r[0], 260, y, 34, INK, 'left', i === 0);
      text(r[1], 700, y, 34, '#2a5aa8', 'left', i === 0);
      text(r[2], 1080, y, 34, '#a8452a', 'left', i === 0);
    });
    const sys = [
      'Throw / Throw break: L+M up close (hold 4 to throw backward) · break within 12f',
      'Roman Cancel: L+M+H (50% Equilibrium) · Dead Angle: L+M+H while blocking (25%)',
      'Burst: U + L/M/H · Faultless Defense: hold back + 2 buttons while blocking',
      'Dash 66 · Backdash 44 · Super jump 2 then 7/8/9 · Double jump · Airdash 66/44 · IAD 956 / 754',
      'Supers: 236236 + button / 214214 + button (50%) · F1 hitboxes · F2 frame data',
      'Gamepad: X = L, Y = M, B = H, A = U, Start = Pause',
    ];
    sys.forEach((s, i) => text(s, 260, 640 + i * 50, 30, INK, 'left', false));
    text('Press U / Enter to close', 960, 960, 28, '#777', 'center', false);
  }

  // ------------------------------------------------------------------ SELECT (kiểu Guilty Gear XX)
  // cụm icon so le 3-4-3
  const ROWS = [3, 4, 3];
  const ICON_W = 150, ICON_H = 118, GAP = 14, SKEW = -0.22;
  function iconLayout() {
    const out = [];
    let i = 0;
    ROWS.forEach((n, r) => {
      for (let k = 0; k < n; k++) {
        out.push({ i, r, x: 960 + (k - (n - 1) / 2) * (ICON_W + GAP), y: 300 + r * (ICON_H + GAP) });
        i++;
      }
    });
    return out;
  }
  const LAYOUT = iconLayout();
  function startSelect(mode) {
    G.mode = mode;
    G.scene = 'select';
    G.sel = { cur: [0, 1], done: [false, false], step: 0, changeT: [0, 0], lockT: [0, 0], readyT: 0 };
  }
  function moveCursor(i, dx, dy) {
    const s = G.sel;
    const n = Math.min(SO.DB.order.length, LAYOUT.length);
    const cur = LAYOUT[s.cur[i]];
    let next = s.cur[i];
    if (dx) {
      const row = LAYOUT.filter((l) => l.r === cur.r && l.i < n);
      const k = row.indexOf(cur);
      next = row[(k + dx + row.length) % row.length].i;
    } else if (dy) {
      const r2 = (cur.r + dy + ROWS.length) % ROWS.length;
      const row = LAYOUT.filter((l) => l.r === r2 && l.i < n);
      row.sort((a, b) => Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x) || (dx >= 0 ? a.x - b.x : b.x - a.x));
      next = row[0].i;
    }
    if (next !== s.cur[i]) { s.cur[i] = next; s.changeT[i] = 0; }
  }
  function lock(i) {
    const s = G.sel;
    s.done[i] = true;
    s.lockT[i] = 0;
    const pf = previewFighter(i, SO.DB.order[s.cur[i]]);
    const m = pf.c.normals.g5H || pf.c.normals.g5M;
    try { if (m) pf.startMove(m, {}); } catch (e) { pf.setState('idle'); }
  }
  function updateSelect() {
    const s = G.sel;
    s.changeT[0]++; s.changeT[1]++; s.lockT[0]++; s.lockT[1]++;
    if (s.done[0] && s.done[1]) {
      s.readyT++;
      if (s.readyT > 50) beginFight();
      return;
    }
    if (G.mode === 'training') {
      const i = s.step;
      if (hit('left')) moveCursor(i, -1, 0);
      if (hit('right')) moveCursor(i, 1, 0);
      if (hit('up')) moveCursor(i, 0, -1);
      if (hit('down')) moveCursor(i, 0, 1);
      if (hit('ok')) { lock(i); if (i === 0) s.step = 1; }
      if (hit('back')) { if (s.step === 1) { s.step = 0; s.done[0] = false; } else G.scene = 'title'; }
      return;
    }
    for (let i = 0; i < 2; i++) {
      const pre = 'p' + (i + 1);
      if (!s.done[i]) {
        if (hit(pre + 'left')) moveCursor(i, -1, 0);
        if (hit(pre + 'right')) moveCursor(i, 1, 0);
        if (hit(pre + 'up')) moveCursor(i, 0, -1);
        if (hit(pre + 'down')) moveCursor(i, 0, 1);
        if (hit(pre + 'ok')) lock(i);
      } else if (hit(pre + 'back')) s.done[i] = false;
    }
    if (!s.done[0] && !s.done[1] && hit('p1back')) G.scene = 'title';
  }

  // nhân vật xem trước (vẽ bằng chính renderer trong trận)
  const PW = { frame: 0, f: [], fx: [], projs: [], parts: [], phase: 'fight', training: false, onMoveStart() {}, onRecover() {}, gain() {}, spend() { return true; }, res() { return 50; }, spawnProj() {}, tryGrab() {}, superFlash() {} };
  const pcache = {};
  function previewFighter(idx, name) {
    const key = idx + ':' + name;
    if (!pcache[key] || pcache[key].c !== SO.DB.chars[name]) {
      const f = new SO.Fighter(PW, idx, name);
      f.resetRound(0, idx === 0 ? 1 : -1);
      pcache[key] = f;
    }
    PW.f[idx] = pcache[key];
    return pcache[key];
  }
  const ease = (v) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3);

  function drawSelect() {
    titleT++;
    PW.frame = titleT;
    R.seed = Math.floor(titleT / 6);
    const s = G.sel;
    const names = SO.DB.order;
    const ch = [SO.DB.chars[names[s.cur[0]]], SO.DB.chars[names[s.cur[1]]]];
    R.drawPaper(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // nền chéo hai màu
    ctx.globalAlpha = 0.32;
    R.sketchPoly(ctx, [[0, 0], [1080, 0], [840, 1080], [0, 1080]], 401, { fill: ch[0].color, stroke: null, hatch: R.shade(ch[0].color, -0.4) });
    R.sketchPoly(ctx, [[1080, 0], [1920, 0], [1920, 1080], [840, 1080]], 402, { fill: ch[1].color, stroke: null, hatch: R.shade(ch[1].color, -0.4) });
    ctx.globalAlpha = 1;
    // chữ nền lớn mờ
    ctx.globalAlpha = 0.07;
    for (let k = 0; k < 4; k++) skewText('SELECT', -200 + ((titleT * 1.2 + k * 700) % 2600), 760 + (k % 2) * 260, 300, INK, null, 'left', -0.25);
    ctx.globalAlpha = 1;
    // vết mực chéo giữa
    R.sketchLine(ctx, 1110, -20, 810, 1100, 403, { stroke: INK, width: 14 });
    R.sketchLine(ctx, 1140, -20, 840, 1100, 404, { stroke: INK, width: 4 });
    // banner trên
    R.sketchPoly(ctx, [[-40, 30], [1960, 0], [1960, 130], [-40, 150]], 405, { fill: INK, stroke: INK, width: 4 });
    skewText('CHARACTER SELECT', 70, 112, 76, '#f6f1e3', null, 'left');
    const modeTag = G.mode === 'training' ? (s.step === 0 ? 'TRAINING · PICK YOUR FIGHTER' : 'TRAINING · PICK THE DUMMY') : 'VERSUS';
    skewText(modeTag, 1860, 100, 40, '#ffd23f', null, 'right');

    // chân dung hai bên
    for (let p = 0; p < 2; p++) {
      if (G.mode === 'training' && p === 1 && s.step === 0 && !s.done[1]) continue;
      const pf = previewFighter(p, names[s.cur[p]]);
      if (pf.state === 'attack' && pf.move) {
        try { pf.attackStep(); } catch (e) { pf.setState('idle'); }
        if (pf.state !== 'attack') pf.setState('idle');
      } else if (pf.state !== 'idle') pf.setState('idle');
      pf.x = 0; pf.y = 0; pf.facing = p === 0 ? 1 : -1;
      const k = ease(s.changeT[p] / 12);
      const baseX = p === 0 ? 370 : 1550;
      const px = baseX + (p === 0 ? -1 : 1) * (1 - k) * 420;
      // spotlight
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.85 * k;
      R.sketchEllipse(ctx, px, 560, 280, 300, 410 + p, { fill: 'rgba(255,255,255,0.55)', stroke: pf.c.color, width: 6 });
      ctx.globalAlpha = 1;
      const sc = 2.5 * Math.min(1, 190 / pf.c.h);
      ctx.setTransform(sc, 0, 0, sc, px, 840);
      ctx.globalAlpha = k;
      if (pf.G.draw) pf.G.draw(pf, ctx, R);
      R.drawFighter(ctx, pf);
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // tên + archetype + gimmick
      const left = p === 0;
      const nx = left ? 60 : 1860;
      const ny = 930;
      const nm = pf.c.name.toUpperCase();
      const nk = ease((s.changeT[p] - 3) / 10);
      ctx.globalAlpha = nk;
      skewText(nm, nx + (left ? -1 : 1) * (1 - nk) * 200, ny, nm.length > 9 ? 96 : 118, pf.c.color, INK, left ? 'left' : 'right', -0.2, 12);
      const tag = (left ? '1P · ' : (G.mode === 'training' ? 'DUMMY · ' : '2P · ')) + pf.c.arch.toUpperCase();
      ctx.font = 'italic bold 30px ' + FONT;
      const tw = ctx.measureText(tag).width + 50;
      const tx = left ? nx : nx - tw;
      R.sketchPoly(ctx, [[tx, 950], [tx + tw, 946], [tx + tw - 14, 990], [tx - 14, 994]], 420 + p, { fill: INK, stroke: INK, width: 2 });
      skewText(tag, tx + 22, 982, 30, left ? '#ff8a7a' : '#8ab4ff', null, 'left');
      ctx.globalAlpha = 1;
      // dải giấy mô tả gimmick
      const gx = left ? 40 : 1880 - 600;
      ctx.save();
      ctx.translate(gx + 300, 1040);
      ctx.rotate(left ? -0.012 : 0.012);
      R.sketchRect(ctx, -300, -40, 600, 80, 430 + p, { fill: '#fffaf0', stroke: '#888', width: 2 });
      ctx.font = '17px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      const gtxt = pf.c.gimmick;
      const cut = gtxt.length > 210 ? gtxt.slice(0, gtxt.lastIndexOf(' ', 208)) + '…' : gtxt;
      wrapCenter(cut, 0, -2, 580, 17, 21);
      ctx.restore();
      if (s.done[p]) {
        const lk = Math.min(1, s.lockT[p] / 6);
        ctx.save();
        ctx.translate(baseX, 300);
        ctx.rotate(left ? -0.15 : 0.15);
        ctx.scale(2 - lk, 2 - lk);
        ctx.globalAlpha = lk;
        R.sketchRect(ctx, -110, -48, 220, 92, 440 + p, { fill: left ? '#d33' : '#36c', stroke: '#fff', width: 6 });
        ctx.font = 'italic bold 64px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('OK!', 0, 22);
        ctx.restore();
      }
    }

    // cụm icon
    const n = Math.min(names.length, LAYOUT.length);
    for (let i = 0; i < n; i++) {
      const L = LAYOUT[i], c = SO.DB.chars[names[i]];
      const wob = Math.sin(titleT * 0.05 + i) * 2;
      ctx.setTransform(1, 0, SKEW, 1, -SKEW * (L.y + wob), 0);
      const x0 = L.x - ICON_W / 2, y0 = L.y + wob - ICON_H / 2;
      const hot = s.cur[0] === i || s.cur[1] === i;
      R.sketchRect(ctx, x0, y0, ICON_W, ICON_H, 500 + i, { fill: hot ? R.shade(c.color, 0.35) : '#e9e2d2', stroke: INK, width: 4, hatch: hot ? R.shade(c.color, -0.2) : '#b8ae9a' });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      shapeIcon(names[i], L.x - SKEW * 0 , L.y + wob - 8, 66, c.color, i + 30);
      ctx.setTransform(1, 0, SKEW, 1, -SKEW * (L.y + wob), 0);
      ctx.fillStyle = INK;
      ctx.fillRect(x0, y0 + ICON_H - 26, ICON_W, 26);
      ctx.font = 'bold 19px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f6f1e3';
      ctx.fillText(c.name.toUpperCase(), L.x, y0 + ICON_H - 7);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // con trỏ
    for (let p = 0; p < 2; p++) {
      if (G.mode === 'training' && p === 1 && s.step === 0) continue;
      const L = LAYOUT[s.cur[p]];
      const pc = p === 0 ? '#e0352b' : '#2f6fe0';
      const blink = s.done[p] ? 1 : 0.6 + 0.4 * Math.sin(titleT * 0.3);
      const both = s.cur[0] === s.cur[1];
      const pad = 8 + (both && p === 1 ? 9 : 0);
      ctx.setTransform(1, 0, SKEW, 1, -SKEW * L.y, 0);
      ctx.globalAlpha = blink;
      R.sketchRect(ctx, L.x - ICON_W / 2 - pad, L.y - ICON_H / 2 - pad, ICON_W + pad * 2, ICON_H + pad * 2, 520 + p, { stroke: pc, width: s.done[p] ? 9 : 7, fill: null });
      const tabX = p === 0 ? L.x - ICON_W / 2 - pad : L.x + ICON_W / 2 + pad - 56;
      ctx.fillStyle = pc;
      ctx.fillRect(tabX, L.y - ICON_H / 2 - pad - 30, 56, 30);
      ctx.font = 'bold 24px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(p === 0 ? '1P' : (G.mode === 'training' ? 'CPU' : '2P'), tabX + 28, L.y - ICON_H / 2 - pad - 7);
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // gợi ý điều khiển
    R.sketchPoly(ctx, [[620, 712], [1300, 704], [1290, 748], [610, 756]], 450, { fill: INK, stroke: INK, width: 2 });
    const hint = G.mode === 'training' ? 'P1 picks both · U / Enter confirm · I / Backspace back' : '1P: WASD + U   ·   2P: arrows + Numpad4 (or ,)   ·   I / Numpad5 cancel';
    text(hint, 955, 739, 22, '#f6f1e3', 'center', false);
    if (s.done[0] && s.done[1]) {
      const k = ease(s.readyT / 10);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(20,18,30,0.35)';
      ctx.fillRect(0, 0, R.W, R.H);
      skewText("LET'S ROCK!", 960 + (1 - k) * 600, 600, 170, '#ffd23f', INK, 'center', -0.2, 16);
      ctx.globalAlpha = 1;
    }
  }
  function wrapCenter(str, x, y, maxW, size, lh) {
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    const y0 = y - ((Math.min(3, lines.length) - 1) * lh) / 2 + 6;
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  }

  // ------------------------------------------------------------------ FIGHT
  function beginFight() {
    const names = SO.DB.order;
    G.p1 = names[G.sel.cur[0]];
    G.p2 = names[G.sel.cur[1]];
    G.world = new SO.World(G.p1, G.p2, G.mode);
    G.scene = 'fight';
    G.paused = false;
    R.cam.init = false;
  }
  SO.newMatch = function (p1, p2, mode) {
    G.mode = mode || 'versus';
    G.p1 = p1; G.p2 = p2;
    G.world = new SO.World(p1, p2, G.mode);
    G.scene = 'fight';
    G.paused = false;
    R.cam.init = false;
    return G.world;
  };

  function pauseItems() {
    const W = G.world, d = W.dummy;
    const items = [
      { label: 'Resume', act: () => (G.paused = false) },
      { label: 'Hitboxes (F1): ' + (R.debug ? 'ON' : 'OFF'), act: () => (R.debug = !R.debug), lr: () => (R.debug = !R.debug) },
      { label: 'Frame data panel (F2): ' + (R.frameData ? 'ON' : 'OFF'), act: () => (R.frameData = !R.frameData), lr: () => (R.frameData = !R.frameData) },
    ];
    if (W.training) {
      const ST = ['stand', 'crouch', 'jump', 'manual'], STN = { stand: 'Stand', crouch: 'Crouch', jump: 'Jump', manual: 'Controlled by P2' };
      const BL = ['none', 'all', 'after', 'random'], BLN = { none: 'None', all: 'All', after: 'After first hit', random: 'Random' };
      const cyc = (arr, v, dir) => arr[(arr.indexOf(v) + dir + arr.length) % arr.length];
      items.push(
        { label: 'Dummy: ' + STN[d.stance], act: () => (d.stance = cyc(ST, d.stance, 1)), lr: (dir) => (d.stance = cyc(ST, d.stance, dir)) },
        { label: 'Dummy block: ' + BLN[d.block], act: () => (d.block = cyc(BL, d.block, 1)), lr: (dir) => (d.block = cyc(BL, d.block, dir)) },
        { label: 'Dummy air tech: ' + (d.tech ? 'ON' : 'OFF'), act: () => (d.tech = !d.tech), lr: () => (d.tech = !d.tech) },
        { label: 'Auto refill HP / Burst: ' + (d.refill ? 'ON' : 'OFF'), act: () => (d.refill = !d.refill), lr: () => (d.refill = !d.refill) },
        { label: 'P1 always 75% Equilibrium: ' + (d.p1Meter ? 'ON' : 'OFF'), act: () => (d.p1Meter = !d.p1Meter), lr: () => (d.p1Meter = !d.p1Meter) },
        { label: 'Reset positions', act: () => { W.startRound(); G.paused = false; } }
      );
    }
    items.push(
      { label: 'P1 move list (' + W.f[0].name + ')', act: () => openMoveList(0) },
      { label: 'P2 move list (' + W.f[1].name + ')', act: () => openMoveList(1) },
      { label: 'Export current moves.csv', act: () => download('moves.csv', SO.currentText.moves) },
      { label: 'Export current characters.csv', act: () => download('characters.csv', SO.currentText.chars) },
      { label: 'Restore default data', act: () => { reloadData(window.SO_DATA.moves, window.SO_DATA.characters); toast('Default data restored'); } },
      { label: 'Character select', act: () => { startSelect(G.mode); } },
      { label: 'Main menu', act: () => { G.scene = 'title'; G.world = null; } }
    );
    return items;
  }
  function openMoveList(i) {
    const f = G.world.f[i];
    const c = SO.DB.chars[f.name];
    const order = { Normal: 0, Command: 1, Unique: 2, Puppet: 3, Special: 4, CmdGrab: 4, AirGrab: 4, Followup: 5, Spell: 6, Super: 7, Throw: 8 };
    const rows = c.moves.slice().sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    G.moveList = { i, rows, scroll: 0, name: f.name };
  }

  function updateFight() {
    const W = G.world;
    if (pressedNow.includes('F1')) R.debug = !R.debug;
    if (pressedNow.includes('F2')) R.frameData = !R.frameData;
    if (G.moveList) {
      const ml = G.moveList;
      if (hit('down')) ml.scroll = Math.min(Math.max(0, ml.rows.length - 18), ml.scroll + 1);
      if (hit('up')) ml.scroll = Math.max(0, ml.scroll - 1);
      if (hit('back') || hit('pause') || hit('ok')) G.moveList = null;
      return;
    }
    if (W.phase === 'matchEnd' && W.phaseT > 60) {
      if (hit('ok')) { SO.newMatch(G.p1, G.p2, G.mode); return; }
      if (hit('back')) { startSelect(G.mode); return; }
    }
    if (hit('pause')) { G.paused = !G.paused; G.pauseIdx = 0; return; }
    if (G.paused) {
      const items = pauseItems();
      if (hit('up')) G.pauseIdx = (G.pauseIdx + items.length - 1) % items.length;
      if (hit('down')) G.pauseIdx = (G.pauseIdx + 1) % items.length;
      const it = items[G.pauseIdx];
      if (hit('left') && it.lr) it.lr(-1);
      if (hit('right') && it.lr) it.lr(1);
      if (hit('ok')) it.act();
      if (hit('back')) G.paused = false;
      return;
    }
    W.step();
  }

  // ------------------------------------------------------------------ HUD
  function drawHUD(W) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const [a, b] = W.f;
    // thanh máu
    for (const f of W.f) {
      const left = f.idx === 0;
      const x0 = left ? 90 : 1100, w = 730, y = 40, h = 38;
      const c = f.c;
      R.sketchRect(ctx, x0, y, w, h, 200 + f.idx, { fill: '#e6ddd0', stroke: INK, width: 4 });
      const hpW = (Math.max(0, f.hp) / c.hp) * (w - 8);
      const grayW = (f.gray / c.hp) * (w - 8);
      const col = f.hp / c.hp < 0.25 ? '#e04a3a' : '#f2c230';
      ctx.fillStyle = '#b9b2a8';
      if (left) ctx.fillRect(x0 + 4 + (w - 8) - hpW - grayW, y + 4, grayW, h - 8);
      else ctx.fillRect(x0 + 4 + hpW, y + 4, grayW, h - 8);
      ctx.fillStyle = col;
      if (left) ctx.fillRect(x0 + 4 + (w - 8) - hpW, y + 4, hpW, h - 8);
      else ctx.fillRect(x0 + 4, y + 4, hpW, h - 8);
      // burst
      const bx = left ? 50 : 1870, by = 60;
      ctx.beginPath(); ctx.arc(bx, by, 28, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 26, -Math.PI / 2, -Math.PI / 2 + (f.burst / 100) * Math.PI * 2); ctx.closePath();
      ctx.fillStyle = f.burst >= 100 ? '#e6a700' : '#bbb'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(bx, by, 28, 0, 7); ctx.stroke();
      text('B', bx, by + 10, 28, f.burst >= 100 ? '#fff' : '#666', 'center');
      // tên + gimmick
      text(f.name + (f.buffs.burst > 0 ? '  ★ BURST' : ''), left ? x0 : x0 + w, y + 74, 32, INK, left ? 'left' : 'right');
      const hud = f.G.hud ? f.G.hud(f) : [];
      let hx = left ? x0 : x0 + w;
      for (const it of hud) {
        if (it.elements) {
          // Star: 3 slot nguyên tố + stock
          for (let k = 0; k < 3; k++) {
            const e = it.elements[k];
            const cx = left ? hx + 22 + k * 46 : hx - 22 - (2 - k) * 46 - 100;
            ctx.beginPath(); ctx.arc(cx, y + 110, 18, 0, 7);
            ctx.fillStyle = e ? SO.EL_COLOR[e] : '#eee'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
            if (e) text({ F: 'L', I: 'B', L: 'S' }[e], cx, y + 119, 22, '#222', 'center');
          }
          const sx = left ? hx + 170 : hx - 60;
          const lab = it.stock ? it.stock.split('').map((ch) => ({ F: 'Fire', I: 'Ice', L: 'Bolt' })[ch]).join('+') : '—';
          text('Stock: ' + lab, sx, y + 119, 24, '#7a6000', 'left');
        } else {
          text(it.text, hx, y + 112, 28, it.color, left ? 'left' : 'right');
          const wdt = ctx.measureText(it.text).width + 24;
          hx += left ? wdt : -wdt;
        }
      }
    }
    // timer + rounds
    panel(890, 22, 140, 92, 0.95);
    text(W.training ? '∞' : String(Math.ceil(W.timer / 60)), 960, 92, 64, INK, 'center');
    for (let p = 0; p < 2; p++) {
      for (let r = 0; r < C.ROUNDS_TO_WIN; r++) {
        const x = 960 + (p ? 1 : -1) * (100 + r * 30);
        ctx.beginPath(); ctx.arc(x, 135, 11, 0, 7);
        ctx.fillStyle = W.score[p] > r ? '#e04a3a' : '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      }
    }
    // Equilibrium
    const ex = 960, ey = 1006, ew = 1000;
    R.sketchRect(ctx, ex - ew / 2, ey - 18, ew, 36, 222, { fill: '#e6ddd0', stroke: INK, width: 4 });
    // vùng không thể chạm (dưới 25%)
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(ex - ew / 2 + 4, ey - 14, ew / 4 - 4, 28);
    ctx.fillRect(ex + ew / 4, ey - 14, ew / 4 - 4, 28);
    const pos = ex + (W.eq / 100) * (ew / 2);
    ctx.fillStyle = 'rgba(210,60,50,0.55)';
    ctx.fillRect(ex - ew / 2 + 4, ey - 14, pos - (ex - ew / 2 + 4), 28);
    ctx.fillStyle = 'rgba(50,100,210,0.55)';
    ctx.fillRect(pos, ey - 14, ex + ew / 2 - 4 - pos, 28);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex, ey - 22); ctx.lineTo(ex, ey + 22); ctx.stroke();
    R.sketchPoly(ctx, [[pos, ey - 30], [pos + 14, ey - 46], [pos - 14, ey - 46]], 223, { fill: '#222', stroke: INK, width: 2, noSub: true });
    const r0 = W.res(0), r1 = W.res(1);
    text('P1 ' + r0.toFixed(0) + '%', ex - ew / 2 - 14, ey + 12, 32, '#b22', 'right');
    text(r1.toFixed(0) + '% P2', ex + ew / 2 + 14, ey + 12, 32, '#236', 'left');
    text('EQUILIBRIUM', ex, ey - 26, 22, '#555', 'center');
    const tags = (r) => (r >= 50 ? 'SUPER/RC' : r >= 25 ? 'DA' : '');
    text(tags(r0), ex - ew / 2 + 10, ey + 50, 22, '#b22', 'left');
    // token (vd Circle power-up): huy hiệu ngọn lửa cạnh thanh lực
    for (const f of W.f) {
      const n = f.G.tokens ? f.G.tokens(f) : 0;
      for (let k = 0; k < n; k++) {
        const tx = f.idx === 0 ? ex - ew / 2 - 175 - k * 40 : ex + ew / 2 + 175 + k * 40, ty = ey - 2;
        const pulse = 1 + 0.08 * Math.sin(W.frame * 0.25);
        ctx.save(); ctx.translate(tx, ty); ctx.scale(pulse, pulse);
        ctx.fillStyle = '#e2401b'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(16, -6, 12, 8); ctx.quadraticCurveTo(8, 18, 0, 18); ctx.quadraticCurveTo(-8, 18, -12, 8); ctx.quadraticCurveTo(-14, -4, -4, -10); ctx.quadraticCurveTo(-2, -2, 2, -4); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 8, 6, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
    text(tags(r1), ex + ew / 2 - 10, ey + 50, 22, '#236', 'right');
    // combo
    const st = W.stats;
    if (st.comboShowT > 0 && st.comboHits >= 2) {
      const left = st.comboOwner === 0;
      outlined(st.comboHits + ' HITS', left ? 330 : 1590, 500, 64, left ? '#b22' : '#236');
      outlined(st.comboDmg + ' dmg', left ? 330 : 1590, 548, 38, '#444');
    }
    if (W.training && R.frameData) drawTraining(W);
    // banner
    if (W.phase === 'intro') {
      outlined(W.phaseT < 60 ? 'ROUND ' + W.round : 'FIGHT!', 960, 470, 130, '#c33');
    }
    if (W.phase === 'roundEnd') outlined(W.endText || '', 960, 470, 130, '#c33');
    if (W.phase === 'matchEnd') {
      const w = W.score[0] > W.score[1] ? 0 : 1;
      outlined((w === 0 ? 'P1 ' : 'P2 ') + W.f[w].name + ' WINS!', 960, 430, 110, w === 0 ? '#b22' : '#236');
      if (W.phaseT > 60) text('U / Enter: rematch · I / Backspace: character select', 960, 520, 36, INK, 'center');
    }
  }

  function drawTraining(W) {
    const f = W.f[0];
    const lm = W.stats.lastMove[0];
    const X = 40, Y = 186;
    panel(X, Y, 560, 214, 0.88);
    text('FRAME DATA (P1)', X + 20, Y + 34, 24, '#b22');
    if (lm) {
      const m = lm.inst, d = m.d;
      text(d.input + ' · ' + d.name + (d.placeholder ? ' *' : ''), X + 20, Y + 66, 24, INK, 'left');
      text('Startup ' + m.su + ' · Active ' + (d.isProj ? d.act + ' (proj)' : m.act) + ' · Recovery ' + m.rec + ' · Total ' + m.total, X + 20, Y + 94, 21, '#444', 'left', false);
      text('On block ' + fmtAdv(d.ob) + ' · On hit ' + (d.kbt === 'Normal' ? fmtAdv(d.oh) : d.kbt) + ' · Dmg ' + d.dmg + (d.cost ? ' · Cost ' + d.cost + '%' : ''), X + 20, Y + 120, 21, '#444', 'left', false);
    }
    const adv = W.stats.lastAdv;
    text('Actual advantage: ' + (adv === null ? '—' : fmtAdv(adv)), X + 20, Y + 152, 24, adv === null ? '#777' : adv >= 0 ? '#1a8a3a' : '#c33');
    text('Combo: ' + W.stats.comboHits + ' hit · ' + W.stats.comboDmg + ' dmg · Dummy: ' + W.f[1].state + (W.f[1].fd ? ' (FD)' : ''), X + 20, Y + 180, 21, '#444', 'left', false);
    text('* = placeholder data', X + 20, Y + 203, 17, '#999', 'left', false);
    // input log
    panel(1770, 186, 110, 470, 0.85);
    text('INPUT', 1825, 218, 22, '#b22', 'center');
    f.inp.log.slice(0, 13).forEach((e, i) => text(prettyInput(e.s), 1825, 252 + i * 31, 24, i ? '#555' : INK, 'center', false));
  }
  const ARROW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
  function prettyInput(s) { return s.replace(/^[1-9]/, (d) => ARROW[d] || d); }
  function fmtAdv(v) { return (v > 0 ? '+' : '') + v; }

  function drawPause(W) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(30,30,40,0.35)';
    ctx.fillRect(0, 0, R.W, R.H);
    const items = pauseItems();
    const h = 90 + items.length * 52;
    panel(560, 540 - h / 2, 800, h);
    text('PAUSED', 960, 540 - h / 2 + 62, 46, INK, 'center');
    items.forEach((it, i) => {
      const y = 540 - h / 2 + 120 + i * 52;
      if (i === G.pauseIdx) R.sketchRect(ctx, 600, y - 38, 720, 50, 300 + i, { fill: '#ffe9a8', stroke: INK, width: 2 });
      text(it.label, 960, y, 32, INK, 'center', i === G.pauseIdx);
    });
    text('W/S select · A/D change · U/Enter confirm · Tab/Esc close', 960, 540 + h / 2 + 40, 26, '#fff', 'center', false);
  }

  function drawMoveList() {
    const ml = G.moveList;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(30,30,40,0.35)';
    ctx.fillRect(0, 0, R.W, R.H);
    panel(120, 70, 1680, 940);
    text('MOVE LIST — ' + ml.name, 960, 130, 46, INK, 'center');
    const cols = [['Input', 150], ['Name', 470], ['Type', 900], ['Dmg', 1040], ['SU', 1140], ['Act', 1220], ['Rec', 1300], ['Block', 1390], ['Hit', 1490], ['Cost', 1590], ['Stance', 1680]];
    cols.forEach(([n, x]) => text(n, x, 190, 26, '#b22', 'left'));
    ml.rows.slice(ml.scroll, ml.scroll + 18).forEach((m, i) => {
      const y = 232 + i * 42;
      const v = [m.input, m.name + (m.placeholder ? ' *' : ''), m.type, m.dmg, m.su, m.act, m.rec, fmtAdv(m.ob), m.kbt === 'Normal' ? fmtAdv(m.oh) : m.kbt.replace('_', ' ').replace('Hard Knockdown', 'HKD').replace('Knockdown', 'KD'), m.cost ? m.cost + '%' : '', m.stance];
      cols.forEach(([n, x], k) => {
        let s = String(v[k]);
        if (k === 1 && s.length > 30) s = s.slice(0, 29) + '…';
        text(s, x, y, 24, INK, 'left', false);
      });
    });
    text('W/S scroll · ' + (ml.scroll + 1) + '-' + Math.min(ml.rows.length, ml.scroll + 18) + ' / ' + ml.rows.length + ' · I/Esc close · * = placeholder data', 960, 990, 24, '#555', 'center', false);
  }

  function drawToast() {
    if (!G.toast) return;
    G.toast.t--;
    if (G.toast.t <= 0) { G.toast = null; return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, G.toast.t / 30);
    ctx.font = 'bold 30px ' + FONT;
    const w = ctx.measureText(G.toast.msg).width + 60;
    panel(960 - w / 2, 170, w, 64);
    text(G.toast.msg, 960, 212, 30, INK, 'center');
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ loop
  function tick() {
    pressedNow = SO.keysPressedOnce.splice(0);
    pollPads();
    if (G.scene === 'title') updateTitle();
    else if (G.scene === 'select') updateSelect();
    else if (G.scene === 'fight' && G.world) updateFight();
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.scene === 'title') drawTitle();
    else if (G.scene === 'select') drawSelect();
    else if (G.scene === 'fight' && G.world) {
      R.render(ctx, G.world);
      drawHUD(G.world);
      if (G.world.flash) R.drawCutIn(ctx, G.world);
      if (G.moveList) drawMoveList();
      else if (G.paused) drawPause(G.world);
    }
    drawToast();
  }
  SO.draw = draw;
  SO.tick = tick;

  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(250, now - last);
    last = now;
    let n = 0;
    while (acc >= STEP && n < 8) { if (!window.SO_FREEZE) tick(); acc -= STEP; n++; }
    draw();
    requestAnimationFrame(loop);
  }
  if (!window.SO_HEADLESS) requestAnimationFrame(loop);

  // co giãn canvas vừa cửa sổ
  function fit() {
    const cs = getComputedStyle(document.body);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 0;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) || 0;
    const s = Math.min((document.documentElement.clientWidth - padX) / R.W, (window.innerHeight - padY) / R.H);
    canvas.style.width = Math.floor(R.W * s) + 'px';
    canvas.style.height = Math.floor(R.H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();
})();
