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
            ("CS0103", _) => $"找不到“{source}”。检查拼写和大小写（C# 区分大小写），以及控件的 Name 是否和代码里一致。",
            ("CS1002", _) => "C# 每条语句末尾要有英文分号 ;",
            ("CS1056", _) or ("CS1525", _) when source.Length == 1 && source[0] > 127 => "这里出现了中文标点，C# 代码里的符号要用英文半角。",
            ("CS0029", _) => "等号两边的类型不一致。如果要把文本框里的文字变成数字，可以用 int.Parse(...) 或 Convert.ToInt32(...)。",
            _ => null,
        };
    }
}
