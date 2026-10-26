## 任务目标

做一个围墙入侵监测程序：点"开启"后，每 2 秒读一次红外对射传感器，在窗体上显示当前时间和"发现入侵"或"正常"；再点一次"关闭"，停止检测。

练习重点：定时器（Timer）的 Tick 事件、用一个 bool 变量记住开关状态、foreach 语句。详细步骤见书 p73–76。

## 界面和控件名

| 控件   | 名称（Name） | 文字（Text）和用途         |
| ------ | ------------ | -------------------------- |
| 窗体   | `Form1`      | 红外对射                   |
| 标签   | `lbl_port`   | 环境串口                   |
| 下拉框 | `com_port`   | ADAM-4150 的串口           |
| 按钮   | `btn_open`   | 开启（打开后变成"关闭"）   |
| 分组框 | `groupBox1`  | 数据显示                   |
| 标签   | `lbl_time`   | 时间                       |
| 文本框 | `txt_time`   | 显示当前时间               |
| 标签   | `lbl_even`   | 入侵                       |
| 文本框 | `txt_even`   | 显示"发现入侵"或"正常"     |
| 定时器 | `timer1`     | Interval 设为 2000（2 秒） |

> 书上的表格里没有分组框，看书上的界面图，"时间""入侵"两行放在"数据显示"分组框里。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;` 和 `using DeviceCtrlLibrary;`。
2. 声明全局变量 `bool IsOpen = false;`，记住串口有没有打开。
3. **Form1_Load**：清空 `com_port`，用 foreach 把 `SerialPort.GetPortNames()` 里的串口号逐个加进去。
4. **btn_open 的 Click**：先把 `IsOpen` 取反；
   - 变成 true 时：打开 ADAM-4150 串口（`adam4150Helper.Open(com_port.Text)`），启动 `timer1`，按钮文字改成"关闭"；
   - 变成 false 时：关闭串口，停止 `timer1`，按钮文字改回"开启"。
5. **timer1 的 Tick**：把 `DateTime.Now` 显示到 `txt_time`；读 `adam4150Helper.SetData().infraredValue`，是 `true` 就在 `txt_even` 显示"发现入侵"，否则显示"正常"。

## 和书上不一样的地方

> 书上的全局变量印成了 `boolIsOpen = false;`，`bool` 和 `IsOpen` 之间要有空格，照抄会编译不过。

## 在平台上怎么试

1. 运行后串口选 **COM3**（ADAM-4150），点"开启"，按钮变成"关闭"，约 2 秒后时间框开始显示时间。
2. 在实训台顶棚点**红外对射**（光束断开，显示"有人闯入"），几秒内入侵框应显示"发现入侵"；再点一次恢复光束，应变回"正常"。
3. 点"关闭"，按钮变回"开启"，时间框不再更新。
