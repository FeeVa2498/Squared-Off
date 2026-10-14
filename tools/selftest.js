// Bài test tự động: chạy trong trình duyệt (headless), mô phỏng input thật cho từng chiêu.
// Dùng: nạp file này sau game, gọi SO_TEST.runAll()
(function () {
  const SO = window.SO;
  const blank = () => ({ up: false, down: false, left: false, right: false, L: false, M: false, H: false, U: false, pause: false });
  function dirRaw(d, r) {
    r = r || blank();
    if (d === 1 || d === 2 || d === 3) r.down = true;
    if (d === 7 || d === 8 || d === 9) r.up = true;
    if (d === 3 || d === 6 || d === 9) r.right = true;
    if (d === 1 || d === 4 || d === 7) r.left = true;
    return r;
  }
  // chuỗi input -> danh sách raw theo frame (P1 nhìn sang phải)
  function seqFor(m) {
    const out = [];
    const push = (d, btns, n) => { for (let k = 0; k < (n || 2); k++) { const r = dirRaw(d); (btns || []).forEach((b) => (r[b] = true)); out.push(r); } };
    let btn = m.btn || 'L';
    if (m.motion) {
      const ds = m.motion.split('').map(Number);
      ds.forEach((d, i) => push(d, i === ds.length - 1 ? [btn] : null, 2));
    } else {
      let d = m.dir || 5;
      push(d, [btn], 2);
    }
    push(5, null, 1);
    return out;
  }
  function runMove(p1, m, opts) {
    opts = opts || {};
    const W = SO.newMatch(p1, opts.p2 || 'Square', 'training');
    W.dummy.refill = false;
    W.dummy.block = opts.block || 'none';
    const [a, b] = W.f;
    a.x = 1200; b.x = 1200 + (opts.dist || 170);
    W.eq = 40;
    const q = [];
    if (m.air) { q.push(dirRaw(8)); q.push(dirRaw(8)); q.push(dirRaw(8)); for (let k = 0; k < 9; k++) q.push(blank()); }
    for (let k = 0; k < 3; k++) q.push(blank());
    seqFor(m).forEach((r) => q.push(r));
    if (opts.hold) for (let k = 0; k < opts.hold; k++) q.push(Object.assign(blank(), opts.holdRaw || {}));
    W.cpuInput = [() => q.shift() || blank(), null];
    let seen = false, hit = false, block = false, err = null, maxFrame = 0;
    const id = m.id;
    try {
      for (let fr = 0; fr < 220; fr++) {
        W.step();
        const lm = W.stats.lastMove[0];
        if (lm && lm.inst.d.id === id) seen = true;
        if (b.state === 'hitstun' || b.state === 'airhit' || b.state === 'thrown') hit = true;
        if (b.state === 'block') block = true;
        maxFrame = fr;
      }
    } catch (e) { err = e.stack || String(e); }
    return { id, input: m.input, seen, hit, block, err };
  }
  function runAll() {
    const res = { ok: 0, fail: [], errors: [], nohit: [] };
    for (const name of SO.DB.order) {
      const c = SO.DB.chars[name];
      for (const m of c.moves) {
        if (!m.btn || ['Followup', 'Puppet', 'Throw', 'System', 'Burst'].includes(m.type) || m.kv.Spell) continue;
        if (m.input.indexOf('(') >= 0) continue;
        if (m.stance === 'Arc') continue; // test riêng
        const r = runMove(name, m, { dist: m.isProj || m.kv.Detonate ? 300 : 160 });
        if (r.err) res.errors.push(name + ' ' + r.id + ': ' + r.err.split('\n').slice(0, 3).join(' | '));
        else if (!r.seen) res.fail.push(name + ' ' + r.id + ' (' + r.input + ')');
        else {
          res.ok++;
          if (m.dmg > 0 && !r.hit && !r.block && !m.kv.Detonate) res.nohit.push(name + ' ' + r.id);
        }
      }
    }
    return res;
  }
  window.SO_TEST = { runAll, runMove, seqFor, dirRaw, blank };
})();
