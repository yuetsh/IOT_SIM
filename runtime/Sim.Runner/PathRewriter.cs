using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 编译前把传给 System.IO（File、Directory、Path、FileStream、StreamWriter 等）和 Image / Bitmap 读写文件方法的路径参数
/// 包上 Sim.Host.WindowsPaths.Fix(...)：教材按 Windows 写 AppDomain.CurrentDomain.BaseDirectory + "Camera\\"，
/// 在 Linux 上反斜杠要换成斜杠。只包语义上确实是这些方法里名字带 path / file / dir 的字符串参数；
/// 改写不换行，报错和异常里的行号不变。学生在编辑器里看到的仍是原来的代码。
/// </summary>
internal static class PathRewriter
{
    private const string Fix = "global::Sim.Host.WindowsPaths.Fix";

    public static CSharpCompilation Rewrite(CSharpCompilation compilation)
    {
        var result = compilation;
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            var targets = root.DescendantNodes()
                .Where(n => n is InvocationExpressionSyntax or BaseObjectCreationExpressionSyntax)
                .SelectMany(n => PathArguments(model.GetOperation(n)))
                .ToHashSet();
            if (targets.Count == 0) continue;
            var rewritten = root.ReplaceNodes(targets, (_, node) =>
                SyntaxFactory.ParseExpression($"{Fix}({node.WithoutTrivia().ToFullString()})").WithTriviaFrom(node));
            result = result.ReplaceSyntaxTree(tree,
                CSharpSyntaxTree.ParseText(SourceText.From(rewritten.ToFullString(), Encoding.UTF8), (CSharpParseOptions)tree.Options, tree.FilePath));
        }
        return result;
    }

    /// <summary>调用里要包起来的路径参数（只取学生直接写的表达式；不含反斜杠的字符串常量不用包）</summary>
    private static IEnumerable<ExpressionSyntax> PathArguments(IOperation? operation)
    {
        var (method, arguments) = operation switch
        {
            IInvocationOperation invocation => (invocation.TargetMethod, invocation.Arguments),
            IObjectCreationOperation creation when creation.Constructor != null => (creation.Constructor, creation.Arguments),
            _ => (null, default),
        };
        if (method == null || !HandlesFiles(method.ContainingType)) yield break;
        foreach (var argument in arguments)
        {
            if (argument.Parameter is not { } parameter || !IsPathName(parameter.Name)) continue;
            var values = argument.ArgumentKind == ArgumentKind.ParamArray && argument.Value is IArrayCreationOperation { Initializer: { } init }
                ? init.ElementValues
                : [argument.Value];
            foreach (var value in values)
            {
                if (value.IsImplicit || value.Type?.SpecialType != SpecialType.System_String) continue;
                if (value.ConstantValue is { HasValue: true, Value: string constant } && !constant.Contains('\\')) continue;
                if (value.Syntax is ExpressionSyntax expression) yield return expression;
            }
        }
    }

    private static bool HandlesFiles(INamedTypeSymbol type)
    {
        var ns = type.ContainingNamespace?.ToDisplayString();
        return ns == "System.IO" || (ns == "System.Drawing" && type.Name is "Image" or "Bitmap");
    }

    private static bool IsPathName(string name) =>
        name.Contains("path", StringComparison.OrdinalIgnoreCase)
        || name.Contains("file", StringComparison.OrdinalIgnoreCase)
        || name.Contains("dir", StringComparison.OrdinalIgnoreCase);
}
