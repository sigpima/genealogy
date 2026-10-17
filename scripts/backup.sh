#!/usr/bin/env bash
# Sao lưu: Postgres (pg_dump, định dạng custom) + thư mục ảnh/tài liệu (uploads) vào một thư mục có dấu thời gian.
#
#   scripts/backup.sh                 # ghi vào ./backups/gia-pha-YYYYmmdd-HHMMSS/, giữ 14 bản mới nhất
#   BACKUP_DIR=/mnt/usb scripts/backup.sh
#   KEEP=30 scripts/backup.sh
#
# Chạy từ bất kỳ đâu (script tự cd về thư mục gốc dự án). Cần stack đang chạy (docker compose up -d).
# Không in mật khẩu; không sửa gì trong database. Khôi phục: scripts/restore.sh (xem docs/SAO-LUU.md).
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/gia-pha-$STAMP"
COMPOSE="docker compose"

$COMPOSE ps --status running --services 2>/dev/null | grep -qx db || { echo "Lỗi: service db chưa chạy (docker compose up -d)." >&2; exit 1; }
$COMPOSE ps --status running --services 2>/dev/null | grep -qx api || { echo "Lỗi: service api chưa chạy (cần để đọc thư mục uploads)." >&2; exit 1; }

mkdir -p "$DEST"
trap 'rm -rf "$DEST.partial"' EXIT
rm -rf "$DEST.partial"; mkdir -p "$DEST.partial"

echo "1/3 Postgres → database.dump"
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$DEST.partial/database.dump"
[ -s "$DEST.partial/database.dump" ] || { echo "Lỗi: pg_dump trả về file rỗng." >&2; exit 1; }

echo "2/3 Thư mục uploads → uploads.tar.gz"
$COMPOSE exec -T api sh -c 'tar -C /app/uploads -cf - .' | gzip > "$DEST.partial/uploads.tar.gz"
gzip -t "$DEST.partial/uploads.tar.gz"

echo "3/3 Kiểm tra và ghi MANIFEST"
# pg_restore --list đọc được file => dump không hỏng; đếm số bảng/dòng dữ liệu để đối chiếu khi khôi phục.
TABLES="$($COMPOSE exec -T db pg_restore --list < "$DEST.partial/database.dump" | grep -c "TABLE DATA")"
MEMBERS="$($COMPOSE exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from members"' | tr -d '[:space:]')"
FILES="$(tar -tzf "$DEST.partial/uploads.tar.gz" | grep -vc '/$' || true)"
{
  echo "created_at=$(date -Iseconds)"
  echo "postgres_table_data_entries=$TABLES"
  echo "members=$MEMBERS"
  echo "upload_files=$FILES"
  (cd "$DEST.partial" && sha256sum database.dump uploads.tar.gz | sed 's/^/sha256 /')
} > "$DEST.partial/MANIFEST.txt"

rmdir "$DEST" 2>/dev/null || true
mv "$DEST.partial" "$DEST"
trap - EXIT
echo "Xong: $DEST ($(du -sh "$DEST" | cut -f1)) — $MEMBERS người, $FILES file"

# Giữ $KEEP bản mới nhất (tên có dấu thời gian nên sắp theo tên là sắp theo thời gian).
if [ "$KEEP" -gt 0 ]; then
  ls -1d "$BACKUP_DIR"/gia-pha-* 2>/dev/null | sort | head -n "-$KEEP" | while read -r old; do
    echo "Xoá bản cũ: $old"; rm -rf "$old"
  done
fi
