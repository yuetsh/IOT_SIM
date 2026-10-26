## 任务目标

做一个"智慧会议室"预约窗体：程序一启动就每秒显示当前时间和光照度、温度、湿度、气压、空气质量。填好时、分、秒，选一种模式（会议、讨论、展示），点"预约"；到了预约时间，程序自动开启这种模式，控制灯光、窗帘和主、客话筒：

| 模式 | 灯光 | 窗帘（滑动条） | 主话筒 | 客话筒 |
| ---- | ---- | -------------- | ------ | ------ |
| 会议 | 开   | 0（全开）      | 开     | 关     |
| 讨论 | 开   | 0（全开）      | 开     | 开     |
| 展示 | 开   | 10（全关）     | 开     | 关     |

勾选"拍照记录"时，预约时间到了还要打开网络摄像头，每 5 分钟存一张照片。点"退出"关掉所有设备。

练习重点：DateTime 的计算和比较（AddHours、AddMinutes、AddSeconds），switch 语句，用 `+=` 订阅事件。详细步骤见书 p148–153。

## 先添加项目资源

点代码上方的**项目资源**，在素材库里勾选 `switch_on`、`switch_off` 两张开关图片（名字和书上一样，不能自己上传）。三个开关图片框的**图片**属性都选 `Resources.switch_off`。

## 界面和控件名

| 控件   | 名称（Name）                                   | 文字（Text）和用途                       |
| ------ | ---------------------------------------------- | ---------------------------------------- |
| 窗体   | `frm_control`                                  | 智慧会议室情景模式                       |
| 分组框 | `grp_mode`                                     | 模式选择                                 |
| 标签   | `lbl_time`                                     | 当前时间：00:00:00（运行时显示当前时间） |
| 标签   | `lbl_mode`                                     | 智慧会议室未开启情景模式                 |
| 复选框 | `chk_record`                                   | 拍照记录                                 |
| 文本框 | `txt_hour`、`txt_minute`、`txt_second`         | 预约的时、分、秒，默认 13、20、00        |
| 标签   | `lbl_hour`、`lbl_minute`、`lbl_second`         | 时、分、秒将会有场                       |
| 下拉框 | `com_mode`                                     | 选择模式，默认文字"会议"                 |
| 按钮   | `btn_reserve`                                  | 预约                                     |
| 按钮   | `btn_exit`                                     | 退出                                     |
| 分组框 | `grp_input`                                    | 采集量                                   |
| 下拉框 | `com_import`                                   | 采集器的串口                             |
| 文本框 | `txt_light`、`txt_temperature`、`txt_humidity` | 光照度、温度、湿度                       |
| 文本框 | `txt_airPressure`、`txt_airQuality`            | 气压、空气质量                           |
| 文本框 | `txt_camera`                                   | 摄像头 IP 地址，默认 192.168.14.131      |
| 分组框 | `grp_status`                                   | 状态栏                                   |
| 滑动条 | `trb_curtain`                                  | 模拟窗帘：0 全开，10 全关                |
| 图片框 | `pic_lightsStatus`                             | 灯光开关，点它手动开关灯                 |
| 灯泡   | `lamp`                                         | 窗体上显示灯的亮灭                       |
| 图片框 | `pic_mainMicrophone`、`pic_subMicrophone`      | 主、客话筒开关，点它手动开关             |
| 定时器 | `timer`                                        | 间隔 1000（1 秒）                        |

其余标签（串口、光照度、温度、湿度、气压、空气质量、摄像头IP地址、窗帘、全开、全关、灯光、话筒、主、客）照书上的图摆好，名字不影响评分。书上表格里还有 CO₂ 浓度一行，但代码里没有用到，可以不做。

> 窗体名：在设计器里点窗体空白处，把属性窗口的**名称**从 `Form1` 改成 `frm_control`，类名、文件名和 Program.cs 会跟着改。先改名再双击窗体，生成的 Load 事件才叫 `frm_control_Load`。

## 实现步骤

1. 代码开头加上 `using System.IO;`、`using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using DeviceCtrlLibrary.Model;`。
2. 声明全局变量：灯、主话筒、客话筒是否打开，模式是否已经开启（`IsInitialized`），`ADAM4017ResModel ResModel`，`DateTime now`，预约时间 `reserve`（先设成 `DateTime.Now.AddDays(1)`，也就是明天，免得一启动就"到时间"），摄像头读到的图片 `Image ReadImage = null`。
3. **Load**：
   - 清空两个下拉框，把串口号加进 `com_import`，`com_mode` 加入"会议""讨论""展示"；
   - 启动 `timer`；
   - 程序目录下没有 `Camera/` 文件夹就建一个（`Directory.Exists`、`Directory.CreateDirectory`）；
   - 用 `+=` 给 `ipCameraHelper.ImageRead` 绑定一个方法，在方法里把 `e.img` 存进 `ReadImage`。
4. **btn_reserve 的 Click**：`reserve = DateTime.Today`，再依次加上三个文本框里的时、分、秒（`Convert.ToInt16` 转成数字）。
5. 写 **ChooseMode()** 方法：`lbl_mode` 显示"智慧会议室已开启××模式"，用 `switch (com_mode.Text)` 按上面的表格设置灯（图片、`lamp`、`adam4150Helper.OnOff(1, ...)`）、`trb_curtain.Value` 和两个话筒的图片。
6. **timer 的 Tick**：
   - 用 `com_import.Text` 打开 `adam4017Helper`、`adam4150Helper`；
   - `now = DateTime.Now`，`lbl_time` 显示 `HH:mm:ss`，读出数据填进五个文本框；
   - `now >= reserve` 时：模式还没开启就调用 `ChooseMode()`，勾了"拍照记录"就打开并启动摄像头（`ipCameraHelper.Open(txt_camera.Text, "admin", "")`、`Start()`），然后记下已开启；分钟能被 5 整除且秒是 0 时，把 `ReadImage` 存到 `Camera/` 文件夹，文件名用当前时间。
7. **三个开关图片框的 Click**：灯、主话筒、客话筒各自开着就关、关着就开（灯还要控制 `lamp` 和实训台的照明灯）。
8. **btn_exit 的 Click**：停止 `timer`，`reserve` 改回明天，"拍照记录"设为不可用，关灯、关两个话筒，`trb_curtain.Value = 0`，`IsInitialized` 改回 false，关闭两个采集器和摄像头。

## 和书上不一样的地方

> **书上 Load 里没有把串口号加进 `com_import`**（注释写了，代码漏了），下拉框是空的，选不了串口。要补上 `foreach (string item in SerialPort.GetPortNames())` 那几行。

> 书上表格里温度文本框写的是 `txt_temperation`，代码里用的是 `txt_temperature`，请按代码写，自动评分按 `txt_temperature` 找。

## 在平台上怎么用时钟

- 实训台上的**时钟**可以拨到任意时刻：填好时刻点"拨到"，程序里的 `DateTime.Now` 就从这个时刻往后走，点"恢复真实时间"回到现在。不用真的等到下午 1 点 20 分。
- 拨时间时**日期别动**：预约时间是按"今天"算的。
- 摄像头拍的照片会出现在运行区下方的"程序保存的图片"里，只在这次运行中保留。"每 5 分钟拍照"这一项自动评分不检查，由老师看代码评阅。

## 在平台上怎么试

1. 运行后串口选 **COM2**（程序一启动就在采集，不用点别的按钮）。在实训台上拖动光照、温度滑块；气压、空气质量在 ADAM-4017+ 那块点"Vin3–6 更多传感器"展开。几秒内文本框应跟着变。
2. 把时钟拨到 **13:19:54**；模式选"讨论"，时分秒填 13、20、00，点"预约"。
3. 预约时间没到时，ADAM-4150 的 **DO1 照明灯**不亮；到 13:20:00 后，应显示"智慧会议室已开启讨论模式"，照明灯亮，窗帘滑块到 0，主、客话筒都是开。
4. 点"退出"，灯、话筒都关掉。想再试一次，重新运行程序。
