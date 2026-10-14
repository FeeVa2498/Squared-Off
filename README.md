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
- **Charge:** `[4]6` là giữ lùi 40f rồi bấm tới + nút; `[2]8` là giữ xuống 40f rồi bấm lên + nút. Sau khi nhả vẫn còn giữ charge thêm 10f. Rhombus và Octagon dùng lệnh charge.
- **Camera:** zoom cố định như game đối kháng 2D thông thường. Hai người chơi không thể lùi ra ngoài mép màn hình; mép sân là góc (tường).

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

## Luật chung

- **Gatling** đi từ thấp lên cao: L > M > H, và L vào thẳng H được (thường sẽ có gap, không phải true blockstring).
- **Cùng một nút**, bản đứng và bản ngồi cancel qua lại được (5L <> 2L, 5H > 2H, 2M > cM…), mỗi chiêu một lần trong chuỗi. Gatling M lần hai từ cM sẽ tự ra fM.
- **Jab** tự gatling vào nhau và vào chính nó (2L 2L 5L 5L). 5L có startup 6f, 2L có startup 7f.
- **Jump cancel** (khi đòn trúng): 5L, 5M, 5H, 2H. 6M và 6H không jump cancel được. Trên không, jump cancel tức là nhảy kép. Star có luật riêng.
- **Super cancel:** chiêu nào special cancel được thì cũng super cancel được.
- **Pushback:** mọi đòn trúng hoặc bị đỡ đều đẩy đối thủ lùi lại tối thiểu một đoạn.
- **Knockdown:** đối thủ nằm 11f rồi mới bắt đầu dậy. Hard knockdown là 30f.
- **Counter hit:**
  - Hitstun cộng thêm: L +3f, M +5f, H +8f.
  - Untech cộng thêm: L +6f, M +10f, H +16f.
  - Hiệu ứng: CH bằng đòn L làm màn hình chậm 10f, đòn M chậm 20f, đòn H chậm 34f kèm zoom camera vào điểm trúng.
  - Cột `Properties` có thể khai `CH=Kbt:Kby:Untech` để đổi thuộc tính đòn khi counter hit, và `CHGroundBounce` để đòn gây ground bounce khi counter hit.
- **Roman Cancel (L+M+H):**
  - **Vàng (25%):** khi đòn đang ở startup hoặc active và đối thủ không bị stun. Giữ nguyên đà di chuyển, làm đối thủ chậm lại. Ví dụ dùng sau khi bắn projectile để lao vào.
  - **Đỏ (50%):** khi đối thủ đang bị hitstun hoặc blockstun.
  - **Tím (50%):** khi đang recovery, đang tự do, hoặc khi chính mình đang bị đánh.
- **Hiệu ứng trên người bị đánh:** trúng đòn lửa thì bị cháy, trúng đòn điện thì bị giật. Hiệu ứng đóng băng sẽ làm sau.

## Circle

Rushdown cầm đại kiếm. Có hệ thống token: bấm 5U để nạp 1 token (icon ngọn lửa cạnh thanh Equilibrium), special kế tiếp sẽ thành bản EX và tiêu mất token.

| Lệnh | Chiêu |
|---|---|
| 5L / 2L | Đánh bằng chuôi kiếm, kiếm cầm ngược. Tự gatling vào nhau được |
| cM / fM | Chém dọc xuống ở gần / vươn người chém ngang ở xa |
| 5H | Chém ngang, chậm nhưng đau, proration 100% |
| 2M | Cúi người chém ngang, đòn low |
| 2H | Hất kiếm lên (launcher), jump cancel được |
| 3H | Quay lưng đâm xuống chân, đòn low gây knockdown |
| 6M | Nhảy ngắn đấm chuôi kiếm, overhead. +2 khi bị đỡ, trúng thì link được vào 5L |
| 6H | Hit 1 hất kiếm lên (special cancel được), hit 2 bổ xuống (unsafe). Counter hit: hit 1 hất tung, hit 2 gây ground bounce |
| 236L | Đấm đất bắn tia lửa chéo lên, +1 khi bị đỡ ở max tầm. Bản EX: 3 tia nối tiếp gần full màn hình |
| 214M | Lăn tròn 3 hit, unsafe. Bản EX: nhanh hơn, +2 khi bị đỡ, trúng thì hất tung |
| 623M / 623H | Kiếm bốc lửa, đối thủ trúng thì bị cháy. 623M bất tử 1–7f. Bản EX: hard knockdown, đối thủ không tech được. Có cả bản trên không |
| 623L | Command grab, xách cổ hất tung lên, nối được combo trên không |
| 5U | Nạp token (startup 30f). Cancel từ normal sang 5U thì ra Power Burst: startup 6f, hất tung nhẹ và vẫn nạp token |
| 2U | Bắn tia lửa thấp: đòn low, disjoint, không special cancel được |
| j.U | Bắn nổ ở cự ly sát, bản thân bị đẩy ra sau. Trúng gần góc thì đối thủ wall bounce |
| 214214M | Dragon Install: trong 8 giây mọi special đều là bản EX mà không tốn token. 5U thành Dragon Blast (+3 khi bị đỡ) |
| 236236H | Meteor Drive: lao tới bốc lửa như thiên thạch |

Combo demo (đã test, khoảng 15 hit / 317 sát thương): c.M f.M 5H 3H 214M (EX) c.M 2H jc j.L j.M jc j.M j.H j.623H

## Gimmick nút U

| Nhân vật | 5U | 2U | j.U |
|---|---|---|---|
| Circle | Nạp token / Power Burst khi cancel | Tia lửa thấp | Bắn nổ cự ly sát |
| Square | Vòng Prism giữa | Vòng sát đất | Vòng nghiêng xuống |
| Triangle | Apex chéo lên trước | Apex chéo lên sau | Apex chéo xuống. 214L lao tới, cancel được sang chiêu khác, side swap khi ở gần. Đĩa 236L có độ trễ 30f mới gây sát thương |
| Rhombus | Grip Shift (armor mid/high) | Grip Shift (armor low/mid) | Bổ nhào có armor |
| Hexagon | Node tại chỗ | Node trên sàn, cách 300px | Node trên không |
| Oval | Bật/tắt Stretch | như 5U | như 5U |
| Cone & Cyl | Giữ U + hướng để điều khiển Cylinder, giữ U + L/M/H để Cylinder đánh | Gọi Cylinder về | Cylinder nhảy đánh |
| Octagon | Parry high/mid | Parry low/mid | Parry trên không |
| Semicircle | Đổi thế tức thì, kể cả giữa đòn | như 5U | như 5U |
| Star | Cast phép theo số lượng nguyên tố | như 5U | như 5U. 214U cất phép vào Stock. L = Băng, M = Điện, H = Lửa. 4X đánh gần, 5X đánh xa, 2X đòn thấp, 6X chống không chiến (gần / 45° / xa) |

## Vũ khí

Cột `Weapon` trong `characters.csv`: Circle cầm đại kiếm, Square long sword, Triangle song đao, Rhombus găng knuckles (nhân vật to nhất, không chạy được), Hexagon gậy hex, Oval ná cao su, Cone & Cyl tay điều khiển rối, Octagon biển STOP, Semicircle katana (thế xanh cầm xuôi, thế hồng cầm ngược), Star sách phép.

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
