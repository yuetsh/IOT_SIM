## 任务目标

做一个报警灯控制程序：选好 ADAM-4150 的串口点"开启"，点"开"报警灯亮，点"关"报警灯灭，窗体上的报警灯跟着实训台上的灯一起变。

练习重点：switch 语句、带参数的方法。详细步骤见书 p84–87。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | 报警灯 |
| 报警灯 | `alarm1` | 窗体上显示报警灯的亮灭（工具箱"物联网设备"里的**报警灯**） |
| 按钮 | `btn_alarmOpen` | 开（打开报警灯） |
| 按钮 | `btn_alarmClose` | 关（关闭报警灯） |
| 分组框 | `groupBox1` | 配置 |
| 标签 | `label1` | 报警灯 |
| 下拉框 | `com_port` | ADAM-4150 的串口 |
| 按钮 | `btn_open` | 开启（打开后变成"关闭"） |

> 书上的表格把报警灯控件的名称写成 `Alarm`，那是控件的类型名；代码里用的名字是 `alarm1`，请按代码写，否则自动评分找不到它。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;` 和 `using DeviceCtrlLibrary;`。
2. 声明全局变量 `bool IsOpen = false;`。
3. **Form1_Load**：和任务 1 一样，把串口号加进 `com_port`。
4. 写一个方法 `AlarmOnOff(string Device, bool IsOpen)`，用 switch 按设备名分支：
   - `"Alarm"`：调用 `adam4150Helper.OnOff(0, IsOpen)` 控制接在 DO0 的报警灯，再调用 `alarm1.OnOff(IsOpen)` 改窗体上的报警灯；
   - `"LED1"`、`"LED2"`：分别控制继电器 1、2；
   - 其他（default）：弹出"没有合适的接口程序！"。
   - 每个分支最后都要有 `break;`。
5. **btn_open 的 Click**：把 `IsOpen` 取反，打开时 `adam4150Helper.Open(com_port.Text)`、文字改成"关闭"，关闭时 `adam4150Helper.Close()`、文字改回"开启"。这个任务不用定时器。
6. **btn_alarmOpen、btn_alarmClose 的 Click**：分别调用 `AlarmOnOff("Alarm", true)`、`AlarmOnOff("Alarm", false)`。

## 和书上不一样的地方

> 书上的全局变量又印成了 `boolIsOpen = false;`，`bool` 和 `IsOpen` 之间要有空格，照抄会编译不过。

## 在平台上怎么试

1. 运行后串口选 **COM3**（ADAM-4150），点"开启"，按钮变成"关闭"。
2. 点"开"，窗体上的报警灯和实训台顶棚的**警示灯**应一起亮；点"关"，一起灭。
