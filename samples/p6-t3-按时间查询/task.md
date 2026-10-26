## 任务目标

选一个开始日期和结束日期，点"查询"，从任务 2 存的 CampusEnvironment 表里查出这段时间内的记录，显示在表格里。

练习重点：select 语句和 where … between … and …、日期时间控件（DateTimePicker）、SqlDataAdapter 和 DataSet、DataGridView 绑定数据。详细步骤见书 p127–128。

## 先准备数据库

这个任务用任务 2 的**环境数据表**库和里面的 **CampusEnvironment** 表（ID、light、humidity、temperature、addtime）。表里要先有几条不同日期的记录，查询才看得出效果。

还没做任务 2，或者数据弄乱了，到右上角的**数据库**页面点**恢复实验初始数据**，选这个实验：库和表会自动建好，CampusEnvironment 里有 3 条记录，时间是 2024 年 1 月 16 日、18 日、23 日。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | 查询校园灾情数据 |
| 标签 | `LblStartTime` | 开始日期 |
| 日期时间控件 | `StartTime` | 选开始日期 |
| 标签 | `LblEndTime` | 结束日期 |
| 日期时间控件 | `EndTime` | 选结束日期 |
| 按钮 | `btnCx` | 查询 |
| 分组框 | `groupBox4` | 历史记录 |
| 数据表格 | `dataGridView1` | 显示查到的记录 |

## 实现步骤

1. 引用 `System.Data.SqlClient` 和 `System.IO.Ports`。
2. 声明全局变量：连接字符串 `sqlConnectString`、`SqlConnection mySqlConnection`、`SqlCommand mySqlCmd`、`SqlDataAdapter sqldata`、`DataSet ds`。
3. **btnCx 的 Click**：
   - 创建连接对象并打开；
   - 写 select 语句：查出 ID、temperature、humidity、light、addtime，列名起中文别名（编号、温度、湿度、光照度、时间），条件是 `addtime BETWEEN '开始' AND '结束'`，开始、结束分别拼进 `StartTime.Value.ToString()` 和 `EndTime.Value.ToString()`；
   - 用这条命令创建 SqlDataAdapter，`ds = new DataSet();`，`Fill(ds)`；
   - `dataGridView1.DataSource = ds.Tables[0].DefaultView;`，最后关闭连接。

## 和书上不一样的地方

> **要先 new 一个 DataSet**：书上直接 `sqldata.Fill(ds)`，`ds` 还没有创建，运行时会报空引用错误。在 Fill 前面加一行 `ds = new DataSet();`。

> **连接字符串**：平台只看 `Initial Catalog=环境数据表`，服务器名、用户名和密码照书上写或写成 `Data Source=.` 都可以。

## 在平台上怎么试

1. 先按上面准备好数据库（用初始数据最好对照）。
2. 运行后开始日期选 **2024 年 1 月 15 日**，结束日期选 **2024 年 1 月 20 日**，点"查询"：表格里应有编号 1、2 两条（16 日、18 日），没有 23 日的那条。
3. 改成 1 月 21 日到 1 月 31 日再点"查询"：表格里只剩编号 3（23 日）。
