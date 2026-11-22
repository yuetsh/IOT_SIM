// "我的学习"里常犯的错误配的中文说明：编译错误按错误代码说明原因和改法；运行出错按异常类型说怎么改
// （运行时已经把常见异常翻译成了中文的"是什么"，见 SimHost.ExplainException）。
// 具体某条报错有平台的针对性提示时（CompileHints.cs，如书上的 True 大写），页面上另外显示在那条报错下面。

const COMPILE_ERRORS: Record<string, string> = {
  CS1002: '少了分号。C# 每条语句末尾要有英文分号 ;，看看报错那一行（或上一行）的末尾。',
  CS1513: '少了右大括号 }。大括号要成对，从报错的位置往上数一数 { 和 } 的个数。',
  CS1514: '少了左大括号 {。',
  CS1026: '少了右括号 )。括号要成对。',
  CS1003: '少了某个符号，报错信息里写着应该输入什么。',
  CS1001: '这里应该是一个名字（变量名、方法名），可能多写或少写了符号。',
  CS1525: '这里出现了不该出现的符号或关键字。常见原因：上一行没写完、括号没配对、用了中文标点。',
  CS1056: '出现了 C# 不认识的字符，多半是中文标点（，；（）“”），换成英文半角的。',
  CS1010: '字符串的双引号没有配对，检查 " 是不是少了一个。',
  CS1022: '多了右大括号 }，或者代码写到了类的外面。',
  CS0116: '代码写到了类的大括号外面。方法、变量要写在 class 的 { } 里面。',
  CS0103: '找不到这个名字。检查拼写和大小写（C# 区分大小写），控件的 Name 是否和代码里一致，变量是不是先声明再用、是不是声明在别的大括号里。',
  CS0246: '找不到这个类型。检查类型名的拼写和大小写，或者文件开头少了 using（比如 using System.Data.SqlClient;）。',
  CS0234: '命名空间里没有这个名字，检查 using 或类型名的拼写。',
  CS1061: '这个对象没有你写的属性或方法。检查拼写和大小写，比如 Text 不能写成 text；也可能对象的类型不对。',
  CS0117: '这个类型里没有你写的成员，检查拼写和大小写。',
  CS0029: '等号两边的类型不一样。文字变数字用 int.Parse(...) 或 Convert.ToInt32(...)，数字变文字用 .ToString()。',
  CS0266: '不能自动转换类型（比如把 double 赋给 int），要强制转换，如 (int)x，或者换成合适的类型。',
  CS0019: '运算符两边的类型不能这样算，比如拿文字和数字比大小。先用 int.Parse 把文字转成数字。',
  CS0023: '这个运算符不能用在这种类型上。',
  CS1501: '方法的参数个数不对。鼠标停在方法名上，能看到它要几个参数。',
  CS1503: '参数的类型不对，比如要数字却给了文字。',
  CS7036: '调用方法时少了必须的参数。',
  CS0165: '变量还没赋值就用了。声明时给它一个初始值，或者保证每种情况下都赋了值。',
  CS0161: '方法写了返回值类型，但不是每种情况都有 return。',
  CS0128: '同一个方法里声明了两个同名的变量。改个名字，或者第二次不要再写类型。',
  CS0136: '这个变量名和外面的变量重名了，换个名字。',
  CS0111: '同一个类里有两个同名的方法，常见于事件处理方法写了两遍（比如复制代码时），删掉一个。',
  CS0102: '类里已经有同名的成员（控件、变量或方法），换个名字或删掉重复的。',
  CS0120: '这里不能直接用窗体的控件或普通成员（在 static 方法里），要通过对象来用。',
  CS0122: '不能访问别的类的私有（private）成员，要改成 public 或者换一种写法。',
  CS0201: '这一行不能单独作为一条语句，比如单独写了 a == 1;，或者调用方法时少了括号 ()。',
  CS0815: '不能用 null 或这种值给 var 声明的变量赋初值，要写出具体类型。',
  CS0428: '方法名后面少了括号 ()，调用方法要写成 方法名()。',
  CS0118: '把一种东西当成了另一种来用（比如把类型当变量），检查名字是不是写错了。',
}

/** 编译错误代码的中文说明；没有收录时返回 null */
export function explainCompileError(code: string): string | null {
  return COMPILE_ERRORS[code] ?? null
}

const EXCEPTION_FIXES: [type: string, fix: string][] = [
  ['FormatException', '转换前先判断文本框是不是空的，或者用 int.TryParse 先试着转换。'],
  ['NullReferenceException', '看出错那一行点号前面的变量，确认用之前已经 new 出来或者赋了值。'],
  ['IndexOutOfRangeException', '用下标前先判断个数（数组用 Length），下标从 0 开始。'],
  ['ArgumentOutOfRangeException', '用下标前先判断个数（Count）；下拉框、列表用 SelectedIndex 前先判断是不是 -1（还没选）。'],
  ['DivideByZeroException', '除之前先判断除数是不是 0。'],
  ['OverflowException', '检查数字的大小，换成能装得下的类型（比如 long、double）。'],
  ['InvalidCastException', '检查要转换的对象实际是什么类型。'],
  ['InvalidOperationException', '检查操作的先后顺序，比如串口、数据库连接要先 Open 再用。'],
  ['SqlException', '按信息检查数据库名、表名、列名和 SQL 语句。'],
  ['IOException', '检查串口有没有选对、文件路径对不对。'],
  ['UnauthorizedAccessException', '检查串口有没有被别的程序占用、文件能不能写。'],
  ['FileNotFoundException', '检查文件名和路径，素材要先在"项目资源"里添加。'],
  ['DirectoryNotFoundException', '检查文件夹路径，用之前先创建文件夹。'],
]

/** 运行出错的改法：按信息括号里的异常类型；认不出时返回 null */
export function exceptionFix(message: string): string | null {
  // 中文信息里也可能有括号（如"串口（COM3）"），异常类型在最后一对括号里
  const type = [...message.matchAll(/（([\w.]+)(?::|）)/g)].at(-1)?.[1]
  const name = type?.slice(type.lastIndexOf('.') + 1)
  return EXCEPTION_FIXES.find(([t]) => t === name)?.[1] ?? null
}
