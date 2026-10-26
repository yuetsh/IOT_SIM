## 任务目标

从 ADAM-4017+ 读出光照度、温度、湿度，点"保存"存进 SQL Server 数据库的 CampusEnvironment 表，在表格里显示全部记录；还能在表格里改数据后点"修改"保存，选中一行点"删除"删掉。

练习重点：ADO.NET 的 SqlConnection、SqlCommand、SqlDataAdapter，insert / update / delete 语句，DataGridView 绑定数据。详细步骤见书 p119–124。

## 先准备数据库

这个任务用任务 1 建的**环境数据表**库，并在库里新建 **CampusEnvironment** 表：ID（int，标识列，主键）、light、humidity、temperature（都是 varchar(50)）、addtime（datetime）。

在右上角的**数据库**页面里建表；还没做任务 1，或者数据弄乱了，点**恢复实验初始数据**，选这个实验，库和表会自动建好。

## 界面和控件名

| 控件 | 名称（Name） | 文字（Text）和用途 |
|---|---|---|
| 窗体 | `Form1` | 校园灾情数据存储 |
| 分组框 | `groupBox2` | 配置 |
| 下拉框 | `com_port` | ADAM-4017+ 的串口 |
| 按钮 | `btn_Open` | 开启（打开后变成"关闭"） |
| 分组框 | `groupBox1` | 数据显示 |
| 文本框 | `txt_light`、`txt_temperature`、`txt_humidity` | 光照度、温度、湿度 |
| 按钮 | `btn_get` | 获取 |
| 按钮 | `btn_save` | 保存 |
| 按钮 | `btnUpdate` | 修改 |
| 按钮 | `btnDelete` | 删除 |
| 分组框 | `groupBox3` | 历史记录 |
| 数据表格 | `dataGridView1` | 显示数据库里的记录 |

> 注意按钮名字的写法不统一：`btn_Open`、`btn_get`、`btn_save` 带下划线，`btnUpdate`、`btnDelete` 不带，照书上的写，自动评分按这些名字找按钮。

## 实现步骤

1. 引用 `System.Data.SqlClient`、`System.IO.Ports`、`DeviceCtrlLibrary`、`DeviceCtrlLibrary.Model`。
2. 声明全局变量：连接字符串、SqlConnection、SqlCommand、SqlDataAdapter、DataSet、串口是否打开（bool）、ADAM4017ResModel。
3. **Form1_Load**：打开数据库连接，把串口号加进 `com_port`。
4. **btn_Open 的 Click**：串口没打开就打开（`adam4017Helper.Open`）并把按钮改成"关闭"，否则关闭并改回"开启"。
5. **btn_get 的 Click**：`adam4017Helper.SetData()` 读出数据，把 lightValue、temperatureValue、humidityValue 填进三个文本框。
6. 写一个 **Databind()** 方法：用 select 语句（列名起中文别名：编号、温度、湿度、光照度、时间）查出全部记录，用 SqlDataAdapter 填进 DataSet，绑定到 `dataGridView1`。
7. **btn_save 的 Click**：用 insert 语句把三个值和当前时间存进表，提示"保存成功！"，再调用 Databind() 刷新表格。
8. **btnUpdate 的 Click**：用 SqlCommandBuilder 生成更新语句，`sqldata.Update(...)` 把表格里改过的数据写回数据库。
9. **btnDelete 的 Click**：按表格当前行第一列的编号，用 delete 语句删掉这一行，再刷新表格。

## 和书上不一样的地方

> **连接字符串**：平台只看 `Initial Catalog=环境数据表`，服务器名、用户名和密码照书上写或写成 `Data Source=.` 都可以。

> **insert 要写列名**：书上写的是 `insert into CampusEnvironment values (温度, 湿度, 光照度, 时间)`，没写列名时值按建表的列顺序（light、humidity、temperature）存进去，温度和光照度就存反了。要写成 `insert into CampusEnvironment (temperature, humidity, light, addtime) values (...)`。

> 书上的 `True` / `False` 大写、中文引号 `”关闭”`、`privatevoid` 都是印刷错误，照抄会编译不过。

## 在平台上怎么试

1. 运行后串口选 **COM2**（ADAM-4017+），点"开启"。
2. 在实训台上拖动光照、温度、湿度的滑块，点"获取"，三个文本框应显示对应的值。
3. 点"保存"，弹出"保存成功！"，表格最后一行是刚存的数据——检查温度、湿度、光照度有没有存进对应的列。
4. 在表格里改一个温度，点"修改"；点中某一行，点"删除"。到**数据库**页面查询 CampusEnvironment 表，看数据是不是真的变了。
