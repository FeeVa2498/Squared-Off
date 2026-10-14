# SQUARED OFF — Prototype

**Chơi online:** https://feeva2498.github.io/Squared-Off/

Game đối kháng 2D chạy trên trình duyệt, khung hình cố định 60 FPS, đủ 10 nhân vật. Toàn bộ chữ trong game là tiếng Anh.
**Mở `index.html` bằng Chrome, Edge hoặc Firefox là chơi được.** Không cần cài đặt hay server.

## Điều khiển

| | P1 | P2 |
|---|---|---|
| Di chuyển | W A S D | Phím mũi tên |
| L / M / H | U / I / O | Numpad 4 / 5 / 6 (hoặc `,` `.` `/`) |
| Unique (U) | J | Numpad 1 (hoặc Shift phải) |
| Pause | Tab | Esc |

Tay cầm: X = L, Y = M, B = H, A = U, Start = Pause.

- **F1**: bật/tắt hitbox.
- **F2**: bật/tắt bảng frame data trong chế độ Training.

### Lệnh hệ thống

- **Throw:** L+M khi đứng gần. Giữ 4 để ném ra sau. Đỡ throw bằng L+M trong 12f.
- **Roman Cancel:** L+M+H, tốn 50%.
- **Dead Angle:** L+M+H khi đang block, tốn 25%.
- **Burst:** U + L/M/H. Khi đang bị đánh hoặc đang block thì ra Defensive Burst. Khi tự do hoặc đang ra đòn thì ra Offensive Burst: tăng 15% sát thương và hồi máu xám trong 5 giây.
- **Faultless Defense:** giữ lùi + 2 nút khi đang block. Tốn Equilibrium, triệt tiêu chip damage, đẩy lùi xa hơn.
- **Instant Block:** bấm lùi trong vòng 8f trước khi đòn chạm. Blockstun giảm 2f, Equilibrium được kéo về phía mình.
- **Di chuyển:** Dash 66, Backdash 44, Super jump 2 rồi 7/8/9, double jump, airdash 66/44 trên không, IAD 956 (tiến) / 754 (lùi). IAD phải nhả về neutral giữa hai lần bấm, nên nhảy tới mà giữ 6 sẽ không thành IAD.
- **Super:** 236236 + nút hoặc 214214 + nút, tốn 50%.

## Equilibrium (thanh kéo co)

- Tài nguyên của P1 là `(v+100)/2`, của P2 là phần còn lại. Mỗi bên luôn còn tối thiểu 25%.
- Tiến lên, dash, đánh trúng hoặc bị block, Instant Block đều kéo thanh về phía mình. Đi lùi bị phạt nhẹ.
- Khi tiêu tài nguyên, thanh bị đẩy về phía đối thủ: tiêu bao nhiêu thì đối thủ được bấy nhiêu.

## Cân bằng số liệu bằng CSV

- `data/moves.csv` chứa 238 chiêu. Các dòng tự bổ sung có tag `PLACEHOLDER` trong cột Properties. Trong game, những chiêu này hiện dấu `*` ở danh sách chiêu và bảng frame data.
- `data/characters.csv` chứa chỉ số nhân vật: HP, tốc độ đi, dash, nhảy, airdash, kích thước, tầm throw.

Có hai cách áp dụng số liệu sau khi chỉnh:

1. **Kéo thả file CSV vào cửa sổ game.** Số liệu áp dụng ngay từ chiêu kế tiếp. Game đọc được CSV lưu từ Excel tiếng Việt (dùng dấu `;`, số thập phân có dấu phẩy) và từ Google Sheets.
2. Chạy `python3 tools/embed_data.py` để nhúng CSV vào `js/data.js`, thành số liệu mặc định khi mở game.

Trong menu Pause có mục **Xuất moves.csv / characters.csv**, dùng để lưu bản đang chạy trong game.

### Thay đổi so với format CSV gốc

- **On_Hit luôn là số** (frame advantage). Các giá trị chữ như `Launch` hay `Knockdown` vốn trùng với cột `Knockback_Type`, nên chỉ còn giữ ở `Knockback_Type`.
- **Cột mới:**
  - `Stance`: dùng cho Semicircle.
  - `Name`
  - `Type`: Normal / Command / Special / Super / Unique / Spell / Throw / CmdGrab / AirGrab / Puppet / Followup / System / Burst.
  - `Untech`: số frame không được tech khi bị hất tung.
  - `Hits`
  - `Hitbox_X/Y/W/H`: tâm hitbox tính từ tâm nhân vật (X theo hướng mặt, Y tính từ mặt đất), cùng kích thước.
  - `Projectile_Speed`
  - `Air_OK`
  - `Cost`: % Equilibrium.
  - `Meter_Gain`
- **Hitstun và Blockstun được tính từ On_Hit và On_Block**, để chỉ có một nguồn số liệu:
  - Đòn thường: `stun = (Active − 1) + Recovery + On_Hit` (hoặc `On_Block`). Đây là lợi thế khi trúng ở frame active đầu tiên. Chiêu có lợi thế +N sẽ link được vào chiêu có startup N.
  - Projectile: `stun = Recovery + On_Hit`. Với projectile, Active là thời gian sống của viên đạn. Đạn có tag `Fullscreen` thì bay tới hết màn hình.
  - Ngồi trúng đòn: hitstun +2f. Counter hit: hitstun +4f, sát thương ×1.1.
- **Hitstop lấy theo CSV**, không theo mức chung 4/7/11 trong GDD.
- **Proration** nhân dồn sau mỗi hit, sàn tối thiểu 10%.
- **Đơn vị Knockback:** `Knockback_X × 3` px/frame khi trên mặt đất (× 2.2 khi bay). `Knockback_Y × 2` px/frame bay lên.
- Spell `ST_U_3E` đổi Input thành `U(FIL)`. 19 phép của Star nằm ở các dòng `ST_SP_*`, key là các chữ cái F (Lửa), I (Băng), L (Sét), sắp theo thứ tự đó.

### Cú pháp cột Properties

Các tag ngăn cách bằng dấu `|`. Tag dạng `Key=Value` có tác dụng trong engine. Tag chỉ có chữ thì là mô tả.

| Key | Ý nghĩa |
|---|---|
| `Vel=vx:vy@a-b` | Vận tốc từ frame a đến b. Nhiều đoạn ngăn bằng `;`. vx theo hướng mặt, vy dương là bay lên. |
| `Proj=straight/angled/orb/disc/bomb/pillar/wave/cloud/beam/rain/burst` | Loại projectile. Đi kèm `Dist`, `Fuse`, `Delay`, `Count`, `Step`, `Gap`, `Spread`, `Angle`, `Life`. |
| `Teleport=behind/front/fwd:N/back:N@frame`, `Vanish=a-b` | Dịch chuyển và khoảng frame biến mất. |
| `Airborne`, `AirCancel=N`, `LandEnd` | Chiêu bay lên; từ frame N được ra đòn trên không; chạm đất thì kết thúc chiêu. |
| `AutoGuard=a-b`, `Followup=ID` | Đỡ tự động trong khoảng frame, rồi ra đòn phản công. |
| `Parry=HM/LM/AIR`, `ParryStun=N` | Parry của Octagon. |
| `Grab=N`, `BreakWindow=N` | Độ dài đòn throw / grab và cửa sổ đỡ throw. |
| `Element=F/I/L`, `Spell=KEY` | Nguyên tố và phép của Star. |
| `Script=...` | Gimmick riêng. Tham số nằm cùng dòng, ví dụ `Dur`, `RingX`, `NodeMax`, `ReachMul`, `CylStun`. |
| `Fx=tên[:màu],...` | Hiệu ứng hình ảnh: `fire` (đấm lửa), `ice`, `elec`, `prism`, `wind`, `spin`, `quake`, `heavy`, `slash`, `petal`, `smoke`, `dust`, `spark`, `metal`, `stretch`, `bounce`, `stop`, `burst`. Ví dụ `Fx=slash:#4aa3d9,heavy`. |
| `WallBounce` / `WallBounceCorner`, `Freeze=N`, `Push`, `BlockProj`, `PassThrough`, `NoExtHurt` | Các hiệu ứng phụ. |

## Gimmick nút U

| Nhân vật | 5U | 2U | j.U |
|---|---|---|---|
| Circle | Ngay sau special: Rolling Install. Khi tự do: lăn tới | Lăn lùi | Lăn bổ nhào |
| Square | Vòng Prism giữa | Vòng sát đất | Vòng nghiêng xuống |
| Triangle | Apex chéo lên trước | Apex chéo lên sau | Apex chéo xuống |
| Rhombus | Grip Shift (armor mid/high) | Grip Shift (armor low/mid) | Bổ nhào có armor |
| Hexagon | Node tại chỗ | Node trên sàn, cách 300px | Node trên không |
| Oval | Bật/tắt Stretch | như 5U | như 5U |
| Cone & Cyl | Giữ U + hướng để điều khiển Cylinder, giữ U + L/M/H để Cylinder đánh | Gọi Cylinder về | Cylinder nhảy đánh |
| Octagon | Parry high/mid | Parry low/mid | Parry trên không |
| Semicircle | Đổi thế tức thì, kể cả giữa đòn | như 5U | như 5U |
| Star | Cast phép theo số lượng nguyên tố | như 5U | như 5U. 214U cất phép vào Stock |

## Cấu trúc thư mục

```
index.html          mở file này để chơi
js/core.js          cấu hình, đọc CSV, input (buffer 5f, motion, composite)
js/fighter.js       FSM nhân vật, chọn chiêu, cancel, di chuyển
js/world.js         va chạm, block/hit, projectile, throw, round, dummy
js/gimmicks.js      gimmick U của 10 nhân vật
js/fx.js            particle và hiệu ứng theo tag Fx
js/render.js        vẽ nét chì rung, camera, afterimage, cut-in super
js/game.js          menu, HUD, pause, training, kéo thả CSV
js/data.js          CSV được nhúng sẵn (tự sinh)
data/*.csv          số liệu để cân bằng
tools/              script sinh/nhúng dữ liệu, test tự động
```
