#!/usr/bin/env bash
# 在服务器上执行：拉取代码、构建镜像、重启，等到编译服务就绪才算成功。
# GitHub Actions 测试通过后通过 SSH 调用它，也可以登录服务器手动执行。
# 用法：deploy/update.sh [提交号，默认 origin/main]
# 第一次部署前，按 deploy/README.md 在服务器上克隆仓库、准备好 .env
set -euo pipefail

# 整个脚本包在函数里：git reset 会在运行中替换本文件，bash 先读完函数再执行，不受影响
main() {
  cd "$(dirname "$0")/.."
  local ref=${1:-origin/main}

  if [[ ! -f .env ]]; then
    echo '还没有 .env：cp .env.example .env 后设置 ACCESS_PASSWORD'
    exit 1
  fi

  echo "== 拉取代码"
  # 代码从 origin（git.xuyue.cc）拉取。Actions 由推送到 GitHub 触发，
  # 两个仓库推送有先后，这个提交可能还没到 origin，多等一会儿
  for attempt in $(seq 10); do
    git fetch --quiet origin
    if git rev-parse --quiet --verify "$ref^{commit}" >/dev/null; then break; fi
    if [[ $attempt == 10 ]]; then
      echo "origin 上没有 $ref：先 git push origin main，再重新运行部署"
      exit 1
    fi
    echo "origin 上还没有 $ref，10 秒后重试"
    sleep 10
  done
  # 服务器上不改代码，配置都在 .env（不进 git，不受影响）
  git checkout --quiet -B main
  git reset --quiet --hard "$ref"
  git log --oneline -1

  echo "== 构建镜像并重启"
  docker compose up -d --build --remove-orphans
  docker image prune -f >/dev/null

  # 等编译服务就绪；沙箱自检失败时部署失败
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
}

main "$@"
