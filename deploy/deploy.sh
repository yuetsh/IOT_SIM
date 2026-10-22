#!/usr/bin/env bash
# 构建镜像，传到服务器后启动（服务器不需要访问 Docker Hub，也不用自己编译）。
# 本机手动部署和 GitHub Actions 自动部署都用这个脚本。
# 用法：deploy/deploy.sh 用户@服务器 [服务器上的目录，默认 ~/IOT_SIM]
#   SKIP_BUILD=1 时不构建，直接用已有的 iot-sim:latest 镜像（Actions 里已带缓存构建好）
# 第一次部署前，先按 deploy/README.md 在服务器上准备好 .env
set -euo pipefail

host=${1:?用法：deploy/deploy.sh 用户@服务器 [目录]}
dir=${2:-IOT_SIM}
cd "$(dirname "$0")/.."

if [[ -z "${SKIP_BUILD:-}" ]]; then
  echo "== 构建镜像"
  docker compose build app
fi
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
ssh "$host" bash -s -- "$dir" <<'EOF'
set -euo pipefail
cd "$1"
if [[ ! -f .env ]]; then
  echo '服务器上还没有 .env：cp .env.example .env 后设置 ACCESS_PASSWORD'
  exit 1
fi
docker compose up -d --no-build --remove-orphans
docker image prune -f >/dev/null

# 等编译服务就绪；沙箱自检失败时部署算失败
for _ in $(seq 60); do
  logs=$(docker compose logs app 2>&1)
  if grep -q '沙箱（bubblewrap）无法启动' <<<"$logs"; then
    echo "$logs" | tail -5
    exit 1
  fi
  if grep -q 'C# 编译服务已就绪' <<<"$logs"; then
    echo '== 部署成功'
    exit 0
  fi
  sleep 2
done
echo '== 120 秒内没有启动完成'
docker compose logs --tail 20 app
exit 1
EOF
