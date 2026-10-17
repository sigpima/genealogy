#!/usr/bin/env bash
# Khôi phục một bản sao lưu — mặc định vào một database MỚI tên khác (diễn tập), KHÔNG đụng vào database đang chạy.
#
#   scripts/restore.sh backups/gia-pha-20261019-020000                       # diễn tập: database "gia_pha_restore"
#   scripts/restore.sh <thư-mục-bản-sao-lưu> --db ten_db_moi
#   scripts/restore.sh <thư-mục> --uploads-to /duong/dan/thu-muc-rong        # giải nén ảnh ra thư mục này
#   scripts/restore.sh <thư-mục> --force-live                                 # GHI ĐÈ database đang chạy (xem docs/SAO-LUU.md)
#
# Sau khi diễn tập: đối chiếu số người với MANIFEST.txt, rồi xoá database thử:
#   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE gia_pha_restore"'
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"; shift || true
[ -n "$SRC" ] && [ -f "$SRC/database.dump" ] || { echo "Dùng: scripts/restore.sh <thư-mục-bản-sao-lưu> [--db TÊN] [--uploads-to THƯ_MỤC] [--force-live]" >&2; exit 2; }
TARGET="gia_pha_restore"; UPLOADS_TO=""; LIVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --db) TARGET="$2"; shift 2;;
    --uploads-to) UPLOADS_TO="$2"; shift 2;;
    --force-live) LIVE=1; shift;;
    *) echo "Tham số lạ: $1" >&2; exit 2;;
  esac
done
COMPOSE="docker compose"

LIVE_DB="$($COMPOSE exec -T db sh -c 'printf %s "$POSTGRES_DB"')"
if [ "$LIVE" = 1 ]; then
  TARGET="$LIVE_DB"
  echo "CẢNH BÁO: sẽ GHI ĐÈ database đang chạy '$LIVE_DB'. Hãy dừng api và worker trước (docker compose stop api worker web)."
  read -r -p "Gõ đúng tên database để xác nhận: " ANSWER
  [ "$ANSWER" = "$LIVE_DB" ] || { echo "Huỷ."; exit 1; }
elif [ "$TARGET" = "$LIVE_DB" ]; then
  echo "Từ chối: '$TARGET' là database đang chạy. Dùng tên khác, hoặc --force-live nếu thật sự muốn ghi đè." >&2
  exit 1
fi

echo "Kiểm tra checksum..."
(cd "$SRC" && grep '^sha256 ' MANIFEST.txt | sed 's/^sha256 //' | sha256sum -c -)

echo "Khôi phục database.dump → '$TARGET'"
$COMPOSE exec -T db sh -c 'cat > /tmp/restore.dump' < "$SRC/database.dump"
$COMPOSE exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS \"$TARGET\"' -c 'CREATE DATABASE \"$TARGET\"'"
$COMPOSE exec -T db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d \"$TARGET\" --no-owner --exit-on-error /tmp/restore.dump; rm -f /tmp/restore.dump"
MEMBERS="$($COMPOSE exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"$TARGET\" -tAc 'select count(*) from members'" | tr -d '[:space:]')"
EXPECTED="$(grep '^members=' "$SRC/MANIFEST.txt" | cut -d= -f2)"
echo "Số người sau khi khôi phục: $MEMBERS (bản sao lưu ghi: $EXPECTED)"
[ "$MEMBERS" = "$EXPECTED" ] || { echo "LỆCH số liệu — kiểm tra lại bản sao lưu." >&2; exit 1; }

if [ -n "$UPLOADS_TO" ]; then
  mkdir -p "$UPLOADS_TO"
  [ -z "$(ls -A "$UPLOADS_TO")" ] || { echo "Thư mục '$UPLOADS_TO' không rỗng — từ chối giải nén đè lên." >&2; exit 1; }
  tar -xzf "$SRC/uploads.tar.gz" -C "$UPLOADS_TO"
  echo "Đã giải nén uploads vào $UPLOADS_TO ($(find "$UPLOADS_TO" -type f | wc -l) file)"
fi
echo "OK."
