#!/usr/bin/env bash
# Sao lưu hằng đêm: chạy scripts/backup.sh, rồi (nếu bạn đã cấu hình) chép bản mới ra NGOÀI máy, và ghi nhật ký.
#
#   scripts/backup-nightly.sh            # cron gọi file này
#
# Cấu hình tuỳ chọn trong ./backup.conf (file này nằm trong .gitignore), ví dụ:
#   OFFSITE_DIR=/mnt/usb/gia-pha         # một thư mục trên ổ khác / ổ USB / thư mục đã đồng bộ (cần rsync hoặc cp)
#   RCLONE_REMOTE=b2:ten-bucket/gia-pha  # hoặc một remote của rclone (Backblaze B2, Google Drive, S3...) - đã `rclone config` sẵn
#   KEEP=14                              # số bản giữ trên máy (mặc định 14)
# Không đặt cái nào = chỉ sao lưu trong máy (vẫn ghi cảnh báo vào nhật ký: bản sao cùng ổ đĩa không cứu được khi hỏng ổ).
# Chỉ CHÉP lên chỗ ngoài, không bao giờ xoá ở đó (dọn bản cũ ngoài máy là việc của bạn hoặc của chính dịch vụ lưu trữ).
set -uo pipefail
cd "$(dirname "$0")/.."

[ -f ./backup.conf ] && . ./backup.conf
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG="$BACKUP_DIR/backup.log"
mkdir -p "$BACKUP_DIR"
log() { echo "$(date -Iseconds) $*" | tee -a "$LOG"; }

log "== bắt đầu sao lưu"
if ! BACKUP_DIR="$BACKUP_DIR" KEEP="${KEEP:-14}" scripts/backup.sh >> "$LOG" 2>&1; then
  log "LỖI: scripts/backup.sh thất bại (xem phía trên)."
  exit 1
fi
LATEST="$(ls -1d "$BACKUP_DIR"/gia-pha-* 2>/dev/null | sort | tail -1)"
[ -n "$LATEST" ] || { log "LỖI: không thấy bản sao lưu vừa tạo."; exit 1; }
log "bản mới: $LATEST"

status=0
if [ -n "${OFFSITE_DIR:-}" ]; then
  if mkdir -p "$OFFSITE_DIR" && { command -v rsync >/dev/null && rsync -a "$LATEST" "$OFFSITE_DIR"/ || cp -a "$LATEST" "$OFFSITE_DIR"/; }; then
    log "đã chép ra $OFFSITE_DIR"
  else
    log "LỖI: không chép được ra $OFFSITE_DIR"; status=1
  fi
fi
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null && rclone copy "$LATEST" "$RCLONE_REMOTE/$(basename "$LATEST")" >> "$LOG" 2>&1; then
    log "đã chép lên $RCLONE_REMOTE"
  else
    log "LỖI: không chép được lên $RCLONE_REMOTE (đã cài và cấu hình rclone chưa?)"; status=1
  fi
fi
if [ -z "${OFFSITE_DIR:-}" ] && [ -z "${RCLONE_REMOTE:-}" ]; then
  log "CẢNH BÁO: chưa cấu hình chỗ lưu ngoài máy (backup.conf). Bản sao này nằm cùng ổ đĩa với dữ liệu."
fi
exit $status
