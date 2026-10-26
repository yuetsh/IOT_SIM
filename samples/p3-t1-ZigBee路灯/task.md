## 任务目标

做一个路灯遥控程序：选好 ZigBee 协调器的串口点"打开"，然后选"开"单选按钮路灯亮，选"关"路灯灭，窗体上的灯泡跟着实训台上的灯一起变。

练习重点：if 语句、按钮文字切换、单选按钮（RadioButton）的 CheckedChanged 事件、自己定义一个方法。详细步骤见书 p53–56。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | ZigBee路灯 |
| 灯泡 | `lamp1` | 窗体上显示路灯的亮灭（工具箱"物联网设备"里的**灯泡**） |
| 单选按钮 | `rb_Open` | 开（开灯） |
| 单选按钮 | `rb_Close` | 关（关灯） |
| 分组框 | `groupBox1` | 配置 |
| 标签 | `lbl_Lamp` | 路灯 |
| 下拉框 | `com_port` | ZigBee 协调器的串口 |
| 按钮 | `btn_open` | 打开（打开后变成"关闭"） |

> 书上的表格写的是 `btn_Open`，代码里是 `btn_open`。名字区分大小写，请按代码写成 `btn_open`，否则自动评分找不到这个按钮。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;` 和 `using DeviceCtrlLibrary;`。
2. 写一个方法 `LampOnOff(int RelayNum, bool IsOpen)`：调用 `DeviceCtrlHelper.zigBeeHelper.OnOff` 控制实训台的路灯，再调用 `lamp1.OnOff` 让窗体上的灯泡跟着变。
3. **Form1_Load**：清空 `com_port`，用 `SerialPort.GetPortNames()` 把串口号加进去。
4. **btn_open 的 Click**：用 if 判断按钮文字——是"打开"就用 `zigBeeHelper.Open(com_port.Text)` 打开串口，文字改成"关闭"；是"关闭"就 `zigBeeHelper.Close()`，文字改回"打开"。
5. **rb_Open 的 CheckedChanged**：调用 `LampOnOff(1, true)`。
6. **rb_Close 的 CheckedChanged**：调用 `LampOnOff(1, false)`。

## 和书上不一样的地方

> 书上第 12 步"关"按钮的事件方法名印成了 `rb_Open_CheckedChanged`，应该是 `rb_Close_CheckedChanged`。在设计器里双击"关"单选按钮，生成的名字就是对的。

## 在平台上怎么试

1. 运行后串口选 **COM4**（ZigBee 协调器），点"打开"，按钮变成"关闭"。
2. 选"开"，窗体上的灯泡和实训台的**照明灯 1** 应一起亮；选"关"，一起灭。
