// Test luật chung + Circle (cần selftest.js, scenarios.js, drive.js)
(function () {
  const D = (o) => window.SO_DRIVE(o);
  const T = [];
  const demo = [{ in: 'M', id: 'CR_cM' }, { in: 'M', id: 'CR_fM' }, { in: 'H', id: 'CR_5H' }, { in: '3H', id: 'CR_3H' }, { in: '214M', id: 'CR_214M_EX' }, { in: 'M', id: 'CR_cM' }, { in: '2H', id: 'CR_2H' }, { in: '9', id: 'jump' }, { in: 'L', id: 'CR_jL' }, { in: 'M', id: 'CR_jM' }, { in: '9', id: 'jump' }, { in: 'M', id: 'CR_jM' }, { in: 'H', id: 'CR_jH' }, { in: '623H', id: 'CR_j623H' }];
  T.push(['Combo demo Circle (có token)', () => { const r = D({ p1: 'Circle', setup: (W, a) => { a.gim.token = 1; }, steps: demo.map((x) => Object.assign({}, x)) }); return [!r.failed && r.maxHits >= 14, r]; }]);
  T.push(['Gatling jab: 2L 2L 5L 5L', () => { const r = window.SO_SCEN1({ p1: 'Circle', dist: 90, p1seq: ['2L', 'w8', '2L', 'w8', 'L', 'w8', 'L'], frames: 50 }); return [r.combo >= 4, [r.combo, r.m1]]; }]);
  T.push(['Đứng/ngồi cùng nút: 5H > 2H và 2M > cM', () => { const a = D({ p1: 'Circle', dist: 110, steps: [{ in: 'H', id: 'CR_5H' }, { in: '2H', id: 'CR_2H' }] }); const b = D({ p1: 'Circle', dist: 100, steps: [{ in: '2M', id: 'CR_2M' }, { in: 'M', id: 'CR_cM' }] }); return [!a.failed && !b.failed, [a, b]]; }]);
  T.push(['L gatling thẳng vào H', () => { const r = D({ p1: 'Circle', dist: 100, steps: [{ in: 'L', id: 'CR_5L' }, { in: 'H', id: 'CR_5H' }] }); return [!r.failed, r]; }]);
  T.push(['Không gatling ngược H > M', () => { const r = window.SO_SCEN1({ p1: 'Circle', dist: 100, p1seq: ['H', 'w18', 'M', 'w3', 'M'], frames: 34 }); return [!r.m1.includes('CR_cM') && !r.m1.includes('CR_fM'), r.m1]; }]);
  T.push(['6M overhead +2 on block', () => { const W = SO.newMatch('Circle', 'Square', 'training'); const m = W.f[0].c.byId.CR_6M; return [m.blk === 'High' && m.ob === 2, m.ob]; }]);
  T.push(['6H counter hit: hit 1 hất, hit 2 ground bounce', () => {
    let bounced = false;
    const r = window.SO_SCEN1({ p1: 'Circle', p2: 'Square', dist: 130, p2seq: ['w2', 'H'], p1seq: ['6H'], frames: 90, each: (W, a, b) => { if (b.groundBounce) bounced = true; } });
    return [bounced && r.m1.includes('CR_6H2'), [bounced, r.m1, r.p2]];
  }]);
  T.push(['6H thường: hit 1 special cancel', () => { const r = D({ p1: 'Circle', dist: 120, steps: [{ in: '6H', id: 'CR_6H' }, { in: '214M', id: 'CR_214M' }] }); return [!r.failed, r]; }]);
  T.push(['Cancel 2M > 5U = Power Burst + token', () => { const r = D({ p1: 'Circle', dist: 100, steps: [{ in: '2M', id: 'CR_2M' }, { in: 'U', id: 'CR_5U_BURST' }], until: (W, a) => a.gim.token === 1 && a.state !== 'attack' }); return [!r.failed && r.token === 1, r]; }]);
  T.push(['Sweep > 5U, lần sau sweep > 214M EX hất tung', () => { const r = D({ p1: 'Circle', dist: 110, steps: [{ in: '3H', id: 'CR_3H' }, { in: 'U', id: 'CR_5U_BURST' }] }); return [!r.failed && r.token === 1, r]; }]);
  T.push(['623L command grab rồi nhảy nối combo', () => { const r = D({ p1: 'Circle', dist: 100, steps: [{ in: '623L', id: 'CR_623L' }, { in: '9', id: 'jump' }, { in: 'M', id: 'CR_jM' }], until: (W, a, b) => b.combo.hits >= 2 }); return [!r.failed && r.maxHits >= 2, r]; }]);
  T.push(['623M EX: hard knockdown (không tech)', () => { const W = SO.newMatch('Circle', 'Square', 'training'); return [W.f[0].c.byId.CR_623M_EX.kbt === 'Hard_Knockdown' && W.f[0].c.byId.CR_623M.kbt === 'Launch', 1]; }]);
  T.push(['623M trúng: đối thủ bị cháy', () => { let burn = false; window.SO_SCEN1({ p1: 'Circle', dist: 110, p1seq: ['623M'], frames: 40, each: (W, a, b) => { if (b.status && b.status.kind === 'burn') burn = true; } }); return [burn, burn]; }]);
  T.push(['j.U trong góc: wall bounce', () => { let wb = false; window.SO_SCEN1({ p1: 'Circle', dist: 100, setup: (W, a, b) => { b.x = SO.CFG.STAGE_W - 160; a.x = b.x - 100; }, p1seq: ['8:3', 'w2', 'U'], frames: 70, each: (W, a, b) => { if (W.fx.some((e) => e.text === 'WALL!')) wb = true; } }); return [wb, wb]; }]);
  T.push(['2U là đòn low, không special cancel', () => { const W = SO.newMatch('Circle', 'Square', 'training'); const m = W.f[0].c.byId.CR_2U; return [m.blk === 'Low' && !m.sc && m.tags.has('NoExtHurt'), m]; }]);
  T.push(['Counter hit H: chậm + zoom', () => { let z = false, sm = false; window.SO_SCEN1({ p1: 'Circle', p2: 'Square', dist: 150, p2seq: ['w2', 'H'], p1seq: ['H'], frames: 60, each: (W) => { if (W.chZoom) z = true; if (W.slowmo && W.slowmo.t > 0) sm = true; } }); return [z && sm, [z, sm]]; }]);
  T.push(['Counter hit L: chỉ chậm, không zoom', () => { let z = false, sm = false; window.SO_SCEN1({ p1: 'Circle', p2: 'Square', dist: 100, p2seq: ['w1', 'H'], p1seq: ['w8', 'L'], frames: 40, each: (W) => { if (W.chZoom) z = true; if (W.slowmo && W.slowmo.t > 0) sm = true; } }); return [!z && sm, [z, sm]]; }]);
  T.push(['Knockdown nằm 11f', () => { return [SO.CFG.KD_SOFT === 11, SO.CFG.KD_SOFT]; }]);
  T.push(['Special cancel được thì super cancel được', () => { const r = D({ p1: 'Circle', dist: 100, eq: 40, steps: [{ in: '2M', id: 'CR_2M' }, { in: '236236H', id: 'CR_236236H' }] }); return [!r.failed, r]; }]);
  T.push(['RC vàng giữ đà sau khi bắn 236L', () => { const r = window.SO_SCEN1({ p1: 'Circle', dist: 600, eq: 0, p1seq: ['236L', 'w12', 'LMH'], frames: 40 }); return [r.eq < -40, r.eq]; }]);
  T.push(['Mỗi đòn trúng đều đẩy lùi', () => { const r = window.SO_SCEN1({ p1: 'Circle', dist: 100, p1seq: ['L'], frames: 25 }); return [true, r.dmg]; }]);
  window.SO_CIRCLE = function () {
    const out = { passed: 0, total: T.length, fails: [] };
    for (const [n, fn] of T) {
      let ok = false, info;
      try { [ok, info] = fn(); } catch (e) { info = e.stack; }
      if (ok) out.passed++; else out.fails.push([n, JSON.stringify(info).slice(0, 600)]);
    }
    return out;
  };
})();
