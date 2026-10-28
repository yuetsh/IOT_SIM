## 任务目标

做一个"楼梯灯"：勾选**人体开关**后，程序每 5 秒检查一次人体红外传感器，有人就开路灯，没人就关灯；不勾选时用"开""关"两个按钮手动控制。

练习重点：复选框的 Click 事件、定时器（Timer）、控件的 Enabled 属性。详细步骤见书 p58–61。

## 界面和控件名

| 控件   | 名称（Name）      | 文字（Text）和用途                             |
| ------ | ----------------- | ---------------------------------------------- |
| 窗体   | `Form1`           | 人体红外ZigBee联动                             |
| 灯泡   | `lamp1`           | 窗体上显示路灯的亮灭                           |
| 按钮   | `btn_lampOpen`    | 开（手动开灯）                                 |
| 按钮   | `btn_lampClose`   | 关（手动关灯）                                 |
| 分组框 | `groupBox1`       | 配置                                           |
| 标签   | `lbl_lamp`        | 路灯                                           |
| 标签   | `lbl_environment` | 环境采集                                       |
| 下拉框 | `com_lamp`        | 路灯（ZigBee 协调器）的串口                    |
| 下拉框 | `com_environment` | 环境采集（ADAM-4150）的串口                    |
| 复选框 | `ch_bodyInfrared` | 人体开关                                       |
| 按钮   | `btn_open`        | 打开（打开后变成"关闭"）                       |
| 定时器 | `timer1`          | Interval 设为 5000（5 秒），Enabled 保持 False |

> 书上的表格写的是 `btn_Open`，代码里是 `btn_open`。名字区分大小写，请按代码写成 `btn_open`，否则自动评分找不到这个按钮。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;` 和 `using DeviceCtrlLibrary;`。
2. **Form1_Load**：清空两个下拉框，用 `SerialPort.GetPortNames()` 把串口号加进去。
3. 写一个方法 `LampOnOff(int RelayNum, bool IsOpen)`：调用 `DeviceCtrlHelper.zigBeeHelper.OnOff` 控制实训台的路灯，再调用 `lamp1.OnOff` 让窗体上的灯泡跟着变。
4. **btn_open 的 Click**：和任务 1 一样，按钮文字是"打开"时打开 ZigBee 串口（`com_lamp.Text`）并改成"关闭"，反之关闭串口。
5. **btn_lampOpen、btn_lampClose 的 Click**：分别调用 `LampOnOff(1, true)`、`LampOnOff(1, false)`。
6. **ch_bodyInfrared 的 Click**：
   - 勾上时：打开 ADAM-4150 串口（`adam4150Helper.Open(com_environment.Text)`），启动 `timer1`，两个手动按钮设为不可用；
   - 取消时：关闭串口，停止 `timer1`，两个按钮恢复可用。
7. **timer1 的 Tick**：读 `adam4150Helper.SetData().bodyInfraredValue`，是 `true`（有人）就开灯，否则关灯。

> 书上第 15 步说"进入 Click 事件"，定时器的事件其实是 **Tick**（事件窗口里叫"计时到"）：在设计器里双击 timer1 就会生成 `timer1_Tick`。

## 在平台上怎么试

1. 运行后，"路灯"选 **COM4**（ZigBee 协调器），"环境采集"选 **COM3**（ADAM-4150），点"打开"。
2. 点"开""关"，看窗体上的灯泡和实训台的**照明灯 1** 是否一起亮灭。
3. 勾选"人体开关"，"开""关"按钮应变成灰色；在实训台上把**人体红外**点成"有人"，5 秒内路灯应亮起，点回"无人"后 5 秒内熄灭。
