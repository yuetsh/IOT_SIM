## 任务目标

做一个火情监测窗体：选好串口点"开启"后，程序每 2 秒读一次火焰传感器，在"时间"框里显示当前时间，在"事件"框里显示"发现火情！"或"正常！"；再点一次按钮（这时文字是"关闭"）就停止采集。

练习重点：for 循环、带返回值的方法和 return 语句、DateTime.Now、定时器（Timer）。详细步骤见书 p91–94。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | 火焰 |
| 标签 | `lbl_port` | 串口 |
| 下拉框 | `com_port` | ADAM-4150 的串口 |
| 按钮 | `btn_open` | 开启（打开后变成"关闭"） |
| 分组框 | `groupBox1` | 数据显示 |
| 标签 | `lbl_time` | 时间 |
| 文本框 | `txt_time` | 显示当前时间 |
| 标签 | `lbl_even` | 事件 |
| 文本框 | `txt_even` | 显示有没有火情 |
| 定时器 | `timer1` | Interval 设为 2000（2 秒），Enabled 保持 False |

> 书上的表格里没有分组框，照图加一个 `groupBox1`（数据显示），把时间、事件两行放进去。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;` 和 `using DeviceCtrlLibrary;`，声明全局变量 `bool IsOpen = false;`。
2. **Form1_Load**：这次用 **for 循环**，从 0 数到 `SerialPort.GetPortNames().Length - 1`，把每个串口号加进 `com_port`。
3. **btn_open 的 Click**：先把 `IsOpen` 取反；打开时调用 `adam4150Helper.Open(com_port.Text)`、启动 `timer1`、按钮改成"关闭"；关闭时调用 `Close()`、停止 `timer1`、按钮改回"开启"。
4. 写一个方法 `GetFireInfo()`，返回 `String`：`adam4150Helper.SetData().fireValue` 是 `true` 就 `return "发现火情！";`，否则 `return "正常！";`。
5. **timer1 的 Tick**：`txt_time` 显示 `DateTime.Now.ToString()`，`txt_even` 显示 `GetFireInfo()` 的返回值。

> 在设计器里双击 timer1 就会生成 `timer1_Tick`。

## 在平台上怎么试

1. 运行后串口选 **COM3**（ADAM-4150），点"开启"，按钮变成"关闭"，2 秒左右"时间"框开始走。
2. 在实训台上把**火焰传感器**点成"有火焰"，几秒内"事件"框显示"发现火情！"；点回"正常"，显示"正常！"。
3. 点"关闭"，按钮变回"开启"，"时间"框不再变化。
