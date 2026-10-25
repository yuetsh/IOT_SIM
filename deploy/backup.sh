#!/usr/bin/env bash
# 在服务器上执行：备份平台的全部数据（账号、班级、学生作品、作业、提交、评阅，以及每个学生自己的数据库）
# 到 backups/<日期时间>/。备份在宿主机上，不在 Docker 数据卷里，数据卷被删也还在；要防硬盘坏，把它拷到别的机器上。
# 平台运行中也可以备份，学生不受影响。恢复见 deploy/restore.sh。
# 用法：deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p backups
name=$(date +%Y%m%d-%H%M%S)
# 同一秒里做了两次（如 restore.sh 恢复前先备份）时，等到下一秒，不和已有的备份重名
while [[ -e backups/$name ]]; do
  sleep 1
  name=$(date +%Y%m%d-%H%M%S)
done
inside=/data/.backup-$name
# 在容器里导出（SQLite 一致读取，不会备份出写了一半的库），再拷到宿主机
docker compose exec -T app bun server.js backup "$inside" >/dev/null
docker compose cp "app:$inside" "backups/$name" 2>/dev/null
docker compose exec -T app rm -rf "$inside"
echo "已备份到 $(pwd)/backups/$name（$(du -sh "backups/$name" | cut -f1)）"
