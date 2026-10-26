## 任务目标

做一个校园监控程序：输入摄像机 IP 点"开"，图片框里实时显示摄像机拍到的画面；用四个方向键转动摄像机；点"拍照"把当前画面保存成图片。

练习重点：图片框（PictureBox）、给设备的事件绑定处理方法（`+=`）、static 变量、文件夹和图片的保存。详细步骤见书 p78–81。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | 网络摄像机 |
| 图片框 | `pictureBox1` | 显示画面；背景色设为黑色，显示方式选"拉伸填满"（StretchImage） |
| 标签 | `label1` | 摄像机IP |
| 文本框 | `txt_ip` | 输入摄像机的 IP |
| 按钮 | `btn_open` | 开（打开后变成"关"） |
| 按钮 | `btn_up` | ↑（向上转） |
| 按钮 | `btn_down` | ↓（向下转） |
| 按钮 | `btn_left` | ←（向左转） |
| 按钮 | `btn_right` | →（向右转） |
| 按钮 | `btn_camera` | 拍照 |

## 实现步骤

1. 代码开头加上 `using System.IO;` 和 `using DeviceCtrlLibrary;`。
2. 声明 4 个全局变量：拍照保存路径 `CameraPath`（static，程序所在目录下的 `Camera/` 文件夹）、摄像机 IP `IpCameraIPAddress`（static）、`bool IsOpen`、存当前画面的 `Image ReadImage`。
3. 写一个方法 `ipCameraHelper_ImageRead(ImageReadEvenArgs e)`：把 `e.img` 存进 `ReadImage`，再显示到 `pictureBox1`。
4. **Form1_Load**：`Camera` 文件夹不存在就用 `Directory.CreateDirectory` 建一个；用 `+=` 把第 3 步的方法绑定到 `DeviceCtrlHelper.ipCameraHelper.ImageRead` 事件上。
5. **btn_open 的 Click**：先把 `IsOpen` 取反；
   - 打开时：取 `txt_ip` 里的 IP，调用 `ipCameraHelper.Open(IP, "admin", "")` 连接，再 `Start()` 开始传画面，按钮文字改成"关"；
   - 关闭时：`Stop()` 停止传画面，按钮文字改回"开"。
6. **四个方向键的 Click**：分别调用 `ipCameraHelper.PanUp()`、`PanDown()`、`PanLeft()`、`PanRight()`。
7. **btn_camera 的 Click**：`ReadImage` 不是 null 时，用当前时间做文件名，`ReadImage.Save(...)` 存成 .jpg 到 `CameraPath`。

## 和书上不一样的地方

> 书上第 6 步只写了 `using System.IO.Ports;`，可是 `Directory` 要用 `using System.IO;`，不加会编译不过。这个任务不用串口，`System.IO.Ports` 可以不写。

## 在平台上怎么试

1. 运行后在 IP 框里填 **192.168.2.50**（填别的 IP 也能连上），点"开"，按钮变成"关"，图片框里出现东围墙的画面，实训台顶棚的**网络摄像头**亮起。
2. 点四个方向键，画面应跟着转动：每点一次转一格，左右各 3 格、上下各 1 格，转到头就不再动。
3. 点"拍照"，运行区下方出现"程序保存的图片"，点开能看到刚拍的照片（只在这次运行中保留）。
4. 再点"关"，按钮变回"开"，画面停止更新。
