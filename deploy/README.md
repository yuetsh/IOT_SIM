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

1. 在服务器上准备目录和口令：

   ```bash
   mkdir -p ~/IOT_SIM && cd ~/IOT_SIM
   # 部署脚本会上传 .env.example；也可以直接新建 .env：
   echo 'ACCESS_PASSWORD=换成你的口令' > .env
   chmod 600 .env
   ```

2. 在本机（开发机）执行：

   ```bash
   deploy/deploy.sh 用户@服务器
   ```

   脚本在本机构建镜像，通过 ssh 传到服务器并启动。日志最后应看到"C# 编译服务已就绪"，且没有"沙箱无法启动"。

3. 在 Nginx Proxy Manager 里添加 Proxy Host：
   - Domain Names：已备案的域名
   - Scheme：`http`，Forward Hostname / IP：`iot-sim`，Forward Port：`80`
   - **打开 Websockets Support**（运行程序靠 WebSocket，不打开会一直连不上）
   - SSL：申请证书，打开 Force SSL

4. 浏览器打开域名，输入口令进入。

## 自动部署（GitHub Actions）

`.github/workflows/ci.yml`：

- 每次推送和 PR：编译 C# 运行时，跑服务端测试（含沙箱）、网页端测试和类型检查。
- 推送到 GitHub 的 main 且测试通过：构建镜像，经 SSH 传到服务器并重启，等到"编译服务已就绪"才算成功。**重启会结束正在运行的学生程序**，上课时间尽量不要推送 main。
- 在 GitHub 的 Actions 页面点 Run workflow 可以手动重新部署。
- 只在 github.com 上运行；推到 git.xuyue.cc 不会触发。

一次性配置（在本机执行，需要已登录的 `gh`）：

1. 服务器上的部署用户要能运行 docker（在 docker 组里），并按上面"第一次部署"第 1 步准备好 `~/IOT_SIM/.env`。
2. 生成部署专用的 SSH 密钥，公钥放到服务器，私钥和服务器信息存进仓库 Secrets：

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
| 更新到新版本 | 推送到 GitHub 的 main（自动部署），或在本机执行 `deploy/deploy.sh 用户@服务器` |
| 换口令 | 修改 `.env` 后 `docker compose up -d`（所有人要重新输入口令） |
| 看日志 | `docker compose logs -f app` |
| 看资源占用 | `docker stats` |
| 重启 / 停止 | `docker compose restart` / `docker compose down` |

## 可调参数

写在 `.env` 里，改完 `docker compose up -d` 生效。

| 变量 | 默认 | 说明 |
|---|---|---|
| `ACCESS_PASSWORD` | （必填） | 访问口令 |
| `APP_MEM_LIMIT` | `4g` | 整个平台的内存上限 |
| `SIM_MAX_RUNS` | `150` | 全站同时运行的学生程序上限，超过时提示"服务器繁忙" |
| `SIM_HEAP_LIMIT_MB` | `128` | 每个学生程序的内存上限 |
| `SIM_CPU_LIMIT_SECONDS` | `120` | 每次运行累计 CPU 时间上限（防死循环） |
| `SIM_MAX_RUN_MINUTES` | `60` | 每次运行最长时间 |
