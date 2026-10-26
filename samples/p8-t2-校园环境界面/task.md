## 任务目标

在任务 1 的程序里新建"校园环境"窗体 `Environment`，把界面搭好：顶部标题栏和"<返回主窗体"，中间是路灯场景的背景图，底部一栏显示火焰、烟雾、光照度、温度、湿度，右边是"路灯控制"和"LED推送"两组控件，左下方是显示一周温度的折线图。这个任务**只做界面**，采集数据、控制路灯、推送 LED 在任务 3 做。

练习重点：多窗体、面板的多层停靠（Top / Fill / Bottom / Right）、透明背景、复选框、图表（Chart）的系列和图例。详细步骤见书 p159–164。

> 接着任务 1 的程序做。为了能看到效果，这次先让主界面的"校园环境"能打开窗体、"<返回主窗体"能关闭窗体（书上放在后面的任务里）。

## 界面和控件名

| 控件   | 名称（Name）                                                            | 文字（Text）和用途                                                          |
| ------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 窗体   | `Environment`                                                           | 校园环境；FormBorderStyle 设为 None，StartPosition 设为 CenterScreen        |
| 面板   | `panel1`                                                                | 顶部标题栏：停靠 Top，背景色 100, 116, 133，放标题图 `ico_title`            |
| 面板   | `panel2`                                                                | 停靠 Fill，下面的面板都放在它里面                                           |
| 面板   | `panel3`                                                                | panel2 里停靠 Top，背景色 229, 229, 229                                     |
| 标签   | `lb_return`                                                             | < 返回主窗体（放在 panel3 上）                                              |
| 面板   | `panel_bg`                                                              | panel3 下面停靠 Fill，背景图片 `day_02`（路灯没亮的场景），背景排列 Stretch |
| 面板   | `panel5`                                                                | panel_bg 里停靠 Bottom：环境数据栏                                          |
| 文本框 | `txt_fire`、`txt_smoke`、`txt_light`、`txt_temperature`、`txt_humidity` | 火焰、烟雾、光照、温度、湿度（左边各配一个标签）                            |
| 按钮   | `btn_dataAnalyse`                                                       | 数据分析                                                                    |
| 按钮   | `btn_ledEnvironment1`                                                   | 推送天气信息（环境数据栏里的那个）                                          |
| 面板   | `panel_form`                                                            | panel_bg 里停靠 Right，背景色 Transparent，背景图片 `bg_from2`              |
| 分组框 | `groupBox2`                                                             | 路灯控制                                                                    |
| 复选框 | `ch_autoLamp`                                                           | 自动控制                                                                    |
| 文本框 | `txt_autoLight`                                                         | 设定开灯光照值（后面配标签"lx"）                                            |
| 图片框 | `pic_lampOpen`                                                          | 灯光控制的开关：背景色 Transparent，背景图片 `switch_off`                   |
| 分组框 | `groupBox3`                                                             | LED推送                                                                     |
| 文本框 | `txt_ledMsg`                                                            | LED信息（Multiline 设为 True）                                              |
| 复选框 | `ch_autoLedFire`                                                        | 自动推送火情                                                                |
| 按钮   | `btn_ledSendMsg`                                                        | 推送LED信息                                                                 |
| 按钮   | `btn_ledEnvironment2`                                                   | 推送天气信息（LED推送组里的那个）                                           |
| 图表   | `chart1`                                                                | 放在 panel_bg 左下方，显示最高温度和平均温度                                |

> 书上表 8-6、表 8-7 把四个按钮的"名称"写成了"数据分析""推送天气信息""推送LED信息"，那是按钮上的文字。名称按上表写，任务 3 的代码和自动评分都用这些名字。

## 实现步骤

1. **项目资源**里再勾选 `day_02`、`bg_from2`、`switch_off`（任务 3 还要用 `day_01`、`switch_on`，可以一起勾上）。
2. 点 **＋ 新建窗体**，建 `Environment`，设成无边框、屏幕居中，调到合适的大小。
3. 按"标题栏 → panel2 → panel3 → panel_bg"的顺序拖面板，设好停靠。先放的面板先占地方，放错了可以在属性里改停靠。
4. 在 panel_bg 上依次放底部的 panel5（环境数据栏）和右边的 panel_form，再把两组控件放进 panel_form 里的两个分组框。书上要求 panel_form 里的其他控件背景色也设成 Transparent，让背景图透出来。
5. 拖一个**图表**到 panel_bg 上，在属性窗口点**系列和图例**：
   - 图例两个：`MaxLegend`、`AVGLegend`；
   - 系列两个：`MaxSeries`（图表类型 Line，图例 MaxLegend，图例文字"最大值"，X 值字段 `_Time`，Y 值字段 `MaxTemperature`）和 `AVGSeries`（Line，AVGLegend，"平均值"，`_Time`，`AVGTemperature`）。
6. 主窗体 `pic_environment` 的 Click：`new Environment().Show();`。
7. `lb_return` 的 Click：`this.Close();`（只关掉这个窗体，主窗体还在）。

## 和书上不一样的地方

> **背景图片叫 `bg_from2`**：书上写的是 `bg_form2.png`，配套资料里的文件名是 `bg_from2`，素材库也用这个名字。

## 在平台上怎么试

1. 运行后在主界面点"校园环境"，打开 Environment 窗体：背景是路灯场景，底部有五个文本框和"数据分析""推送天气信息"，右边有"路灯控制""LED推送"两组，左下方有图表（现在还没有数据）。
2. 点"< 返回主窗体"，Environment 关闭，主界面还在。
