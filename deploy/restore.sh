#!/usr/bin/env bash
# 在服务器上执行：用 deploy/backup.sh 做的备份替换平台现在的全部数据。
# 替换前先自动备份现在的数据（恢复错了还能换回来）；恢复时平台停止约十几秒，正在运行的学生程序会结束。
# 用法：deploy/restore.sh backups/<日期时间>
set -euo pipefail
cd "$(dirname "$0")/.."

dir=${1:?用法：deploy/restore.sh backups/<日期时间>}
if [[ ! -f $dir/iot-sim.db ]]; then
  echo "$dir 不是备份目录（里面应该有 iot-sim.db）"
  exit 1
fi
read -r -p "用 $dir 替换平台现在的全部数据？现在的数据会先备份。[y/N] " answer
[[ $answer == y || $answer == Y ]] || exit 1

echo "== 备份现在的数据"
deploy/backup.sh
echo "== 停止平台、替换数据"
docker compose stop app
# 旧库的 -wal、-shm 文件一定要删掉，否则会被当成新库的未写完的日志，把恢复的库弄坏
docker compose run --rm --no-deps -T -v "$(realpath "$dir"):/restore:ro" app \
  sh -c 'rm -rf /data/iot-sim.db /data/iot-sim.db-wal /data/iot-sim.db-shm /data/databases && cp -r /restore/. /data/'
echo "== 启动平台"
docker compose up -d app
echo "已恢复到 $dir"
