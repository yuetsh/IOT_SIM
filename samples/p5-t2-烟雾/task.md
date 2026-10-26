## 任务目标

和任务 1 一样监测灾情，这次读的是烟雾传感器，而且不用定时器，改用**线程**：线程里用 while 循环每 2 秒读一次烟雾传感器，显示时间和"发现烟情"或"正常"。点"关闭"时把线程挂起，再点"开启"让线程继续，关闭窗体时终止线程。

练习重点：while 循环、线程 Thread（Start、Suspend、Resume、Abort、Thread.Sleep）、窗体的 FormClosing 事件。详细步骤见书 p98–101。

## 界面和控件名

| 控件   | 名称（Name） | 文字（Text）和用途       |
| ------ | ------------ | ------------------------ |
| 窗体   | `Form1`      | 烟雾                     |
| 标签   | `lbl_port`   | 串口                     |
| 下拉框 | `com_port`   | ADAM-4150 的串口         |
| 按钮   | `btn_open`   | 开启（打开后变成"关闭"） |
| 分组框 | `groupBox1`  | 数据显示                 |
| 标签   | `lbl_time`   | 时间                     |
| 文本框 | `txt_time`   | 显示当前时间             |
| 标签   | `lbl_even`   | 事件                     |
| 文本框 | `txt_even`   | 显示有没有烟情           |

> 界面和任务 1 一样，但**没有定时器**。书上的表格里没有分组框，照图加一个 `groupBox1`（数据显示）。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using System.Threading;`。
2. 声明全局变量：`bool IsOpen = false;`、`bool IsFirst = true;`（线程是不是第一次启动）、`Thread thd;`。
3. 写线程要运行的方法 `GetData()`：`while (true)` 循环里，`adam4150Helper.SetData().smokeValue` 是 `true` 就显示"发现烟情"，否则显示"正常"，两种情况都把当前时间写进 `txt_time`；每次循环最后 `Thread.Sleep(2000)`。
4. **Form1_Load**：这次用 **foreach** 把串口号加进 `com_port`；然后 `thd = new Thread(GetData);`，再写 `Control.CheckForIllegalCrossThreadCalls = false;`，允许线程直接改窗体上的控件。
5. **btn_open 的 Click**：先把 `IsOpen` 取反。
   - 打开时：打开 ADAM-4150 串口，按钮改成"关闭"；`IsFirst` 是 `true` 就把它改成 `false` 并 `thd.Start()`，否则 `thd.Resume()`；
   - 关闭时：关闭串口，按钮改回"开启"，`thd.Suspend()`。
6. **Form1 的 FormClosing**：终止线程（见下面"和书上不一样的地方"）。在设计器里选中窗体，到 **⚡ 事件** 里双击 FormClosing 生成方法。

## 和书上不一样的地方

> **关闭窗体时先让线程继续**：书上 FormClosing 里直接 `thd.Abort();`。如果点过"关闭"，线程正处于挂起状态，直接终止会出错（在真的 Visual Studio 里也一样）。要先判断 `thd.ThreadState == ThreadState.Suspended`，是的话先 `thd.Resume();`，再 `thd.Abort();`。

## 在平台上怎么试

1. 运行后串口选 **COM3**（ADAM-4150），点"开启"，按钮变成"关闭"，"时间"框开始走。
2. 在实训台上把**烟雾传感器**点成"有烟雾"，几秒内"事件"框显示"发现烟情"；点回"正常"，显示"正常"。
3. 点"关闭"，"时间"框应停住不动；再点"开启"，时间接着走，烟雾状态也继续更新。
4. 点"关闭"之后直接关掉窗体，不应弹出错误。
