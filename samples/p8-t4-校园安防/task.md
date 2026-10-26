## 任务目标

在主界面上接通"校园安防"：新建 `Security` 窗体，打开时连上网络摄像机显示实时画面，后台线程每秒检查一次红外对射，有人闯入时显示"发现入侵"并把当前画面存进数据库；四个方向键控制摄像机转动；"拍照"把画面存成图片文件、同时存进数据库；返回主窗体时关掉摄像机。"查看历史图像"按钮先放好，任务 5 再做。

练习重点：摄像机的 ImageRead 事件、后台线程、图片框的鼠标按下 / 松开事件（MouseDown / MouseUp）、换背景图片、保存图片文件。详细步骤见书 p174–180。

## 先准备数据库

用任务 3 的 **WisdomCampus** 库，入侵和拍照的图片存进 **SecurityData** 表（报警时间 EvenTime、图片 EvenImage），存的方法是任务 3 写好的 `SQLBLL.SecurityUpData`。还没有这个库或数据弄乱了，到**数据库**页面点**恢复实验初始数据**，选这个实验。

## 界面和控件名

接着任务 3 的程序做。Security 窗体顶部和 Environment 一样：标题栏 + "< 返回主窗体"。

| 窗体     | 名称（Name）                                  | 文字（Text）和用途                                                            |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| 主界面   | `pic_security`                                | "校园安防"：打开 Security 窗体                                                |
| 校园安防 | `Security`                                    | 无边框、屏幕居中                                                              |
| 校园安防 | `panel1`、`panel3`                            | 标题栏（放标题图 `ico_title`）、返回栏，都停靠 Top                            |
| 校园安防 | `lb_return`                                   | < 返回主窗体                                                                  |
| 校园安防 | `panel_bg_video`                              | 停靠 Fill，白色背景，下面的控件都放在它上面                                   |
| 校园安防 | `panel2`                                      | 灰色（DimGray）的视频区                                                       |
| 校园安防 | `pic_video`                                   | 放在 panel2 上，显示摄像机画面；背景图片 `icon_monitor`，背景排列 Center      |
| 校园安防 | `lb_infrared`                                 | 放在 panel2 上，标签"入侵:"的右边，开始是 N/A，之后显示"发现入侵"或"正常"     |
| 校园安防 | `panel_video_ctrl`                            | 方向盘：背景图片 `panel_video_ctrl`，背景排列 Stretch                         |
| 校园安防 | `pic_up`、`pic_down`、`pic_left`、`pic_right` | 放在方向盘上的四个方向键，背景图片 `btn_arrow_up_normal` 等，背景排列 Stretch |
| 校园安防 | `btn_camera`                                  | 拍照                                                                          |
| 校园安防 | `btn_history`                                 | 查看历史图像（任务 5 再写代码）                                               |

## 实现步骤

1. **项目资源**里再勾选 `icon_monitor`、`panel_video_ctrl` 和四个方向键的 `btn_arrow_*_normal`、`btn_arrow_*_press`（共 8 张）。
2. 点 **＋ 新建窗体** 建 `Security`，按上表搭界面。
3. 主窗体 `pic_security` 的 Click：`new Security().Show();`。
4. 在 Security 里引用 `System.IO`、`System.Threading`、`DeviceCtrlLibrary`、`智慧校园.SQLHelpers`，声明字段：入侵标志 `IsInfrared`、图片文件夹 `ImgDir`（程序目录下的 Camera 文件夹）、线程、SynchronizationContext、当前画面 `img`。
5. 写 **ipCameraHelper_ImageRead(ImageReadEvenArgs e)**：把 `e.img` 记到 `img`，并显示到 `pic_video`。
6. 写 **tick()**：`while (true)` 循环，读 ADAM-4150 的 `infraredValue`，用 `_main.Send` 把"发现入侵"或"正常"显示到 `lb_infrared`；有入侵且有画面时调用 `SQLBLL.SecurityUpData(img)`；`Thread.Sleep(1000)`。
7. **Security_Load**：打开摄像机（AppSet 里的 IP、用户名、密码），挂上 ImageRead 事件，`Start()`；启动 tick 线程；Camera 文件夹不存在就建一个。
8. **Security_FormClosed**：摄像机 `Stop()`、`Close()`，停止线程。
9. **btn_camera 的 Click**：把 `pic_video.Image` 存成 `ImgDir + 年月日_时分秒 + ".jpg"`，再调用 `SQLBLL.SecurityUpData` 存进数据库。
10. **四个方向键**：在 ⚡ 事件里双击"鼠标按下"和"鼠标松开"生成方法。按下时换成 `_press` 图片并调用 `PanUp()`（或 PanDown / PanLeft / PanRight），松开时换回 `_normal` 图片并再调用一次同一个方法。
11. **lb_return 的 Click**：`this.Close();`。

## 和书上不一样的地方

> **摄像机每次调用转一格**：平台的摄像机左右 7 格、上下 3 格，开始在正中，`PanUp()` 等方法每调用一次转一格。书上按下、松开各调用一次，所以点一下方向键会转两格。

> **面板的名字**：示例（取自配套工程）里白色的大面板叫 `panel_bg_video`、灰色视频区叫 `panel2`，书上叫 `panel_bg`、`panel_bg_video`。面板的名字不评分，照书上起名也可以。

> 书上的路径 `"Camera\\"` 照写就行，平台会换成服务器上能用的路径。

## 在平台上怎么试

1. 运行后点"校园安防"，打开 Security 窗体，几秒内 `pic_video` 里出现摄像机画面（校园东围墙）。
2. 点实训台的**红外对射**遮挡光束，"入侵:"后面显示"发现入侵"，画面里出现翻墙的人；再点一次恢复，显示"正常"。
3. 点四个方向键，画面跟着转；松开后方向键换回原来的图片。把鼠标放在实训台的**网络摄像头**上能看到云台的位置。
4. 点"拍照"，运行区下面的"程序保存的图片"里多出一张 Camera 文件夹下的照片（文件名是拍照的日期和时间）；到**数据库**页面查询 SecurityData 表，能看到拍照和入侵时存的记录。
5. 点"< 返回主窗体"，Security 关闭，摄像机也关闭。
