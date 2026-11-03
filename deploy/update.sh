#!/usr/bin/env bash
# 在服务器上执行：拉取代码、构建镜像、重启，等到编译服务就绪才算成功。
# 用法：deploy/update.sh [提交号，默认 origin/main] [--prebuilt]
#
#   不带 --prebuilt：服务器自己编（只要有 docker 就能跑，不依赖开发机；2 核编一次约一分钟，期间学生程序会卡）。
#                    GitHub 上手动触发的备用部署、登录服务器手动部署都走这条。
#   --prebuilt：     用 prebuilt/ 里现成的产物，镜像构建只剩几条 COPY。push origin 后开发机上的 gitea-runner
#                    编好、测过、rsync 过来再调用（.gitea/workflows/deploy.yml）。prebuilt/COMMIT 必须就是要部署的提交，
#                    对不上说明产物不是这次编的，直接失败，不会把旧产物配新代码。
#
# 第一次部署前，按 deploy/README.md 在服务器上克隆仓库、准备好 .env
set -euo pipefail

# 整个脚本包在函数里：git reset 会在运行中替换本文件，bash 先读完函数再执行，不受影响
main() {
  cd "$(dirname "$0")/.."
  local ref=origin/main prebuilt=0 arg
  for arg in "$@"; do
    case "$arg" in
      --prebuilt) prebuilt=1 ;;
      -*) echo "未知参数：$arg（可用：--prebuilt）" >&2; exit 2 ;;
      *) ref=$arg ;;
    esac
  done

  if [[ ! -f .env ]]; then
    echo '还没有 .env：cp .env.example .env 后设置 TEACHER_PASSWORD'
    exit 1
  fi

  echo "== 拉取代码"
  # 代码从 origin（git.xuyue.cc）拉取。GitHub 上手动触发时，这个提交可能还没推到 origin，多等一会儿
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

  if [[ $prebuilt == 1 ]]; then
    local head built
    head=$(git rev-parse HEAD)
    built=$(cat prebuilt/COMMIT 2>/dev/null || true)
    if [[ $built != "$head" ]]; then
      echo "prebuilt/ 里的产物是 ${built:-（没有）} 编的，要部署的是 $head。"
      echo '重新跑一次开发机上的部署，或者去掉 --prebuilt 让服务器自己编'
      exit 1
    fi
    for f in prebuilt/runtime/Sim.Runner.dll prebuilt/web/index.html prebuilt/server.js; do
      [[ -e $f ]] || { echo "prebuilt/ 不完整，缺 $f"; exit 1; }
    done
    export ARTIFACTS=prebuilt
    echo "== 用开发机编好的产物（$(du -sh prebuilt | cut -f1)）"
  else
    export ARTIFACTS=build
  fi

  echo "== 构建镜像并重启"
  # caddy 用的是现成镜像，up 不会去拉新版，不拉的话永远是第一次部署时那份
  docker compose pull --quiet caddy
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
