'use strict';
// =============================================================================
// SQUARED OFF - core: cấu hình, tiện ích, đọc CSV, bảng chiêu, input
// =============================================================================
(function () {
  const SO = (window.SO = window.SO || {});

  // ---- Hằng số hệ thống (đơn vị: frame @60fps, pixel ở độ phân giải 1080p) ----
  SO.CFG = {
    FPS: 60,
    STAGE_W: 2800,
    VIEW_W: 760, // bề rộng khung nhìn (world px) — camera không zoom; nhân vật cao ~45% màn hình như GGXX
    SCREEN_MARGIN: 24, // khoảng cách tối thiểu từ người chơi tới mép màn hình
    CHARGE: 40, // số frame giữ để charge ([4]6, [2]8)
    CHARGE_KEEP: 10, // giữ charge thêm bao nhiêu frame sau khi nhả
    KBX_GROUND: 3, // Knockback_X * 3 = vận tốc đẩy lùi trên đất (px/f)
    KBX_AIR: 2.2, // Knockback_X * 2.2 = vận tốc ngang khi bị hất tung
    KBY: 2, // Knockback_Y * 2 = vận tốc bay lên (px/f)
    PUSH_DECAY: 0.75,
    CROUCH_HITSTUN: 2,
    CH_HITSTUN: 4,
    CH_DMG: 1.1,
    PRORATION_FLOOR: 0.1,
    GRAY_RATIO: 0.3,
    BUFFER: 5,
    COMPOSITE: 3,
    DASH_WINDOW: 12,
    SJ_WINDOW: 10,
    THROW_BREAK: 12,
    SUPER_FLASH: 30,
    ROUND_TIME: 99,
    ROUNDS_TO_WIN: 2,
    EQ_FLOOR: 25,
    FD_COST: 0.5,
    FD_PUSH: 1.8,
    IB_WINDOW: 8,
    IB_STUN: 2,
    IB_GAIN: 3,
    WALK_GAIN: 0.04,
    DASH_GAIN: 0.07,
    BACK_PENALTY: 0.02,
    BURST_REGEN: 0.02,
    BURST_ON_DMG: 0.08,
    KD_SOFT: 18,
    KD_HARD: 40,
    WAKEUP: 12,
    AIRTECH_INV: 10,
    JUGGLE_DECAY: 0.05,
    JUGGLE_MIN: 0.35,
    CANCEL_EXTRA: 10,
    LANDING: 2,
    AIR_ATK_LANDING: 3,
    DASH_LOCK: 4,
    PREJUMP: 3,
    MIN_STUN: 4,
    CLOSE_RANGE: 120, // cM / fM
    PROX_GUARD: 330,
  };

  // ---- Tiện ích ----
  SO.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SO.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  SO.hash = function (a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 10000) / 10000; // 0..1
  };
  SO.overlap = (a, b) =>
    Math.abs(a.cx - b.cx) * 2 < a.w + b.w && Math.abs(a.cy - b.cy) * 2 < a.h + b.h;

  // ---- CSV ----
  SO.parseCSV = function (text) {
    const rows = [];
    let row = [], f = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    // Excel locale VN/EU lưu CSV bằng dấu ';'
    const firstLine = text.split(/\r?\n/)[0];
    const D = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
        } else f += c;
      } else if (c === '"') q = true;
      else if (c === D) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map((s) => s.trim());
    return {
      head,
      rows: rows.map((r) => {
        const o = {};
        head.forEach((h, i) => (o[h] = (r[i] === undefined ? '' : r[i]).trim()));
        return o;
      }),
    };
  };

  SO.toCSV = function (head, rows) {
    const esc = (v) => {
      v = v === undefined || v === null ? '' : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [head.join(',')].concat(rows.map((r) => head.map((h) => esc(r[h])).join(','))).join('\n') + '\n';
  };

  const num = (v, d) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? d : n;
  };
  const bool = (v) => /^(true|1|yes|x)$/i.test(String(v).trim());
  function range(s) {
    s = String(s || '').trim();
    if (!s || s === '0') return null;
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return [+m[1], +m[2]];
    const n = parseInt(s, 10);
    return isNaN(n) || n <= 0 ? null : [1, n];
  }
  SO.range = range;

  function parseProps(s) {
    const tags = new Set(), kv = {};
    String(s || '').split('|').forEach((t) => {
      t = t.trim();
      if (!t) return;
      const i = t.indexOf('=');
      if (i > 0) kv[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      else {
        tags.add(t);
        t.split('_').forEach((w) => w && tags.add(w));
      }
    });
    return { tags, kv };
  }

  // Vel=vx:vy@a-b;vx:vy@a-b  (vx tính theo hướng mặt, vy dương = bay lên)
  function parseVel(s) {
    if (!s) return [];
    return s.split(';').map((seg) => {
      const m = seg.trim().match(/^(-?[\d.]+):(-?[\d.]+)@(\d+)-(\d+)$/);
      if (!m) return null;
      return { vx: +m[1], vy: +m[2], a: +m[3], b: +m[4] };
    }).filter(Boolean);
  }

  const MOTIONS = {
    '236': [[2], [3], [6]],
    '214': [[2], [1], [4]],
    '623': [[6], [2], [3]],
    '421': [[4], [2], [1]],
    '41236': [[4], [1, 1], [2], [3, 1], [6]],
    '63214': [[6], [3, 1], [2], [1, 1], [4]],
    '236236': [[2], [3, 1], [6], [2], [3, 1], [6]],
    '214214': [[2], [1, 1], [4], [2], [1, 1], [4]],
    '632146': [[6], [3, 1], [2], [1, 1], [4], [6]],
  };
  // [dir, optional]
  SO.MOTIONS = MOTIONS;
  SO.motionWindow = (m) => (m.length <= 3 ? 16 : m.length <= 5 ? 24 : 32);

  function normMove(r) {
    const m = {};
    m.raw = r;
    m.id = r.Move_ID;
    m.char = r.Character;
    m.input = r.Input || '';
    m.stance = r.Stance || '';
    m.name = r.Name || m.id;
    m.type = r.Type || 'Normal';
    m.dmg = num(r.Damage, 0);
    m.chip = num(r.Chip_Damage, 0);
    m.su = Math.max(0, Math.round(num(r.Startup, 1)));
    m.act = Math.max(0, Math.round(num(r.Active, 0)));
    m.rec = Math.max(0, Math.round(num(r.Recovery, 0)));
    m.ob = Math.round(num(r.On_Block, 0));
    m.oh = Math.round(num(r.On_Hit, 0));
    m.unt = Math.round(num(r.Untech, 0));
    m.hits = Math.max(1, Math.round(num(r.Hits, 1)));
    m.pr = num(r.Proration_Rate, 1);
    m.kbx = num(r.Knockback_X, 0);
    m.kby = num(r.Knockback_Y, 0);
    m.kbt = r.Knockback_Type || 'Normal';
    m.blk = r.Block_Type || 'Mid';
    m.sc = bool(r.Special_Cancellable);
    m.suc = bool(r.Super_Cancellable);
    m.jc = bool(r.Jump_Cancellable);
    m.dc = bool(r.Dash_Cancellable);
    m.invType = r.Invincible_Type || 'None';
    m.inv = m.invType === 'None' ? null : range(r.Invincible_Frames);
    m.armor = Math.round(num(r.Armor_Hits, 0));
    m.hsa = Math.round(num(r.Hitstop_Attacker, 0));
    m.hsd = Math.round(num(r.Hitstop_Defender, 0));
    m.hb = { x: num(r.Hitbox_X, 0), y: num(r.Hitbox_Y, 0), w: num(r.Hitbox_W, 0), h: num(r.Hitbox_H, 0) };
    m.spd = num(r.Projectile_Speed, 0);
    m.airOK = bool(r.Air_OK);
    m.cost = num(r.Cost, 0);
    m.gain = num(r.Meter_Gain, 0);
    const p = parseProps(r.Properties);
    m.tags = p.tags;
    m.kv = p.kv;
    m.placeholder = p.tags.has('PLACEHOLDER');
    m.vel = parseVel(p.kv.Vel);
    m.isProj = !!p.kv.Proj;
    // Fx=fire,slash:#4aa3d9 -> [{name, color}]
    m.fx = String(p.kv.Fx || '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => { const [name, color] = t.split(':'); return { name, color: color || '' }; });
    m.fxSet = new Set(m.fx.map((x) => x.name));
    m.hasHitbox = m.hb.w > 0 && m.hb.h > 0 && m.act > 0;
    if (m.su < 1) m.su = 1;
    m.casterAct = m.isProj ? 1 : m.act;
    m.total = m.su - 1 + m.casterAct + m.rec;
    if (m.total < 1) m.total = 1;
    // ---- Phân tích input ----
    let inp = m.input.replace(/\s+/g, '');
    m.air = /^j\./i.test(inp);
    if (m.air) inp = inp.slice(2);
    m.motion = null; m.dir = 5; m.prox = ''; m.btn = '';
    let mm;
    m.charge = null;
    if ((mm = inp.match(/^\[([42])\]([689])([LMHU])$/))) { m.charge = { from: +mm[1], to: +mm[2] }; m.btn = mm[3]; }
    else if ((mm = inp.match(/^([cf])([LMHU])$/))) { m.prox = mm[1]; m.btn = mm[2]; }
    else if ((mm = inp.match(/^(\d+)([LMHU])$/))) {
      if (mm[1].length === 1) m.dir = +mm[1];
      else m.motion = mm[1];
      m.btn = mm[2];
    } else if ((mm = inp.match(/^([LMHU])$/))) m.btn = mm[1];
    return m;
  }

  function normChar(r) {
    return {
      name: r.Character,
      pfx: r.Prefix,
      shape: r.Shape,
      arch: r.Archetype,
      hp: num(r.HP, 1000),
      walkF: num(r.Walk_Fwd, 4),
      walkB: num(r.Walk_Back, 3.3),
      dash: num(r.Dash_Speed, 10),
      backdash: Math.round(num(r.Backdash_Frames, 22)),
      jumpV: num(r.Jump_Velocity, 19),
      jumpX: num(r.Jump_Fwd_Speed, 5),
      grav: num(r.Gravity, 0.95),
      adash: num(r.Airdash_Speed, 14),
      adashF: Math.round(num(r.Airdash_Frames, 15)),
      airJumps: Math.round(num(r.Air_Jumps, 1)),
      airDashes: Math.round(num(r.Air_Dashes, 1)),
      w: num(r.Width, 110),
      h: num(r.Height, 186),
      throwR: num(r.Throw_Range, 150),
      color: r.Color || '#888',
      weapon: r.Weapon || '',
      gimmick: r.Gimmick || '',
    };
  }

  // ---- Database ----
  SO.loadData = function (movesText, charsText) {
    const mp = SO.parseCSV(movesText);
    const cp = SO.parseCSV(charsText);
    const DB = { chars: {}, order: [], all: {}, byId: {}, movesHead: mp.head, movesRows: mp.rows, charsHead: cp.head, charsRows: cp.rows };
    cp.rows.forEach((r) => {
      if (!r.Character) return;
      const c = normChar(r);
      c.moves = []; c.normals = {}; c.motions = []; c.charges = []; c.unique = {}; c.spells = {}; c.byId = {};
      DB.chars[c.name] = c;
      DB.order.push(c.name);
    });
    mp.rows.forEach((r) => {
      if (!r.Move_ID) return;
      const m = normMove(r);
      DB.byId[m.id] = m;
      if (m.char === 'ALL') { DB.all[m.id] = m; return; }
      const c = DB.chars[m.char];
      if (!c) return;
      c.moves.push(m);
      c.byId[m.id] = m;
      if (m.kv.Spell) { c.spells[m.kv.Spell] = m; return; }
      if (['Followup', 'Puppet', 'System', 'Burst', 'Throw'].includes(m.type)) return;
      if (!m.btn) return;
      if (m.charge) {
        c.charges.push(m);
      } else if (m.motion) {
        c.motions.push(m);
      } else if (m.btn === 'U') {
        c.unique[(m.air ? 'j' : 'g') + (m.dir === 2 || m.dir === 1 || m.dir === 3 ? '2' : '5')] = m;
      } else {
        const key = (m.air ? 'j' : 'g') + (m.prox || m.dir) + m.btn;
        c.normals[key] = m;
      }
    });
    Object.values(DB.chars).forEach((c) => {
      c.motions.sort((a, b) => b.motion.length - a.motion.length || (b.type === 'Super') - (a.type === 'Super'));
    });
    SO.DB = DB;
    return DB;
  };

  SO.sysMove = function (c, name) {
    return (c && c.byId[c.pfx + '_' + name]) || SO.DB.all['ALL_' + name];
  };

  // ===========================================================================
  // INPUT
  // ===========================================================================
  const BIND = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], L: ['KeyU'], M: ['KeyI'], H: ['KeyO'], U: ['KeyJ'], pause: ['Tab'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], L: ['Numpad4', 'Comma'], M: ['Numpad5', 'Period'], H: ['Numpad6', 'Slash'], U: ['Numpad1', 'ShiftRight'], pause: ['Escape'] },
  ];
  SO.BIND = BIND;
  const keys = new Set();
  const GAME_CODES = new Set();
  BIND.forEach((b) => Object.values(b).forEach((arr) => arr.forEach((c) => GAME_CODES.add(c))));
  SO.keysPressedOnce = []; // dùng cho menu
  window.addEventListener('keydown', (e) => {
    if (GAME_CODES.has(e.code) || e.code === 'Enter' || e.code === 'Backspace' || e.code === 'F1' || e.code === 'F2') e.preventDefault();
    if (!keys.has(e.code)) SO.keysPressedOnce.push(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function padState(i) {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const p = pads[i];
    if (!p) return null;
    const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    return {
      up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5,
      L: b(2), M: b(3), H: b(1), U: b(0), pause: b(9),
    };
  }

  SO.readRaw = function (i) {
    const b = BIND[i];
    const r = {};
    for (const k in b) r[k] = b[k].some((c) => keys.has(c));
    const p = padState(i);
    if (p) for (const k in p) r[k] = r[k] || p[k];
    return r;
  };
  SO.keyDown = (code) => keys.has(code);

  // numpad từ raw (tuyệt đối, trái/phải màn hình)
  SO.rawToNumpad = function (r) {
    let dx = (r.right ? 1 : 0) - (r.left ? 1 : 0);
    let dy = r.up ? 1 : r.down ? -1 : 0;
    return 5 + dx + dy * 3;
  };
  SO.mirrorDir = (d) => (d === 5 ? 5 : d + (d % 3 === 1 ? 2 : d % 3 === 0 ? -2 : 0));

  // Trạng thái input của một người chơi
  class PlayerInput {
    constructor() {
      this.reset();
    }
    reset() {
      this.raw = { up: false, down: false, left: false, right: false, L: false, M: false, H: false, U: false, pause: false };
      this.prevRaw = Object.assign({}, this.raw);
      this.abs = 5; this.rel = 5; this.prevRel = 5;
      this.hist = new Array(64).fill(5);
      this.histAbs = new Array(64).fill(5);
      this.frame = 0;
      this.pressT = { L: -99, M: -99, H: -99, U: -99 };
      this.held = { L: false, M: false, H: false, U: false };
      this.pressed = { L: false, M: false, H: false, U: false };
      this.buf = []; // {b, t}
      this.fwdTapT = -99; this.backTapT = -99; this.backStartT = -99;
      this.downT = -99; this.upT = -99; this.t9 = -99; this.t7 = -99;
      this.chg = { 4: { n: 0, last: 0, rel: -99 }, 2: { n: 0, last: 0, rel: -99 } };
      this.compUsedT = -99;
      this.log = []; // lịch sử để hiển thị
    }
    // facing: 1 = nhìn sang phải
    update(raw, facing, frame) {
      this.prevRaw = this.raw;
      this.raw = raw;
      this.frame = frame;
      this.prevRel = this.rel;
      this.abs = SO.rawToNumpad(raw);
      this.rel = facing === 1 ? this.abs : SO.mirrorDir(this.abs);
      this.hist[frame % 64] = this.rel;
      this.histAbs[frame % 64] = this.abs;
      const isF = (d) => d === 6 || d === 3 || d === 9;
      const isB = (d) => d === 4 || d === 1 || d === 7;
      // dash: chỉ tính khi gõ thẳng 6 / 4 từ hướng không cùng phía (để 236236, 214214 không thành dash)
      if (this.rel === 6 && !isF(this.prevRel)) { this.lastFwdTap = this.fwdTapT; this.fwdTapT = frame; }
      if (this.rel === 4 && !isB(this.prevRel)) { this.lastBackTap = this.backTapT; this.backTapT = frame; }
      if (isB(this.rel) && !isB(this.prevRel)) this.backStartT = frame;
      if (this.rel <= 3) this.downT = frame;
      if (this.rel >= 7) this.upT = frame;
      if (this.rel === 9) this.t9 = frame;
      // charge: đếm số frame giữ lùi (1/4/7) và giữ xuống (1/2/3)
      for (const [k, on] of [[4, this.rel === 1 || this.rel === 4 || this.rel === 7], [2, this.rel <= 3]]) {
        const c = this.chg[k];
        if (on) c.n++;
        else if (c.n > 0) { c.last = c.n; c.rel = frame; c.n = 0; }
      }
      if (this.rel === 7) this.t7 = frame;
      let anyNew = false;
      for (const b of ['L', 'M', 'H', 'U']) {
        this.pressed[b] = raw[b] && !this.prevRaw[b];
        this.held[b] = raw[b];
        if (this.pressed[b]) {
          this.pressT[b] = frame;
          this.buf.push({ b, t: frame, rel: this.rel });
          anyNew = true;
        }
      }
      this.buf = this.buf.filter((p) => frame - p.t <= SO.CFG.BUFFER);
      if (this.rel !== this.prevRel || anyNew) {
        let s = this.rel === 5 ? '' : String(this.rel);
        for (const b of ['L', 'M', 'H', 'U']) if (this.pressed[b]) s += b;
        if (s) {
          this.log.unshift({ s, t: frame });
          if (this.log.length > 18) this.log.pop();
        }
      }
    }
    dirAt(f) { return this.hist[((f % 64) + 64) % 64]; }
    // phát hiện motion trong cửa sổ kết thúc ở frame `end`
    motion(m, end, extra) {
      const pat = MOTIONS[m];
      if (!pat) return false;
      const W = SO.motionWindow(m) + (extra || 0);
      const start = Math.max(end - W, this.frame - 60);
      let i = 0, last = -1;
      for (let f = start; f <= end; f++) {
        const d = this.dirAt(f);
        if (d === last) continue;
        last = d;
        if (i >= pat.length) break;
        if (d === pat[i][0]) i++;
        else if (pat[i][1] && i + 1 < pat.length && d === pat[i + 1][0]) i += 2;
      }
      while (i < pat.length && pat[i][1]) i++;
      return i >= pat.length;
    }
    recentDown(window) { return this.frame - this.downT <= window && this.frame - this.downT > 0; }
    isBack() { return this.rel === 4 || this.rel === 1 || this.rel === 7; }
    isFwd() { return this.rel === 6 || this.rel === 3 || this.rel === 9; }
    isDown() { return this.rel <= 3; }
    isUp() { return this.rel >= 7; }
    within(bs, w) {
      const ts = bs.map((b) => this.pressT[b]);
      const mx = Math.max(...ts), mn = Math.min(...ts);
      return mx - mn <= w && this.frame - mx <= SO.CFG.BUFFER && mx > this.compUsedT;
    }
    // dịch mọi mốc thời gian 1 frame (dùng khi đang hitstop để không mất input)
    shift() {
      this.buf.forEach((p) => p.t++);
      for (const b of ['L', 'M', 'H', 'U']) if (this.pressT[b] < this.frame) this.pressT[b]++;
      for (const k of ['fwdTapT', 'lastFwdTap', 'backTapT', 'lastBackTap', 'backStartT', 'downT', 'upT', 't9', 't7', 'compUsedT']) if (this[k] < this.frame && this[k] > -90) this[k]++;
    }
    // đã charge đủ hướng k (4 hoặc 2) chưa (đang giữ hoặc vừa nhả trong CHARGE_KEEP frame)
    charged(k, need) {
      const c = this.chg[k];
      need = need || SO.CFG.CHARGE;
      return c.n >= need || (c.last >= need && this.frame - c.rel <= SO.CFG.CHARGE_KEEP);
    }
    heldCount() { return ['L', 'M', 'H'].filter((b) => this.held[b]).length; }
  }
  SO.PlayerInput = PlayerInput;

  SO.loadData(window.SO_DATA.moves, window.SO_DATA.characters);
})();
