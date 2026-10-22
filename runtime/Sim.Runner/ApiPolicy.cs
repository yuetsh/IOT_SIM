using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Sim.Runner;

/// <summary>
/// 编译时检查学生代码用到的 API：网络、启动外部程序、反射、调用本机代码等课程用不到、只会带来风险的功能，
/// 直接给出中文报错。真正的隔离靠运行时沙箱，这里是第二道防线，也让学生看到明确的原因。
/// </summary>
internal static class ApiPolicy
{
#pragma warning disable RS2008 // 不是分析器，不需要发布跟踪
    private static readonly DiagnosticDescriptor NotAllowed = new(
        "SIM001", "平台不允许使用的功能", "平台不允许使用 {0}（{1}）", "Usage", DiagnosticSeverity.Error, isEnabledByDefault: true);
#pragma warning restore RS2008

    /// <summary>整个命名空间（含子命名空间）都不允许</summary>
    private static readonly (string Namespace, string Reason)[] DeniedNamespaces =
    {
        ("System.Net", "网络访问"),
        ("System.Reflection", "反射"),
        ("System.Runtime.Loader", "加载程序集"),
        ("System.IO.Pipes", "进程间通信"),
        ("System.IO.MemoryMappedFiles", "进程间通信"),
    };

    /// <summary>单个类型不允许（所在命名空间的其他类型可以用）</summary>
    private static readonly Dictionary<string, string> DeniedTypes = new()
    {
        ["System.Diagnostics.Process"] = "启动其他程序",
        ["System.Diagnostics.ProcessStartInfo"] = "启动其他程序",
        ["System.AppDomain"] = "加载程序集",
        ["System.Runtime.InteropServices.Marshal"] = "调用本机代码",
        ["System.Runtime.InteropServices.DllImportAttribute"] = "调用本机代码",
        ["System.Runtime.InteropServices.LibraryImportAttribute"] = "调用本机代码",
        ["System.Runtime.InteropServices.NativeLibrary"] = "调用本机代码",
        ["System.Runtime.InteropServices.NativeMemory"] = "调用本机代码",
    };

    /// <summary>不允许的类型里单独放行的成员：教材用 AppDomain.CurrentDomain.BaseDirectory 拼出保存照片的路径</summary>
    private static readonly HashSet<string> AllowedMembers = new()
    {
        "System.AppDomain.CurrentDomain",
        "System.AppDomain.BaseDirectory",
    };

    public static IEnumerable<Diagnostic> Check(CSharpCompilation compilation)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var name in tree.GetRoot().DescendantNodes().OfType<SimpleNameSyntax>())
            {
                // A.B.C 只检查最右边的名字，避免同一处报好几次
                if (name.Parent is QualifiedNameSyntax q && q.Left == name) continue;
                // var 推断出的类型在初始化表达式里已经检查过
                if (name is IdentifierNameSyntax { IsVar: true }) continue;
                if (name.Parent is MemberAccessExpressionSyntax m && m.Expression == name && model.GetSymbolInfo(name).Symbol is INamespaceOrTypeSymbol) continue;

                var symbol = model.GetSymbolInfo(name).Symbol;
                if (symbol == null) continue;
                if (Reason(symbol) is { } reason)
                {
                    yield return Diagnostic.Create(NotAllowed, name.GetLocation(), Display(symbol), reason);
                }
            }
        }
    }

    private static string? Reason(ISymbol symbol)
    {
        if (symbol is IDynamicTypeSymbol) return "dynamic 动态调用";
        // using 指令里的命名空间不算：VS 生成的 AssemblyInfo.cs 会 using System.Runtime.InteropServices
        if (symbol is INamespaceSymbol) return null;
        if (symbol is IPropertySymbol && AllowedMembers.Contains($"{symbol.ContainingType.ToDisplayString()}.{symbol.Name}")) return null;
        var type = symbol as INamedTypeSymbol ?? symbol.ContainingType;
        // 方法的返回值、参数类型由调用处检查；这里看符号本身属于哪个类型
        for (var t = type; t != null; t = t.ContainingType)
        {
            var fullName = t.OriginalDefinition.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat).Replace("global::", "");
            if (DeniedTypes.TryGetValue(fullName, out var reason)) return reason;
        }
        if (type == null) return null;
        // AssemblyInfo.cs 里的 [assembly: AssemblyTitle(...)] 等特性可以用
        if (type.Name.EndsWith("Attribute") && type.ContainingNamespace.ToDisplayString() == "System.Reflection") return null;
        var ns = type.ContainingNamespace.ToDisplayString();
        foreach (var (denied, reason) in DeniedNamespaces)
        {
            if (ns == denied || ns.StartsWith(denied + ".")) return reason;
        }
        return null;
    }

    private static string Display(ISymbol symbol) => symbol switch
    {
        IDynamicTypeSymbol => "dynamic",
        INamedTypeSymbol type => type.ToDisplayString(),
        _ => $"{symbol.ContainingType.ToDisplayString()}.{symbol.Name}",
    };
}
