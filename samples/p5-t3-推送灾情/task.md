## 任务目标

把任务 1、任务 2 合在一起：点"获取"时同时读火焰和烟雾传感器，显示在窗体上，把灾情推送到 LED 屏（实训台的屏和窗体上的 LED 控件都显示）；每次发现灾情都记进一个二维数组，点"历史灾情信息"打开第二个窗体，在列表框里列出全部记录。

练习重点：二维数组、静态类成员、continue 语句、两个窗体、列表框（ListBox）。详细步骤见书 p104–107。

## 界面和控件名

主窗体 Form1：

| 控件       | 名称（Name）                        | 文字（Text）和用途           |
| ---------- | ----------------------------------- | ---------------------------- |
| 窗体       | `Form1`                             | 火焰烟雾                     |
| LED 显示屏 | `led1`                              | 窗体顶部，显示推送的灾情     |
| 分组框     | `groupBox2`                         | 数据采集                     |
| 标签       | `lbl_time`、`lbl_fire`、`lbl_smoke` | 时间、火焰、烟雾             |
| 文本框     | `txt_time`、`txt_fire`、`txt_smoke` | 显示时间、火焰状态、烟雾状态 |
| 按钮       | `btn_get`                           | 获取                         |
| 分组框     | `groupBox1`                         | 配置                         |
| 标签       | `lbl_Ledport`                       | LED                          |
| 下拉框     | `com_ledPort`                       | LED 屏的串口                 |
| 标签       | `lbl_4150port`                      | 环境采集                     |
| 下拉框     | `com_environmentPort`               | ADAM-4150 的串口             |
| 按钮       | `btn_Open`                          | 开启（打开后变成"关闭"）     |
| 按钮       | `OpenRecord`                        | 历史灾情信息                 |

历史记录窗体 Form2：

| 控件   | 名称（Name）  | 文字（Text）和用途 |
| ------ | ------------- | ------------------ |
| 窗体   | `Form2`       | 历史灾情记录       |
| 列表框 | `lstbRecored` | 一行一条灾情记录   |

> 书上表 5-6 没列 `btn_get`、`OpenRecord`、`groupBox2`，照图加上。`lstbRecored` 的拼写就是这样（不是 Record），照着写。

## 实现步骤

1. 点 **＋ 新建类**，建 `RecordClass`，写两个静态成员：`string[,] record = new string[50, 2]`（每条记录存时间和内容）、`int recoudeindex = 0`（下一条记录存在第几行）。
2. Form1 的代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using DeviceCtrlLibrary.Model;`；全局变量：`ADAM4150ResModel ResModel;`、`bool IsOpen = false;`、`string LED_MSG = "";`。
3. **Form1_Load**：清空两个下拉框，用 for 循环加串口号；遇到 `COM1`（电脑自带的串口）就 `continue` 跳过。平台上没有 COM1，这段照书保留，在机房真机上才用得到。
4. **btn_Open 的 Click**：打开时调用 `adam4150Helper.Open(com_environmentPort.Text)` 和 `ledHelper.OpenLedCom(com_ledPort.Text)`，按钮改成"关闭"；关闭时关闭 ADAM-4150 串口，按钮改回"开启"。
5. **btn_get 的 Click**：
   - 用 `adam4150Helper.SetData()` 读出数据存进 `ResModel`，清空 `LED_MSG`，显示当前时间，火焰、烟雾两个框先写"正常"；
   - `fireValue` 为 `true`：火焰框写"发现火情"，`LED_MSG` 加上"发现火情"，把时间和内容记进数组当前行，`recoudeindex` 加 1；
   - `smokeValue` 为 `true`：同样处理，写的是"发现烟情"；
   - 用 `ledHelper.SendLedString(LED_MSG)` 推送到 LED 屏，返回的字符串里没有 "Error" 时，再用 `led1.setLedText(...)` 显示到窗体上。
6. 点 **＋ 新建窗体**，建 Form2，放列表框 `lstbRecored`。
7. **OpenRecord 的 Click**：`new` 一个 Form2 并 `Show()`。
8. **Form2_Load**：for 循环从 0 到 `recoudeindex - 1`，把每条记录的"时间 + 内容"加进 `lstbRecored`。

## 和书上不一样的地方

> **烟雾记录写成了火情**：书上烟雾分支往数组里记的内容是" 发现火情"，要改成" 发现烟情"，否则历史记录里看不到烟情。

> **列表框的名字**：书上 Form2_Load 里写的是 `listBox1`，表 5-7 和界面里叫 `lstbRecored`，代码要写 `lstbRecored`。

> 书上烟雾分支有一行注释只写了一个 `/`，照抄会编译不过，要写成 `//`。

## 在平台上怎么试

1. 运行后"LED"选 **COM5**（LED 屏），"环境采集"选 **COM3**（ADAM-4150），点"开启"。
2. 在实训台上把**火焰传感器**点成"有火焰"，点"获取"：火焰框显示"发现火情"、烟雾框显示"正常"，实训台的 LED 屏和窗体上的 LED 控件都显示"发现火情"。
3. 把火焰点回"正常"、**烟雾传感器**点成"有烟雾"，再点"获取"，火焰框显示"正常"、烟雾框显示"发现烟情"。
4. 点"历史灾情信息"，列表里应有"发现火情"和"发现烟情"两条，每条前面是时间。
