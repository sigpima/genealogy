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

- Mở http://127.0.0.1:3000 trên chính máy này, hoặc `http://<IP máy>:3000` từ máy khác (đổi cổng bằng `FRONTEND_PORT`). Đăng ký tài khoản đầu tiên ngay trên web.
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

### Nạp cây gia phả từ file JSON

```bash
docker compose cp path/to/tree.json api:/tmp/tree.json
docker compose exec api python scripts/seed_members.py /tmp/tree.json
```

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
- Không dùng cổng 5432 (hay bị Postgres cài sẵn trên máy chiếm): dev 15432, test 55432;
  đổi bằng `DB_PORT` / `TEST_DB_PORT` / `API_PORT`.
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
