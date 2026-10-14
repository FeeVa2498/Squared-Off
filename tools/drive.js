// Driver: chuỗi bước {in:'2H'|'236L'|'9'|..., id:'CR_2H'}; mash input mỗi 3 frame tới khi chiêu id bắt đầu
window.SO_DRIVE = function (o) {
  const W = SO.newMatch(o.p1, o.p2 || 'Square', 'training');
  W.dummy.refill = false; W.dummy.block = o.block || 'none'; W.dummy.tech = o.tech !== undefined ? o.tech : false;
  const [a, b] = W.f; a.x = 1200; b.x = 1200 + (o.dist || 110); W.eq = o.eq === undefined ? 40 : o.eq;
  if (o.setup) o.setup(W, a, b);
  const T = SO_TEST, steps = o.steps.slice();
  let cur = null, seq = [], tries = 0; const log = []; let failed = null; let maxHits = 0;
  function mk(inp) {
    const out = [];
    const push = (d, btn, n) => { for (let k = 0; k < n; k++) { const r = T.dirRaw(d); if (btn) r[btn] = true; out.push(r); } };
    let m;
    if ((m = inp.match(/^j?(\d*)([LMHU])$/))) {
      const ds = (m[1] || '5').split('').map(Number);
      if (ds.length === 1) push(ds[0], m[2], 2); else ds.forEach((d, i) => push(d, i === ds.length - 1 ? m[2] : null, 2));
    } else if ((m = inp.match(/^(\d)$/))) push(+m[1], null, 3);
    out.push(T.blank());
    return out;
  }
  W.cpuInput = [() => {
    if (!seq.length) {
      if (cur && cur.done) cur = null;
      if (!cur && steps.length) { cur = steps.shift(); tries = 0; }
      // như người chơi: đợi đòn hiện tại trúng (hoặc đang tự do) rồi mới nhập lệnh tiếp
      const A = W.f[0];
      const busy = A.state === 'attack' && A.move && !A.contact && !cur?.now && A.mf < A.move.total - 6;
      if (cur && !busy) { seq = mk(cur.in); tries++; if (/\d\d/.test(cur.in)) for (let k = 0; k < 6; k++) seq.push(T.blank()); }
    }
    return seq.shift() || T.blank();
  }, null];
  for (let fr = 0; fr < (o.frames || 300); fr++) {
    W.step();
    if (o.trace && fr >= (o.traceFrom||0) && fr < o.trace) log.push('T' + fr + ' ' + a.state + (a.move ? ':' + a.move.d.id + '@' + a.mf : '') + ' rel' + a.inp.rel + ' buf' + JSON.stringify(a.inp.buf) + ' c' + a.contact + ' y' + Math.round(a.y) + ' aj' + a.airJumps + ' | ' + b.state + ' y' + Math.round(b.y) + ' h' + b.combo.hits);
    maxHits = Math.max(maxHits, b.combo.hits);
    if (cur && !cur.done) {
      const ok = cur.id === 'jump' ? (a.state === 'air' || a.state === 'prejump') : a.state === 'attack' && a.move && a.move.d.id === cur.id;
      if (ok) { cur.done = true; seq = []; log.push(fr + ' ' + cur.id + ' hits=' + b.combo.hits + ' def=' + b.state + ' y=' + Math.round(b.y)); }
      else if (tries > 40) { failed = cur.id + ' @' + fr + ' state=' + a.state + (a.move ? ':' + a.move.d.id + '@' + a.mf : '') + ' def=' + b.state + ' y=' + Math.round(b.y) + ' dx=' + Math.round(b.x - a.x); break; }
    }
    if (o.until && o.until(W, a, b)) break;
  }
  return { log, failed, maxHits, hits: b.combo.hits, dmg: b.c.hp - b.hp, left: steps.length, token: a.gim.token, eq: W.eq, extra: o.extra ? o.extra(W, a, b) : undefined };
};
