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

## 自动部署（push origin 就部署）

`.gitea/workflows/deploy.yml`：push 到 origin（git.xuyue.cc）的 main 时，**开发机上的 gitea-runner** 编 C# 运行时、网页和 `server.js`，跑服务端测试（含沙箱）、网页端测试和类型检查（有一项不过就不部署），把产物 rsync 到服务器的 `~/IOT_SIM/prebuilt/`，再在服务器上执行 `deploy/update.sh <提交号> --prebuilt`：拉代码、用现成产物构建镜像（只剩几条 COPY）、重启，等到"编译服务已就绪"才算成功。push 后一两分钟上线，进度在 git.xuyue.cc/xuyue/IOT_SIM/actions。

- `update.sh` 由 `deploy/update-bg.sh` 在服务器上**后台**跑，SSH 断了（开发机切代理、换网络）它照样跑完，runner 重连后接着看输出、拿结果。以前它跑在 SSH 会话里，断线时正好在 `docker compose up` 中间，旧容器删了、新容器没启动，网站就停了。服务器上的部署输出在 `/var/tmp/iot_sim-update.log`。
- **重启会结束正在运行的学生程序**，上课时间尽量不要推送 main。
- **push 时开发机得开着。** 没开的话任务在 Gitea 里排队，开机后 runner 连上就接着跑；排队超过 24 小时会被作废，要在 Actions 页面重跑。
- 在 Gitea 的 Actions 页面点 Run workflow 可以手动重新部署（比如改了服务器上的 `.env` 之后）。
- `prebuilt/COMMIT` 记着产物是哪个提交编的，和要部署的提交对不上时 `update.sh` 直接失败，不会把旧产物配新代码。

为什么不在服务器或 GitHub 上编：服务器只有 2 核，学生程序也在上面跑，以前服务器自己编约一分钟，dotnet 和 vite 把两个核占满；GitHub 上测试约 5 分钟，push 后 6 分钟多才上线。开发机 16 核，服务端测试同时跑（`bun test --parallel`，评分测试标了 `describe.concurrent`）约半分钟。

**服务器自己编的能力还在**：`deploy/update.sh` 不带 `--prebuilt` 就是在镜像里编（`Dockerfile` 的构建参数 `ARTIFACTS` 默认 `build`），只要有 docker 就能部署，不依赖开发机。

### 部署 runner

和 OJ2 共用开发机上的同一个 runner（host 模式，注册在 git.xuyue.cc 的 `xuyue` 用户下，标签 `oj2-deploy`、`iot-deploy`，一次只跑一个任务，两边的部署排队）。装法、配置文件位置、换机器重新注册见 OJ2 仓库 `docs/deploy.md` 的"部署 runner"。

host 模式直接用开发机自己的东西，所以**不需要配任何 secret**：

- PATH 里的 bun、dotnet 10 SDK、bubblewrap（测试里学生程序在沙箱中运行）、rsync；
- `~/.ssh/config` 里的 `debian`（root@服务器，服务器目录 `/root/IOT_SIM`）；
- 能 `git fetch git@git.xuyue.cc:xuyue/IOT_SIM.git`（都不能要密码）。

开发机的 bun 版本和 `Dockerfile` 里镜像的 bun 不一样时，工作流会给出警告（`server.js` 是开发机打包、镜像里的 bun 运行的）。

### 备用：GitHub 手动触发

`.github/workflows/ci.yml` 只在 PR 时跑测试，push 不触发（不然每次推送两边各部署一遍）。开发机不在、又急着上线时，在 github.com 的 Actions → CI/CD → Run workflow：测试通过后 SSH 到服务器执行 `deploy/update-bg.sh <提交号>`（后台跑 `update.sh`），**服务器自己编**。这个提交要已经推到 origin（服务器从 origin 拉代码，没到时脚本会等最多约 100 秒）。

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

| 做什么       | 命令                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| 更新到新版本 | `git push origin main`（开发机测试、编好后自动部署），或在服务器上执行 `deploy/update.sh`（服务器自己编） |
| 改老师密码   | 修改 `.env` 后 `docker compose up -d`                                                                     |
| 学生账号     | 老师登录后在"班级管理"里导入名单、查看和重置密码                                                          |
| 看日志       | `docker compose logs -f app`                                                                              |
| 看资源占用   | `docker stats`                                                                                            |
| 备份数据     | `deploy/backup.sh`，见下文"备份与恢复"                                                                    |
| 重启 / 停止  | `docker compose restart` / `docker compose down`                                                          |

## 导出 EXE、VS 工程用的教材类库

实验页的"导出 EXE"把学生的程序编译成 Windows 程序，嵌入教材的**真机版**设备类库，在机房电脑上双击就能控制真的实训台；"导出 VS 工程"把这些 dll 放在工程的 lib 文件夹里。这些 dll 是教材配套资料，有版权，不进仓库（GitHub 上的仓库是公开的），要单独拷到服务器的 `~/IOT_SIM/textbook-libs/`（compose 把它只读挂进容器）。没放时导出会提示"服务器上没有放教材的设备类库"，其他功能不受影响。

放进同一个目录（不分子目录）的文件，都在教材配套资料里：

| 文件                                                                                                                            | 在配套资料里的位置                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `DeviceCtrlLibrary.dll`                                                                                                         | `公共库/设备控制类库/设备控制/`（**不是** `仿真/`） |
| `ComLibrary.dll`、`ICS.Acquisition.dll`、`ICS.Common.dll`、`ICS.Models.dll`、`IPCameraDll.dll`、`LEDLibrary.dll`、`MyCamer.dll` | `公共库/设备控制类库/设备控制/API/`                 |
| `WinFormsDeviceControlLibrary.dll`                                                                                              | `公共库/设备控件库/`                                |
| `AxInterop.WMPLib.dll`、`Interop.WMPLib.dll`（媒体播放器，项目 7 任务 2）                                                       | `项目7/任务二/寝室情景模式/寝室情景模式/bin/Debug/` |

在本机（配套资料解压在 `~/下载/物联网编程与应用配套/`）执行：

```bash
B=~/下载/物联网编程与应用配套/物联网编程与应用
ssh 服务器 mkdir -p IOT_SIM/textbook-libs
scp "$B"/公共库/设备控制类库/设备控制/DeviceCtrlLibrary.dll "$B"/公共库/设备控制类库/设备控制/API/*.dll \
    "$B"/公共库/设备控件库/WinFormsDeviceControlLibrary.dll \
    "$B"/项目7/任务二/寝室情景模式/寝室情景模式/bin/Debug/*Interop.WMPLib.dll 服务器:IOT_SIM/textbook-libs/
```

容器里的平台用普通用户运行，目录和文件要让其他用户能读（用 root 拷的文件常常是 `-rw-------`，导出时会提示"权限不够"）：

```bash
chmod 755 ~/IOT_SIM/textbook-libs
chmod 644 ~/IOT_SIM/textbook-libs/*.dll
```

拷好后不用重启，下一次导出就能用。本机开发时同样放在仓库根目录的 `textbook-libs/`（已在 .gitignore 里），也可以用环境变量 `SIM_TEXTBOOK_LIBS` 指到别处。

## 备份与恢复

平台不自动备份，在服务器的 `~/IOT_SIM` 下手动执行：

```bash
deploy/backup.sh                          # 备份到 backups/<日期时间>/，平台运行中也可以，学生不受影响
deploy/restore.sh backups/20261025-153000 # 用某份备份替换现在的全部数据
```

- 备份包括账号、班级、学生作品、作业、提交、评阅（`iot-sim.db`）和每个学生自己的数据库（`databases/`）。一个班一学期的数据估计两三百 MB，主要是提交时的界面截图。
- 备份放在宿主机的 `~/IOT_SIM/backups/` 里，不在 Docker 数据卷里，误删数据卷也还在；**要防服务器硬盘坏，把这个目录拷到别的机器上**。
- 建议在部署大的新版本前、学期中间、期末导出成绩后各备份一次。
- 恢复会先自动备份现在的数据（恢复错了还能换回来），然后停止平台约十几秒、替换数据、重新启动；正在运行的学生程序会结束，尽量不在上课时恢复。

## 可调参数

写在 `.env` 里，改完 `docker compose up -d` 生效。

| 变量                    | 默认             | 说明                                                                                                                                                                               |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEACHER_PASSWORD`      | （必填）         | 老师账号的密码                                                                                                                                                                     |
| `TEACHER_USERNAME`      | `admin`          | 老师账号                                                                                                                                                                           |
| `DEEPSEEK_API_KEY`      | （空）           | AI 评阅用的 DeepSeek 密钥；不填就不做 AI 评阅                                                                                                                                      |
| `AI_MODEL`              | `deepseek-flash` | AI 评阅用的模型（需要支持图片输入）                                                                                                                                                |
| `APP_MEM_LIMIT`         | `4g`             | 整个平台的内存上限                                                                                                                                                                 |
| `SIM_MAX_RUNS`          | `150`            | 全站同时运行的学生程序上限，超过时提示"服务器繁忙"                                                                                                                                 |
| `SIM_HEAP_LIMIT_MB`     | `128`            | 每个学生程序的内存上限                                                                                                                                                             |
| `SIM_CPU_LIMIT_SECONDS` | `120`            | 每次运行累计 CPU 时间上限（防死循环）                                                                                                                                              |
| `SIM_MAX_RUN_MINUTES`   | `60`             | 每次运行最长时间                                                                                                                                                                   |
| `SIM_GRADE_CONCURRENCY` | `16`             | 全站同时跑几个评分检查项（提交评分和"自己检查"共用）。2 核实测：45 人同时自测项目 8 任务 3，最后一人约 1.5 分钟出结果；调到 24 以上 CPU 不够，定时器来不及触发，正确的程序会被误判 |
