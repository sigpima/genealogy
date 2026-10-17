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
  **admin** (quản trị đúng một họ), **thành viên** (chỉ xem họ của mình). Tài khoản **đầu tiên** đăng ký trên hệ thống
  trống tự thành superadmin (và một họ mặc định được tạo). Người đăng ký sau vào họ họ chọn (xem `/t/<tên-họ>` bên
  dưới) và mặc định **chờ admin của họ đó duyệt**. Admin vào mục **Quản trị** để duyệt/tạo người dùng và đổi cài đặt
  (đăng ký: cần duyệt/mở/đóng; xem: riêng tư/công khai) **của họ mình**.
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
  (nếu họ đó công khai) và đăng ký đúng họ. Nếu hệ thống chỉ có **một** họ thì không cần link.
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
