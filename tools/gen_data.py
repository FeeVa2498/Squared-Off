#!/usr/bin/env python3
"""Sinh data/moves.csv, data/characters.csv và js/data.js cho SQUARED OFF.

Các dòng gốc trong GDD (Move Data Format.txt) được giữ nguyên số liệu.
Các dòng tự bổ sung được gắn tag PLACEHOLDER trong cột Properties.
Chạy:  python3 tools/gen_data.py
Sau khi chỉnh CSV bằng tay, chạy  python3 tools/embed_data.py  để nhúng lại vào js/data.js
(hoặc kéo thả file CSV thẳng vào cửa sổ game).
"""
import csv, io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

COLS = ['Move_ID', 'Character', 'Input', 'Stance', 'Name', 'Type', 'Damage', 'Chip_Damage',
        'Startup', 'Active', 'Recovery', 'On_Block', 'On_Hit', 'Untech', 'Hits', 'Proration_Rate',
        'Knockback_X', 'Knockback_Y', 'Knockback_Type', 'Block_Type', 'Special_Cancellable',
        'Super_Cancellable', 'Jump_Cancellable', 'Dash_Cancellable', 'Invincible_Type',
        'Invincible_Frames', 'Armor_Hits', 'Hitstop_Attacker', 'Hitstop_Defender', 'Hitbox_X',
        'Hitbox_Y', 'Hitbox_W', 'Hitbox_H', 'Projectile_Speed', 'Air_OK', 'Cost', 'Meter_Gain',
        'Properties']

K = dict(dmg='Damage', chip='Chip_Damage', su='Startup', act='Active', rec='Recovery',
         ob='On_Block', oh='On_Hit', unt='Untech', hits='Hits', pr='Proration_Rate',
         kbx='Knockback_X', kby='Knockback_Y', kbt='Knockback_Type', blk='Block_Type',
         sc='Special_Cancellable', suc='Super_Cancellable', jc='Jump_Cancellable',
         dc='Dash_Cancellable', inv='Invincible_Type', invf='Invincible_Frames', arm='Armor_Hits',
         hsa='Hitstop_Attacker', hsd='Hitstop_Defender', spd='Projectile_Speed', air='Air_OK',
         cost='Cost', gain='Meter_Gain', props='Properties', stance='Stance', name='Name',
         type='Type')

BOOL = {'sc', 'suc', 'jc', 'dc', 'air'}

ROWS = []
IDS = set()


def fmt(v):
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, float):
        s = ('%.2f' % v).rstrip('0').rstrip('.')
        return s if s else '0'
    return str(v)


def add(mid, ch, inp, placeholder=True, hb=(0, 0, 0, 0), **kw):
    """Thêm một dòng. Giá trị mặc định hợp lý cho đòn thường."""
    assert mid not in IDS, mid
    IDS.add(mid)
    t = kw.get('type', 'Normal')
    dmg = kw.get('dmg', 0)
    heavy = dmg >= 50
    d = dict(stance='', name='', type=t, dmg=0, chip=0, su=5, act=3, rec=8, ob=0, oh=2, unt=0,
             hits=1, pr=0.9, kbx=1.5, kby=0.0, kbt='Normal', blk='Mid', sc=True, suc=True,
             jc=False, dc=False, inv='None', invf='0', arm=0, spd=0, air=False, cost=0, props='')
    if t in ('Special', 'Spell'):
        d.update(sc=False, suc=True, hsa=8, hsd=8, gain=4)
    elif t == 'Super':
        d.update(sc=False, suc=False, hsa=12, hsd=12, gain=0, cost=50, pr=1.0)
    elif t in ('Unique', 'System', 'Throw', 'CmdGrab', 'AirGrab', 'Burst', 'Followup', 'Puppet'):
        d.update(sc=False, suc=False, hsa=8, hsd=8, gain=2)
    d.update(kw)
    if 'hsa' not in d:
        d['hsa'] = 10 if heavy else (6 if dmg >= 22 else 4)
    if 'hsd' not in d:
        d['hsd'] = d['hsa']
    if 'gain' not in d:
        d['gain'] = round(1.5 + dmg / 25.0, 1)
    if placeholder:
        d['props'] = (d['props'] + '|PLACEHOLDER').strip('|')
    row = {'Move_ID': mid, 'Character': ch, 'Input': inp}
    for k, v in d.items():
        row[K[k]] = fmt(v)
    row['Hitbox_X'], row['Hitbox_Y'], row['Hitbox_W'], row['Hitbox_H'] = [fmt(x) for x in hb]
    ROWS.append(row)
    return row


# ---------------------------------------------------------------------------
# 1. Dòng gốc trong GDD -> chuyển sang format mới (On_Hit luôn là số)
# ---------------------------------------------------------------------------
ORIGINAL = """Move_ID,Character,Input,Damage,Chip_Damage,Startup,Active,Recovery,On_Block,On_Hit,Proration_Rate,Knockback_X,Knockback_Y,Knockback_Type,Block_Type,Special_Cancellable,Super_Cancellable,Jump_Cancellable,Dash_Cancellable,Invincible_Type,Invincible_Frames,Armor_Hits,Hitstop_Attacker,Hitstop_Defender,Properties
CR_5L,Circle,5L,12,0,4,3,6,1,3,0.85,1.5,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,4,4,Jab_ExtendedHurtbox
CR_cM,Circle,cM,28,0,7,4,10,-1,2,0.90,2.0,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,6,6,Close_Proximity
CR_fM,Circle,fM,32,0,9,4,14,-3,1,0.90,2.5,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,6,6,Far_Poke
CR_5H,Circle,5H,65,0,14,5,22,-6,Launch,1.00,2.0,10.0,Launch,Mid,TRUE,TRUE,TRUE,FALSE,None,0,0,10,10,Heavy_Whiff_Punish
CR_6M,Circle,6M,40,0,18,3,16,-2,4,0.90,3.0,0.0,Normal,High,TRUE,TRUE,FALSE,FALSE,None,0,0,7,7,Overhead
CR_236L,Circle,236L,45,8,11,4,18,-4,Knockdown,0.90,4.0,2.0,Knockdown,Mid,FALSE,TRUE,FALSE,FALSE,None,0,0,8,8,Seismic_PointblankInCorner
CR_214M,Circle,214M,60,10,12,12,16,-2,Knockdown,0.85,3.0,1.5,Knockdown,Mid,FALSE,TRUE,FALSE,FALSE,None,0,0,8,8,Hairball_MultiHit
CR_623M,Circle,623M,75,15,5,6,28,-18,Knockdown,1.00,3.0,8.0,Knockdown,Mid,FALSE,TRUE,FALSE,FALSE,Full,1-6,0,10,10,Invincible_Startup_DP
CR_623H,Circle,623H,110,20,9,8,34,-24,Hard_Knockdown,1.00,4.0,12.0,Hard_Knockdown,Mid,FALSE,FALSE,FALSE,FALSE,None,0,0,12,12,Combo_Ender_Heavy_DP
SQ_5L,Square,5L,14,0,5,3,7,0,2,0.85,1.5,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,4,4,Jab
SQ_cM,Square,cM,30,0,8,4,11,-1,3,0.90,2.0,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,6,6,Close_Proximity
SQ_fM,Square,fM,35,0,10,4,15,-2,2,0.90,2.8,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,6,6,Far_Poke
SQ_5H,Square,5H,70,0,15,5,24,-5,Launch,1.00,2.5,11.0,Launch,Mid,TRUE,TRUE,TRUE,FALSE,None,0,0,10,10,Heavy_Starter
SQ_6H,Square,6H,45,0,20,4,18,-3,3,0.90,3.5,0.0,Normal,High,TRUE,TRUE,FALSE,FALSE,None,0,0,8,8,Overhead
SQ_236L,Square,236L,50,10,13,20,18,-2,2,0.90,5.0,0.0,Normal,Mid,FALSE,TRUE,FALSE,FALSE,None,0,0,6,6,Fullscreen_Projectile
SQ_623M,Square,623M,80,15,5,6,26,-16,Knockdown,1.00,3.0,8.5,Knockdown,Mid,FALSE,TRUE,FALSE,FALSE,Full,1-5,0,10,10,Invincible_Startup_DP
TR_3H,Triangle,3H,55,0,10,4,20,-6,Hard_Knockdown,0.90,2.0,0.0,Hard_Knockdown,Low,TRUE,TRUE,FALSE,FALSE,None,0,0,8,8,Sweep
TR_2H,Triangle,2H,60,0,8,5,18,-4,Launch,1.00,1.5,12.0,Launch,Mid,TRUE,TRUE,TRUE,FALSE,None,0,0,8,8,Launcher_AntiAir
TR_236L,Triangle,236L,30,5,15,45,12,4,Knockdown,0.80,1.0,0.5,Knockdown,Mid,FALSE,FALSE,FALSE,FALSE,None,0,0,6,6,Disc_Lockdown_Oki
ST_5L,Star,5L,10,0,4,3,6,1,3,0.85,1.2,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,4,4,Fire_Element_Slot1
ST_5M,Star,5M,25,0,8,4,12,-1,2,0.90,2.0,0.0,Normal,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,6,6,Ice_Element_Slot2
ST_5H,Star,5H,55,0,13,5,20,-4,Launch,1.00,2.2,9.5,Launch,Mid,TRUE,TRUE,FALSE,FALSE,None,0,0,9,9,Lightning_Element_Slot3
ST_U_3E,Star,U,130,25,22,15,26,8,Hard_Knockdown,1.00,5.0,14.0,Hard_Knockdown,Mid,FALSE,FALSE,FALSE,FALSE,None,0,0,14,14,Requires_3_Elements
"""

# Bổ sung cho các dòng gốc: tên, loại, hitbox, thuộc tính engine (không đổi số liệu gốc)
ORIG_EXTRA = {
    'CR_5L': dict(name='Jab', type='Normal', hb=(62, 128, 56, 28)),
    'CR_cM': dict(name='Close Medium', type='Normal', hb=(70, 105, 70, 44)),
    'CR_fM': dict(name='Far Medium', type='Normal', hb=(112, 112, 104, 30)),
    'CR_5H': dict(name='Heavy Bounce', type='Normal', hb=(80, 150, 96, 96), unt=40),
    'CR_6M': dict(name='Overhead Hop', type='Command', hb=(70, 140, 70, 72)),
    'CR_236L': dict(name='Seismic Slam', type='Special', hb=(90, 40, 130, 70), props_add='WallBounceCorner'),
    'CR_214M': dict(name='Hairball', type='Special', hb=(70, 95, 54, 54), spd=5, hits=3,
                    props_add='Proj=straight'),
    'CR_623M': dict(name='Rising Roll', type='Special', hb=(48, 150, 76, 120),
                    props_add='Vel=3:16@5-10'),
    'CR_623H': dict(name='Big Rising Roll', type='Special', hb=(48, 160, 84, 140), hits=2,
                    props_add='Vel=4:20@9-15'),
    'SQ_5L': dict(name='Jab', type='Normal', hb=(66, 132, 58, 28)),
    'SQ_cM': dict(name='Close Medium', type='Normal', hb=(74, 110, 72, 46)),
    'SQ_fM': dict(name='Far Medium', type='Normal', hb=(118, 116, 110, 32)),
    'SQ_5H': dict(name='Prism Upper', type='Normal', hb=(78, 160, 92, 110), unt=42),
    'SQ_6H': dict(name='Edge Drop', type='Command', hb=(78, 150, 80, 80)),
    'SQ_236L': dict(name='Prism Shot', type='Special', hb=(70, 120, 60, 50), spd=8,
                    props_add='Proj=straight'),
    'SQ_623M': dict(name='Rising Corner', type='Special', hb=(50, 155, 78, 130),
                    props_add='Vel=3:17@5-10'),
    'TR_3H': dict(name='Tri Sweep', type='Command', hb=(112, 14, 128, 24)),
    'TR_2H': dict(name='Apex Launcher', type='Normal', hb=(54, 175, 80, 130), unt=42),
    'TR_236L': dict(name='Disc', type='Special', hb=(60, 16, 72, 26), spd=2.5, hits=3,
                    props_add='Proj=disc'),
    'ST_5L': dict(name='Ember Flick', type='Normal', hb=(64, 128, 58, 30), props_add='Element=F'),
    'ST_5M': dict(name='Frost Breath', type='Normal', hb=(92, 120, 86, 40), props_add='Element=I'),
    'ST_5H': dict(name='Volt Pillar', type='Normal', hb=(80, 150, 90, 110), unt=40,
                  props_add='Element=L'),
    'ST_U_3E': dict(name='Prism Nova (Fire+Ice+Lightning)', type='Spell', input='U(FIL)', hits=3,
                    hb=(0, 160, 220, 320), air=True, props_add='Spell=FIL|Proj=rain|Count=1'),
}


def load_original():
    rd = csv.DictReader(io.StringIO(ORIGINAL))
    for r in rd:
        ex = ORIG_EXTRA[r['Move_ID']]
        oh = r['On_Hit']
        try:
            oh_v = int(oh)
        except ValueError:
            oh_v = 0
        props = r['Properties']
        if ex.get('props_add'):
            props = props + '|' + ex['props_add']
        kw = dict(name=ex['name'], type=ex['type'], dmg=int(r['Damage']), chip=int(r['Chip_Damage']),
                  su=int(r['Startup']), act=int(r['Active']), rec=int(r['Recovery']),
                  ob=int(r['On_Block']), oh=oh_v, unt=ex.get('unt', 0), hits=ex.get('hits', 1),
                  pr=float(r['Proration_Rate']), kbx=float(r['Knockback_X']),
                  kby=float(r['Knockback_Y']), kbt=r['Knockback_Type'], blk=r['Block_Type'],
                  sc=r['Special_Cancellable'] == 'TRUE', suc=r['Super_Cancellable'] == 'TRUE',
                  jc=r['Jump_Cancellable'] == 'TRUE', dc=r['Dash_Cancellable'] == 'TRUE',
                  inv=r['Invincible_Type'], invf=r['Invincible_Frames'],
                  arm=int(r['Armor_Hits']), hsa=int(r['Hitstop_Attacker']),
                  hsd=int(r['Hitstop_Defender']), spd=ex.get('spd', 0), air=ex.get('air', False),
                  props=props)
        if r['Move_ID'] == 'ST_U_3E':
            kw['ob'] = 8
        add(r['Move_ID'], r['Character'], ex.get('input', r['Input']), placeholder=False,
            hb=ex['hb'], **kw)


# ---------------------------------------------------------------------------
# 2. Khuôn normal dùng chung (mỗi nhân vật nhân hệ số tốc độ / sát thương / tầm)
# ---------------------------------------------------------------------------
NORMAL_TEMPLATE = {
    '5L': dict(name='Stand Light', dmg=12, su=5, act=3, rec=7, ob=0, oh=2, pr=0.85, kbx=1.5, hb=(64, 130, 58, 28)),
    '5M': dict(name='Stand Medium', dmg=30, su=8, act=4, rec=12, ob=-1, oh=2, pr=0.9, kbx=2.2, hb=(88, 116, 84, 40)),
    '5H': dict(name='Stand Heavy', dmg=60, su=13, act=5, rec=20, ob=-5, oh=1, pr=1.0, kbx=3.0, hb=(98, 136, 100, 70)),
    '6M': dict(name='Overhead', type='Command', dmg=40, su=19, act=3, rec=16, ob=-2, oh=3, kbx=3.0, blk='High', hb=(72, 145, 72, 72)),
    '2L': dict(name='Crouch Light', dmg=10, su=5, act=3, rec=7, ob=-1, oh=1, pr=0.85, kbx=1.4, blk='Low', hb=(66, 18, 62, 24)),
    '2M': dict(name='Crouch Medium', dmg=26, su=8, act=4, rec=13, ob=-2, oh=1, kbx=2.0, blk='Low', hb=(100, 22, 104, 26)),
    '2H': dict(name='Anti-air Launcher', dmg=55, su=9, act=5, rec=20, ob=-6, oh=0, kbx=1.5, kby=11, kbt='Launch', unt=40, jc=True, pr=1.0, hb=(56, 170, 82, 120)),
    '3H': dict(name='Sweep', type='Command', dmg=50, su=11, act=4, rec=22, ob=-8, oh=0, kbx=2.0, kby=0, kbt='Knockdown', blk='Low', hb=(112, 14, 126, 24)),
    'j.L': dict(name='Air Light', dmg=9, su=5, act=4, rec=8, ob=2, oh=4, pr=0.85, kbx=1.2, blk='High', unt=16, hb=(58, 70, 58, 40)),
    'j.M': dict(name='Air Medium', dmg=24, su=7, act=5, rec=12, ob=2, oh=4, kbx=1.8, blk='High', unt=18, hb=(74, 46, 84, 50)),
    'j.H': dict(name='Air Heavy', dmg=45, su=10, act=5, rec=18, ob=3, oh=6, pr=1.0, kbx=2.4, kby=2, blk='High', unt=22, hb=(70, 22, 104, 62)),
}


def normals(ch, pfx, skip=(), speed=0, dmg=1.0, reach=1.0, over=None, extra_props=None):
    over = over or {}
    extra_props = extra_props or {}
    for inp, base in NORMAL_TEMPLATE.items():
        if inp in skip:
            continue
        mid = pfx + '_' + inp.replace('.', '')
        if mid in IDS:
            continue
        kw = dict(base)
        kw.setdefault('type', 'Normal')
        x, y, w, h = kw.pop('hb')
        kw['su'] = max(3, kw['su'] + speed)
        kw['dmg'] = int(round(kw['dmg'] * dmg))
        hb = (round(x * reach), y, round(w * reach), h)
        if inp in over:
            o = dict(over[inp])
            if 'hb' in o:
                hb = o.pop('hb')
            kw.update(o)
        if inp in extra_props:
            kw['props'] = extra_props[inp]
        add(mid, ch, inp, hb=hb, **kw)


# ---------------------------------------------------------------------------
# 3. Nhân vật
# ---------------------------------------------------------------------------
CHAR_COLS = ['Character', 'Prefix', 'Shape', 'Archetype', 'HP', 'Walk_Fwd', 'Walk_Back', 'Dash_Speed',
             'Backdash_Frames', 'Jump_Velocity', 'Jump_Fwd_Speed', 'Gravity', 'Airdash_Speed',
             'Airdash_Frames', 'Air_Jumps', 'Air_Dashes', 'Width', 'Height', 'Throw_Range', 'Color',
             'Gimmick']
CHARS = [
    ['Circle', 'CR', 'circle', 'Rushdown', 950, 4.6, 3.6, 11.0, 20, 19.0, 5.6, 0.95, 15, 16, 1, 1, 110, 168, 150, '#e0574a', 'Rolling Install: press U right after a special (costs 10%) to boost the next special: +1 hit, +20% damage, 2f faster (3 seconds). 5U rolls forward, 2U rolls back, j.U is a diving roll.'],
    ['Square', 'SQ', 'square', 'Shoto / Balanced', 1000, 4.0, 3.3, 10.0, 22, 19.0, 5.0, 0.95, 14, 15, 1, 1, 118, 186, 150, '#3f7fd8', 'Prism Ring: 5U places a mid ring, 2U a low ring, j.U an angled ring. Your projectiles passing through it gain 1.5x speed, 1.5x size and +1 hit. One ring at a time, lasts 4s, 3s cooldown.'],
    ['Triangle', 'TR', 'triangle', 'Vortex / Mobility', 900, 4.4, 3.6, 11.5, 20, 19.5, 5.8, 0.95, 16, 14, 1, 2, 108, 196, 145, '#f2a516', 'Apex Dash: 5U dashes diagonally up-forward, 2U up-back, j.U down-forward (can attack after 6f). 236L leaves a disc on the floor for okizeme.'],
    ['Rhombus', 'RH', 'rhombus', 'Grappler', 1150, 3.0, 2.6, 8.0, 24, 17.5, 4.2, 1.0, 0, 0, 1, 0, 140, 214, 165, '#8a5ac8', 'Grip Shift: 5U armors mid/high hits, 2U armors low/mid hits (90f, every normal gets 1 armor hit, walks slower). j.U is an armored dive. 63214H command grab.'],
    ['Hexagon', 'HX', 'hexagon', 'Trap', 950, 3.8, 3.2, 9.5, 22, 18.5, 4.8, 0.95, 14, 14, 1, 1, 118, 186, 150, '#2fa37a', 'Grid Node: 5U places a node at your position, 2U on the floor 300px ahead, j.U in the air. Up to 3 nodes. 236L/M/H detonates node 1/2/3; with 2+ nodes a laser links them.'],
    ['Oval', 'OV', 'oval', 'Zoner', 950, 3.7, 3.3, 9.5, 22, 18.5, 4.6, 0.95, 14, 14, 1, 1, 98, 206, 150, '#d65ba3', 'Elastic Stretch: U toggles stretch for 5s. Normals reach 1.6x farther with +3f recovery, and the hurtbox stretches too. 8s cooldown.'],
    ['Cone & Cyl', 'CC', 'cone', 'Puppet', 950, 4.0, 3.3, 10.0, 22, 18.5, 5.0, 0.95, 14, 14, 1, 1, 100, 188, 150, '#d2683a', 'Puppet: hold U + direction to move Cylinder, hold U + L/M/H to make Cylinder attack, 2U recalls it, j.U makes it jump and strike. If Cylinder gets hit it is stunned for 3s.'],
    ['Octagon', 'OC', 'octagon', 'Parry', 1000, 4.0, 3.3, 10.0, 22, 19.0, 5.0, 0.95, 14, 14, 1, 1, 118, 186, 150, '#c93a3a', 'STOP Parry: 5U parries high/mid, 2U parries low/mid, j.U parries in the air. 7f window; a successful parry stuns the attacker for 30f. Cannot parry throws or supers.'],
    ['Semicircle', 'SC', 'semicircle', 'Stance', 980, 4.2, 3.4, 10.5, 20, 19.0, 5.2, 0.95, 15, 15, 1, 1, 128, 170, 150, '#4aa3d9', 'Stance (Narmaya style): U switches stance instantly, even mid-attack. Flat (blue): +20% reach, H normals get armor. Arc (pink): 1f faster startup, normals dash cancel, faster walk. Each stance has its own 4 specials.'],
    ['Star', 'ST', 'star', 'Element Mage', 900, 3.8, 3.2, 9.5, 22, 18.5, 4.8, 0.95, 14, 14, 1, 1, 118, 186, 145, '#e8c228', 'Elements (Nine style): normals L=Fire, M=Ice, H=Lightning, gained on hit or block, up to 3. U casts a spell based on HOW MANY of each element you hold (19 spells). 214U stocks the spell; U with empty slots casts the stock.'],
]


def build():
    load_original()

    # ===================== CIRCLE =====================
    normals('Circle', 'CR', skip=('5M',), speed=-1, dmg=0.95,
            over={'2H': dict(name='Bounce Up'), '3H': dict(name='Roll Sweep')})
    add('CR_236H', 'Circle', '236H', type='Special', name='Rolling Charge', dmg=70, chip=10, su=14, act=16, rec=14, ob=-6, oh=0, hits=2, kbx=3, kby=5, kbt='Knockdown', props='Vel=12:0@8-29|NoExtHurt', hb=(36, 70, 112, 112))
    add('CR_j236M', 'Circle', 'j.236M', type='Special', name='Air Dive Roll', dmg=50, chip=8, su=10, act=20, rec=10, ob=-3, oh=2, blk='High', unt=24, kbx=2, props='Vel=8:-12@10-29|LandEnd', hb=(20, 50, 110, 110))
    add('CR_236236H', 'Circle', '236236H', type='Super', name='Seismic Rush', dmg=240, chip=40, su=8, act=20, rec=30, ob=-20, oh=0, hits=5, kbx=4, kby=10, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='Vel=14:0@8-27|NoExtHurt', hb=(40, 90, 130, 150))
    add('CR_214214H', 'Circle', '214214H', type='Super', name='Cannonball Crash', dmg=200, chip=30, su=10, act=16, rec=26, ob=-24, oh=0, hits=4, kbx=2, kby=14, kbt='Hard_Knockdown', inv='Full', invf='1-14', props='Vel=5:18@10-25|NoExtHurt', hb=(30, 120, 140, 160))
    add('CR_U_INSTALL', 'Circle', 'U (after special)', type='Unique', name='Rolling Install', su=1, act=0, rec=8, cost=10, oh=0, ob=0, props='Script=install|Dur=180|DmgUp=0.2|ExtraHits=1|Faster=2')
    add('CR_5U', 'Circle', '5U', type='Unique', name='Forward Roll', su=1, act=0, rec=23, oh=0, ob=0, inv='Strike', invf='3-14', props='Vel=9:0@3-18')
    add('CR_2U', 'Circle', '2U', type='Unique', name='Back Roll', su=1, act=0, rec=20, oh=0, ob=0, inv='Strike', invf='1-12', props='Vel=-8:0@3-16')
    add('CR_jU', 'Circle', 'j.U', type='Unique', name='Dive Roll', dmg=40, su=8, act=12, rec=8, ob=1, oh=3, blk='High', unt=20, kbx=2, props='Vel=9:-10@8-19|LandEnd', hb=(20, 50, 100, 100))

    # ===================== SQUARE =====================
    normals('Square', 'SQ', skip=('5M', '6M'), over={'3H': dict(name='Corner Sweep')})
    add('SQ_236M', 'Square', '236M', type='Special', name='Prism Shot (Fast)', dmg=45, chip=9, su=14, act=80, rec=19, ob=-3, oh=1, kbx=4, spd=13, props='Proj=straight', hb=(70, 120, 60, 50))
    add('SQ_236H', 'Square', '236H', type='Special', name='Prism Shot (Heavy)', dmg=70, chip=14, su=18, act=110, rec=20, ob=0, oh=0, hits=2, kbx=3, kby=4, kbt='Knockdown', spd=9, props='Proj=straight', hb=(70, 120, 90, 80))
    add('SQ_j236L', 'Square', 'j.236L', type='Special', name='Air Prism Shot', dmg=40, chip=8, su=12, act=60, rec=16, ob=-2, oh=2, kbx=2, spd=10, props='Proj=angled|Angle=-45|LandEnd', hb=(40, 20, 56, 48))
    add('SQ_623H', 'Square', '623H', type='Special', name='Big Rising Corner', dmg=110, chip=20, su=9, act=8, rec=32, ob=-24, oh=0, hits=2, kbx=4, kby=12, kbt='Hard_Knockdown', inv='Strike', invf='1-8', props='Vel=4:21@9-16', hb=(50, 165, 86, 150))
    add('SQ_214M', 'Square', '214M', type='Special', name='Prism Whirl', dmg=66, chip=10, su=12, act=18, rec=14, ob=-4, oh=0, hits=3, kbx=3, kby=4, kbt='Knockdown', props='Vel=7:0@12-29', hb=(50, 110, 92, 92))
    add('SQ_236236H', 'Square', '236236H', type='Super', name='Prism Beam', dmg=260, chip=40, su=12, act=40, rec=30, ob=-14, oh=0, hits=8, kbx=3, kby=8, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='Proj=beam', hb=(60, 125, 1500, 110))
    add('SQ_214214H', 'Square', '214214H', type='Super', name='Square Barrage', dmg=230, chip=35, su=7, act=24, rec=30, ob=-18, oh=0, hits=6, kbx=3, kby=12, kbt='Launch', unt=50, inv='Full', invf='1-9', props='Vel=12:0@7-20|NoExtHurt', hb=(50, 110, 120, 140))
    add('SQ_5U', 'Square', '5U', type='Unique', name='Prism Ring (Mid)', su=10, act=0, rec=14, ob=0, oh=0, props='Script=ring|RingX=260|RingY=120|RingLife=240|RingCD=180|RingR=70')
    add('SQ_2U', 'Square', '2U', type='Unique', name='Prism Ring (Low)', su=10, act=0, rec=14, ob=0, oh=0, props='Script=ring|RingX=260|RingY=40|RingLife=240|RingCD=180|RingR=70')
    add('SQ_jU', 'Square', 'j.U', type='Unique', name='Prism Ring (Angled)', su=8, act=0, rec=12, ob=0, oh=0, air=True, props='Script=ring|RingX=160|RingY=-150|RingLife=240|RingCD=180|RingR=70')

    # ===================== TRIANGLE =====================
    normals('Triangle', 'TR', speed=-1, dmg=0.92, reach=1.05, over={'6M': dict(name='Apex Overhead')})
    add('TR_214L', 'Triangle', '214L', type='Special', name='Tri-Shift (Behind)', su=1, act=0, rec=22, oh=0, ob=0, inv='Full', invf='6-16', props='Teleport=behind@14|Vanish=6-14')
    add('TR_214M', 'Triangle', '214M', type='Special', name='Tri-Shift (Front)', su=1, act=0, rec=20, oh=0, ob=0, inv='Full', invf='6-14', props='Teleport=front@12|Vanish=6-12')
    add('TR_623H', 'Triangle', '623H', type='Special', name='Apex Slash', dmg=90, chip=15, su=7, act=6, rec=28, ob=-20, oh=0, hits=2, kbx=3, kby=10, kbt='Knockdown', inv='Full', invf='1-7', props='Vel=3:18@7-12', hb=(48, 165, 80, 140))
    add('TR_j214H', 'Triangle', 'j.214H', type='Special', name='Spike Dive', dmg=55, chip=6, su=10, act=20, rec=10, ob=-2, oh=3, blk='High', unt=22, kbx=2, props='Vel=7:-16@10-29|LandEnd', hb=(24, 30, 80, 90))
    add('TR_236236H', 'Triangle', '236236H', type='Super', name='Trinity Rush', dmg=230, chip=35, su=8, act=25, rec=30, ob=-20, oh=0, hits=6, kbx=4, kby=10, kbt='Hard_Knockdown', inv='Full', invf='1-10', props='Vel=13:0@8-20|NoExtHurt', hb=(46, 110, 120, 150))
    add('TR_214214H', 'Triangle', '214214H', type='Super', name='Disc Storm', dmg=180, chip=30, su=10, act=60, rec=26, ob=2, oh=0, hits=6, kbx=2, kby=5, kbt='Knockdown', inv='Full', invf='1-10', spd=3.5, props='Proj=disc|Count=3|Step=6', hb=(60, 16, 72, 26))
    add('TR_5U', 'Triangle', '5U', type='Unique', name='Apex Dash (Up-Fwd)', su=1, act=0, rec=15, oh=0, ob=0, props='Vel=9.5:9.5@2-16|Airborne|AirCancel=9|Script=apex')
    add('TR_2U', 'Triangle', '2U', type='Unique', name='Apex Dash (Up-Back)', su=1, act=0, rec=15, oh=0, ob=0, props='Vel=-9:9@2-16|Airborne|AirCancel=9|Script=apex')
    add('TR_jU', 'Triangle', 'j.U', type='Unique', name='Apex Dash (Down-Fwd)', su=1, act=0, rec=14, oh=0, ob=0, air=True, props='Vel=10:-10@1-14|AirCancel=6|LandEnd|Script=apex')

    # ===================== RHOMBUS =====================
    normals('Rhombus', 'RH', speed=1, dmg=1.15, reach=1.1, over={'5L': dict(su=6), '6M': dict(name='Heavy Drop', arm=1)})
    add('RH_THROW', 'Rhombus', 'LM', type='Throw', name='Rhombus Throw', dmg=110, su=5, act=2, rec=24, oh=0, ob=0, kbx=3, kby=7, kbt='Knockdown', blk='Unblockable', props='Grab=24|BreakWindow=12')
    add('RH_63214H', 'Rhombus', '63214H', type='CmdGrab', name='Diamond Grip', dmg=150, su=5, act=3, rec=40, oh=0, ob=0, kbx=2, kby=8, kbt='Hard_Knockdown', blk='Unblockable', props='Grab=40', hb=(84, 110, 80, 160))
    add('RH_236H', 'Rhombus', '236H', type='Special', name='Shoulder Charge', dmg=80, chip=12, su=18, act=8, rec=22, ob=-4, oh=0, kbx=4, kby=3, kbt='Knockdown', arm=1, props='Vel=10:0@10-25', hb=(70, 120, 90, 120))
    add('RH_214M', 'Rhombus', '214M', type='Special', name='Rhomb Lariat', dmg=70, chip=10, su=10, act=10, rec=24, ob=-10, oh=0, hits=2, kbx=2, kby=11, kbt='Launch', unt=34, hb=(70, 160, 130, 100))
    add('RH_623H', 'Rhombus', '623H', type='AirGrab', name='Sky Grip', dmg=120, su=6, act=6, rec=36, oh=0, ob=0, kbx=2, kby=6, kbt='Hard_Knockdown', blk='Unblockable', props='Vel=2:14@6-12|Grab=30', hb=(60, 200, 96, 130))
    add('RH_236236H', 'Rhombus', '236236H', type='Super', name='Diamond Crush', dmg=260, chip=40, su=10, act=12, rec=34, ob=-16, oh=0, hits=3, kbx=5, kby=10, kbt='Hard_Knockdown', arm=99, inv='Throw', invf='1-22', props='Vel=10:0@10-21', hb=(70, 120, 120, 160))
    add('RH_214214H', 'Rhombus', '214214H', type='Super', name='Grand Grip', dmg=320, su=3, act=4, rec=50, ob=0, oh=0, kbx=3, kby=10, kbt='Hard_Knockdown', blk='Unblockable', props='Grab=70|CmdGrab', hb=(90, 110, 110, 170))
    add('RH_5U', 'Rhombus', '5U', type='Unique', name='Grip Shift (High)', su=1, act=0, rec=10, oh=0, ob=0, props='Script=shift|Shift=HM|Dur=90|WalkMul=0.6')
    add('RH_2U', 'Rhombus', '2U', type='Unique', name='Grip Shift (Low)', su=1, act=0, rec=10, oh=0, ob=0, props='Script=shift|Shift=LM|Dur=90|WalkMul=0.6')
    add('RH_jU', 'Rhombus', 'j.U', type='Unique', name='Armored Dive', dmg=55, su=8, act=20, rec=12, ob=-1, oh=3, blk='High', arm=1, unt=22, kbx=2, props='Vel=4:-15@8-27|LandEnd', hb=(20, 30, 120, 90))

    # ===================== HEXAGON =====================
    normals('Hexagon', 'HX', over={'6M': dict(name='Hex Drop')})
    for i, b in enumerate('LMH'):
        add('HX_236' + b, 'Hexagon', '236' + b, type='Special', name='Detonate Node %d' % (i + 1), dmg=60, chip=10, su=8, act=10, rec=16, ob=2, oh=0, kbx=2, kby=9, kbt='Launch', unt=30, props='Detonate=%d|LineDmg=30' % (i + 1), hb=(0, 0, 150, 150))
    add('HX_214L', 'Hexagon', '214L', type='Special', name='Hex Pulse', dmg=40, chip=6, su=10, act=6, rec=16, ob=-4, oh=0, kbx=7, kby=4, kbt='Knockdown', props='Proj=burst', hb=(0, 100, 260, 220))
    add('HX_41236H', 'Hexagon', '41236H', type='Special', name='Hex Barrier', dmg=60, chip=12, su=20, act=90, rec=22, ob=4, oh=3, hits=4, kbx=1.5, spd=3, props='Proj=orb', hb=(90, 110, 110, 110))
    add('HX_236236H', 'Hexagon', '236236H', type='Super', name='Grid Collapse', dmg=120, chip=20, su=10, act=10, rec=30, ob=-6, oh=0, kbx=3, kby=12, kbt='Launch', unt=50, inv='Full', invf='1-10', props='Detonate=all|LineDmg=50', hb=(0, 0, 180, 180))
    add('HX_214214H', 'Hexagon', '214214H', type='Super', name='Node Rain', su=10, act=0, rec=20, oh=0, ob=0, props='Script=node3')
    add('HX_5U', 'Hexagon', '5U', type='Unique', name='Grid Node (Self)', su=10, act=0, rec=12, oh=0, ob=0, props='Script=node|NodeX=30|NodeY=90|NodeLife=900|NodeMax=3')
    add('HX_2U', 'Hexagon', '2U', type='Unique', name='Grid Node (Ground)', su=12, act=0, rec=12, oh=0, ob=0, props='Script=node|NodeX=300|NodeY=25|NodeLife=900|NodeMax=3')
    add('HX_jU', 'Hexagon', 'j.U', type='Unique', name='Grid Node (Air)', su=8, act=0, rec=10, oh=0, ob=0, air=True, props='Script=node|NodeX=0|NodeY=40|NodeLife=900|NodeMax=3')

    # ===================== OVAL =====================
    normals('Oval', 'OV', speed=1, dmg=0.95, reach=1.25)
    for b, spd, d, su in (('L', 7, 40, 15), ('M', 10, 45, 16), ('H', 13, 55, 18)):
        add('OV_236' + b, 'Oval', '236' + b, type='Special', name='Slingshot %s' % b, dmg=d, chip=8, su=su, act=60, rec=20, ob=-2, oh=1, kbx=3, spd=spd, props='Proj=straight', hb=(70, 115, 56, 56))
    add('OV_623M', 'Oval', '623M', type='Special', name='Stretch Upper', dmg=80, chip=12, su=6, act=8, rec=26, ob=-18, oh=0, kbx=1.5, kby=12, kbt='Launch', unt=40, inv='Full', invf='1-6', hb=(56, 210, 80, 170))
    add('OV_41236H', 'Oval', '41236H', type='Special', name='Elastic Lance', dmg=70, chip=10, su=16, act=4, rec=26, ob=-8, oh=0, kbx=4, kby=4, kbt='Knockdown', hb=(300, 130, 420, 40))
    add('OV_j236M', 'Oval', 'j.236M', type='Special', name='Air Slingshot', dmg=40, chip=8, su=12, act=40, rec=16, ob=-2, oh=2, kbx=2, spd=9, props='Proj=angled|Angle=-30|LandEnd', hb=(40, 20, 50, 50))
    add('OV_236236H', 'Oval', '236236H', type='Super', name='Mega Stretch', dmg=250, chip=40, su=10, act=6, rec=40, ob=-20, oh=0, hits=3, kbx=5, kby=10, kbt='Hard_Knockdown', inv='Full', invf='1-10', props='NoExtHurt', hb=(560, 130, 1100, 90))
    add('OV_214214H', 'Oval', '214214H', type='Super', name='Bouncing Barrage', dmg=180, chip=30, su=10, act=70, rec=28, ob=4, oh=0, hits=3, kbx=3, kby=6, kbt='Knockdown', inv='Full', invf='1-10', spd=11, props='Proj=straight|Count=3|Step=8', hb=(70, 115, 70, 70))
    for v, air in (('5U', False), ('2U', False), ('j.U', True)):
        add('OV_' + v.replace('.', ''), 'Oval', v, type='Unique', name='Elastic Stretch', su=1, act=0, rec=10, oh=0, ob=0, air=air, props='Script=stretch|Dur=300|CD=480|ReachMul=1.6|RecAdd=3')

    # ===================== CONE & CYL =====================
    normals('Cone & Cyl', 'CC', dmg=0.9)
    add('CC_236L', 'Cone & Cyl', '236L', type='Special', name='Spin Top', dmg=45, chip=9, su=14, act=70, rec=18, ob=-1, oh=2, hits=2, kbx=2, spd=6, props='Proj=straight', hb=(70, 40, 60, 60))
    add('CC_623M', 'Cone & Cyl', '623M', type='Special', name='Cone Spike', dmg=78, chip=14, su=6, act=6, rec=26, ob=-18, oh=0, kbx=2, kby=11, kbt='Knockdown', inv='Full', invf='1-6', props='Vel=2:15@6-11', hb=(46, 170, 70, 140))
    add('CC_214M', 'Cone & Cyl', '214M', type='Special', name='Cylinder Rush (command)', su=6, act=0, rec=16, oh=0, ob=0, props='Puppet=CC_CYL_RUSH')
    add('CC_CYL_RUSH', 'Cone & Cyl', '-', type='Puppet', name='Cylinder Rush', dmg=60, chip=10, su=10, act=20, rec=14, ob=-2, oh=0, hits=2, kbx=3, kby=5, kbt='Knockdown', props='Vel=12:0@10-29', hb=(36, 60, 90, 100))
    add('CC_CYL_L', 'Cone & Cyl', 'hold U + L', type='Puppet', name='Cylinder Punch', dmg=30, su=8, act=4, rec=16, ob=0, oh=3, kbx=2, hb=(50, 60, 64, 50))
    add('CC_CYL_M', 'Cone & Cyl', 'hold U + M', type='Puppet', name='Cylinder Upper', dmg=45, su=12, act=5, rec=20, ob=-2, oh=0, kbx=1.5, kby=11, kbt='Launch', unt=36, hb=(30, 110, 74, 120))
    add('CC_CYL_H', 'Cone & Cyl', 'hold U + H', type='Puppet', name='Cylinder Slam', dmg=55, su=20, act=4, rec=20, ob=1, oh=4, kbx=3, blk='High', hb=(40, 60, 84, 96))
    add('CC_jU', 'Cone & Cyl', 'j.U', type='Puppet', name='Cylinder Hop', dmg=40, su=10, act=8, rec=14, ob=0, oh=0, kbx=1.5, kby=8, kbt='Launch', unt=30, air=True, props='Vel=2:14@1-10|CylHop', hb=(0, 120, 90, 90))
    add('CC_5U', 'Cone & Cyl', '5U (hold)', type='Unique', name='Puppet Control', su=0, act=0, rec=0, oh=0, ob=0, props='Script=control|CylSpeed=6|CylStun=180')
    add('CC_2U', 'Cone & Cyl', '2U', type='Unique', name='Recall', su=0, act=0, rec=0, oh=0, ob=0, props='Script=recall')
    add('CC_236236H', 'Cone & Cyl', '236236H', type='Super', name='Duo Assault', dmg=240, chip=40, su=8, act=22, rec=30, ob=-18, oh=0, hits=6, kbx=4, kby=11, kbt='Hard_Knockdown', inv='Full', invf='1-10', props='Vel=11:0@8-24|Puppet=CC_CYL_M|NoExtHurt', hb=(44, 110, 120, 150))
    add('CC_214214H', 'Cone & Cyl', '214214H', type='Super', name='Cylinder Drop', dmg=200, chip=35, su=12, act=20, rec=30, ob=-8, oh=0, kbx=1, kby=4, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='Proj=rain|Count=1', hb=(0, 0, 170, 210))

    # ===================== OCTAGON =====================
    normals('Octagon', 'OC')
    add('OC_236L', 'Octagon', '236L', type='Special', name='Stop Sign (Slow)', dmg=45, chip=9, su=14, act=70, rec=18, ob=-2, oh=1, kbx=3, spd=7, props='Proj=straight', hb=(70, 120, 64, 64))
    add('OC_236M', 'Octagon', '236M', type='Special', name='Stop Sign (Fast)', dmg=50, chip=10, su=15, act=50, rec=19, ob=-3, oh=1, kbx=3, spd=11, props='Proj=straight', hb=(70, 120, 64, 64))
    add('OC_623H', 'Octagon', '623H', type='Special', name='Octa Rise', dmg=95, chip=16, su=8, act=7, rec=30, ob=-22, oh=0, hits=2, kbx=3, kby=11, kbt='Knockdown', inv='Full', invf='1-8', props='Vel=2:17@8-14', hb=(48, 165, 82, 140))
    add('OC_214H', 'Octagon', '214H', type='Special', name='Octa Counter', su=4, act=21, rec=20, oh=0, ob=0, props='AutoGuard=4-24|Followup=OC_COUNTER_HIT')
    add('OC_COUNTER_HIT', 'Octagon', '-', type='Followup', name='Octa Counter Strike', dmg=90, su=4, act=4, rec=20, ob=-10, oh=0, kbx=4, kby=6, kbt='Knockdown', inv='Full', invf='1-8', hb=(80, 120, 110, 120))
    add('OC_236236H', 'Octagon', '236236H', type='Super', name='Full Stop', dmg=160, chip=30, su=12, act=80, rec=28, ob=-4, oh=70, kbx=1, spd=9, inv='Full', invf='1-12', props='Proj=straight', hb=(80, 120, 110, 110))
    add('OC_214214H', 'Octagon', '214214H', type='Super', name='Eightfold Strike', dmg=250, chip=40, su=7, act=24, rec=30, ob=-18, oh=0, hits=8, kbx=4, kby=11, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='Vel=12:0@7-18|NoExtHurt', hb=(46, 110, 120, 150))
    add('OC_5U', 'Octagon', '5U', type='Unique', name='STOP Parry (High/Mid)', su=1, act=7, rec=20, oh=0, ob=0, props='Parry=HM|ParryStun=30')
    add('OC_2U', 'Octagon', '2U', type='Unique', name='STOP Parry (Low/Mid)', su=1, act=7, rec=20, oh=0, ob=0, props='Parry=LM|ParryStun=30')
    add('OC_jU', 'Octagon', 'j.U', type='Unique', name='STOP Parry (Air)', su=1, act=7, rec=16, oh=0, ob=0, air=True, props='Parry=AIR|ParryStun=30')

    # ===================== SEMICIRCLE =====================
    normals('Semicircle', 'SC', over={'6M': dict(name='Arc Drop')})
    add('SC_F_236L', 'Semicircle', '236L', stance='Flat', type='Special', name='Horizon Slash', dmg=55, chip=9, su=14, act=4, rec=20, ob=-6, oh=0, kbx=4, kby=4, kbt='Knockdown', hb=(180, 120, 260, 40))
    add('SC_F_214M', 'Semicircle', '214M', stance='Flat', type='Special', name='Dawn Guard', su=3, act=20, rec=18, oh=0, ob=0, props='AutoGuard=3-22|Followup=SC_F_GUARD_SLASH')
    add('SC_F_GUARD_SLASH', 'Semicircle', '-', stance='Flat', type='Followup', name='Dawn Guard Slash', dmg=85, su=3, act=5, rec=22, ob=-10, oh=0, kbx=1.5, kby=12, kbt='Launch', unt=40, inv='Full', invf='1-7', hb=(60, 170, 100, 160))
    add('SC_F_623H', 'Semicircle', '623H', stance='Flat', type='Special', name='Rising Arc', dmg=100, chip=18, su=9, act=6, rec=30, ob=-22, oh=0, kbx=3, kby=12, kbt='Hard_Knockdown', inv='Full', invf='1-9', props='Vel=2:16@9-14', hb=(60, 170, 92, 170))
    add('SC_F_41236H', 'Semicircle', '41236H', stance='Flat', type='Special', name='Tide Cleave', dmg=85, chip=14, su=22, act=5, rec=22, ob=-2, oh=0, kbx=4, kby=5, kbt='Knockdown', blk='High', hb=(150, 100, 180, 140))
    add('SC_A_236L', 'Semicircle', '236L', stance='Arc', type='Special', name='Crescent Vanish', dmg=60, chip=10, su=20, act=4, rec=18, ob=-8, oh=0, kbx=3, kby=5, kbt='Knockdown', inv='Full', invf='6-12', props='Teleport=behind@12|Vanish=6-12', hb=(70, 120, 104, 84))
    add('SC_A_214M', 'Semicircle', '214M', stance='Arc', type='Special', name='Flutter Flurry', dmg=75, chip=10, su=9, act=18, rec=16, ob=-6, oh=2, hits=5, kbx=1, props='Vel=6:0@9-26', hb=(60, 110, 100, 100))
    add('SC_A_623M', 'Semicircle', '623M', stance='Arc', type='Special', name='Swift Rise', dmg=80, chip=12, su=5, act=6, rec=26, ob=-16, oh=0, kbx=2, kby=12, kbt='Launch', unt=38, inv='Full', invf='1-5', props='Vel=2:15@5-10', hb=(52, 160, 80, 140))
    add('SC_A_63214H', 'Semicircle', '63214H', stance='Arc', type='Special', name='Petal Dash', dmg=70, chip=10, su=10, act=10, rec=20, ob=-5, oh=0, kbx=3, kby=5, kbt='Knockdown', props='Vel=18:0@10-19|PassThrough', hb=(40, 110, 120, 100))
    add('SC_236236H', 'Semicircle', '236236H', type='Super', name='Butterfly Tide', dmg=250, chip=40, su=9, act=30, rec=30, ob=-14, oh=0, hits=5, kbx=4, kby=10, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='NoExtHurt', hb=(300, 120, 600, 140))
    add('SC_214214H', 'Semicircle', '214214H', type='Super', name='Thousand Petals', dmg=260, chip=40, su=8, act=24, rec=30, ob=-18, oh=0, hits=10, kbx=3, kby=12, kbt='Launch', unt=50, inv='Full', invf='1-10', props='Vel=15:0@8-20|PassThrough|NoExtHurt', hb=(40, 110, 120, 140))
    add('SC_U', 'Semicircle', 'U / 2U / j.U', type='Unique', name='Stance Switch', su=0, act=0, rec=0, oh=0, ob=0, props='Script=stance|FlatReach=1.2|ArcFaster=1|ArcWalk=1.25|FlatWalk=0.85')

    # ===================== STAR =====================
    normals('Star', 'ST', skip=('6M', '3H'), extra_props={
        '2L': 'Element=F', '2M': 'Element=I', '2H': 'Element=L',
        'j.L': 'Element=F', 'j.M': 'Element=I', 'j.H': 'Element=L'})
    add('ST_214L', 'Star', '214L', type='Special', name='Blink Back', su=1, act=0, rec=18, oh=0, ob=0, inv='Full', invf='4-10', props='Teleport=back:280@8|Vanish=4-8')
    add('ST_214M', 'Star', '214M', type='Special', name='Blink Forward', su=1, act=0, rec=20, oh=0, ob=0, inv='Full', invf='4-10', props='Teleport=fwd:280@8|Vanish=4-8')
    add('ST_214U', 'Star', '214U', type='Unique', name='Stock Spell', su=10, act=0, rec=10, oh=0, ob=0, props='Script=stock')
    add('ST_236236H', 'Star', '236236H', type='Super', name='Starfall', dmg=220, chip=40, su=12, act=60, rec=30, ob=-6, oh=0, hits=5, kbx=1, kby=6, kbt='Hard_Knockdown', inv='Full', invf='1-12', props='Proj=rain|Count=5|Step=6|Spread=70', hb=(0, 0, 100, 120))
    add('ST_214214H', 'Star', '214214H', type='Super', name='Element Overload', su=1, act=0, rec=20, oh=0, ob=0, props='Script=overload')
    S = 'Spell'
    spells = [
        # key, name, dmg, su, act, rec, ob, oh, kbt, kbx, kby, unt, hits, spd, props, hb
        ('F', 'Ember', 35, 14, 60, 16, -2, 2, 'Normal', 3, 0, 0, 1, 10, 'Proj=straight', (70, 120, 50, 40)),
        ('FF', 'Flame Skull', 70, 16, 10, 18, 2, 0, 'Knockdown', 3, 6, 0, 1, 0, 'Proj=bomb|Dist=180|Fuse=18', (0, 110, 150, 150)),
        ('FFF', 'Inferno', 120, 18, 14, 22, 4, 0, 'Launch', 2, 13, 44, 3, 0, 'Proj=pillar|Dist=200|Delay=6', (0, 150, 180, 300)),
        ('I', 'Frost Block', 35, 13, 8, 18, -1, 0, 'Knockdown', 2, 5, 0, 1, 0, 'Proj=pillar|Dist=160', (0, 60, 90, 120)),
        ('II', 'Glacier Spike', 65, 16, 10, 20, 1, 0, 'Launch', 1.5, 11, 40, 1, 0, 'Proj=pillar|Dist=320|Delay=8', (0, 90, 110, 180)),
        ('III', 'Ice Age', 110, 18, 8, 24, 3, 0, 'Launch', 2, 10, 40, 4, 0, 'Proj=wave|Dist=140|Count=4|Gap=130|Step=5', (0, 70, 100, 140)),
        ('L', 'Spark', 30, 11, 40, 15, -2, 1, 'Normal', 2, 0, 0, 1, 16, 'Proj=straight', (70, 130, 40, 30)),
        ('LL', 'Thunder Orb', 60, 16, 80, 20, 3, 3, 'Normal', 1.5, 0, 0, 4, 3, 'Proj=orb', (80, 120, 90, 90)),
        ('LLL', 'Storm Sphere', 110, 20, 120, 24, 6, 4, 'Normal', 1.5, 0, 0, 6, 2, 'Proj=orb|Push', (100, 140, 170, 170)),
        ('FI', 'Steam Veil', 50, 15, 90, 18, 8, 3, 'Normal', 1, 0, 0, 5, 0, 'Proj=cloud|Dist=220|BlockProj', (0, 120, 200, 200)),
        ('FL', 'Plasma Line', 80, 15, 16, 22, -4, 0, 'Knockdown', 3, 5, 0, 4, 0, 'Proj=beam', (60, 125, 900, 50)),
        ('IL', 'Hailstorm', 70, 16, 40, 18, 4, 4, 'Normal', 1, 0, 0, 3, 0, 'Proj=rain|Count=3|Step=8|Spread=60', (0, 0, 90, 90)),
        ('FFI', 'Frost Skull', 80, 16, 10, 18, 2, 4, 'Normal', 2, 0, 0, 1, 0, 'Proj=bomb|Dist=220|Fuse=16|Freeze=20', (0, 110, 150, 150)),
        ('FFL', 'Volt Skull', 85, 16, 12, 18, 3, 0, 'Knockdown', 3, 6, 0, 3, 0, 'Proj=bomb|Dist=260|Fuse=10', (0, 110, 160, 160)),
        ('FII', 'Magma Pillar', 85, 17, 12, 20, 2, 0, 'Hard_Knockdown', 2, 9, 0, 2, 0, 'Proj=pillar|Dist=260|Delay=6', (0, 120, 120, 240)),
        ('IIL', 'Shock Spikes', 90, 17, 8, 22, 2, 0, 'Launch', 1.5, 10, 40, 3, 0, 'Proj=wave|Dist=180|Count=3|Gap=160|Step=3', (0, 70, 100, 140)),
        ('FLL', 'Ball Lightning', 85, 16, 70, 20, 3, 0, 'Knockdown', 2, 6, 0, 3, 5, 'Proj=orb', (80, 120, 90, 90)),
        ('ILL', 'Static Field', 70, 16, 100, 18, 6, 4, 'Normal', 1, 0, 0, 5, 0, 'Proj=cloud|Dist=180|Freeze=8', (0, 100, 180, 160)),
    ]
    for key, nm, dmg, su, act, rec, ob, oh, kbt, kbx, kby, unt, hits, spd, props, hb in spells:
        els = {'F': 'Fire', 'I': 'Ice', 'L': 'Lightning'}
        label = '+'.join(els[c] for c in key)
        add('ST_SP_' + key, 'Star', 'U(%s)' % key, type=S, name='%s (%s)' % (nm, label), dmg=dmg, chip=int(dmg * 0.18), su=su, act=act, rec=rec, ob=ob, oh=oh, kbt=kbt, kbx=kbx, kby=kby, unt=unt, hits=hits, spd=spd, air=True, props='Spell=%s|%s' % (key, props), hb=hb)

    # ===================== HỆ THỐNG CHUNG =====================
    add('ALL_THROW', 'ALL', 'LM', type='Throw', name='Throw', dmg=80, su=5, act=2, rec=24, oh=0, ob=0, kbx=3, kby=7, kbt='Knockdown', blk='Unblockable', hsa=0, hsd=0, props='Grab=20|BreakWindow=12')
    add('ALL_DEAD_ANGLE', 'ALL', 'LMH (while blocking)', type='System', name='Dead Angle Attack', dmg=20, su=12, act=6, rec=26, ob=-14, oh=0, kbx=6, kby=6, kbt='Knockdown', inv='Full', invf='1-17', cost=25, gain=0, props='NoExtHurt', hb=(80, 110, 120, 140))
    add('ALL_RC', 'ALL', 'LMH', type='System', name='Roman Cancel', su=1, act=0, rec=0, oh=0, ob=0, cost=50, gain=0, props='Script=rc|Radius=260|Slow=40|PushBack=12')
    add('ALL_BURST_D', 'ALL', 'U+L/M/H (in hit/blockstun)', type='Burst', name='Defensive Burst', dmg=0, su=9, act=8, rec=30, ob=-24, oh=0, kbx=7, kby=10, kbt='Launch', unt=30, inv='Full', invf='1-16', gain=0, props='Burst=def|NoExtHurt', hb=(0, 110, 340, 300))
    add('ALL_BURST_O', 'ALL', 'U+L/M/H (neutral/attacking)', type='Burst', name='Offensive Burst', dmg=30, su=8, act=6, rec=14, ob=2, oh=0, kbx=1, kby=9, kbt='Launch', unt=36, inv='Full', invf='1-13', gain=0, props='Burst=off|Buff=300|DmgUp=0.15|GrayRegen=1.5|NoExtHurt', hb=(0, 110, 300, 280))


# Hiệu ứng hình ảnh cho từng chiêu (cột Properties: Fx=tên[:màu],tên...)
FX = {
    'CR_5H': 'heavy', 'CR_236L': 'quake', 'CR_214M': 'wind', 'CR_623M': 'fire', 'CR_623H': 'fire,heavy',
    'CR_236H': 'spin,fire', 'CR_j236M': 'spin', 'CR_236236H': 'fire,spin', 'CR_214214H': 'fire,heavy', 'CR_jU': 'spin',
    'CR_5U': 'dust', 'CR_2U': 'dust', 'CR_3H': 'dust',
    'SQ_5H': 'heavy', 'SQ_236L': 'prism', 'SQ_236M': 'prism', 'SQ_236H': 'prism', 'SQ_j236L': 'prism',
    'SQ_623M': 'fire', 'SQ_623H': 'fire,heavy', 'SQ_214M': 'wind,spin', 'SQ_236236H': 'prism', 'SQ_214214H': 'prism,heavy', 'SQ_3H': 'dust',
    'TR_236L': 'spark', 'TR_623H': 'slash', 'TR_j214H': 'wind', 'TR_236236H': 'slash', 'TR_214214H': 'spark',
    'TR_3H': 'dust', 'TR_214L': 'smoke', 'TR_214M': 'smoke', 'TR_2H': 'slash',
    'RH_5H': 'heavy', 'RH_236H': 'heavy,dust', 'RH_214M': 'wind,spin', 'RH_63214H': 'heavy', 'RH_623H': 'wind',
    'RH_236236H': 'heavy,quake', 'RH_214214H': 'quake', 'RH_jU': 'quake', 'RH_6M': 'heavy', 'RH_THROW': 'heavy',
    'HX_236L': 'elec:#3fd69a', 'HX_236M': 'elec:#3fd69a', 'HX_236H': 'elec:#3fd69a', 'HX_214L': 'elec:#3fd69a',
    'HX_41236H': 'elec:#3fd69a', 'HX_236236H': 'elec:#3fd69a,heavy', 'HX_5H': 'heavy',
    'OV_236L': 'bounce', 'OV_236M': 'bounce', 'OV_236H': 'bounce', 'OV_j236M': 'bounce', 'OV_623M': 'wind',
    'OV_41236H': 'stretch', 'OV_236236H': 'stretch,heavy', 'OV_214214H': 'bounce',
    'CC_236L': 'spin', 'CC_623M': 'spark', 'CC_CYL_L': 'metal', 'CC_CYL_M': 'metal', 'CC_CYL_H': 'metal,heavy',
    'CC_CYL_RUSH': 'metal,dust', 'CC_jU': 'metal', 'CC_236236H': 'metal,spin', 'CC_214214H': 'heavy,quake',
    'OC_236L': 'stop', 'OC_236M': 'stop', 'OC_623H': 'fire', 'OC_COUNTER_HIT': 'heavy', 'OC_236236H': 'stop', 'OC_214214H': 'slash',
    'SC_F_236L': 'slash:#4aa3d9', 'SC_F_GUARD_SLASH': 'slash:#4aa3d9', 'SC_F_623H': 'slash:#4aa3d9,wind', 'SC_F_41236H': 'slash:#4aa3d9,heavy',
    'SC_A_236L': 'petal,slash:#ef6fae', 'SC_A_214M': 'petal,slash:#ef6fae', 'SC_A_623M': 'petal,slash:#ef6fae', 'SC_A_63214H': 'petal,slash:#ef6fae',
    'SC_236236H': 'slash:#4aa3d9,heavy', 'SC_214214H': 'petal,slash:#ef6fae', 'SC_5H': 'slash', 'SC_2H': 'slash',
    'ST_214L': 'smoke', 'ST_214M': 'smoke', 'ST_236236H': 'elec,fire,ice', 'ST_214214H': 'elec,fire,ice',
    'ALL_BURST_D': 'burst', 'ALL_BURST_O': 'burst', 'ALL_DEAD_ANGLE': 'heavy',
}
EL_FX = {'F': 'fire', 'I': 'ice', 'L': 'elec'}


def apply_fx():
    for r in ROWS:
        fx = FX.get(r['Move_ID'])
        props = r['Properties']
        if not fx:
            m = re.search(r'Element=(\w)', props)
            if m:
                fx = EL_FX[m.group(1)]
            m = re.search(r'Spell=(\w+)', props)
            if m:
                fx = ','.join(EL_FX[c] for c in sorted(set(m.group(1)), key='FIL'.index))
        if fx:
            r['Properties'] = (props + '|Fx=' + fx).strip('|')


def write():
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    mv = io.StringIO()
    w = csv.DictWriter(mv, fieldnames=COLS, lineterminator='\n')
    w.writeheader()
    for r in ROWS:
        w.writerow(r)
    ch = io.StringIO()
    w2 = csv.writer(ch, lineterminator='\n')
    w2.writerow(CHAR_COLS)
    for c in CHARS:
        w2.writerow([fmt(x) for x in c])
    with open(os.path.join(ROOT, 'data', 'moves.csv'), 'w', encoding='utf-8') as f:
        f.write(mv.getvalue())
    with open(os.path.join(ROOT, 'data', 'characters.csv'), 'w', encoding='utf-8') as f:
        f.write(ch.getvalue())
    print('moves:', len(ROWS), 'characters:', len(CHARS))


if __name__ == '__main__':
    build()
    apply_fx()
    write()
    import embed_data
    embed_data.main()
