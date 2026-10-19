# Sao lưu và khôi phục

Dữ liệu của dòng họ nằm ở **hai chỗ**: database Postgres (volume `postgres_data`) và thư mục ảnh/tài liệu (volume `uploads_data`).
Sao lưu phải lấy cả hai — chỉ có database thì mất hết ảnh, chỉ có ảnh thì mất hết cây.

## Sao lưu

```bash
scripts/backup.sh                      # → ./backups/gia-pha-YYYYmmdd-HHMMSS/ (giữ 14 bản mới nhất)
BACKUP_DIR=/mnt/usb KEEP=30 scripts/backup.sh
```

Mỗi bản gồm `database.dump` (pg_dump định dạng custom), `uploads.tar.gz` và `MANIFEST.txt` (số người, số file, checksum SHA-256).
Script chỉ **đọc** database (không sửa gì), không in mật khẩu, và ghi vào thư mục `.partial` rồi mới đổi tên — nên một lần
chạy dở không để lại bản trông như đủ mà hỏng.

**Chạy tự động mỗi đêm:** `scripts/backup-nightly.sh` gọi `backup.sh`, rồi chép bản mới ra **ngoài máy** nếu bạn đã cấu hình, và ghi `backups/backup.log`
(mỗi dòng có giờ; có "LỖI" nghĩa là đêm đó chưa an toàn). Máy này đã đặt cron `15 2 * * *` (xem `crontab -l`; muốn tắt: `crontab -e` rồi xoá dòng đó).

Chỗ lưu ngoài máy khai trong file `backup.conf` ở thư mục gốc dự án (file này nằm trong `.gitignore`, không bị commit):

```
OFFSITE_DIR=/mnt/usb/gia-pha         # một ổ khác / ổ USB / thư mục đã đồng bộ lên đám mây
RCLONE_REMOTE=b2:ten-bucket/gia-pha  # hoặc remote của rclone (Backblaze B2, Google Drive, S3...) đã `rclone config` sẵn
KEEP=30                              # số bản giữ trên máy (mặc định 14)
```

Có thể đặt cả hai. Script chỉ **chép lên**, không bao giờ xoá bên đó. Chưa cấu hình thì mỗi đêm vẫn sao lưu trong máy nhưng nhật ký ghi "CẢNH BÁO" — bản sao cùng ổ không cứu được khi hỏng ổ.
Đặt cron ở máy khác: `15 2 * * * cd /đường/dẫn/gia_pha && scripts/backup-nightly.sh >/dev/null 2>&1`.

**File `.env` KHÔNG nằm trong bản sao lưu** (nó chứa mật khẩu): hãy cất một bản trong trình quản lý mật khẩu. Mất `.env` không mất dữ liệu — chỉ cần `POSTGRES_PASSWORD`/`JWT_SECRET` mới (đổi `JWT_SECRET` làm mọi người đăng nhập lại), nhập lại cấu hình email nếu có.

**Quan trọng:** một bản sao lưu nằm cùng ổ đĩa với dữ liệu thì không cứu được khi hỏng ổ. Hãy chép `BACKUP_DIR` sang chỗ khác
(ổ USB, máy khác, dịch vụ lưu trữ). Bản sao lưu chứa dữ liệu thật (email, băm mật khẩu, số điện thoại) — giữ như giữ tài liệu mật;
thư mục `backups/` đã nằm trong `.gitignore`.

Ngoài ra trang **Xuất bản** (admin) có nút tải toàn bộ dữ liệu dạng JSON — bản đọc được bằng mắt, tiện mang đi nơi khác,
nhưng KHÔNG thay cho sao lưu (không có ảnh, không có tài khoản đăng nhập).

**Xem tình trạng ngay trong web:** Quản trị → **Sao lưu** (và việc "Chưa có bản sao lưu…" trên trang Cần làm) cho biết bản gần nhất lúc nào, bao lâu rồi, dung lượng bao nhiêu. Trang này chỉ *đọc* thư mục `backups/` (compose gắn vào API ở chế độ chỉ đọc) và cố ý không có nút tạo/tải bản sao lưu — mỗi bản chứa dữ liệu của mọi họ trên máy chủ. Hãy `mkdir -p backups` trước khi `docker compose up` để thư mục thuộc user của bạn.

## Khôi phục

**Luôn diễn tập trước** — bản sao lưu chưa từng khôi phục thử thì chưa chắc dùng được:

```bash
scripts/restore.sh backups/gia-pha-20261019-021500                          # vào database mới "gia_pha_restore"
scripts/restore.sh backups/gia-pha-20261019-021500 --uploads-to /tmp/anh-thu  # kèm giải nén ảnh ra thư mục RỖNG
```

Script kiểm tra checksum, tạo database mới, khôi phục, rồi **đối chiếu số người với MANIFEST** (lệch là dừng và báo lỗi).
Nó từ chối khôi phục vào chính database đang chạy. Dọn sau khi diễn tập:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE gia_pha_restore"'
```

**Khôi phục thật** (mất dữ liệu / chuyển máy chủ):

1. Máy mới: `cp .env.example .env`, điền cùng `POSTGRES_*`/`JWT_SECRET` như cũ (đổi `JWT_SECRET` chỉ làm mọi người phải đăng nhập lại).
2. `docker compose up -d db`, rồi `docker compose stop api worker web` nếu đang chạy.
3. `scripts/restore.sh <bản-sao-lưu> --force-live` (phải gõ lại tên database để xác nhận).
4. Ảnh: `docker compose run --rm --no-deps -T api sh -c 'tar -C /app/uploads -xzf -' < <bản-sao-lưu>/uploads.tar.gz`
5. `docker compose up -d` — API tự chạy migration nếu bản sao lưu cũ hơn phiên bản code.
6. Mở trang web, đăng nhập, kiểm tra số người và vài tấm ảnh.

## Đã diễn tập thế nào

Trên stack Docker của máy phát triển (691 người, chưa có ảnh): `scripts/backup.sh` → `scripts/restore.sh` vào `gia_pha_restore` →
**691 người, 2 tài khoản, phiên bản migration `f2c4d8e19b36` khớp**; cố khôi phục vào database đang chạy bị từ chối; rồi xoá database thử.
Chưa diễn tập: giải nén ảnh với dữ liệu có ảnh thật (thư mục uploads của máy này đang rỗng) và khôi phục sang một máy khác.

**Diễn tập lần 2 (2026-10-19, sau khi thêm bản đồ, link mời…):** `backup.sh` rồi `restore.sh --uploads-to` trên stack thật: 691 người khớp MANIFEST,
4 tài khoản, 1 họ, phiên bản migration `f8c0d4e72b93` **bằng đúng** database đang chạy, bảng `member_invites` có mặt; checksum của cả hai file đạt; database thử đã xoá.
Cron được thử với môi trường tối thiểu (`env -i`) để chắc chắn chạy được từ cron.
