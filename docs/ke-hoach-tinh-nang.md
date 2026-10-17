# Kế hoạch tính năng — Website Gia phả

Ngày soạn: 2026-10-17 · Trạng thái: **đã làm xong: GĐ1 (phân quyền, quản trị, cài đặt site), GĐ8 (thống kê đầy đủ + bảng độ đầy đủ dữ liệu), GĐ7 (sử ký, tộc ước, dòng thời gian, bài đệm, menu điện thoại), GĐ6 (thư viện ảnh/tài liệu, địa điểm + bản đồ, nơi an nghỉ), GĐ5 (lịch âm dương, giỗ tự tính, sự kiện, link .ics, nhắc việc), GĐ4 (yêu cầu cập nhật + duyệt + nhật ký thay đổi), "đa gia đình" GĐ3 (tìm không dấu có gợi ý + bộ lọc, chi/phái có màu trên cây, thống kê cơ bản), và GĐ2 (ngày tháng đầy đủ/âm lịch, quê quán, liên hệ, thứ tự anh em, mẹ/con nuôi, trang Nhập liệu, CSV, tách "N vị") (quyết định D1 = nhiều gia đình: superadmin → mỗi họ một cây, một admin; trang quản lý của superadmin để sau, hiện dùng dòng lệnh)**. Các giai đoạn còn lại chờ bạn chốt các quyết định ở mục 3 (các quyết định D2, D4 dùng đề xuất mặc định). GĐ0 (sao lưu) được bỏ qua vì dữ liệu hiện chỉ là demo. — các giai đoạn còn lại chờ bạn chốt các quyết định ở mục 3 (GĐ1 đã dùng các đề xuất mặc định của tôi: D1 một cây, D2 riêng tư mặc định, D4 duyệt đăng ký). GĐ0 (sao lưu) được bỏ qua vì dữ liệu hiện chỉ là demo.

Nguồn: (1) file PDF "Tính năng chi tiết website gia phả" của bạn; (2) menu trái do Stitch đề xuất
(Sử ký dòng họ · Lăng mộ & nhà thờ · Lịch giỗ & sự kiện · Thống kê & phân tích); (3) hiện trạng code.

Quy ước độ lớn (ước lượng tương đối, **không phải cam kết thời gian**):
**S** = 1 migration nhỏ + vài endpoint + 1 màn hình · **M** = vài bảng + API + nhiều màn hình + test · **L** = nhiều module, có phần hạ tầng mới.

---

## 1. Hiện trạng so với yêu cầu

| Yêu cầu | Hiện có | Còn thiếu |
|---|---|---|
| **Cây gia phả** (PDF §1) | Cây dọc 3 mức zoom, thu/mở nhánh, xem tổ tiên, tìm theo tên, mượt tới 5.000 người | Cây ngang, xem riêng một nhánh con cháu, quan hệ **mẹ** của con, con nuôi, tính quan hệ họ hàng ("A là chú của B"), nhiều chi/phái |
| **Hồ sơ cá nhân** (§2) | Tên, giới tính, **chỉ năm** sinh/mất, tiểu sử, ảnh, tên tự, chức vị, nơi ở, mộ phần + GPS, thứ bậc tự tính | Ngày/tháng đầy đủ + **âm lịch**, quê quán riêng, điện thoại/email, thứ tự anh em nhập tay, thư viện ảnh/tư liệu |
| **Phân quyền** (§3) | Chỉ có "đã đăng nhập / chưa" | **Vai trò admin / thành viên / khách**, chế độ công khai hay riêng tư, duyệt tài khoản |
| **Tìm kiếm & lọc** (§5) | Tìm theo tên ở trình duyệt, **phân biệt dấu** ("nguyen" không ra "Nguyễn") | Tìm không dấu, lọc theo đời/nhánh/năm sinh/quê, gợi ý khi gõ sai |
| **Tương tác** (§6) | Đăng ký, đăng nhập, quên mật khẩu qua email | **Gửi yêu cầu cập nhật** cho admin duyệt |
| **Sự kiện** (§7, Stitch) | Không có | Lịch giỗ (âm lịch), sự kiện, nhắc qua email, thiệp mời online |
| **Nhiều chi/phái** (§8) | Một cây, một gốc | Chi/phái, trưởng chi, ghép nối nhánh |
| **Riêng tư** (§9) | Không | Ẩn/hiện từng thông tin, khoá cả website |
| **Tiện ích** (§10) | Giao diện co giãn được | Xuất PDF/PNG, in thành quyển, thống kê |
| **Sử ký, Lăng mộ & nhà thờ** (Stitch) | Mộ phần là một ô chữ + GPS trên hồ sơ | Bài viết sử ký, địa điểm có bản đồ, ảnh |

## 2. Những điều tôi phát hiện, cần bạn biết trước

1. **Lỗ hổng phân quyền đang có thật.** Bất kỳ ai mở được trang web đều **tự đăng ký** được, và tài khoản nào
   cũng **sửa/xoá được toàn bộ cây**. Vì web vừa được mở ở `0.0.0.0`, ai trong cùng mạng cũng làm được. Đây là việc
   cần xử lý **trước** mọi tính năng mới (Giai đoạn 0 và 1).
2. **Dữ liệu 691 người vừa nạp chỉ có tên và đời** — chưa có năm sinh/mất, giới tính, quê quán. Lịch giỗ, thống kê,
   tuổi, lọc theo năm sinh đều **trống cho tới khi có người nhập dữ liệu**. Vì vậy công cụ nhập liệu hàng loạt và
   cách để cả họ cùng bổ sung (yêu cầu cập nhật) phải đi **trước** lịch giỗ và thống kê.
3. **PDF nhảy số từ mục 3 sang mục 5** — mục 4 bị thiếu. Tôi đoán đó là phần tư liệu/hình ảnh/kỷ niệm (và
   Stitch "Sử ký dòng họ" lấp chỗ này). Bạn xác nhận giúp.
4. **PDF viết "Insight cho khách hàng"** — nghe như sản phẩm bán cho **nhiều gia đình**. Hiện cả hệ thống là
   **một cây chung** (không có khái niệm "cây của ai"). Nếu bạn định bán cho nhiều họ, đây là quyết định kiến trúc
   lớn nhất và nên chốt ngay (D1), vì thêm sau rất tốn.
5. **Lịch giỗ phải tính theo âm lịch.** Giỗ là ngày mất âm lịch lặp lại hằng năm, đổi sang dương lịch mỗi năm một
   ngày khác. Cần thư viện/thuật toán đổi lịch và test kỹ; ngày mất phải lưu kèm cờ "âm lịch".

## 3. Quyết định cần chốt (kèm đề xuất của tôi)

| # | Câu hỏi | Đề xuất | Nếu chọn khác |
|---|---|---|---|
| **D1** | Một gia đình hay nhiều gia đình (SaaS)? | ~~Một cây cho mỗi lần triển khai~~ → **ĐÃ CHỌN: nhiều gia đình** (đã làm) | Nhiều họ: thêm bảng `trees`, mọi bảng có `tree_id`, quyền theo từng cây — thêm khoảng một giai đoạn L và phải làm **trước** giai đoạn 1 |
| **D2** | Truy cập mặc định: riêng tư hay công khai? | **Riêng tư (phải đăng nhập)**, có công tắc "công khai chỉ xem" do admin bật | Công khai mặc định thì phải làm riêng tư từng trường sớm hơn |
| **D3** | Mô hình quan hệ cha/mẹ | Giữ `parent_id` = **cha** (phụ hệ) + `mother_id` tuỳ chọn trỏ tới người vợ + cờ con nuôi | Đồ thị đầy đủ (bảng cha mẹ) linh hoạt hơn nhưng nặng hơn nhiều, ít họ cần |
| **D4** | Đăng ký tài khoản | **Admin duyệt hoặc mời**, không để đăng ký tự do | Mở hẳn: rủi ro như mục 2.1 |
| **D5** | Ai nhập liệu thật? | Admin nhập hàng loạt + thành viên **gửi yêu cầu cập nhật** | Cho thành viên sửa trực tiếp nhánh của mình (nhanh hơn, ít kiểm soát hơn) |
| **D6** | Các dòng "Nguyễn Vô Danh 3 Vị" | Giữ nguyên một dòng, thêm công cụ **tách thành N người** khi cần | Tách sẵn thành N người trống tên |
| **D7** | Gửi nhắc/thiệp mời qua đâu? | **Email (SMTP) + thông báo trong web + file lịch .ics**; chia sẻ link thiệp qua Zalo bằng tay | Zalo ZNS/SMS tự động: có phí, cần tài khoản doanh nghiệp, làm sau |

---

## 4. Phân tích từng tính năng

### A. Phân quyền, quản trị, cài đặt site (PDF §3, §9) — **M**
- **Dữ liệu:** `users.role` (`admin` | `member`), `users.status` (`pending` | `active`); bảng `site_settings` (khoá/giá trị):
  `visibility` (private/public), `registration` (invite/approval/closed), tên dòng họ, tiêu đề.
- **Quyền:** admin làm mọi thứ · member **xem** + gửi yêu cầu (giai đoạn 4) · khách xem được nếu site công khai, **không
  thấy** trường nhạy cảm (điện thoại, email, ảnh nếu ẩn).
- **Backend:** dependency `require_role`, áp vào mọi endpoint ghi; `GET` cây/hồ sơ cho phép khách tuỳ cài đặt;
  admin-only: duyệt/mời/khoá user, đổi role, cài đặt. Người dùng hiện có (`tien@gmail.com`) → admin qua migration.
- **Frontend:** middleware hiện chuyển về `/login` khi không có cookie → phải cho phép chế độ công khai; ẩn nút sửa/xoá
  với member/khách; trang **Quản trị** (danh sách user, duyệt, mời, cài đặt).
- **Rủi ro:** quên chặn một endpoint → test ma trận (vai trò × endpoint) bắt buộc.

### B. Hồ sơ & dữ liệu cốt lõi (PDF §1, §2) — **L**, chia 4 phần
- **B1. Ngày đầy đủ, âm lịch, trường mới (M):** sinh/mất lưu `year` + `month` + `day` (đều tuỳ chọn, vì nhiều người
  chỉ biết năm) + cờ `is_lunar` (mặc định âm lịch cho ngày mất); thêm `hometown` (quê quán), `phone`, `email`,
  `birth_order` nhập tay (cần khi chưa biết năm sinh). Giữ tương thích `birth_year`/`death_year` hiện có.
- **B2. Nhập liệu hàng loạt (M):** bảng sửa nhanh theo đời/nhánh (sửa ngay trong ô, có Tab/Enter), nhập/xuất CSV,
  công cụ **tách "N vị" thành N người**, thanh tiến độ "hồ sơ đã đủ bao nhiêu %". *Đây là phần quyết định dự án có
  dùng được hay không, vì dữ liệu hiện chỉ có tên.*
- **B3. Quan hệ phức tạp (M):** `mother_id` (D3), con nuôi, nhiều đời vợ có thứ tự, hiển thị vợ/chồng ngay trên cây
  (thẻ chi tiết đã hiện vợ đầu). Nên làm **sớm** vì đổi mô hình dữ liệu về sau tốn kém.
- **B4. Tính quan hệ họ hàng (M):** chọn hai người → "A là *chú/bác/cô/dì/cậu/mợ/anh họ…* của B". Thuật toán: tìm tổ
  tiên chung gần nhất trên cây + luật gọi theo giới tính và **thứ tự so với cha/mẹ** (bác hay chú). Cần B1/B3.
- **B5. Cây ngang + xem riêng một nhánh (S–M):** chuyển trục layout; "xem nhánh này" (chỉ con cháu một người), bổ sung
  cho chế độ xem tổ tiên đã có.

### C. Tìm kiếm & lọc thông minh (PDF §5) — **M**
- **Backend:** `GET /members/search` với `q`, `generation`, `branch`, `born_from/to`, `hometown`, `gender`, `status`.
  Postgres `unaccent` (tìm không dấu) + `pg_trgm` (gần đúng → "Có phải bạn muốn tìm…?"). Đời tính bằng truy vấn đệ quy
  hoặc cột `depth` lưu sẵn (cũng phục vụ thống kê).
- **Frontend:** ô tìm kiếm cho kết quả có phân trang + bộ lọc, bấm kết quả thì cây bay tới người đó (đã có cơ chế).
- **Rủi ro:** tiếng Việt gõ không dấu / dấu sai kiểu cũ (`hòa` vs `hoà`) → chuẩn hoá Unicode NFC khi lưu và khi tìm.

### D. Chi/phái (PDF §8) — **M**
- **Thiết kế gọn:** bảng `branches` (tên, màu, mô tả, `root_member_id` = người đứng đầu chi). **Một chi = cây con bắt
  đầu từ một người**, nên không phải gán nhánh cho từng thành viên — người nào thuộc chi sâu nhất trong các tổ tiên
  của họ. Không cần backfill dữ liệu.
- **Ghép nối chi phái:** dùng "chuyển cây con" (đổi cha, đã có) + nhập CSV vào một nhánh. Nhiều gốc độc lập trong một
  hệ thống chưa hỗ trợ (cây hiện lấy một gốc) — chỉ cần nếu chọn D1 = nhiều gia đình.
- **UI:** chip lọc theo chi, màu theo chi trên thẻ, trang chi (thành viên, thống kê riêng), gán trưởng chi.

### E. Yêu cầu cập nhật & duyệt (PDF §6) — **L**
- **Dữ liệu:** `change_requests` (member, người gửi, loại: sửa / thêm con / báo sai / bổ sung thông tin, nội dung đề xuất
  JSON, lời nhắn, trạng thái, người duyệt, ghi chú duyệt); `audit_log` (ai sửa gì, lúc nào, giá trị cũ/mới).
- **Luồng:** member bấm "Đề xuất chỉnh sửa" ở hồ sơ → admin thấy hộp thư kèm **so sánh cũ/mới** → Duyệt (áp bằng đúng
  validation của API sửa hiện có) hoặc Từ chối kèm lý do. Email cho admin khi có yêu cầu mới, cho người gửi khi có kết quả.
- **Vì sao quan trọng:** đây là cách **cả họ cùng điền dữ liệu** mà admin vẫn kiểm soát (D5), và nhật ký thay đổi giữ
  niềm tin cho một tài liệu mang tính lịch sử.

### F. Lịch giỗ & sự kiện (PDF §7, Stitch) — **L**, chia 4 phần
- **F1. Lịch + giỗ tự sinh (M):** đổi âm↔dương (thư viện Python có kiểm thử với bảng ngày đã biết); giỗ **không lưu
  trùng** — tính từ ngày mất âm lịch của từng người cho mỗi năm; bảng `events` cho sự kiện nhập tay (họp họ, cưới hỏi,
  sinh nhật, giỗ tổ…) với ngày dương hoặc quy tắc lặp theo âm lịch. Trang lịch dạng tháng + danh sách, luôn hiện **cả
  ngày âm và ngày dương**.
- **F2. Link lịch (.ics) + khung "sắp tới" (S):** thuê bao lịch vào điện thoại; khung 30 ngày tới trên trang chính.
- **F3. Nhắc việc (M):** thêm một tiến trình định kỳ (service `worker` trong compose, chạy mỗi ngày) → gửi email (SMTP đã
  có) và tạo thông báo trong web trước 7/3/1 ngày; mỗi người chọn mức nhắc. Cần SMTP thật (D7).
- **F4. Thiệp mời online + phản hồi (M):** mỗi sự kiện có thể tạo thiệp với **link riêng không cần đăng nhập** (token),
  trang thiệp đẹp, người nhận bấm Tham dự/Không/Chưa chắc + số người; admin xem danh sách. Chia sẻ link qua Zalo/email.

### G. Lăng mộ & nhà thờ (Stitch) — **M** (cần K trước)
- **Dữ liệu:** `places` (loại: nhà thờ họ/từ đường/lăng mộ/nghĩa trang/đền; tên, địa chỉ, GPS, mô tả, người trông coi,
  lưu ý khi thăm, ảnh); `members.burial_place_id` + `plot` (khu/hàng/số mộ). Chuyển ô "mộ phần" + GPS hiện có thành
  địa điểm (mỗi `burial_place` khác nhau → một `place`, giữ trường cũ cho tới khi chuyển xong).
- **UI:** bản đồ (Leaflet + OpenStreetMap, không cần khoá API), danh sách/lọc, trang địa điểm liệt kê người an nghỉ ở đó,
  nút "Chỉ đường" mở Google Maps; từ hồ sơ người mất bấm tới nơi an nghỉ; liên kết với sự kiện (giỗ tổ ở nhà thờ).

### H. Sử ký dòng họ (Stitch; PDF §2 "kể câu chuyện cuộc đời", mục 4 bị thiếu) — **M–L**
- **Dữ liệu:** `articles` (tiêu đề, slug, loại: nguồn gốc / thế thứ / **gia huấn–tộc ước** / sự kiện / nhân vật / khác,
  nội dung Markdown, ảnh bìa, ghim, thứ tự), `article_members` (bài nhắc tới ai), `timeline_entries` (năm, tiêu đề,
  nội dung, người liên quan).
- **Nội dung đặc thù họ Việt (đề xuất):** trang **Tộc ước/Gia huấn**; **bài đệm/tự bối** (bài thơ quy định chữ đệm theo đời)
  lưu theo từng đời để gợi ý khi thêm người; dòng thời gian của dòng họ.
- **UI:** trình soạn Markdown có xem trước (đơn giản, không cần WYSIWYG nặng); trang đọc đẹp (đúng bộ chữ Noto Serif);
  hồ sơ thành viên hiện "Được nhắc trong…". Admin soạn, member đọc, khách đọc nếu công khai.

### I. Thống kê & phân tích (PDF §10, Stitch) — **M**
- **Backend:** `GET /stats` tính bằng SQL: tổng thành viên, số đời, người mỗi đời, mỗi chi, tỉ lệ nam/nữ, còn sống/đã
  mất, tuổi thọ, thập niên sinh, số con trung bình, dòng dài nhất, người đông con nhất, chữ đệm phổ biến.
- **Điểm nhấn tôi đề xuất:** **bảng "độ đầy đủ dữ liệu"** (bao nhiêu % có năm sinh/giới tính/ảnh/quê) kèm danh sách người
  còn thiếu để bấm vào bổ sung — biến thống kê thành công cụ nhập liệu.
- **UI:** thẻ số liệu + biểu đồ dễ đọc/đủ tương phản, bấm vào một cột thì chuyển sang tìm kiếm đã lọc.
- **Khi nào có ý nghĩa:** số liệu theo đời/chi có ngay; còn lại cần B1/B2 và dữ liệu thật.

### J. Xuất và in ấn (PDF §10) — **J1: M · J2: L**
- **J1:** xuất PNG/PDF của **khung nhìn hiện tại hoặc một chi** (vẽ lại SVG → ảnh); chạy trong trình duyệt.
- **J2 — "Quyển phả":** tạo PDF nhiều trang phía máy chủ (bìa hoành phi, mục lục, mỗi đời một phần với hồ sơ và ảnh, sử
  ký, sơ đồ cây khổ lớn). Cần nhúng font tiếng Việt, thử in thật. Làm sau cùng vì dùng mọi dữ liệu ở trên.

### K. Nền tảng media (dùng chung) — **M**
- Tổng quát hoá việc tải ảnh đại diện hiện có thành bảng `media` (ảnh/tài liệu, mô tả, người tải, gắn vào thành viên/địa điểm/
  bài viết), giới hạn dung lượng, **ảnh thu nhỏ** (Pillow), thư viện ảnh trên hồ sơ ("Tư liệu & bút tích" ở bản
  thiết kế). Lưu ở đĩa như hiện nay; có thể chuyển sang MinIO như `fashion-web` nếu dung lượng lớn.

### L. Riêng tư & vận hành an toàn (PDF §9) — **M**
- **Riêng tư từng trường:** mỗi trường nhạy cảm (điện thoại, email, nơi ở, ảnh) có mức xem: admin / thành viên / công
  khai; một lớp "che dữ liệu" theo vai trò người xem trước khi trả API.
- **Khoá cả website:** chính là chế độ riêng tư + tài khoản (khuyến nghị) thay vì một mật khẩu chung; có thể thêm "mã
  truy cập chung" nếu bạn muốn đơn giản hơn.
- **Vận hành:** giới hạn tần suất đăng nhập/đăng ký, tiêu đề bảo mật, hướng dẫn HTTPS sau reverse proxy,
  **sao lưu Postgres + thư mục ảnh định kỳ và diễn tập khôi phục**, xuất toàn bộ dữ liệu (JSON/CSV).

### M. Menu trái và khung điều hướng (Stitch) — **S**
Các mục: *Cây gia phả* (đã có) · *Sử ký dòng họ* · *Lăng mộ & nhà thờ* · *Lịch giỗ & sự kiện* · *Thống kê & phân tích* ·
(admin) *Yêu cầu* · *Quản trị*. Mỗi mục **chỉ xuất hiện khi tính năng đã sẵn sàng** (không để link chết). Trên điện thoại
chuyển thành ngăn kéo.

---

## 5. Thứ tự thực hiện

```
GĐ0 hotfix ─► GĐ1 phân quyền ─► GĐ2 dữ liệu + nhập liệu ─► GĐ3 tìm kiếm + chi/phái
                                        │                          │
                                        ▼                          ▼
                                 GĐ4 yêu cầu cập nhật ─► GĐ5 lịch giỗ ─► GĐ6 media + lăng mộ ─► GĐ7 sử ký
                                                                                      │
                                                          GĐ8 thống kê ◄──────────────┘  ─► GĐ9 thiệp mời ─► GĐ10 xuất/in ─► GĐ11 họ hàng + riêng tư nâng cao
```

| GĐ | Nội dung | Độ lớn | Lý do xếp ở đây | Sau giai đoạn này bạn có |
|---|---|---|---|---|
| **0** | Hotfix: **đóng đăng ký tự do** (cờ cấu hình), sao lưu Postgres + ảnh, tài liệu khôi phục | S | Lỗ hổng 2.1 và dữ liệu không thể làm lại | Gia phả không bị người lạ sửa/xoá; có bản sao lưu |
| **1** | **A**: vai trò, duyệt/mời người dùng, cài đặt công khai/riêng tư, trang Quản trị, **M** khung menu | M | Mọi thứ sau đều cần kiểm tra quyền | Chia sẻ link cho họ hàng mà an toàn: họ xem, chỉ admin sửa |
| **2** | **B1 + B2 + B3**: ngày đầy đủ/âm lịch, quê quán, liên hệ, thứ tự anh em, mẹ/con nuôi, **bảng nhập liệu hàng loạt**, CSV, tách "N vị" | L | Dữ liệu hiện chỉ có tên; mô hình dữ liệu nên chốt sớm (đổi sau rất tốn) | Điền được năm sinh/mất/giới tính nhanh cho hàng trăm người |
| **3** | **C + D** + thống kê cơ bản (đếm theo đời/chi) | M + M | 700+ người cần tìm/lọc tốt; chi/phái định hình cách lọc và màu | Tìm không dấu, lọc đời/chi, màu theo chi, trang chi |
| **4** | **E**: yêu cầu cập nhật + duyệt + nhật ký thay đổi | L | Cách để **cả họ cùng điền dữ liệu** (họ mới biết ngày giỗ) | Họ hàng đóng góp, admin duyệt, có lịch sử thay đổi |
| **5** | **F1–F3**: lịch giỗ âm lịch, sự kiện, .ics, nhắc email | M + S + M | Giá trị đặc trưng nhất của gia phả; cần ngày mất từ GĐ2/4 | **Nhắc giỗ tự động**, lịch trên điện thoại |
| **6** | **K + G**: media nền tảng + lăng mộ & nhà thờ + bản đồ | M + M | Cần hạ tầng ảnh trước khi có địa điểm/sử ký | Bản đồ mộ phần và nhà thờ, thư viện ảnh |
| **7** | **H**: sử ký, tộc ước, bài đệm, dòng thời gian | M–L | Dùng media; cần người soạn nội dung | Kho sử ký của dòng họ |
| **8** | **I**: thống kê đầy đủ + độ đầy đủ dữ liệu | M | Chỉ thật sự hữu ích khi dữ liệu đã nhiều | Bảng điều khiển số liệu |
| **9** | **F4**: thiệp mời online + phản hồi | M | Tiện ích sự kiện, làm sau khi lịch ổn định | Gửi thiệp họp họ/giỗ tổ qua link |
| **10** | **J1 → J2**: xuất PNG/PDF, rồi quyển phả | M → L | Dùng mọi dữ liệu trước đó | In được quyển phả |
| **11** | **B4 + B5** + riêng tư từng trường + hardening | M + M | Hoàn thiện; riêng tư từng trường cần sớm hơn nếu bật chế độ công khai | Xem quan hệ họ hàng, cây ngang, ẩn thông tin nhạy cảm |

**Nếu chọn D1 = nhiều gia đình:** thêm một giai đoạn L ("đa gia đình") **ngay trước GĐ1**.
**Nếu muốn mở công khai sớm:** kéo phần "riêng tư từng trường" của GĐ11 lên cùng GĐ1/GĐ2 (vì GĐ2 thêm điện thoại/email).

## 6. Không đề xuất làm (hoặc để rất sau)
- Gửi nhắc qua Zalo/SMS tự động (có phí, cần tài khoản doanh nghiệp).
- Trình soạn WYSIWYG nặng cho sử ký (Markdown + xem trước là đủ).
- Chữ Hán Nôm cho tên húy (cần font và nhập liệu riêng); Unicode vẫn lưu được nếu sau này cần.
- Đa ngôn ngữ giao diện (hiện chỉ tiếng Việt).

## 7. Việc tiếp theo tôi đề xuất
1. Bạn trả lời **D1 → D7** (hoặc gật đầu với đề xuất của tôi).
2. Tôi làm ngay **GĐ0** (đóng đăng ký + sao lưu) vì nhỏ và đang có rủi ro thật.
3. Rồi viết thiết kế chi tiết + kế hoạch từng bước cho **GĐ1**, như đã làm với giao diện Heritage.
