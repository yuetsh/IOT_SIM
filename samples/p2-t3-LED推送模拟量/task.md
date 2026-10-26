## 任务目标

把任务 1 和任务 2 合起来：同时打开 ADAM-4017+ 和 LED 屏的串口，点"获取"读出光照度、温度、湿度，显示在文本框里，再拼成一句话推送到 LED 屏，例如"当前环境信息 光照度:500lx温度:25℃湿度:60%"。

练习重点：下拉框（ComboBox）和文本框（TextBox）、字符串拼接、一个按钮同时控制两个设备。详细步骤见书 p42–45。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `frm_LED` | LED推送模拟量 |
| LED 显示屏 | `led` | 窗体上方的 LED 控件 |
| 分组框 | `grp_show` | 数据显示 |
| 文本框 | `txt_light`、`txt_temperature`、`txt_humidity` | 显示光照度、温度、湿度的值（前面放标签） |
| 按钮 | `btn_get` | 获取 |
| 分组框 | `grp_config` | 配置 |
| 下拉框 | `com_adamPort` | 模拟量串口（ADAM-4017+） |
| 下拉框 | `com_ledPort` | LED串口 |
| 按钮 | `btn_open` | 开启（打开后变成"关闭"） |

> 书上的表格写的是 `btn_Open`，代码里是 `btn_open`（小写 o）；表格里也没有列 LED 控件，代码里叫 `led`。请按代码起名，自动评分按这些名字找控件。

> 窗体名：在设计器里点窗体空白处，把属性窗口的**名称**从 `Form1` 改成 `frm_LED`，类名、文件名和 Program.cs 会跟着改。先改名再双击窗体，生成的 Load 事件才叫 `frm_LED_Load`。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using DeviceCtrlLibrary.Model;`。
2. 声明全局变量：`bool IsOpen = false;`、`ADAM4017ResModel ResModel;`、`String LED_MSG = "";`（要推送的文字）。
3. **frm_LED_Load**：清空两个下拉框，用一个 foreach 把串口号同时加进 `com_adamPort` 和 `com_ledPort`。
4. **btn_open 的 Click**：
   - 没打开时：`adam4017Helper.Open(com_adamPort.Text)` 和 `ledHelper.OpenLedCom(com_ledPort.Text)` 打开两个串口，按钮改成"关闭"，IsOpen 设为 true；
   - 已打开时：`adam4017Helper.Close()` 和 `ledHelper.Close()` 关闭，按钮改回"开启"，IsOpen 设为 false。
5. **btn_get 的 Click**：
   - 先把 LED_MSG 清空，用 `adam4017Helper.SetData()` 读数据，填进三个文本框（和任务 2 一样）；
   - 把"当前环境信息"和三个值拼进 LED_MSG（光照度后面加 lx，温度加 ℃，湿度加 %）；
   - 调用 `ledHelper.SendLedString(LED_MSG)`，返回值里没有 "Error" 时，调用 `led.setLedText` 让窗体上的 LED 控件也显示。

## 和书上不一样的地方

> 书上关闭时调用的 `DeviceCtrlHelper.ledHelper.Close()`，教材配套的类库里其实没有这个方法。平台保留了它（什么也不做），书上的代码可以原样编译。

> 书上的 `True` / `False` 首字母大写是印刷错误，要写成小写的 `true` / `false`。

## 在平台上怎么试

1. 运行后"模拟量串口"选 **COM2**（ADAM-4017+），"LED串口"选 **COM5**（LED 屏），点"开启"。
2. 点"获取"，文本框显示温度 25、湿度 60、光照度 500，实训台的 **LED 显示屏**上应出现这三个数。
3. 在实训台上把温度拖到 31，再点"获取"，LED 屏上的温度应变成 31。
