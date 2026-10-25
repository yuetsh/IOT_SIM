# 物联网编程仿真平台

面向中职《物联网编程与应用（第 2 版）》的在线仿真平台：学生在浏览器里写 C# WinForms 程序，
程序在服务器上运行，界面和虚拟实训台的效果在网页上实时显示。设计方案见 [docs/设计方案.md](docs/设计方案.md)。

## 目录

| 目录 | 内容 |
|---|---|
| `web/` | Vue 3 前端：代码编辑、虚拟窗体渲染、虚拟实训台 |
| `server/` | Bun 后端：示例工程接口，WebSocket 会话，为每次运行启动一个 C# 运行器 |
| `shared/` | 浏览器、服务器、运行器之间的消息协议（`protocol.ts`） |
| `runtime/` | .NET 10：仿真 WinForms（`Sim.WinForms`）、教材设备类库（`Sim.Devices`）、仿冒 SqlClient（`Sim.Data`，T-SQL 转写成 SQLite）、运行器（`Sim.Runner`） |
| `samples/` | 示例工程（按教材任务整理） |
| `docs/` | 设计方案（`设计方案.md`）、教材逐任务摘要（`教材摘要/`） |
| `deploy/` | 部署：Caddyfile、部署脚本和说明（`deploy/README.md`） |

## 本地开发

需要 Bun 和 .NET 10 SDK；装了 bubblewrap（`bwrap`）时，学生程序在本机也会放进沙箱运行，和服务器一致。

```bash
bun install                 # 安装前端和后端依赖
bun run build:runtime       # 编译 C# 运行时
bun run dev:server          # 启动后端（端口 3000）
bun run dev:web             # 启动前端（端口 5173），浏览器打开 http://localhost:5173
```

测试：

```bash
cd server
bun test              # 端到端测试：编译并运行示例，模拟浏览器操作
cd ../web && bun test src   # 窗体设计器：Designer.cs 读写、编辑操作、插入事件处理方法
bun test/load.ts 100  # 压力测试：同时运行 100 个学生程序
```

## 部署

Docker Compose，HTTPS 由服务器上的 Nginx Proxy Manager 负责。推送到 GitHub 的 main 后，GitHub Actions 跑完测试，SSH 到服务器执行 `deploy/update.sh`：服务器从 git.xuyue.cc 拉代码、构建镜像、重启。详见 [deploy/README.md](deploy/README.md)。

## 运行器的四种模式

`Sim.Runner` 通过标准输入输出与 Bun 服务器交换 JSON 消息（每行一条）：

- `compile-server`：常驻编译服务，全服务器共用一个。Roslyn 只加载一次，编译结果写回工程目录。
- `language-server`：常驻语言服务，全服务器共用一个：代码补全、悬停提示、参数提示、边写边检查。
- `sql-server`：常驻 SQL 服务，全服务器共用一个：数据库页面的查询和对象资源管理器，评分前按实验的 `database.sql` 建库。学生的数据库在 `data/databases/<用户编号>/`，每个库一个 SQLite 文件。
- `run <工程目录>`：运行已编译的学生程序，每次运行一个进程，不加载编译器。

## 当前进度：第 0 阶段（技术验证）已跑通

教材项目 2 任务 1（LED 显示屏）的书上代码原样运行：选串口、打开、推送文字，窗体上的 LED 控件和实训台 LED 屏都会滚动显示；不打开串口直接推送会弹出 "Error:发送失败"。

本机实测（16 核、28 GB）：

| 指标 | 结果 |
|---|---|
| 编译（编译服务预热后） | 约 10–300 ms |
| 启动到窗体显示 | 约 100 ms |
| 单次操作往返 | 约 15 ms |
| 100 个程序同时运行：内存 | 合计约 1.1 GB（PSS，平均每个 11 MB）；另加编译服务约 150 MB |
| 100 个程序同时点击：往返 | 中位数约 60 ms，P95 约 75 ms |

## 第 1 阶段进行中

已完成：

- **虚拟实训台**：按教材实训台布局图排列（红外对射、警示灯、LED 屏、照明灯、人体红外、温湿度、光照、烟雾、火焰、ADAM 模块）。每个浏览器会话一台，状态由服务器统一保存：传感器读数由网页上的滑块和开关设定，经服务器推给学生程序；灯、继电器、LED 屏由学生程序控制。
- 新控件：CheckBox、RadioButton（事件顺序与 WinForms 一致）、ListBox、PictureBox、DataGridView、DateTimePicker、TrackBar、Windows Media Player、Chart（图表），教材控件库的 Lamp、Alarm；Panel 停靠布局、背景图片、无边框窗体。
- 示例工程（按书上代码整理）：项目 1 任务 1–2、项目 2 任务 1–3、项目 3 任务 1–2、项目 4 任务 1–3、项目 5 任务 1–3、项目 6 任务 2–3、项目 7 任务 1–3、项目 8 任务 1–5，共 23 个（项目 6 任务 1 在数据库页面上完成）。网址带 `?sample=示例编号` 可直接打开指定示例。
- 代码编辑器（Monaco）：C# 高亮、编译错误波浪线、点错误跳到对应行、F5 运行 / Shift+F5 停止、草稿自动保存在浏览器本地。
- 窗体设计器（仿 VS，界面中文）：工具箱、拖放与改大小、属性窗口、事件窗口、双击生成事件处理方法、撤销 / 重做；读写 VS 格式的 Designer.cs。
- 多窗体：新建、删除窗体；运行时多个窗口可切换前后。
- 部署：bubblewrap 沙箱（断网、只读、看不到其他进程，限制内存、CPU 时间和运行时长）、编译时禁止网络 / 反射 / 启动进程等 API、Docker Compose、GitHub Actions 自动部署。
- 第 2 阶段（进行中）：账号登录（本机开发时老师账号为 admin / admin）、班级管理与 CSV 名单导入、学生作品保存在服务器上；自动评分（每个示例的 `checks.yaml`）；实验页"评价项"可以自己检查（不计分）；布置作业、学生提交后自动评分；老师评阅（看代码和界面截图、运行学生的程序、老师评分项打分、评语）、AI 评阅建议（DeepSeek，老师采纳后生效）、全班成绩表与 CSV 导出。
- 第 3 阶段（教材项目 4–8 已全部完成）：教材项目 5 用到的旧版线程 API（`Thread.Suspend` / `Resume` / `Abort`）编译时改写成平台的协作式实现（`runtime/Sim.Runner/LegacyThreadRewriter.cs`、`runtime/Sim.WinForms/Host/LegacyThreads.cs`）；网络摄像机（画面帧由 `runtime/Sim.Devices/Camera/build-frames.ts` 从 `scene.svg` 生成，需要 rsvg-convert 和 ImageMagick）。

尚未完成：

- 一个班试用。
- 书上的扩展练习（"边想边做""自主探究"）、导出 VS 工程、校园街景场景、故障注入题库（第 4 阶段）。
