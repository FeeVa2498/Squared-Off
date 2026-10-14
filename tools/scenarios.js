// Kịch bản test cơ chế (chạy sau selftest.js)
(function () {
  const SO = window.SO, T = window.SO_TEST;
  const blank = T.blank, dirRaw = T.dirRaw;
  function mirror(d) { return SO.mirrorDir(d); }
  function parse(tokens, mir) {
    const out = [];
    const md = (d) => (mir ? mirror(d) : d);
    const raw = (d, btns) => { const r = dirRaw(md(d)); (btns || '').split('').forEach((b) => b && (r[b] = true)); return r; };
    for (const t of tokens) {
      let m;
      if ((m = t.match(/^w(\d+)$/))) { for (let k = 0; k < +m[1]; k++) out.push(blank()); }
      else if ((m = t.match(/^(\d)(?:\+([LMHU]+))?:(\d+)$/))) { for (let k = 0; k < +m[3]; k++) out.push(raw(+m[1], m[2])); }
      else if ((m = t.match(/^(\d*)([LMHU]+)$/))) {
        const ds = m[1] ? m[1].split('').map(Number) : [5];
        ds.forEach((d, i) => { const last = i === ds.length - 1; out.push(raw(d, last ? m[2] : '')); out.push(raw(d, last ? m[2] : '')); });
      } else throw new Error('token ' + t);
    }
    return out;
  }
  function scen(o) {
    const W = SO.newMatch(o.p1, o.p2 || 'Square', o.mode || 'training');
    W.dummy.refill = false;
    W.dummy.block = o.block || 'none';
    if (o.p2seq) W.dummy.stance = 'manual';
    const [a, b] = W.f;
    a.x = 1200; b.x = 1200 + (o.dist || 120);
    W.eq = o.eq === undefined ? 40 : o.eq;
    if (o.setup) o.setup(W, a, b);
    const q1 = parse(o.p1seq || []), q2 = parse(o.p2seq || [], true);
    W.cpuInput = [() => q1.shift() || (o.p1idle ? Object.assign(blank(), o.p1idle) : blank()), o.p2seq ? () => q2.shift() || (o.p2idle ? Object.assign(blank(), o.p2idle) : blank()) : null];
    const trace = [];
    const ev = { states: [new Set(), new Set()], moves: [new Set(), new Set()], maxCombo: 0, hp0: [a.hp, b.hp] };
    let err = null;
    try {
      for (let fr = 0; fr < (o.frames || 180); fr++) {
        W.step();
        for (let i = 0; i < 2; i++) {
          ev.states[i].add(W.f[i].state);
          const lm = W.stats.lastMove[i];
          if (lm) ev.moves[i].add(lm.inst.d.id);
        }
        ev.maxCombo = Math.max(ev.maxCombo, b.combo.hits, a.combo.hits);
        if (o.each) o.each(W, a, b, fr, ev);
        if (o.trace) trace.push(fr + ':' + a.state + '/' + (a.move ? a.move.id + '@' + a.mf : '') + ' | ' + b.state + '/' + (b.move ? b.move.id + '@' + b.mf : '') + ' hp' + b.hp);
      }
    } catch (e) { err = e.stack; }
    const res = { name: o.name, err, p1: [...ev.states[0]], p2: [...ev.states[1]], m1: [...ev.moves[0]], m2: [...ev.moves[1]], combo: ev.maxCombo, dmg: [ev.hp0[0] - a.hp, ev.hp0[1] - b.hp], eq: W.eq };
    let pass = true;
    try { pass = o.check ? !!o.check(res, W, a, b, ev) : true; } catch (e) { pass = false; res.checkErr = String(e); }
    res.pass = pass && !err;
    if (o.trace && !res.pass) res.trace = trace.slice(0, o.trace);
    if (o.extra) res.extra = o.extra(W, a, b, ev);
    return res;
  }

  const S = [];
  S.push({ name: 'Combo Circle 5L>cM>5H', p1: 'Circle', dist: 100, p1seq: ['5L', 'w6', 'M', 'w8', 'H'], frames: 70, check: (r) => r.combo >= 3 });
  S.push({ name: 'Combo Circle 5L>cM>214M', p1: 'Circle', dist: 100, p1seq: ['5L', 'w6', 'M', 'w6', '214M'], frames: 90, check: (r) => r.combo >= 3 });
  S.push({ name: 'Circle 6M on hit link vào 5L', p1: 'Circle', dist: 120, p1seq: ['6M', 'w32', 'L'], frames: 70, check: (r) => r.m1.includes('CR_5L') && r.combo >= 2 });
  S.push({ name: 'Combo Square 2L>2M>236L', p1: 'Square', dist: 100, p1seq: ['2L', 'w6', '2M', 'w6', '236L'], frames: 120, check: (r) => r.combo >= 3 });
  S.push({ name: 'Gatling không lùi tier (5H>5L bị chặn)', p1: 'Square', dist: 100, p1seq: ['H', 'w12', 'L'], frames: 80, check: (r) => !r.m1.includes('SQ_5L') });
  S.push({ name: 'Jump cancel 5H (on hit)', p1: 'Circle', dist: 100, p1seq: ['H', 'w12', '9:6'], frames: 70, check: (r) => r.p1.includes('air') && r.p1.includes('prejump') });
  S.push({ name: 'Block all vs 5L', p1: 'Circle', dist: 100, block: 'all', p1seq: ['L'], frames: 40, check: (r) => r.p2.includes('block') && !r.p2.includes('hitstun') });
  S.push({ name: 'Chip damage special khi block', p1: 'Circle', dist: 120, block: 'all', p1seq: ['236L'], frames: 60, check: (r) => r.p2.includes('block') && r.dmg[1] > 0 });
  S.push({ name: 'Low trúng người block đứng', p1: 'Square', dist: 100, p2seq: ['4:60'], p1seq: ['w6', '2L'], frames: 40, check: (r) => r.p2.includes('hitstun') });
  S.push({ name: 'Overhead trúng người block ngồi', p1: 'Square', dist: 100, p2seq: ['1:60'], p1seq: ['w6', '6H'], frames: 60, check: (r) => r.p2.includes('hitstun') });
  S.push({ name: 'High bị block khi đứng', p1: 'Square', dist: 100, p2seq: ['4:60'], p1seq: ['w6', '6H'], frames: 60, check: (r) => r.p2.includes('block') && !r.p2.includes('hitstun') });
  S.push({ name: 'Throw L+M', p1: 'Circle', dist: 100, p1seq: ['w3', 'LM'], frames: 80, check: (r) => r.p2.includes('thrown') && r.dmg[1] >= 70 });
  S.push({ name: 'Throw break', p1: 'Circle', dist: 100, p1seq: ['w3', 'LM'], p2seq: ['w12', 'LM'], frames: 60, check: (r) => r.p2.includes('recoil') && r.dmg[1] === 0 });
  S.push({ name: 'Throw tech khi cùng ném', p1: 'Circle', dist: 100, p1seq: ['w3', 'LM'], p2seq: ['w3', 'LM'], frames: 60, check: (r) => r.p1.includes('recoil') && r.p2.includes('recoil') });
  S.push({ name: 'Throw không bắt người đang nhảy', p1: 'Circle', dist: 100, p2seq: ['8:10'], p1seq: ['w8', 'LM'], frames: 60, check: (r) => !r.p2.includes('thrown') });
  S.push({ name: 'Roman Cancel 5H whiff', p1: 'Circle', dist: 400, eq: 40, p1seq: ['H', 'w3', 'LMH'], frames: 30, check: (r, W, a) => r.eq < 0 && a.state !== 'attack' });
  S.push({ name: 'Không đủ 50% thì không RC tím (neutral)', p1: 'Circle', dist: 400, eq: -40, p1seq: ['LMH'], frames: 12, check: (r, W) => W.eq === -40 });
  S.push({ name: 'RC vàng chỉ tốn 25% (đòn đang startup)', p1: 'Circle', dist: 400, eq: 0, p1seq: ['H', 'w3', 'LMH'], frames: 12, check: (r, W) => Math.abs(W.eq - -50) < 0.5 && W.fx.some((e) => e.text === 'YELLOW ROMAN CANCEL') });
  S.push({ name: 'RC đỏ khi đối thủ đang bị đánh (50%)', p1: 'Circle', dist: 100, eq: 0, p1seq: ['H', 'w16', 'LMH'], frames: 30, check: (r, W) => W.fx.some((e) => e.text === 'RED ROMAN CANCEL') });
  S.push({ name: 'RC tím khi đòn whiff đang recovery', p1: 'Circle', dist: 600, eq: 40, p1seq: ['H', 'w22', 'LMH'], frames: 30, check: (r, W) => W.fx.some((e) => e.text === 'PURPLE ROMAN CANCEL') });
  S.push({ name: 'Defensive burst thoát combo', p1: 'Circle', dist: 100, p1seq: ['5L', 'w6', 'M', 'w8', 'H'], p2seq: ['w12', 'UL'], frames: 80, check: (r) => r.m2.includes('ALL_BURST_D') && (r.p1.includes('airhit') || r.p1.includes('block')) });
  S.push({ name: 'Offensive burst + buff', p1: 'Circle', dist: 100, p1seq: ['w3', 'UH'], frames: 40, check: (r, W, a) => r.m1.includes('ALL_BURST_O') && a.buffs.burst > 0 && a.burst < 1 });
  S.push({ name: 'Dead Angle khi block', p1: 'Circle', dist: 100, eq: 0, p1seq: ['w2', 'H'], p2seq: ['4:22', '4+LMH:3', 'w20'], frames: 60, check: (r) => r.m2.includes('ALL_DEAD_ANGLE') });
  S.push({ name: 'FD giảm Equilibrium', p1: 'Circle', dist: 100, eq: 0, p1seq: ['w2', 'H'], p2seq: ['4:20', '4+LM:30'], frames: 40, check: (r, W) => r.p2.includes('block') && W.eq > 0 });
  S.push({ name: 'Instant block', p1: 'Circle', dist: 100, p1seq: ['w2', 'H'], p2seq: ['w12', '4:30'], frames: 40, extra: (W) => W.fx.map((e) => e.text).filter(Boolean) });
  S.push({ name: 'Octagon charge [4]6L', p1: 'Octagon', dist: 500, p1seq: ['4:45', '6L'], frames: 70, check: (r) => r.m1.includes('OC_C46L') });
  S.push({ name: 'Octagon chưa đủ charge thì không ra', p1: 'Octagon', dist: 500, p1seq: ['4:15', '6L'], frames: 40, check: (r) => !r.m1.includes('OC_C46L') });
  S.push({ name: 'Octagon charge [2]8H', p1: 'Octagon', p2: 'Circle', dist: 140, p1seq: ['2:45', '8H'], frames: 60, check: (r) => r.m1.includes('OC_C28H') && !r.p1.includes('air') });
  S.push({ name: 'Rhombus [4]6H Diamond Charge', p1: 'Rhombus', dist: 230, p1seq: ['4:45', '6H'], frames: 70, check: (r) => r.m1.includes('RH_C46H') && r.dmg[1] > 0 });
  S.push({ name: 'Rhombus không dash được', p1: 'Rhombus', dist: 600, p1seq: ['6:2', 'w2', '6:20'], frames: 30, check: (r) => !r.p1.includes('dash') });
  S.push({ name: 'Mép màn hình chặn lùi', p1: 'Circle', dist: 300, p1seq: ['4:240'], frames: 240, check: (r, W, a, b) => Math.abs(b.x - a.x) <= SO.CFG.VIEW_W - a.c.w / 2 - b.c.w / 2 - SO.CFG.SCREEN_MARGIN * 2 + 1 && b.x > a.x });
  S.push({ name: 'Dash 66', p1: 'Circle', dist: 600, p1seq: ['6:2', 'w2', '6:20'], frames: 30, check: (r) => r.p1.includes('dash') });
  S.push({ name: 'Backdash 44', p1: 'Circle', dist: 300, p1seq: ['4:2', 'w2', '4:2'], frames: 30, check: (r) => r.p1.includes('backdash') });
  S.push({ name: 'Super jump 2>8 + không double jump', p1: 'Square', dist: 600, p1seq: ['2:3', '8:3', 'w10', '8:3'], frames: 30, check: (r, W, a) => a.superJump && a.airJumps === 0 });
  S.push({ name: 'IAD 956', p1: 'Square', dist: 600, p1seq: ['9:2', 'w1', '6:2'], frames: 14, each: (W, a, b, fr, ev) => { if (a.state === 'airdash') ev.iadY = Math.min(ev.iadY || 999, a.y); }, check: (r, W, a, b, ev) => ev.iadY !== undefined && ev.iadY < 60 });
  S.push({ name: 'IAD lùi 754', p1: 'Square', dist: 600, p1seq: ['7:2', 'w1', '4:2'], frames: 14, check: (r) => r.p1.includes('airdash') });
  S.push({ name: 'Nhảy tới + giữ 6 không thành IAD', p1: 'Square', dist: 600, p1seq: ['9:2', '6:12'], frames: 16, check: (r) => !r.p1.includes('airdash') });
  S.push({ name: 'Double jump', p1: 'Square', dist: 600, p1seq: ['8:3', 'w10', '8:3'], frames: 26, check: (r, W, a) => a.airJumps === 0 && !a.superJump });
  S.push({ name: 'Airdash rồi không double jump', p1: 'Square', dist: 600, p1seq: ['8:3', 'w8', '6:2', 'w2', '6:2', 'w3', '8:3'], frames: 30, check: (r, W, a) => r.p1.includes('airdash') && a.airJumps === 1 });
  S.push({ name: 'Super 236236H flash', p1: 'Square', dist: 200, eq: 40, p1seq: ['236236H'], frames: 120, check: (r) => r.m1.includes('SQ_236236H') && r.dmg[1] > 100 });
  S.push({ name: 'Circle Dragon Install 214214M: special là EX, không tốn token', p1: 'Circle', dist: 140, eq: 40, p1seq: ['214214M', 'w50', '214M'], frames: 120, check: (r, W, a) => r.m1.includes('CR_214214M') && r.m1.includes('CR_214M_EX') && a.gim.di > 0 });
  S.push({ name: 'Super không đủ tài nguyên', p1: 'Square', dist: 200, eq: -40, p1seq: ['236236H'], frames: 60, check: (r) => !r.m1.includes('SQ_236236H') });
  S.push({ name: 'Circle 5U nạp token, special kế tiếp là EX và mất token', p1: 'Circle', dist: 150, p1seq: ['U', 'w45', '214M'], frames: 110, check: (r, W, a) => r.m1.includes('CR_5U') && r.m1.includes('CR_214M_EX') && a.gim.token === 0 });
  S.push({ name: 'Square ring tăng tốc projectile', p1: 'Square', dist: 900, p1seq: ['U', 'w26', '236L'], frames: 90, each: (W, a, b, fr, ev) => { if (W.projs.some((p) => p.boosted)) ev.boost = true; }, check: (r, W, a, b, ev) => ev.boost });
  S.push({ name: 'Triangle apex dash rồi j.H', p1: 'Triangle', dist: 400, p1seq: ['U', 'w10', 'H'], frames: 50, check: (r) => r.m1.includes('TR_5U') && r.m1.includes('TR_jH') });
  S.push({ name: 'Triangle 214L side swap khi ở gần', p1: 'Triangle', dist: 130, p1seq: ['214L'], frames: 40, check: (r, W, a, b) => a.x > b.x });
  S.push({ name: 'Triangle 214L ở xa không qua người', p1: 'Triangle', dist: 700, p1seq: ['214L'], frames: 40, check: (r, W, a, b) => a.x < b.x && r.m1.includes('TR_214L') });
  S.push({ name: 'Triangle 214L cancel sang 5H', p1: 'Triangle', dist: 600, p1seq: ['214L', 'w4', 'H'], frames: 50, check: (r) => r.m1.includes('TR_5H') });
  S.push({ name: 'Triangle disc chưa gây sát thương trước 30f', p1: 'Triangle', dist: 200, p1seq: ['236L'], frames: 50, each: (W, a, b, fr, ev) => { const p = W.projs.find((q) => q.kind === 'disc'); if (p && p.t < 30 && b.state === 'hitstun') ev.early = true; if (p && b.combo.hits > 0) ev.hit = true; }, check: (r, W, a, b, ev) => !ev.early });
  S.push({ name: 'Rhombus command grab 63214H', p1: 'Rhombus', dist: 120, p1seq: ['63214H'], frames: 90, check: (r) => r.p2.includes('thrown') && r.dmg[1] >= 140 });
  S.push({ name: 'Rhombus grip shift armor', p1: 'Rhombus', p2: 'Circle', dist: 140, p1seq: ['U', 'w10', 'H'], p2seq: ['w18', 'L'], frames: 50, extra: (W) => W.fx.map((e) => e.text).filter(Boolean), check: (r) => r.m1.includes('RH_5H') });
  S.push({ name: 'Hexagon node + detonate', p1: 'Hexagon', dist: 300, p1seq: ['2U', 'w26', '236L'], frames: 80, check: (r) => r.dmg[1] > 0 });
  S.push({ name: 'Hexagon tia nối 2 node', p1: 'Hexagon', dist: 250, setup: (W, a, b) => { a.gim.nodes = [{ x: b.x - 100, y: 60, life: 900 }, { x: b.x + 150, y: 60, life: 900 }]; }, p1seq: ['236L'], frames: 50, each: (W, a, b, fr, ev) => { if (W.projs.some((p) => p.kind === 'line')) ev.line = true; }, check: (r, W, a, b, ev) => ev.line && r.dmg[1] > 0 });
  S.push({ name: 'Oval stretch tăng tầm', p1: 'Oval', dist: 260, p1seq: ['U', 'w14', 'M'], frames: 50, check: (r) => r.dmg[1] > 0 });
  S.push({ name: 'Cone điều khiển Cylinder + đánh', p1: 'Cone & Cyl', dist: 260, p1seq: ['5+U:2', '6+U:40', '6+UL:2', '5+U:20'], frames: 70, check: (r) => r.dmg[1] > 0 });
  S.push({ name: 'Cylinder bị đánh -> choáng', p1: 'Cone & Cyl', p2: 'Circle', dist: 200, setup: (W, a) => { a.gim.cyl.x = a.x + 90; }, p1seq: ['5+U:60'], p2seq: ['w6', 'M'], frames: 30, check: (r, W, a) => a.gim.cyl.stun > 0 });
  S.push({ name: 'Octagon parry 5U vs 5H', p1: 'Circle', p2: 'Octagon', dist: 110, p1seq: ['w2', 'H'], p2seq: ['w12', 'U'], frames: 60, check: (r) => r.p1.includes('hitstun') && r.dmg[1] === 0 });
  S.push({ name: 'Octagon parry sai tầng (5U vs 2L)', p1: 'Square', p2: 'Octagon', dist: 100, p1seq: ['w4', '2L'], p2seq: ['w5', 'U'], frames: 30, check: (r) => r.p2.includes('hitstun') });
  S.push({ name: 'Semicircle đổi thế giữa đòn', p1: 'Semicircle', dist: 100, p1seq: ['H', 'w4', 'U'], frames: 40, check: (r, W, a) => a.gim.stance === 'Arc' && r.m1.includes('SC_5H') && r.m1.length === 1 });
  S.push({ name: 'Semicircle Arc 214M khác Flat 214M', p1: 'Semicircle', dist: 120, setup: (W, a) => { a.gim.stance = 'Arc'; }, p1seq: ['214M'], frames: 60, check: (r) => r.m1.includes('SC_A_214M') });
  S.push({ name: 'Semicircle Flat auto-guard counter', p1: 'Semicircle', p2: 'Circle', dist: 110, p1seq: ['214M'], p2seq: ['w8', 'H'], frames: 70, check: (r) => r.m1.includes('SC_F_GUARD_SLASH') });
  S.push({ name: 'Star L=Băng M=Điện: cast IIL', p1: 'Star', dist: 100, p1seq: ['L', 'w14', '4L', 'w14', 'M', 'w20', 'U'], frames: 120, check: (r) => r.m1.includes('ST_SP_IIL') });
  S.push({ name: 'Star 4L / 6H / 2M đúng chiêu', p1: 'Star', dist: 120, p1seq: ['4L', 'w16', '6H', 'w40', '2M'], frames: 110, check: (r) => r.m1.includes('ST_4L') && r.m1.includes('ST_6H') && r.m1.includes('ST_2M') });
  S.push({ name: 'Star không nạp khi đánh trượt', p1: 'Star', dist: 600, p1seq: ['L', 'w14', 'U'], frames: 50, check: (r, W, a) => !r.m1.some((m) => m.startsWith('ST_SP')) });
  S.push({ name: 'Star nạp khi bị block', p1: 'Star', dist: 100, block: 'all', p1seq: ['L', 'w14'], frames: 30, check: (r, W, a) => a.gim.el.length === 1 });
  S.push({ name: 'Star stock 214U rồi cast stock', p1: 'Star', dist: 120, setup: (W, a) => { a.gim.el = ['L', 'L']; }, p1seq: ['214U', 'w30', 'U'], frames: 90, check: (r, W, a) => r.m1.includes('ST_214U') && r.m1.includes('ST_SP_LL') && a.gim.stock === null });
  S.push({ name: 'Star FIL = ST_U_3E', p1: 'Star', dist: 250, setup: (W, a) => { a.gim.el = ['L', 'F', 'I']; }, p1seq: ['U'], frames: 90, check: (r) => r.m1.includes('ST_U_3E') && r.dmg[1] > 0 });
  S.push({ name: 'Proration: combo dài sát thương giảm', p1: 'Circle', dist: 100, p1seq: ['5L', 'w6', '5L', 'w6', '5L', 'w6', '5L'], frames: 60, extra: (W, a, b) => b.combo.scale });
  S.push({ name: 'Versus: KO kết thúc round', p1: 'Circle', mode: 'versus', dist: 100, setup: (W, a, b) => { W.phase = 'fight'; b.hp = 5; }, p1seq: ['H'], frames: 400, check: (r, W) => W.score[0] === 1 && W.round === 2 });
  S.push({ name: 'Air tech sau launch', p1: 'Circle', p2: 'Square', dist: 100, setup: (W) => { W.dummy.tech = true; W.dummy.stance = 'stand'; }, p1seq: ['2H'], frames: 90, each: (W, a, b) => { if (b.state === 'airhit' && b.untech > 12) b.untech = 12; }, check: (r) => r.p2.includes('airhit') && r.p2.includes('air') });
  S.push({ name: 'Crouch hitstun dài hơn', p1: 'Square', dist: 100, p2seq: ['2:60'], p1seq: ['w2', 'L'], frames: 30, extra: (W, a, b) => b.stun });

  window.SO_SCEN = function (filter) {
    const all = S.filter((s) => !filter || s.name.includes(filter)).map(scen);
    return { passed: all.filter((r) => r.pass).length, total: all.length, fails: all.filter((r) => !r.pass), extras: all.filter((r) => r.pass && r.extra !== undefined).map((r) => [r.name, r.extra]) };
  };
  window.SO_SCEN1 = scen;
})();
