#!/usr/bin/env bash
# 在服务器上执行：后台跑 deploy/update.sh，前台跟着输出，退出码和 update.sh 一样。
# 用法：deploy/update-bg.sh <提交号> [--prebuilt]   开始部署这个提交并跟着看
#       deploy/update-bg.sh --follow <提交号>        接着看这个提交的部署（SSH 断线重连后用）；
#                                                     这个提交的部署还没开始过时退出码 75
#
# 为什么要后台跑：以前 update.sh 直接跑在 SSH 会话里，SSH 一断（开发机网络切换、代理重启）就跟着被杀。
# 2026-11-03 断在 docker compose up 中间：旧容器删了、新容器只创建没启动，网站停了 40 分钟。
# 现在 update.sh 在新会话里跑（setsid），SSH 断了它照样跑完，开发机重连后用 --follow 拿结果。
set -euo pipefail

# 包在函数里：update.sh 会 git reset，运行中替换本文件，bash 先读完函数再执行，不受影响
main() {
  cd "$(dirname "$0")/.."
  local state=/var/tmp/iot_sim-update
  # state.sha：这次部署的提交  state.pid：后台进程  state.log：输出  state.exit：update.sh 的退出码（跑完才有）

  if [[ ${1:-} == --follow ]]; then
    local sha=${2:?用法：deploy/update-bg.sh --follow <提交号>}
    if [[ $(cat $state.sha 2>/dev/null || true) != "$sha" ]]; then
      echo "服务器上没有 $sha 的部署记录（还没开始）"
      exit 75
    fi
    follow
  fi

  local sha=${1:?用法：deploy/update-bg.sh <提交号> [--prebuilt]}

  # 上一次还在跑（比如它的 SSH 断了、又推了新的）就等它跑完，两次 compose up 不能同时跑
  local old
  old=$(cat $state.pid 2>/dev/null || true)
  if [[ -n $old ]] && kill -0 "$old" 2>/dev/null; then
    echo "== 上一次部署（$(cat $state.sha 2>/dev/null)）还在跑，等它结束"
    while kill -0 "$old" 2>/dev/null; do sleep 2; done
  fi

  rm -f $state.pid $state.exit
  echo "$sha" >$state.sha
  # 后台进程自己写 pid（$$），保证记下的就是会写退出码的那个进程
  setsid bash -c 'echo $$ >"$0.pid"; deploy/update.sh "$@"; echo $? >"$0.exit"' \
    "$state" "$@" >$state.log 2>&1 </dev/null &
  for _ in $(seq 50); do [[ -s $state.pid ]] && break; sleep 0.1; done
  follow
}

follow() {
  local pid code
  pid=$(cat $state.pid 2>/dev/null || true)
  if [[ -n $pid ]]; then
    # update 进程结束后 tail 自己退出
    tail -n +1 -f --pid="$pid" $state.log
  else
    cat $state.log 2>/dev/null || true
  fi
  code=$(cat $state.exit 2>/dev/null || true)
  if [[ -z $code ]]; then
    echo "== 部署进程意外结束，没有留下退出码，看看 docker compose ps"
    exit 1
  fi
  exit "$code"
}

main "$@"
