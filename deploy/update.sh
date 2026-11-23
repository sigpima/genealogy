#!/usr/bin/env bash
# Trên server đặt cạnh docker-compose.yml và .env (~/genealogy/). Chuẩn: ~/.claude/CLAUDE.md, mục "Triển khai".
# Chạy TRÊN SERVER:
#   ./update.sh                              kéo image theo API_IMAGE_TAG / WEB_IMAGE_TAG trong .env (mặc định latest) rồi khởi động lại
#   API_IMAGE_TAG=sha-abc1234 ./update.sh    triển khai / rollback đúng một bản build của api (chỉ lần chạy này)
#   WEB_IMAGE_TAG=sha-def5678 ./update.sh    tương tự cho web (hai image ở hai repo nên sha khác nhau)
# Muốn ghim lâu dài thì sửa API_IMAGE_TAG / WEB_IMAGE_TAG trong .env.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Chưa có .env (copy từ .env.example rồi điền)." >&2; exit 1; }

echo "• kéo image (api: ${API_IMAGE_TAG:-theo .env, mặc định latest}; web: ${WEB_IMAGE_TAG:-theo .env, mặc định latest})"
docker compose pull

echo "• khởi động lại và đợi healthy"
if ! docker compose up -d --remove-orphans --wait --wait-timeout "${WAIT_TIMEOUT:-180}"; then
  echo "Có service không healthy. Log gần nhất:" >&2
  docker compose logs --tail 30 >&2
  echo "Rollback: API_IMAGE_TAG=<tag-cũ> WEB_IMAGE_TAG=<tag-cũ> ./update.sh   (xem tag ở GitHub -> Packages)" >&2
  exit 1
fi

docker image prune -f >/dev/null   # xoá layer đã bị thay thế
docker compose ps
echo "Đã triển khai:"
docker compose ps --format '  {{.Service}}  {{.Image}}'
