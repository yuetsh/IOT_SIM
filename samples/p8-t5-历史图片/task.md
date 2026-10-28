## 任务目标

做"历史报警记录"窗体 `SecurityCameraData`：在校园安防界面点"查看历史图像"打开它，按开始时间、结束时间从数据库里查出这段时间拍下的照片（拍照和入侵时存的），一次显示一张和它的拍摄时间，用左右箭头前后翻；查不到就显示"NO DATA"。

练习重点：ShowDialog 打开对话框式的窗体、日期时间选择器（DateTimePicker）、Dictionary 和 List 集合、运行时改控件的父容器（Parent）和位置（Location）。详细步骤见书 p181–185。

## 先准备数据库

照片在 **WisdomCampus** 库的 **SecurityData** 表里，任务 4 的拍照和入侵检测会往里存；初始数据里这张表是空的，先在校园安防界面拍几张照片再查。查询用任务 3 写好的 `SQLBLL.GetSecurityData(开始日期, 结束日期)`，它返回"拍摄时间 → 照片"的 Dictionary。

## 界面和控件名

接着任务 4 的程序做。

| 窗体         | 名称（Name）                         | 文字（Text）和用途                                                                        |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 校园安防     | `btn_history`                        | 查看历史图像：打开 SecurityCameraData 窗体                                                |
| 历史报警记录 | `SecurityCameraData`                 | 无边框、屏幕居中                                                                          |
| 历史报警记录 | `panel1`                             | 标题栏：背景色 100, 116, 133，左边标签 `label1`"历史报警记录"（白字）                     |
| 历史报警记录 | `pic_close`                          | 标题栏右边的关闭按钮：背景图片 `windowstate_closed_hover`，背景排列 Center                |
| 历史报警记录 | `panel_toolBar`                      | 工具栏：背景色 229, 229, 229                                                              |
| 历史报警记录 | `dateTimePicker1`、`dateTimePicker2` | 开始时间、结束时间（左边各配一个标签）                                                    |
| 历史报警记录 | `btn_get`                            | 查询                                                                                      |
| 历史报警记录 | `pic_camera`                         | 显示照片：背景色 64, 64, 64                                                               |
| 历史报警记录 | `lb_noData`                          | NO DATA（红字，背景色 64, 64, 64，字号 48），叠在 pic_camera 中间                         |
| 历史报警记录 | `lb_time`                            | TIME（红字，背景色 64, 64, 64），叠在 pic_camera 右下角，显示拍摄时间                     |
| 历史报警记录 | `pic_up`、`pic_down`                 | 左、右翻页箭头：图片 `arrow_left_normal`、`arrow_right_normal`，SizeMode 设为 CenterImage |

> 注意 `pic_up` 是**左**箭头（上一张）、`pic_down` 是**右**箭头（下一张），名字照书上写。

## 实现步骤

1. **项目资源**里再勾选 `windowstate_closed_hover`、`arrow_left_normal`、`arrow_right_normal`。
2. 点 **＋ 新建窗体** 建 `SecurityCameraData`，按上表搭界面。
3. 校园安防 `btn_history` 的 Click：`new SecurityCameraData().ShowDialog();`。
4. 引用 `DeviceCtrlLibrary`、`智慧校园.SQLHelpers`，声明字段：照片集合 `ImgDictionary`（`Dictionary<string, Image>`）、当前下标 `index = -1`、当前照片 `img`、时间列表 `Keys`（`List<string>`）。
5. 写 **ImageChanged(char UpOrDown = '+')**：`'+'` 时下标加 1、`'-'` 时减 1，超过最后一张回到第一张、小于 0 回到最后一张；按 `Keys[index]` 从集合里取出照片显示到 `pic_camera`，时间显示到 `lb_time`。
6. 写 **GetData()**：用两个日期时间选择器的 Value 调用 `SQLBLL.GetSecurityData`，下标设回 −1，清空 `Keys`；没有照片就显示 `lb_noData` 并返回，有照片就隐藏它，把所有时间加进 `Keys`，调用 `ImageChanged()` 显示第一张。
7. **SecurityCameraData_Load**：把 `pic_up`、`pic_down` 的 Parent 设成 `pic_camera`，位置分别设为 (20, 0) 和 (560, 0)，然后调用 `GetData()`。
8. **btn_get 的 Click**：`GetData();`
9. **pic_up 的 Click**：`ImageChanged('-');` **pic_down 的 Click**：`ImageChanged();`
10. **pic_close 的 Click**：`this.Close();`

## 和书上不一样的地方

> **每次查询前清空 Keys**：书上的 GetData 没有 `Keys.Clear();`，查第二次时 Keys 里还留着上次的时间，翻页时照片和时间就对不上了。在下标设回 −1 的地方加上 `Keys.Clear();`。

## 在平台上怎么试

> 先准备：做过任务 4 的话，SecurityData 表里已经存了任务 4 拍的照片和入侵照片，下面看到的第一张就不是 9:00 那张。先到右上角的**数据库**页面点"恢复实验初始数据"，选"项目8 任务5"，把表清空（自动评分每次都用干净的库，不受影响）。

1. 在实训台的**时钟**里拨到 9:00:00，运行后打开校园安防，等画面出来点"拍照"；再拨到 10:30:00，再拍一张。
2. 点"查看历史图像"，打开历史报警记录窗体：两个日期默认都是今天，显示第一张照片，右下角时间是 9:00 左右，"NO DATA"不显示。
3. 点右箭头显示 10:30 那张，再点回到第一张；点左箭头往回翻。
4. 开始时间选 2024-01-01，点"查询"，还能查到今天的照片；结束时间再改成 2024-01-31，点"查询"，显示"NO DATA"。
5. 点右上角的关闭按钮，回到校园安防界面。
