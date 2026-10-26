## 任务目标

从 ADAM-4017+ 模拟量采集器读出光照度、温度、湿度：选好串口点"开启"，再点"获取"，三个文本框显示传感器的当前值；"开启"按钮打开后变成"关闭"，再点一次关闭串口。

练习重点：标签（Label）和按钮（Button）、窗体的 Load 事件、用 bool 变量记住串口是否打开、读取设备类库返回的数据。详细步骤见书 p36–39。

## 界面和控件名

| 控件   | 名称（Name）                                   | 文字（Text）和用途         |
| ------ | ---------------------------------------------- | -------------------------- |
| 窗体   | `frm_analog`                                   | 模拟量采集                 |
| 分组框 | `grp_show`                                     | 数据显示                   |
| 标签   | `lbl_light`、`lbl_temperature`、`lbl_humidity` | 光照度、温度、湿度         |
| 文本框 | `txt_light`、`txt_temperature`、`txt_humidity` | 显示光照度、温度、湿度的值 |
| 按钮   | `btn_get`                                      | 获取                       |
| 分组框 | `grp_config`                                   | 配置                       |
| 下拉框 | `com_port`                                     | 串口                       |
| 按钮   | `btn_Open`                                     | 开启（打开后变成"关闭"）   |

> 窗体名：在设计器里点窗体空白处，把属性窗口的**名称**从 `Form1` 改成 `frm_analog`，类名、文件名和 Program.cs 会跟着改。先改名再双击窗体，生成的 Load 事件才叫 `frm_analog_Load`。

## 实现步骤

1. 代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using DeviceCtrlLibrary.Model;`（平台已经引用好了设备类库，不用复制 dll）。
2. 声明两个全局变量：`bool IsOpen = false;` 记录串口是否打开，`ADAM4017ResModel ResModel;` 存放读到的数据。
3. **frm_analog_Load**（窗体的 Load 事件，双击窗体空白处生成）：清空 `com_port`，用 foreach 把 `SerialPort.GetPortNames()` 的串口号加进去。
4. **btn_Open 的 Click**：
   - IsOpen 为 false 时：`DeviceCtrlHelper.adam4017Helper.Open(com_port.Text)` 打开串口，按钮文字改成"关闭"，IsOpen 设为 true；
   - 否则：`adam4017Helper.Close()` 关闭串口，按钮文字改回"开启"，IsOpen 设为 false。
5. **btn_get 的 Click**：`ResModel = DeviceCtrlHelper.adam4017Helper.SetData();`，把 `ResModel.lightValue`、`temperatureValue`、`humidityValue` 分别填进三个文本框。

## 和书上不一样的地方

> 书上把 `IsOpen = true`、`IsOpen = false` 印成了 `True`、`False`（首字母大写），C# 的布尔值只能小写，照抄会编译不过。

## 在平台上怎么试

1. 运行后串口选 **COM2**（ADAM-4017+），点"开启"，按钮应变成"关闭"。
2. 点"获取"，三个文本框应显示实训台上的默认值：温度 25、湿度 60、光照度 500。
3. 在实训台上把温度拖到 31、光照拖到 300，再点"获取"，文本框应变成新的数值。
