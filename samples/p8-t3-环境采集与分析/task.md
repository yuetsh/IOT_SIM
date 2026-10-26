## 任务目标

让任务 2 做好的"校园环境"界面动起来：打开窗体后，后台线程每隔 5 秒多采集一次环境数据，显示在底部的文本框里并存进数据库；路灯可以点开关手动控制，也可以按光照度自动开关，开灯时背景换成亮灯的场景；能把天气信息、自己输入的文字推送到 LED 屏，勾选"自动推送火情"后有火情自动推送；点"数据分析"用折线图显示最近 7 天每天的最高温度和平均温度。

练习重点：自己写类（AppSet、SQLHelper、SQLBLL）、后台线程（Thread）和 SynchronizationContext 回到界面线程更新控件、参数化的 SQL 语句、图表绑定数据（DataSource + DataBind）、复选框的 CheckedChanged 事件。详细步骤见书 p164–174。

## 先准备数据库

这个任务用 **WisdomCampus** 库（书上配套资料里附带的库）：EnvironmentData 表存环境数据，SecurityData 表存报警图片（任务 4、5 用），Users 表存用户。平台已经按书上的表结构建好，并预置了 7 天的环境数据，"数据分析"一打开就有图。

第一次运行这个实验时，平台会自动建好这个库；数据弄乱了，到右上角的**数据库**页面点**恢复实验初始数据**，选这个实验。

## 界面和控件名

界面在任务 2 已经做好，这次要写代码的控件：

| 窗体     | 名称（Name）                                   | 文字（Text）和用途                         |
| -------- | ---------------------------------------------- | ------------------------------------------ |
| 主界面   | `Main`                                         | Load 里打开所有设备的串口                  |
| 主界面   | `pic_environment`                              | "校园环境"：打开 Environment 窗体          |
| 校园环境 | `Environment`                                  | Load 里启动采集线程，FormClosed 里停止线程 |
| 校园环境 | `txt_fire`、`txt_smoke`                        | 显示"发生火情"/"发生烟情"或"正常"          |
| 校园环境 | `txt_light`、`txt_temperature`、`txt_humidity` | 显示光照、温度、湿度                       |
| 校园环境 | `btn_dataAnalyse`                              | 数据分析 / 关闭图表                        |
| 校园环境 | `chart1`                                       | 最近 7 天的最高温度、平均温度              |
| 校园环境 | `btn_ledEnvironment1`、`btn_ledEnvironment2`   | 推送天气信息（两个按钮做同一件事）         |
| 校园环境 | `pic_lampOpen`                                 | 灯光控制开关：点一下开灯，再点关灯         |
| 校园环境 | `ch_autoLamp`                                  | 自动控制路灯                               |
| 校园环境 | `txt_autoLight`                                | 设定开灯光照值：光照低于它就开灯           |
| 校园环境 | `txt_ledMsg`                                   | 要推送的 LED 信息                          |
| 校园环境 | `btn_ledSendMsg`                               | 推送LED信息                                |
| 校园环境 | `ch_autoLedFire`                               | 自动推送火情                               |

## 实现步骤

1. 点 **＋ 新建类**，建 `AppSet`：四个串口（ADAM-4017+ 是 COM2、ADAM-4150 是 COM3、ZigBee 是 COM4、LED 屏是 COM5）、摄像机的 IP / 用户名 / 密码（任务 4 用）、数据库连接字符串，都写成 `public static string`。
2. 再建 `SQLHelpers/SQLHelper` 和 `SQLHelpers/SQLBLL` 两个类（带文件夹，命名空间是 `智慧校园.SQLHelpers`）：
   - SQLHelper：`getData` 执行查询返回 DataSet，`Exec` 执行增删改返回影响的行数（出错返回 −1），`SaveData` 用 SqlCommandBuilder 保存 DataTable；
   - SQLBLL：`EnvironmentUpData` 把一次采集的数据 insert 进 EnvironmentData，`GetEnvironmentGraphData` 按天分组查出最近 7 天的最高温度和平均温度，`SecurityUpData`、`GetSecurityData` 存取报警图片（任务 4、5 用）；
   - 在 SQLBLL 文件里再写一个 `SQLRes` 类（Msg、Result 两个属性）当返回结果。
3. **Main_Load**：在 try 里依次打开 ADAM-4017+、ADAM-4150、ZigBee、LED 屏的串口（用 AppSet 里的串口号）。
4. **Environment_Load**：隐藏 chart1，创建线程运行 `Tick` 方法，记下 `WindowsFormsSynchronizationContext.Current`，启动线程。
5. **Tick()**：`while (true)` 循环，每次：
   - 读 ADAM-4017+ 和 ADAM-4150 的数据；
   - 用 `_main.Send(...)` 回到界面线程，把火焰、烟雾、光照、温度、湿度显示到文本框；
   - 勾了自动控制时，光照低于设定值就 `LampOnOff(1, true)`，否则 `LampOnOff(1, false)`；
   - 勾了自动推送火情时，火焰和烟雾都有推送"发生严重火灾"，只有火焰推送"发现火情"，只有烟雾推送"发现烟情"；
   - 调用 `SQLBLL.EnvironmentUpData(...)` 存数据，`Thread.Sleep(5000)`。
6. **LampOnOff(int RelayNum, bool IsOpen)**：调用 `zigBeeHelper.OnOff` 开关路灯，再用 `_main.Send` 换图片：开灯时开关换成 `switch_on`、背景换成 `day_01`，关灯时换回 `switch_off`、`day_02`。
7. **Environment_FormClosed**：停止采集线程。
8. **btn_dataAnalyse 的 Click**：文字是"数据分析"时，把 `GetEnvironmentGraphData()` 的结果给 `chart1.DataSource`，`DataBind()`，显示图表，文字改成"关闭图表"；反过来隐藏图表、改回"数据分析"。
9. **两个"推送天气信息"按钮**：推送"当前温度:…℃ 湿度:…%"。
10. **pic_lampOpen 的 Click**：按 `IsLampOpen` 开灯或关灯，然后把 `IsLampOpen` 取反。
11. **btn_ledSendMsg 的 Click**：推送 `txt_ledMsg` 里的文字。
12. **txt_autoLight 的 TextChanged**：用 `double.TryParse` 把输入的数存进 `setLight`。
13. **ch_autoLamp 的 CheckedChanged**：`IsAuto_Lamp = ch_autoLamp.Checked;`
14. **ch_autoLedFire 的 CheckedChanged**：`IsAuto_FireMsg = ch_autoLedFire.Checked;`

## 和书上不一样的地方

> **第 23 步的控件名写错了**：书上说在 `ch_autoLamp` 的 CheckedChanged 里写 `IsAuto_FireMsg = ch_autoLedFire.Checked;`，应该是 **`ch_autoLedFire`** 的 CheckedChanged（双击"自动推送火情"复选框生成）。写到 ch_autoLamp 里，"自动推送火情"就不起作用。

> **连接字符串**：平台只看 `Initial Catalog=WisdomCampus`，服务器名、用户名和密码照书上写就行。

> 书上 `GetSecurityData` 最后一行印成了 `eturn ImgDictionary;`，要写成 `return`。

> 书上关窗体时用的 `thread.Suspend()` 在新版 .NET 里已经不能用，平台做了兼容，照书上写就行。

## 在平台上怎么试

1. 运行后点"校园环境"。在实训台上拖动温度、湿度、光照滑块，8 秒内文本框里的数应跟着变；点火焰、烟雾，"火焰""烟雾"应显示"发生火情""发生烟情"。
2. 点灯光控制的开关：实训台的**照明灯 1** 亮起，开关和背景换成开灯的图片；再点一次全部换回来。
3. 在"设定开灯光照值"里输入 400，勾选"自动控制"。把光照拖到 200，几秒内路灯自动亮；拖到 800，路灯自动熄灭。
4. 点"推送天气信息"，实训台的 LED 屏显示"当前温度:26℃ 湿度:50%"这样的文字；在"LED信息"里输入文字，点"推送LED信息"，LED 屏显示这段文字。
5. 勾选"自动推送火情"，点实训台的火焰，LED 屏显示"发现火情"；再点烟雾，显示"发生严重火灾"。
6. 点"数据分析"，出现两条折线（最大值、平均值），按钮变成"关闭图表"；再点一次图表隐藏。到**数据库**页面查询 EnvironmentData 表，能看到程序刚存进去的数据。
