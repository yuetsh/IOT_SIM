# 部署

服务器上的结构：

```
学生浏览器 ──HTTPS──▶ Nginx Proxy Manager（443） ──npm_proxy 网络──▶ caddy（iot-sim:80） ──▶ app（Bun + .NET + bubblewrap）
```

- **app**：Bun 服务端、打包好的网页、C# 编译服务。学生程序每次运行都放进 bubblewrap 沙箱：断网，看不到服务器文件和其他进程，工程目录只读，限制内存（128 MB）、CPU 时间（120 秒）和运行时长（60 分钟）。
- **caddy**：只收 HTTP，转发给 app，压缩网页；从 NPM 转发来的 `X-Forwarded-For` 里取学生的真实 IP。
- 不映射宿主机端口，NPM 通过外部网络 `npm_proxy` 访问 `iot-sim:80`。

## 服务器要求

- Linux，Docker 和 Docker Compose v2，已有外部网络 `npm_proxy`（NPM 所在的网络）。
- 2 核 8G 足够两个班同时使用（实测 100 个程序同时运行约 1.1 GB）。
- 沙箱需要宿主机允许非特权用户命名空间。**Debian 12（本平台的服务器）默认允许**，不用设置，可用 `sysctl kernel.unprivileged_userns_clone` 确认输出为 1。
- **Ubuntu 23.10 及以上**默认禁止，沙箱会起不来，需要放开：

  ```bash
  echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/60-userns.conf
  sudo sysctl --system
  ```

  其他发行版一般不需要。服务器启动时会自检沙箱，不通过会在日志里打印原因，并拒绝运行学生代码（不会在无隔离的情况下运行）。

## 第一次部署

服务器上的 `~/IOT_SIM` 是从 origin（git.xuyue.cc）克隆的仓库，镜像在服务器上构建；配置只放在 `.env`（不进 git）。

1. 服务器要能拉取 origin：仓库是私有的话，在服务器上生成一把密钥（`ssh-keygen -t ed25519`），把公钥加到 git.xuyue.cc 仓库的部署密钥（只读）里。

2. 克隆仓库，准备口令：

   ```bash
   git clone git@git.xuyue.cc:xuyue/IOT_SIM.git ~/IOT_SIM
   cd ~/IOT_SIM
   echo 'TEACHER_PASSWORD=换成你的密码' > .env
   chmod 600 .env
   ```

   `~/IOT_SIM` 已经存在（比如以前用脚本上传过文件）时，就地变成仓库，已有的 `.env` 会保留：

   ```bash
   cd ~/IOT_SIM
   git init -q && git remote add origin git@git.xuyue.cc:xuyue/IOT_SIM.git
   git fetch origin && git checkout -f -B main origin/main
   ```

3. 构建并启动：

   ```bash
   deploy/update.sh
   ```

   拉取代码、构建镜像（第一次要下载 .NET SDK、Bun 等镜像和依赖，之后有缓存）、启动，最后应看到"部署成功"。

4. 在 Nginx Proxy Manager 里添加 Proxy Host：
   - Domain Names：已备案的域名
   - Scheme：`http`，Forward Hostname / IP：`iot-sim`，Forward Port：`80`
   - **打开 Websockets Support**（运行程序靠 WebSocket，不打开会一直连不上）
   - Advanced 里加一行 `client_max_body_size 10m;`（NPM 默认只允许 1 MB，带界面截图的作业提交可能超过）
   - SSL：申请证书，打开 Force SSL

5. 浏览器打开域名，用老师账号登录，在"班级管理"里建班、导入学生名单。

数据库（账号、班级、学生作品）在 Docker 数据卷 `data` 里，重新部署不会丢；`docker compose down -v` 会删除数据卷，不要加 `-v`。

## 自动部署（GitHub Actions）

`.github/workflows/ci.yml`：

- 每次推送和 PR：编译 C# 运行时，跑服务端测试（含沙箱）、网页端测试和类型检查。
- 推送到 GitHub 的 main 且测试通过：SSH 到服务器执行 `deploy/update.sh <提交号>`，服务器从 origin 拉代码、构建、重启，等到"编译服务已就绪"才算成功。**重启会结束正在运行的学生程序**，上课时间尽量不要推送 main。
- 服务器从 origin 拉代码，所以**两个仓库都要推送**（`git push origin main`、`git push github main`）。GitHub 先到时，脚本会等 origin 最多约 100 秒。
- 在 GitHub 的 Actions 页面点 Run workflow 可以手动重新部署。
- 只在 github.com 上运行；推到 git.xuyue.cc 不会触发。

一次性配置（在本机执行，需要已登录的 `gh`）：

1. 服务器上的部署用户要能运行 docker（在 docker 组里），并按上面"第一次部署"准备好 `~/IOT_SIM`。
2. 生成部署专用的 SSH 密钥（GitHub Actions 用它登录服务器），公钥放到服务器，私钥和服务器信息存进仓库 Secrets：

   ```bash
   ssh-keygen -t ed25519 -N '' -C iot-sim-deploy -f /tmp/iot_deploy
   ssh-copy-id -i /tmp/iot_deploy.pub 用户@服务器
   gh secret set DEPLOY_SSH_KEY -R yuetsh/IOT_SIM < /tmp/iot_deploy
   gh secret set DEPLOY_HOST -R yuetsh/IOT_SIM -b 服务器地址
   gh secret set DEPLOY_USER -R yuetsh/IOT_SIM -b 用户名
   rm /tmp/iot_deploy /tmp/iot_deploy.pub
   ```

   SSH 端口不是 22 时，再设置 `DEPLOY_PORT`；服务器目录不是 `~/IOT_SIM` 时，设置变量 `gh variable set DEPLOY_DIR -R yuetsh/IOT_SIM -b 目录`。

## 日常操作

在服务器的 `~/IOT_SIM` 目录下：

| 做什么 | 命令 |
|---|---|
| 更新到新版本 | 推送到两个仓库的 main（GitHub 测试通过后自动部署），或在服务器上执行 `deploy/update.sh` |
| 改老师密码 | 修改 `.env` 后 `docker compose up -d` |
| 学生账号 | 老师登录后在"班级管理"里导入名单、查看和重置密码 |
| 看日志 | `docker compose logs -f app` |
| 看资源占用 | `docker stats` |
| 重启 / 停止 | `docker compose restart` / `docker compose down` |

## 可调参数

写在 `.env` 里，改完 `docker compose up -d` 生效。

| 变量 | 默认 | 说明 |
|---|---|---|
| `TEACHER_PASSWORD` | （必填） | 老师账号的密码 |
| `TEACHER_USERNAME` | `admin` | 老师账号 |
| `DEEPSEEK_API_KEY` | （空） | AI 评阅用的 DeepSeek 密钥；不填就不做 AI 评阅 |
| `AI_MODEL` | `deepseek-flash` | AI 评阅用的模型（需要支持图片输入） |
| `APP_MEM_LIMIT` | `4g` | 整个平台的内存上限 |
| `SIM_MAX_RUNS` | `150` | 全站同时运行的学生程序上限，超过时提示"服务器繁忙" |
| `SIM_HEAP_LIMIT_MB` | `128` | 每个学生程序的内存上限 |
| `SIM_CPU_LIMIT_SECONDS` | `120` | 每次运行累计 CPU 时间上限（防死循环） |
| `SIM_MAX_RUN_MINUTES` | `60` | 每次运行最长时间 |
