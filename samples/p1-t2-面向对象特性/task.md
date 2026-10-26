## 任务目标

一个窗体里做两件事：上半部分是简易计算器，输入两个数、选运算符，点"="算出结果；下半部分点"显示"，让两个中国人、两个美国人依次"说话"，在文本框里输出各自说的语言。

练习重点：装箱与拆箱（object 和值类型互相转换）、类的继承、虚方法（virtual）和重写（override）、List 和 Dictionary。详细步骤见书 p13–16。

## 界面和控件名

| 控件   | 名称（Name）   | 文字（Text）和用途                       |
| ------ | -------------- | ---------------------------------------- |
| 窗体   | `Form1`        | C#入门基础                               |
| 分组框 | `groupBox1`    | 简易计算器                               |
| 文本框 | `txtNum1`      | 第一个数                                 |
| 下拉框 | `cmboxType`    | 运算符，Items 填 `+`、`-`、`*`、`/` 四项 |
| 文本框 | `txtNum2`      | 第二个数                                 |
| 按钮   | `btnCalculate` | =                                        |
| 文本框 | `txtResult`    | 计算结果，ReadOnly 设为 True             |
| 分组框 | `groupBox2`    | 类的多态性                               |
| 文本框 | `txtDispaly`   | 输出说话内容，Multiline 设为 True        |
| 按钮   | `btnDisplay`   | 显示                                     |

> `txtDispaly` 是书上的拼法（不是 Display），代码和自动评分都用这个名字，照着写。书上的表格没写下拉框的 Items 和文本框的 Multiline，要自己在属性里设置。

## 实现步骤

1. 写一个方法 `public Object Result(Object a, Object b, String type)`：先把 a、b 拆箱成 float，用 switch 按 `+ - * /` 计算（其他情况结果为 0），最后把结果装箱成 Object 返回。
2. **btnCalculate 的 Click**：两个文本框都不为空时，用 `float.Parse` 把文字转成数，调用 `Result(a, b, cmboxType.Text)`，返回值拆箱成 float，显示到 `txtResult`。
3. 点"＋ 新建类"，新建 `People` 类，写一个虚方法 `public virtual void Speak(TextBox Txtbox, string name)`，把 name 追加到文本框的 Text 后面。
4. 新建 `Chinese` 类继承 People，重写 Speak：调用 `base.Speak`，传入 `name + "说的是汉语！\r\n"`。
5. 新建 `American` 类继承 People，同样重写，内容改成"说的是英语！"。
6. **btnDisplay 的 Click**：
   - 建一个 `Dictionary<int, string>`，放入 1 张三、2 李四、3 Mary、4 Jimmy；
   - 建一个 `List<People>`，先加 2 个 `new Chinese()`，再加 2 个 `new American()`；
   - 遍历 List，对第 i 个对象调用 `Speak(this.txtDispaly, dicName[i + 1])`。

## 和书上不一样的地方

> 书上第 8 步写的是"双击'='按钮"，其实应该双击"**显示**"按钮，生成 `btnDisplay_Click`。

> 书上排版把减号印成了长一点的"–"，抄 `case "-"` 和下拉框的 Items 时要用键盘上的减号，否则选"-"时算不出来。

## 在平台上怎么试

1. 运行后输入 7 和 2，选"+"，点"="，结果应为 9；改选"/"再点"="，结果应为 3.5。
2. 点"显示"，文本框里应依次出现"张三说的是汉语！""李四说的是汉语！""Mary说的是英语！""Jimmy说的是英语！"四行。
