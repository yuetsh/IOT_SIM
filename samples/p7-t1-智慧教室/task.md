## 任务目标

做一个"智慧教室"控制窗体：点"启用"后，程序每 2 秒读一次光照度、温度、湿度并显示出来，再按读数自动控制设备——光线暗就开灯、太亮就关灯；太热或太冷就开空调并调好温度，否则关空调。灯也可以点开关图片手动开关。

练习重点：滑动条（TrackBar）的 Minimum / Maximum / Value，图片框（PictureBox）显示项目资源里的图片，定时器 Tick 里的 if / else if 判断。详细步骤见书 p133–137。

## 先添加项目资源

开关图片用 `switch_on`（开）和 `switch_off`（关）。书上是"项目属性 → 资源 → 添加资源"，平台上点代码上方的**项目资源**，在素材库里勾选这两张图（名字和书上一样，不能自己上传图片）。

加好后，图片框的**图片**属性可以直接选 `Resources.switch_off`；代码里写 `Properties.Resources.switch_on`。

## 界面和控件名

| 控件   | 名称（Name）                                   | 文字（Text）和用途                              |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| 窗体   | `frm_control`                                  | 智慧教室情景控制                                |
| 分组框 | `grp_mode`                                     | 模式选择                                        |
| 标签   | `lbl_mode`                                     | 智慧教室将开启（启用后变成"智慧教室已开启"）    |
| 按钮   | `btn_apply`                                    | 启用（启用后变成"关闭"）                        |
| 分组框 | `grp_input`                                    | 采集量                                          |
| 下拉框 | `com_import`                                   | 采集器的串口                                    |
| 文本框 | `txt_light`、`txt_temperature`、`txt_humidity` | 光照度、温度、湿度                              |
| 分组框 | `grp_status`                                   | 状态栏                                          |
| 图片框 | `pic_airconditioneStatus`                      | 空调开关状态，图片选 switch_off                 |
| 滑动条 | `trb_airconditione`                            | 模拟空调温度：最小值 18，最大值 32，值 18       |
| 图片框 | `pic_lightsStatus`                             | 灯光开关状态，图片选 switch_off；点它手动开关灯 |
| 灯泡   | `lamp`                                         | 窗体上显示灯的亮灭                              |
| 定时器 | `timer`                                        | 间隔 2000（2 秒）                               |

其余标签（串口、光照度、温度、湿度、空调、灯光、18℃、32℃）照书上的图摆好，名字不影响评分。

> 窗体名：在设计器里点窗体空白处，把属性窗口的**名称**从 `Form1` 改成 `frm_control`，类名、文件名和 Program.cs 会跟着改。先改名再双击窗体，生成的 Load 事件才叫 `frm_control_Load`。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using DeviceCtrlLibrary.Model;`。
2. 声明全局变量：串口是否打开、灯是否打开、空调是否打开（三个 bool，都是 false），以及 `ADAM4017ResModel ResModel`。
3. **Load**：用 `SerialPort.GetPortNames()` 把串口号加进 `com_import`。
4. **btn_apply 的 Click**：
   - 没打开时：用 `com_import.Text` 打开 `adam4017Helper` 和 `adam4150Helper`，按钮改成"关闭"，`lbl_mode` 改成"智慧教室已开启"，启动 `timer`；
   - 已打开时：关闭两个采集器，停止 `timer`，文字改回"启用""智慧教室将开启"。
5. **timer 的 Tick**：
   - `adam4017Helper.SetData()` 读出数据，把 lightValue、temperatureValue、humidityValue 填进三个文本框；
   - 光照度（用 `Convert.ToInt16` 转成数字）**小于 400** 开灯：图片换成 switch_on，`lamp.OnOff(true)`，`adam4150Helper.OnOff(1, true)`，记下灯已打开；**大于 800** 关灯（反过来做一遍）；
   - 温度**高于 30℃**：空调图片换成 switch_on，`trb_airconditione.Value = 26`；**低于 5℃**：图片换成 switch_on，`Value = 25`；其他情况：图片换成 switch_off，`Value = 18`。
6. **pic_lightsStatus 的 Click**：灯开着就关（图片、灯泡、实训台照明灯一起关），关着就开。

## 和书上不一样的地方

> **手动开关灯的判断写反了**：书上 pic_lightsStatus_Click 写的是 `if (!IsLampOpen) { 关灯 }`，这样灯关着时点了还是关。应该是 `if (IsLampOpen) { 关灯 } else { 开灯 }`。

> **滑动条要设最小值 18、最大值 32**：书上的表格没写。滑动条默认最大值是 10，代码里把 Value 设成 26 时程序会出错。

> 书上表格里温度文本框写的是 `txt_temperation`，代码里用的是 `txt_temperature`，请按代码写，自动评分按 `txt_temperature` 找。

## 在平台上怎么试

1. 运行后串口选 **COM2**，点"启用"，按钮变成"关闭"。两个采集器都用这个串口打开（书上就是这样写的）。
2. 在实训台上拖动光照、温度、湿度的滑块，2 秒内三个文本框应跟着变。
3. 把光照拖到 400 以下，窗体上的灯泡和实训台 ADAM-4150 的 **DO1 照明灯**应一起亮；拖到 800 以上应熄灭。
4. 把温度拖到 30℃ 以上，空调滑块应停在 26；拖到 5℃ 以下停在 25；其他温度回到 18。
5. 点灯光的开关图片，灯应该一下开、一下关。
