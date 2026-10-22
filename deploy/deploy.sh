#!/usr/bin/env bash
# 在本机构建镜像，传到服务器后启动（服务器不需要访问 Docker Hub，也不用自己编译）。
# 用法：deploy/deploy.sh 用户@服务器 [服务器上的目录，默认 iot-sim]
# 第一次部署前，先按 deploy/README.md 在服务器上准备好 .env
set -euo pipefail

host=${1:?用法：deploy/deploy.sh 用户@服务器 [目录]}
dir=${2:-iot-sim}
cd "$(dirname "$0")/.."

echo "== 构建镜像"
docker compose build app
docker pull -q caddy:2-alpine

echo "== 上传配置文件到 $host:$dir"
ssh "$host" "mkdir -p $dir/deploy"
scp -q compose.yaml .env.example "$host:$dir/"
scp -q deploy/Caddyfile "$host:$dir/deploy/"

echo "== 上传镜像（约 130 MB）"
docker save iot-sim:latest | gzip -1 | ssh "$host" 'gunzip | docker load'
if ! ssh "$host" 'docker image inspect caddy:2-alpine >/dev/null 2>&1'; then
  docker save caddy:2-alpine | gzip -1 | ssh "$host" 'gunzip | docker load'
fi

echo "== 启动"
ssh "$host" "cd $dir && test -f .env || { echo '服务器上还没有 .env：cp .env.example .env 后设置 ACCESS_PASSWORD'; exit 1; }
  docker compose up -d --no-build --remove-orphans && docker image prune -f >/dev/null
  sleep 5 && docker compose logs --tail 5 app"
