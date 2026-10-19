# Chạy bằng Docker

Có 3 file compose, mỗi file một mục đích:

| File | Dùng để | Có gì |
|---|---|---|
| `docker-compose.yml` (thư mục gốc) | Chạy **đủ bộ** như khi deploy | Postgres + `genealogy-api` + `genealogy-web` |
| `genealogy-api/docker-compose.yml` | Phát triển và **chạy test** backend | Postgres dev, Postgres test (tmpfs), API |
| `genealogy-web/docker-compose.yml` | Chạy **riêng frontend** | web (bản production) hoặc web-dev (hot reload) |

Mô hình theo `../fashion-web/docker-compose.yml` (mạng public/private, healthcheck,
giới hạn log, biến bắt buộc), bỏ phần MinIO/GHCR vì dự án này lưu ảnh đại diện trên
đĩa và chưa có CI đẩy image.

## 1. Chạy đủ bộ (thư mục gốc)

```bash
cp .env.example .env      # điền POSTGRES_PASSWORD và JWT_SECRET — thiếu là compose báo lỗi
docker compose up --build -d
```

- Mở http://127.0.0.1:3000 trên chính máy này, hoặc `http://<IP máy>:3000` từ máy khác (đổi cổng bằng `FRONTEND_PORT`).
- **Nhiều họ (gia phả) trên một hệ thống.** Mỗi họ có **cây riêng**, **admin riêng**, người dùng và cài đặt riêng; dữ liệu
  các họ **tách biệt hoàn toàn**. Vai trò: **superadmin** (chủ hệ thống, không thuộc họ nào, có quyền ở mọi họ),
  **admin** (quản trị đúng một họ), **thành viên** (chỉ xem họ của mình). Không có đăng ký công khai: superadmin đầu tiên tạo bằng dòng lệnh
  (xem "Tạo tài khoản quản trị tối cao đầu tiên"), admin của họ do superadmin tạo, thành viên do admin tạo hoặc mời bằng link. Admin vào mục **Quản trị**
  để tạo/mời người dùng và đổi cài đặt (xem: riêng tư/công khai) **của họ mình**.
- **Trang cho superadmin**: `http://<máy>:3000/he-thong` (mục "Các họ" ở menu trái) — xem danh sách họ, tạo họ kèm admin (mật khẩu tạm hiện một lần), đổi
  tên/slug, và chuyển sang xem/quản trị một họ (có ô chọn họ ở thanh trên khi có từ hai họ). Dòng lệnh (mục "Quản lý các họ") vẫn dùng được, và là cách duy nhất để đặt
  thêm superadmin. **Ảnh đại diện chỉ hiện với người được xem họ đó** (đăng nhập đúng họ, superadmin, hoặc họ đang công khai).
- Lần đầu mất vài phút để build image. Mỗi lần API khởi động nó tự chạy
  `alembic upgrade head`, nên schema luôn mới.
- **Chỉ web publish port ra máy chủ** (mặc định `0.0.0.0`; trên server thật đặt `FRONTEND_BIND=127.0.0.1` rồi để reverse proxy trỏ vào). API và Postgres nằm
  trong mạng nội bộ; browser chỉ nói chuyện với web, web proxy `/api/*` và
  `/uploads/*` sang API. Muốn xem docs của API thì dùng compose của backend (mục 2).
- Mạng: `private_net` (`internal: true`, không ra Internet) cho db + api + web;
  `public_net` cho web + api (API cần ra Internet để gửi mail SMTP quên mật khẩu).
- Dữ liệu nằm trong 2 volume `postgres_data` và `uploads_data`, còn nguyên sau
  `docker compose down`. Xoá sạch: `docker compose down -v`.
- Xem trạng thái: `docker compose ps` (cột health); log: `docker compose logs -f api`.

### Đặt sau reverse proxy HTTPS

Đặt `FRONTEND_BIND=127.0.0.1` (để chỉ proxy gọi được), cho nginx của máy chủ trỏ vào `127.0.0.1:${FRONTEND_PORT}`, rồi trong `.env`:

```
FRONTEND_BIND=127.0.0.1
FRONTEND_ORIGIN=https://<domain>
COOKIE_SECURE=true
```

### Bảo mật & vận hành

- **HTTPS**: web chỉ nói HTTP; HTTPS và HSTS là việc của reverse proxy (HSTS qua HTTP là sai nên API/web không tự gửi). Ví dụ nginx:

  ```nginx
  server {
    listen 443 ssl;
    server_name gia-pha.example.com;
    # ssl_certificate ... (certbot/Caddy tự lo)
    client_max_body_size 25m;                      # ảnh/tài liệu tải lên
    proxy_read_timeout 300s;                       # quyển phả PDF của họ lớn soạn lâu
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $remote_addr;   # GHI ĐÈ, không nối thêm: để API tin được địa chỉ này
      proxy_set_header X-Forwarded-Proto $scheme;
      add_header Strict-Transport-Security "max-age=31536000" always;
    }
  }
  ```
  rồi `.env`: `FRONTEND_BIND=127.0.0.1`, `FRONTEND_ORIGIN=https://gia-pha.example.com`, `COOKIE_SECURE=true`, **`TRUSTED_PROXY_HOPS=1`**.
- **Giới hạn tần suất** (`RATE_LIMIT_ENABLED`, mặc định bật): đăng nhập (20 lần/5 phút mỗi địa chỉ; **8 lần sai/5 phút mỗi tài khoản**),
  quên mật khẩu (5/giờ), link mời (30/5 phút), trả lời thiệp (40/10 phút) → HTTP 429. Đo thực tế: proxy `/api` của Next.js **không** chuyển địa chỉ người
  truy cập sang API, nên khi chưa có nginx phía trước, mọi người "cùng một địa chỉ" và giới hạn theo địa chỉ được nới ×5 để không chặn cả nhà
  (giới hạn theo tài khoản mới là thứ chặn đoán mật khẩu). Bộ đếm nằm trong bộ nhớ của một tiến trình API (compose chạy đúng một) — chạy nhiều bản API thì mỗi bản đếm riêng.
- **Header bảo mật**: API gửi `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; web gửi thêm `Permissions-Policy` và
  (bản production) `Content-Security-Policy`.
- **Sao lưu/khôi phục**: `scripts/backup-nightly.sh` (cron mỗi đêm, chép ra ngoài máy qua `backup.conf`), `scripts/backup.sh`, `scripts/restore.sh`, hướng dẫn và nhật ký diễn tập trong [docs/SAO-LUU.md](docs/SAO-LUU.md). `.env` không nằm trong bản sao lưu: tự cất riêng.
- **Xuất toàn bộ dữ liệu**: trang **Xuất bản** (admin) → "Tải dữ liệu JSON" (`GET /api/export/data.json`; không có mật khẩu/token). Cũng ở đó: "Tải GEDCOM" (`GET /api/export/data.ged`, GEDCOM 5.5.1 để mở trong Ancestry/MyHeritage/Gramps; chỉ có người, vợ chồng, con — không ảnh/tài liệu/chi phái; ngày âm lịch giữ năm + ghi chú). Chỉ xuất, chưa có nhập.

### Tạo tài khoản quản trị tối cao đầu tiên (superadmin)

**Không có đăng ký công khai.** Tài khoản đi vào hệ thống bằng đúng ba cửa: (1) bạn, chủ máy chủ, tạo **superadmin** bằng dòng lệnh; (2) superadmin tạo **một họ cùng admin đầu tiên** của họ đó; (3) admin tạo tài khoản hoặc gửi **link mời** gắn với từng người trong cây (xem bên dưới). Người lạ vào được trang web cũng không tự tạo được tài khoản nào.

Lần cài đầu tiên (chưa có tài khoản nào), chạy một lần:

```bash
docker compose exec api python scripts/manage.py create-user --role superadmin --email ban@example.com --name "Tên bạn" --password 'mật-khẩu-dài-ít-nhất-8-ký-tự'
```

(bỏ `--password` thì hệ thống tự sinh và in ra một lần). Đăng nhập bằng tài khoản đó: chưa có họ nào nên trang chủ đưa thẳng tới **Quản trị nền tảng** (`/he-thong`) để tạo họ đầu tiên.

Admin của từng họ do superadmin tạo ở trang **Các họ** (`/he-thong`): tạo họ mới kèm admin đầu tiên (mật khẩu hiện một lần). Admin cũng là một thành viên của họ: sau khi nhập liệu xong, admin mở hồ sơ người của mình trong cây và bấm **"Đây là tôi"** (không cần ai duyệt).

**Mời người trong họ**: admin mở hồ sơ một người → **"Mời người này"** → sao chép link (hiện **một lần**, hiệu lực 14 ngày, mỗi người một link; tạo link mới thì link cũ hết tác dụng). Người nhận mở link, đặt email và mật khẩu, vào thẳng cây ở đúng vị trí của mình ("Hồ sơ của tôi"). Danh sách link và nút **Thu hồi** nằm ở **Quản trị → Người dùng**.

### Quản trị tối cao (superadmin): ai làm được gì

- **Superadmin** là chủ nền tảng (không thuộc họ nào), vào được mọi họ. **Admin** chỉ quản trị đúng một họ; **thành viên** chỉ xem và đề xuất. Không ai trong họ thấy hay đụng được superadmin.
- **Tạo superadmin đầu tiên**: bằng dòng lệnh `create-user` (xem trên). Muốn cấp thêm quyền superadmin: `docker compose exec api python scripts/manage.py set-role --email ... --role superadmin` (trang web cố ý không cấp được).
- **Quên mật khẩu superadmin**: `docker compose exec api python scripts/manage.py set-password --email ...` (tự sinh và in ra một lần; hoặc thêm `--password`). Không cần email.
- Trang **Quản trị nền tảng** (`/he-thong`, menu "Các họ"): màn hình đầu là **Cần làm** (họ không còn admin hoạt động, họ đang tạm ngưng, bộ nhắc việc ngừng chạy, chưa sao lưu, ổ đĩa sắp đầy) cùng số liệu cả hệ thống.
  - **Các họ**: tạo họ kèm admin đầu tiên (mật khẩu hiện một lần), đổi tên/đường dẫn, **Tạm ngưng** (mọi người của họ bị đăng xuất ngay và không đăng nhập được; link lịch, thiệp mời, khách xem ngừng; không mất dữ liệu) và **Kích hoạt lại**, **Xoá họ** (chỉ họ đang tạm ngưng, phải gõ lại đường dẫn; xoá hẳn dữ liệu và ảnh, không khôi phục được — nên tải JSON của họ trước).
  - **Quản trị viên** của từng họ: thêm admin mới, nâng một người của họ lên admin, vô hiệu hoá/kích hoạt lại (luôn còn ít nhất một), đặt mật khẩu mới (hiện một lần).
  - **Nhật ký nền tảng**: những gì superadmin đã làm với các họ, kể cả mỗi lần **vào một họ để hỗ trợ** (nút "Xem cây"/"Quản trị" và ô chọn họ ở đầu trang đều ghi lại trước khi chuyển). Những gì superadmin sửa *bên trong* một họ nằm trong nhật ký của họ đó, dưới tên superadmin.
  - **Hệ thống**: cơ sở dữ liệu, bộ nhắc việc (lần chạy gần nhất), email đã cấu hình chưa, ổ đĩa, dung lượng ảnh, và tình trạng sao lưu đầy đủ (kể cả tổng số người cả hệ thống). Sao lưu/khôi phục vẫn làm bằng script trên máy chủ.

### Quyền riêng tư theo trường

Trang **Quản trị** (admin) → "Quyền riêng tư": mỗi trường (điện thoại, email, nơi ở, ghi chú, nơi an nghỉ, ảnh, quê quán) đặt mức xem
**Chỉ admin / Thành viên / Công khai** (công khai = cả khách vào cây đang mở công khai). Mặc định giữ đúng như trước GĐ11.

### Dùng image build sẵn thay vì build tại server

Mỗi service có cả `build:` lẫn `image:`. Khi CI build + push lên registry, đặt trong
`.env` `API_IMAGE`, `API_IMAGE_TAG`, `WEB_IMAGE`, `WEB_IMAGE_TAG`, rồi
`docker compose pull && docker compose up -d`. Ghim tag để rollback.

### Lưu ý khi cấu hình

- `POSTGRES_PASSWORD` dùng ký tự nào cũng được: API nhận `POSTGRES_HOST/USER/PASSWORD/DB`
  riêng và tự dựng URL kết nối (có mã hoá). Chỉ cần bọc trong nháy đơn trong `.env` nếu mật
  khẩu có `$`, `#`, dấu nháy hay khoảng trắng.
- Postgres 18 mount volume ở `/var/lib/postgresql` (không phải `.../data` như bản 16);
  mount sai chỗ sẽ crash-loop. Volume của bản compose cũ (Postgres 16, tên `db-data`)
  **không dùng lại được** — Postgres không mở thẳng dữ liệu khác major version; nếu có dữ
  liệu cũ cần `pg_dump` ra rồi nạp vào.
- `API_BASE_URL` của web là **build arg**: với `output: 'standalone'`, `rewrites()` bị
  đóng băng vào image lúc `next build`. Compose gốc đã đặt `http://api:8000`; đổi thì phải
  `docker compose up --build`.
- Mạng của server có MTU nhỏ hơn 1500 (vd 1492) thì đặt `DOCKER_NETWORK_MTU=1492`.

### Nhập liệu hàng loạt (trang **Nhập liệu**, dành cho admin)

Mở `http://<máy>:3000/nhap-lieu`: bảng sửa trực tiếp từng ô (tự lưu), lọc theo đời/nhánh/"thiếu thông tin", thanh tiến độ, nút
**Tách** cho dòng gộp kiểu "Vô Danh 3 Vị", **Xuất CSV** / **Nhập CSV** (mở bằng Excel; dòng có cột `id` là cập nhật, không có `id`
là thêm con; ô trống = giữ nguyên, ô `-` = xoá; sai một dòng thì cả file không được nhập, có bước xem thử trước khi áp dụng).
Cập nhật bản đang chạy: `docker compose up --build -d` (migration tự chạy khi API khởi động).

### Thiệp mời online

- Trong **Lịch giỗ**, chọn ngày có sự kiện → **Thiệp mời** → tạo thiệp cho ngày đó (kèm lời mời). Bạn nhận **một link chung** để dán vào nhóm Zalo/email, hoặc **link riêng** cho từng người (nhập mỗi tên một dòng).
- Người nhận mở link **không cần đăng nhập**: thấy ngày dương + âm lịch, địa điểm (có nút chỉ đường), lời mời, rồi chọn *Tham dự / Không / Chưa chắc* và số người. Họ sửa được câu trả lời bằng cách mở lại link. Họ **không thấy tên người khác**, chỉ thấy tổng.
- Admin xem ai đã trả lời, tổng số người đến, **tải danh sách CSV**, đóng nhận trả lời hoặc đặt hạn chót. Link là bí mật: ai có link đều trả lời được; xoá thiệp thì link chết.

### Thống kê

- **Thống kê** (`/thong-ke`): nhân khẩu, số đời, người mỗi đời và mỗi chi, giới tính, còn sống/đã mất, tuổi thọ, thập niên sinh, số con, dòng dài nhất, chữ đệm và tên phổ biến. **Bấm vào một cột để xem danh sách người tương ứng** (mở trang Tìm kiếm đã lọc sẵn).
- **Độ đầy đủ dữ liệu**: bao nhiêu % người đã có giới tính, năm sinh, quê quán, ảnh…; admin bấm **Bổ sung** để mở bảng Nhập liệu đã lọc sẵn những người còn thiếu.

### Sử ký dòng họ

- **Sử ký** (`/su-ky`): bài viết viết bằng Markdown (nguồn gốc, thế thứ, **tộc ước/gia huấn**, nhân vật, sự kiện), kèm ảnh, ghim bài quan trọng, bản nháp chỉ quản trị viên thấy. Người được nhắc tới trong bài sẽ có mục “Được nhắc trong…” ở hồ sơ. **Dòng thời gian** của họ và **bài đệm** (chữ đệm từng đời; khi thêm con, quản trị viên được gợi ý chữ đệm của đời đó).
- Thành viên đọc được bài đã đăng; khách chỉ đọc khi họ để chế độ công khai (khách thấy chữ, không thấy ảnh). HTML trong bài không bao giờ được chạy.
- **Điện thoại**: nút ☰ ở góc trái thanh đầu trang mở menu đầy đủ.

### Ảnh, tài liệu và địa điểm

- **Tư liệu & bút tích**: trong hồ sơ mỗi người (và mỗi địa điểm), admin tải ảnh JPEG/PNG/WebP hoặc PDF (≤ 10 MB). Hệ thống kiểm tra **nội dung file** (đổi đuôi không qua được) và tự tạo ảnh thu nhỏ. File nằm trong volume `uploads_data` (thư mục `media/`) — nhớ sao lưu cùng database. **Chỉ người đã đăng nhập vào đúng họ mới xem được**, kể cả khi họ để chế độ công khai.
- **Địa điểm** (`/dia-diem`): nhà thờ họ, từ đường, lăng mộ, nghĩa trang, đền, có bản đồ OpenStreetMap (trình duyệt cần ra Internet để tải bản đồ nền), nút **Chỉ đường** (Google Maps), người trông coi, lưu ý khi thăm, danh sách người an nghỉ. Trong hồ sơ, admin chọn **Nơi an nghỉ** và vị trí mộ.
- **Chuyển dữ liệu cũ**: nếu trước đây bạn nhập chữ vào ô “Mộ phần”, vào `/dia-diem` → *Chuyển từ ô “Mộ phần” cũ* → *Xem trước* → *Áp dụng*: hệ thống gom các ô giống nhau thành địa điểm. Ô cũ được giữ nguyên.

### Lịch giỗ, sự kiện, link lịch điện thoại, nhắc việc

- **Lịch giỗ** (`/lich`): luôn hiện cả ngày dương và ngày âm. **Giỗ tự tính** từ ngày mất âm lịch của từng người (không lưu trùng); người chỉ có ngày mất **dương lịch không có năm** thì chưa tính được và được báo ở cuối lịch. Admin thêm **sự kiện** (họp họ, cưới hỏi, giỗ Tổ…) theo âm hoặc dương, một lần hoặc lặp hằng năm.
- **Link lịch cho điện thoại**: admin bấm *Bật link lịch*, cả họ chép link rồi “Đăng ký lịch qua URL” trong Google/Apple Calendar. Đây là **link bí mật** (ai có link xem được lịch giỗ); *Tạo link mới* cắt quyền các điện thoại cũ, *Tắt link* gỡ hẳn.
- **Nhắc việc**: service **`worker`** trong `docker-compose.yml` chạy mỗi giờ, tạo thông báo (chuông trên thanh đầu trang) trước giỗ/sự kiện 7 và 1 ngày — mỗi người tự chọn ở trang lịch — và gửi email nếu đã đặt `SMTP_HOST`. Chạy lại nhiều lần không bị nhắc trùng. Xem log: `docker compose logs -f worker`; chạy tay một lần: `docker compose exec worker python scripts/run_reminders.py`.
- Âm lịch tính theo **múi giờ Việt Nam (UTC+7)**, không dùng bảng của lịch Trung Quốc (hai bên lệch nhau ở vài năm). Nếu gặp năm nghi ngờ, đối chiếu với lịch vạn niên của gia đình.

### Yêu cầu cập nhật và nhật ký thay đổi

- Thành viên **không sửa trực tiếp**: họ mở hồ sơ một người → **Đề xuất chỉnh sửa** (sửa thông tin / thêm con / báo sai). Admin vào **Yêu cầu** xem bản cũ – bản mới rồi **Duyệt** (áp dụng ngay) hoặc **Từ chối** (kèm lý do). Người gửi xem kết quả ở cùng trang.
- **Nhật ký** (`/nhat-ky`, admin): mọi thay đổi trên cây — ai, lúc nào, từ giá trị nào sang giá trị nào (kể cả nhập CSV, tách dòng, chi phái, duyệt yêu cầu).
- **Email báo** (admin khi có yêu cầu mới, người gửi khi có kết quả) chỉ chạy khi đã đặt `SMTP_HOST` trong `.env`; không có SMTP thì vẫn dùng bình thường qua huy hiệu số trên menu.

### Tìm kiếm, chi phái, thống kê

- **Tìm kiếm** (`/tim-kiem`, hoặc "Tìm nâng cao" trong ô tìm trên cùng): gõ không dấu cũng được, tìm cả vợ/chồng, lọc theo đời/chi/năm sinh/quê/giới tính/còn sống-đã mất, gợi ý khi gõ sai.
- **Chi phái** (`/chi-phai`): admin tạo chi bằng cách chọn **trưởng chi**; cả nhánh con cháu của người đó thuộc chi (chi con ghi đè chi cha). Cây hiện màu chi trên thẻ, kèm số liệu từng chi.
- Tìm kiếm làm trong bộ nhớ nên **không cần cài thêm extension Postgres** (`unaccent`, `pg_trgm`). Cập nhật: `docker compose up --build -d` (migration tự chạy).

### Nạp cây gia phả từ file JSON

```bash
docker compose cp path/to/tree.json api:/tmp/tree.json
docker compose exec api python scripts/seed_members.py /tmp/tree.json
```

### Quản lý các họ bằng dòng lệnh (song song với trang `/he-thong`)

Chạy trong container API (hoặc `uv run python scripts/manage.py ...` trong `genealogy-api/`):

```bash
M="docker compose exec -T -w /app api python scripts/manage.py"
$M list                                                                   # các họ và người dùng
$M create-tree --name "Nguyễn Tộc Làng Phú Ốc" --slug phu-oc              # tạo họ (slug: chữ thường, số, gạch ngang)
$M rename-tree --slug phu-oc --name "Tên mới" --new-slug ten-moi          # đổi tên/slug
$M create-user --email a@x.com --name "Tên" --role admin --tree phu-oc    # tạo admin của họ (bỏ --password: tự sinh, in một lần)
$M create-user --email me@x.com --name "Tôi" --role superadmin            # superadmin không thuộc họ nào
$M set-role --email a@x.com --role superadmin                             # đổi vai trò (admin/member cần --tree)
```

- Mỗi họ có link riêng: **`http://<máy>:3000/t/<slug>`**. Mở link đó một lần là trình duyệt nhớ họ nào (cookie) để khách xem
  (nếu họ đó công khai) và biết đang đăng nhập vào họ nào. Nếu hệ thống chỉ có **một** họ thì không cần link.
- Nạp dữ liệu vào một họ: `docker compose exec api python scripts/seed_members.py /tmp/tree.json --tree-slug phu-oc`.
- Đã có sẵn dữ liệu từ bản cũ? Migration chuyển hết vào một họ `default`; đổi tên bằng `rename-tree` và đặt superadmin bằng `set-role`.

## 2. Backend riêng và chạy test (`genealogy-api/`)

```bash
cd genealogy-api
docker compose up -d --wait db-test    # Postgres cho test (tmpfs, 127.0.0.1:55432)
uv run pytest                          # test chạy trên Postgres thật, không dùng SQLite
docker compose down                    # dọn (db-test mất dữ liệu — đúng ý)

docker compose up -d --wait db         # Postgres dev, 127.0.0.1:15432, volume postgres_data
docker compose up --build api          # hoặc chạy luôn API trong Docker (127.0.0.1:8000/docs)
```

- Test dựng schema bằng chính các migration (`alembic upgrade head`), xoá sạch bảng
  trước mỗi test, và **từ chối chạy trên database có tên không kết thúc bằng `_test`**.
  Đổi đích bằng biến `TEST_DATABASE_URL`.
- **Một file `.env` cho cả hai cách chạy**: `genealogy-api/.env` (copy từ `.env.example`) vừa được compose đọc để thay `${...}`,
  vừa được app chạy ngoài Docker (`uv run uvicorn`, `alembic`, `scripts/*.py`) đọc. Các biến `POSTGRES_*`, `JWT_SECRET`... trùng tên
  với `../.env.example` (bản deploy). Trong Docker, `api` nối thẳng `db:5432`; ngoài Docker, app nối `127.0.0.1:${POSTGRES_PORT}`
  (mặc định 15432). Biến môi trường của tiến trình luôn thắng file `.env`.
- Không dùng cổng 5432 (hay bị Postgres cài sẵn trên máy chiếm): dev 15432, test 55432;
  đổi bằng `POSTGRES_PORT` / `TEST_DB_PORT` / `API_PORT`.
- Service `api` còn tham gia network `genealogy_dev` (tên cố định) để compose của
  frontend gọi được `http://api:8000`.

## 3. Frontend riêng (`genealogy-web/`)

```bash
(cd genealogy-api && docker compose up -d --build --wait api)   # API trước
cd genealogy-web
docker compose up --build web                # bản production, 0.0.0.0:3000 (đổi bằng WEB_BIND)
docker compose --profile dev up web-dev      # bản dev, hot reload (lần đầu `npm ci` mất vài phút)
```

- Mặc định web gọi API qua network `genealogy_dev` bằng `http://api:8000`.
- API chạy ngoài Docker (uvicorn trên máy)? Đặt `API_BASE_URL=http://host.docker.internal:8000`
  và cho uvicorn nghe `0.0.0.0`: port chỉ bind `127.0.0.1` thì container không với tới được.
  Với bản production phải build lại sau khi đổi (build arg).
- Đổi `package-lock.json` ở chế độ dev: `docker compose --profile dev run --rm web-dev npm ci`.

## Ghi chú

- Thư mục gốc `gia_pha/` là một git repo, cấu trúc giống `fashion-web`: `genealogy-api` và
  `genealogy-web` là **submodule** (mỗi cái giữ lịch sử riêng; repo gốc chỉ ghi commit đang
  dùng). `.gitmodules` đang để URL tạm `./genealogy-api` / `./genealogy-web` vì hai repo
  chưa có remote — khi đẩy lên GitHub/GitLab nhớ đổi URL thật:
  `git submodule set-url genealogy-api git@...:org/genealogy-api.git` (tương tự cho web),
  rồi commit `.gitmodules`. Sau khi sửa code trong một submodule, vào thư mục đó commit,
  rồi ở gốc `git add genealogy-api` để "bump" commit mới.
- `.gitignore` gốc đang chặn tạm `genealogy-legacy/` (bản Spring Boot cũ, chứa mật khẩu
  DB/JWT thô trong `application.properties`, chưa phải git repo) và các ảnh `*.png` /
  `*.jpeg` rời ở gốc — xoá các dòng "TẠM" khi đã dọn.
- `.env` (gốc) không được commit.
