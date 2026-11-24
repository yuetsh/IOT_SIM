#!/usr/bin/env bash
# 在机房（/root/IOT）执行，部署工作流同步好文件后调用：构建计算节点镜像、启动，
# 检查网页反代正常、计算节点连上了服务器。
# 用法：bash deploy.sh <底子镜像，如 iot-sim-base:68d11c35b0df> <提交号> [restart-web]
#   restart-web：Caddyfile 变了，重启 iot-web（单文件挂载，换了文件容器里看到的还是旧的）
set -euo pipefail
cd "$(dirname "$0")"
base=${1:?用法：bash deploy.sh <底子镜像> <提交号> [restart-web]}
sha=${2:?用法：bash deploy.sh <底子镜像> <提交号> [restart-web]}
restart_web=${3:-}

# 手动 docker compose build 时默认用 iot-sim-base:latest
docker tag "$base" iot-sim-base:latest
echo "== 构建计算节点镜像并启动（底子 $base）"
IOT_BASE=$base APP_VERSION=$sha docker compose up -d --build
if [[ $restart_web == restart-web ]]; then docker compose restart iot-web; fi
docker image prune -f >/dev/null

sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:86/api/me)
if [[ $code != 401 ]]; then
  docker logs --tail 30 iot-web
  echo "== 机房反代接口不是 401（未登录）：$code"
  exit 1
fi
echo '== 网页反代 OK'

# 等计算节点连上服务器（服务器刚重启时会先连不上，几秒后重连）。看它最后一条连接相关的日志
for _ in $(seq 60); do
  last=$(docker logs iot-worker 2>&1 | grep -E '已连上服务器|连接断了|连不上服务器|要设置|沙箱' | tail -1 || true)
  if [[ $last == *已连上服务器* ]]; then
    echo '== 计算节点已连上服务器'
    exit 0
  fi
  sleep 2
done
docker logs --tail 30 iot-worker
echo '== 计算节点 120 秒内没有连上服务器'
exit 1
