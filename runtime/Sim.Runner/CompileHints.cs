using System.Linq;
using Microsoft.CodeAnalysis;

namespace Sim.Runner;

/// <summary>
/// 针对教材上常见写法错误的中文提示（书上代码有 True/False 大写、Catch(EventArgs ex) 等印刷错误，学生照抄后会遇到）。
/// 只在编译器的原始报错之外补充一句说明，不改变报错本身。
/// </summary>
internal static class CompileHints
{
    public static string? For(Diagnostic diagnostic)
    {
        var source = diagnostic.Location.SourceTree?.GetText().ToString(diagnostic.Location.SourceSpan) ?? "";
        return (diagnostic.Id, source) switch
        {
            ("CS0103", "True" or "False") => $"C# 的布尔值是小写的 {source.ToLowerInvariant()}。",
            ("CS0103", "Catch") or ("CS0246", "Catch") => "catch 要小写，括号里写异常类型，例如 catch (Exception ex)。",
            ("CS0246", var name) when name.StartsWith("bool") || name.StartsWith("private") || name.StartsWith("public") || name.StartsWith("string") || name.StartsWith("int") =>
                $"“{name}”像是类型和名字之间少了一个空格。",
            ("CS0234", var s) when s.Contains("Properties") => "要用 Properties.Resources，先点代码上方的“项目资源”，添加需要的图片或声音。",
            ("CS0117", var s) when s.Contains("Resources.") => $"项目资源里还没有“{s[(s.LastIndexOf('.') + 1)..]}”：点代码上方的“项目资源”添加（名字要和代码里一致）。",
            ("CS0103", _) => $"找不到“{source}”。检查拼写和大小写（C# 区分大小写），以及控件的 Name 是否和代码里一致。",
            ("CS1002", _) => "C# 每条语句末尾要有英文分号 ;",
            ("CS1056", _) or ("CS1525", _) when source.Length == 1 && source[0] > 127 => "这里出现了中文标点，C# 代码里的符号要用英文半角。",
            ("CS0029", _) => "等号两边的类型不一致。如果要把文本框里的文字变成数字，可以用 int.Parse(...) 或 Convert.ToInt32(...)。",
            ("CS8026", _) => Vs2012(diagnostic),
            _ => null,
        };
    }

    /// <summary>导出工程时照机房的 VS 2012 只能用 C# 5，新版 C# 的写法（报错里给出功能名）说明怎么改</summary>
    private static readonly (string Feature, string Fix)[] NewerFeatures =
    {
        ("内插字符串", "$\"…{x}…\" 改成 string.Format(\"…{0}…\", x)，或者用 + 把字符串连起来"),
        ("空传播运算符", "a?.b 改成先判断是否为 null，例如 a != null ? a.b : null"),
        ("nameof", "nameof(x) 直接写成字符串 \"x\""),
        ("expression-bodied", "=> 改成大括号，方法写成 { return …; }，属性写成 { get { return …; } }"),
        ("自动属性初始值", "属性后面的 = 初始值 去掉，改到构造函数里赋值"),
        ("化出变量", "out var x 改成先声明变量（如 int x;），再写 out x"),
        ("字典初始值", "[\"键\"] = 值 改成 { \"键\", 值 }"),
        ("模式匹配", "x is 类型 y 改成先用 as 转换，再判断是否为 null"),
        ("本地函数", "方法里的方法挪到类里，写成一个 private 方法"),
        ("default 字面量", "default 写成 default(类型)，例如 default(int)"),
        ("元组", "改成定义一个类，或者用 out 参数返回多个值"),
        ("异常筛选器", "catch (…) when (条件) 改成在 catch 里用 if 判断"),
    };

    private static string Vs2012(Diagnostic diagnostic)
    {
        var message = diagnostic.GetMessage(System.Globalization.CultureInfo.GetCultureInfo("zh-Hans"));
        var fix = NewerFeatures.FirstOrDefault(f => message.Contains(f.Feature)).Fix;
        return "机房的 VS 2012 只支持 C# 5，不认这种写法" + (fix == null ? "，换成老的写法。" : $"：{fix}。");
    }
}
