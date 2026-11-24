# 机房（debian114）

机房那台在 `/root/IOT`，跑两个容器（`compose.yaml`）：

- **iot-web**：Caddy，放打包好的网页，`/api`、`/ws`、`/resources` 反代到 `https://iot.xuyue.cc`。学生访问 `http://10.13.114.114:86`（只在局域网，没有 frp）。
- **iot-worker**：计算节点（`bun server.js worker`，代码在 `server/src/worker.ts`）。主动连服务器的 `wss://iot.xuyue.cc/worker`，替服务器编译运行学生程序、评分（提交评分和自己检查）、提供语言服务。不开端口、不存数据。

账号、作品、作业、提交、学生自己的数据库都只在服务器上（一份 SQLite），校内校外看到的完全一样。服务器只有 2 核，机房这台 28 核，学生程序放在这边跑。

## 机房关机、断网时

服务器一直是主角，机房只是帮忙：

- 计算节点没连上：编译运行、评分都在服务器上做，和没有机房时一样（只是慢一些）。
- 运行中断了：学生的程序结束，提示"和运行程序的机器断开了连接，请重新运行"，再点运行就在服务器上运行。
  网络突然断开（没有关闭连接）时，服务器约 30 秒后发现；计算节点约 30 秒后放弃这条连接、结束手上的程序并重连。
- 评分、启动程序时断了，或者计算节点那边出错（比如磁盘满）：改在服务器上做，学生和老师感觉不到。
- `docker stop iot-worker`（部署、关机）：先断开连接（学生马上看到提示），再结束程序退出，不用等 10 秒。
- 学生程序一直刷屏：每个程序往服务器发输出平均每秒最多 512 KB（可以先冲 4 MB），链路积压时先不读它的输出（程序自己停下来等），编码后超过 4 MB 的一行丢掉。一个学生的程序不会拖垮整条连接。
- 链路堵了（发给计算节点的数据积压超过 4 MB）：学生在窗体上的操作先丢掉（点了没反应），启动、结束程序照常。
- 机房那条外网线断了：校外照常用 iot.xuyue.cc；机房的学生用不了 86 端口（它也要连服务器）。

服务器日志里能看到计算节点连上、断开（`docker compose logs app | grep 计算节点`）。

## 学生的数据库（项目 6、8）

**代码里用到数据库（`SqlConnection`、`SqlCommand` 等）的程序在服务器上运行**，不交给计算节点：学生的库只在服务器上，数据库页面随时可能在改它，拷过来再拷回去会互相覆盖。交给计算节点的运行都不带数据库。评分不受影响：评分用的是按实验的 `database.sql` 新建的库，用到数据库的实验也在计算节点上评。

## 版本和令牌

- 计算节点和服务器要是同一个提交（镜像里的 `APP_VERSION`），不一样时服务器拒绝它（日志里有"版本不一样"），自己做。部署工作流先部署服务器、再部署机房，中间约一分钟由服务器自己做。
- 两边的 `.env` 里有同一个 `WORKER_TOKEN`（服务器 `/root/IOT_SIM/.env`，机房 `/root/IOT/.env`，都是 `chmod 600`）。换令牌：两边一起改，服务器 `docker compose up -d`，机房 `docker compose up -d iot-worker`。

## 镜像怎么来的

机房拉不到 Docker Hub，也装不了 apt 包，所以镜像分两层：

- **底子** `iot-sim-base:<标签>`：.NET 运行时 + bubblewrap + bun，就是 `Dockerfile` 里的 `runtime-base` 阶段。标签是那一段的哈希。在开发机上编好，`docker save | zstd` 传过来（约 110 MB，开发机到机房约 1 MB/s，几分钟）。只有那一段改了（比如升级 bun）才要再传，部署工作流会自己发现并处理。
- **上面几层**：`prebuilt/`（开发机编好的 C# 运行时、网页、`server.js`）和 `samples/`，rsync 到 `/root/IOT/worker/`，只传变了的文件，在机房 `docker compose build`（只有几条 COPY，不用联网）。

## 部署

平时 push 到 origin 的 main，`.gitea/workflows/deploy.yml` 最后一步「机房：网页 + 计算节点」会同步网页、计算节点的构建材料和本目录的文件，再执行 `deploy.sh`：构建、启动，确认 86 端口反代正常、计算节点连上了服务器。

第一次（或换机器）要先准备 `.env`：

```bash
ssh fschool 'mkdir -p /root/IOT && umask 077 && echo "WORKER_TOKEN=和服务器一样的令牌" > /root/IOT/.env'
```

手动部署只能在开发机上做（要有编好的产物），步骤照工作流的最后一步。只想重启：

```bash
ssh fschool 'cd /root/IOT && docker compose restart iot-worker'
```

看计算节点在做什么：`docker logs -f iot-worker`、`docker stats iot-worker`。
