## 任务目标

做一个登录程序：登录窗体里输入用户名和密码，点"登录"检查账号是否存在；点"增加用户"打开第二个窗体，输入用户名和两遍密码后保存。用户数据放在一个公共的静态类里，两个窗体都能用。

练习重点：多个窗体（新建、Show、Close）、静态类和属性、数组和 for 循环、MessageBox。详细步骤见书 p2–7。

> 书上先用 Python 写了一遍登录程序，平台只支持 C#，这一部分看书了解即可。知识提炼里的控制台示例可以把代码放进按钮的 Click 里运行，`Console.WriteLine` 的输出显示在运行区下面；`Console.ReadLine` 读不到输入。

## 界面和控件名

登录窗体：

| 控件   | 名称（Name）  | 文字（Text）和用途                                                   |
| ------ | ------------- | -------------------------------------------------------------------- |
| 窗体   | `Login`       | 登录                                                                 |
| 文本框 | `txtUserName` | 输入用户名（前面放标签 `LblUsername`）                               |
| 文本框 | `txtPassword` | 输入密码，PasswordChar 设为星号 *（前面放标签 `LblPwd`，文字"密码"） |
| 按钮   | `btnOk`       | 登录                                                                 |
| 按钮   | `btnCancel`   | 取消                                                                 |
| 按钮   | `btnAdd`      | 增加用户                                                             |

用户名前面的标签 `LblUsername` 文字是"用户名称"。

> 窗体名：在设计器里点窗体空白处，把属性窗口的**名称**从 `Form1` 改成 `Login`，类名、文件名和 Program.cs 会跟着改。

增加用户窗体（点"＋ 新建窗体"，名字填 AddUser）：

| 控件   | 名称（Name）  | 文字（Text）和用途                |
| ------ | ------------- | --------------------------------- |
| 窗体   | `AddUser`     | 增加用户                          |
| 文本框 | `txtNewUser1` | 新用户名（前面放标签"用户名"）    |
| 文本框 | `txtPass1`    | 密码，PasswordChar 设为星号 *     |
| 文本框 | `txtPass2`    | 确认密码，PasswordChar 设为星号 * |
| 按钮   | `btnOk`       | 确定                              |
| 按钮   | `btnCancel`   | 取消                              |

> 书上的控件表和代码对不上：表里写 `txtPwd`、`BtnOk`，增加用户窗体写 `txtUserName`、`txtPwd`、`txtCheckPwd`，代码里用的是上面这些名字。请按上面的表起名，自动评分按这些名字操作。

## 实现步骤

1. 点"＋ 新建类"，新建 `PublicData` 类，写 4 个静态成员：用户名数组 `SysUserName`、密码数组 `SysPwd`（都是 `new string[4]`，最多存 4 个用户），已存的用户数 `intNum`、当前登录用户的序号 `intUser`（这两个写成 `{ get; set; }` 属性）。
2. Login 窗体里声明 `public bool IsLogin = false;` 记录是否登录成功。
3. **登录窗体 btnOk 的 Click**：用 for 循环逐个比较 `PublicData.SysUserName[i]` 和 `SysPwd[i]`，用户名和密码都相同（且用户名不为空）时把 IsLogin 设为 true，提示"登录成功，欢迎进入！"，记下 `intUser = i`，break 跳出循环；循环结束后 IsLogin 还是 false，就提示"无效的密码或用户名，请重试"，并让密码框获得焦点（`Focus()`）。
4. **登录窗体 btnCancel 的 Click**：IsLogin 设为 false，`this.Close()` 关闭窗体。
5. **btnAdd 的 Click**：`new AddUser()` 创建增加用户窗体，再调用 `Show()` 显示出来。
6. **增加用户窗体 btnOk 的 Click**：
   - `intNum` 小于 4 时，如果两次密码相同（`txtPass1.Text.Equals(txtPass2.Text)`）且不为空，就把用户名和密码存进两个数组的第 `intNum` 个位置，`intNum` 加 1，关闭窗体；否则提示"用户名或密码错误，请重新输入"。
   - 已经存满 4 个，提示"用户名已满不能增加"。
7. **增加用户窗体 btnCancel 的 Click**：`this.Close()`。

## 和书上不一样的地方

> **增加用户窗体每次点击时新建**：书上在 Login 里写了全局变量 `AddUser addfrm = new AddUser();`，点按钮时只 `Show()`。窗体关闭后就被释放了，第二次点"增加用户"会出错，所以改成在 btnAdd 的 Click 里 `new AddUser()` 再 `Show()`。

> 书上登录成功后用到的变量 `change` 没有声明过，照抄会编译不过，这几行删掉即可。

> 程序刚启动时一个用户都没有，要先点"增加用户"加一个账号才能登录。

## 在平台上怎么试

1. 运行后点"增加用户"，用户名填 zhangsan，两次密码都填 123，点"确定"，窗体关闭。
2. 在登录窗体输入 zhangsan 和 123，点"登录"，应提示"登录成功，欢迎进入！"。
3. 输入一个不存在的用户名或错误的密码，应提示"无效的密码或用户名，请重试"。
4. 再点"增加用户"，两次密码填得不一样，点"确定"，应提示"用户名或密码错误，请重新输入"。
