## 任务目标

模拟校园信息发布：选好 LED 显示屏的串口并打开，在文本框里输入一段文字，点"推送"后实训台的 LED 屏和窗体上的 LED 控件都显示这段文字；推送失败时弹出出错信息。

练习重点：分组框（GroupBox）、下拉框的 Click 事件、用 `SerialPort.GetPortNames()` 列出串口、调用设备类库、自定义控件 LED。详细步骤见书 p23–27。

## 界面和控件名

| 控件       | 名称（Name）   | 文字（Text）和用途                              |
| ---------- | -------------- | ----------------------------------------------- |
| 窗体       | `Form1`        | LED显示屏                                       |
| LED 显示屏 | `led`          | 窗体上方的大块 LED 控件，在工具箱"物联网设备"里 |
| 分组框     | `groupBox1`    | LED控制                                         |
| 下拉框     | `com_Port`     | 串口（前面放标签"串口"）                        |
| 按钮       | `btn_Open`     | 打开                                            |
| 文本框     | `txt_SendText` | 要推送的文字（前面放标签"推送LED信息"）         |
| 按钮       | `btn_Send`     | 推送                                            |

> 书上的表格把 LED 控件写成 `LED`，代码里用的是小写的 `led`，请按代码起名。

## 实现步骤

1. 平台已经引用好了 `DeviceCtrlLibrary.dll` 和 `WinFormsDeviceControlLibrary.dll`，不用像书上那样复制 dll、添加引用；LED 显示屏、灯泡、报警灯这些控件直接在工具箱的"物联网设备"里。
2. 代码开头加上 `using System.IO.Ports;`、`using DeviceCtrlLibrary;`、`using WinFormsDeviceControlLibrary;`。
3. **com_Port 的 Click**（在 ⚡ 事件里双击 Click）：先清空下拉框，再用 foreach 把 `SerialPort.GetPortNames()` 的每个串口号加进去。这样每次点开下拉框都会刷新串口列表。
4. **btn_Open 的 Click**：调用 `DeviceCtrlHelper.ledHelper.OpenLedCom(com_Port.Text)` 打开选中的串口。
5. **btn_Send 的 Click**：调用 `DeviceCtrlHelper.ledHelper.SendLedString(txt_SendText.Text)`，把返回的字符串存到变量 res；如果 res 里含有 "Error"（`res.IndexOf("Error") >= 0`）就用 MessageBox 显示出来，否则调用 `led.setLedText(res)` 让窗体上的 LED 控件显示。

## 和书上不一样的地方

> 知识提炼的 try-catch 示例里，书上把 `catch (Exception ex)` 印成了 `Catch(EventArgs ex)`，照抄会编译不过：catch 要小写，括号里是异常类型 Exception。

## 在平台上怎么试

1. 运行后点开"串口"下拉框，选 **COM5**（LED 屏），点"打开"。
2. 输入"欢迎光临"，点"推送"，实训台的 **LED 显示屏**和窗体上的 LED 控件都应显示"欢迎光临"。
3. 重新运行，不点"打开"直接推送，应弹出"Error:发送失败"。
