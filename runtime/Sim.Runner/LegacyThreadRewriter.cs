using System.Text;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 编译前改写学生代码里的旧版线程 API，让教材项目 5 的 Suspend / Resume / Abort 能在新版 .NET 上运行：
/// <code>
/// new Thread(GetData)          → new Thread(LegacyThreads.Wrap(new ThreadStart(GetData)))
/// thd.Suspend() / Resume() / Abort()  → LegacyThreads.Suspend(thd) …
/// thd.ThreadState              → LegacyThreads.GetThreadState(thd)
/// Thread.Sleep(2000)           → LegacyThreads.Sleep(2000)
/// </code>
/// 只改写语义上确实是 System.Threading.Thread 成员的调用；改写不换行，报错和异常堆栈里的行号不变。
/// 学生在编辑器里看到的仍是原来的代码。
/// </summary>
internal static class LegacyThreadRewriter
{
    private const string Target = "global::Sim.Host.LegacyThreads";

    /// <summary>改写整个编译；没有需要改写的地方时原样返回</summary>
    public static CSharpCompilation Rewrite(CSharpCompilation compilation)
    {
        var result = compilation;
        foreach (var tree in compilation.SyntaxTrees)
        {
            // 用到线程的文件一定会出现 Thread 这个词，其他文件不用做语义分析
            if (!tree.GetText().ToString().Contains("Thread")) continue;
            var rewriter = new Rewriter(compilation.GetSemanticModel(tree));
            var root = rewriter.Visit(tree.GetRoot());
            if (!rewriter.Changed) continue;
            var text = SourceText.From(root.ToFullString(), Encoding.UTF8);
            result = result.ReplaceSyntaxTree(tree, CSharpSyntaxTree.ParseText(text, (CSharpParseOptions)tree.Options, tree.FilePath));
        }
        return result;
    }

    /// <summary>平台支持的过时线程 API 不再提示"已过时"（边写边检查时用）</summary>
    public static bool IsSupportedObsoleteWarning(Diagnostic diagnostic)
    {
        if (diagnostic.Id is not ("CS0618" or "SYSLIB0006")) return false;
        // 警告标在整个调用上，如 thd.Suspend()
        var source = diagnostic.Location.SourceTree?.GetText().ToString(diagnostic.Location.SourceSpan) ?? "";
        return Regex.IsMatch(source, @"\b(Suspend|Resume|Abort)\b");
    }

    private static bool IsThread(ITypeSymbol? type) =>
        type is { Name: "Thread", ContainingNamespace: { Name: "Threading", ContainingNamespace: { Name: "System", ContainingNamespace.IsGlobalNamespace: true } } };

    private sealed class Rewriter(SemanticModel model) : CSharpSyntaxRewriter
    {
        public bool Changed { get; private set; }

        public override SyntaxNode? VisitInvocationExpression(InvocationExpressionSyntax node)
        {
            var method = model.GetSymbolInfo(node).Symbol as IMethodSymbol;
            var visited = (InvocationExpressionSyntax)base.VisitInvocationExpression(node)!;
            if (method == null || !IsThread(method.ContainingType)) return visited;

            switch (method.Name)
            {
                case "Suspend" or "Resume" or "Abort" when !method.IsStatic && visited.Expression is MemberAccessExpressionSyntax access:
                    // thd.Abort(x) → LegacyThreads.Abort(thd, x)
                    var arguments = visited.ArgumentList.Arguments.Insert(0, SyntaxFactory.Argument(access.Expression.WithoutTrivia()));
                    Changed = true;
                    return SyntaxFactory.InvocationExpression(Member(method.Name), SyntaxFactory.ArgumentList(arguments))
                        .WithTriviaFrom(visited);
                case "Sleep" when method.IsStatic:
                    Changed = true;
                    return visited.WithExpression(Member("Sleep").WithTriviaFrom(visited.Expression));
                default:
                    return visited;
            }
        }

        public override SyntaxNode? VisitMemberAccessExpression(MemberAccessExpressionSyntax node)
        {
            var symbol = model.GetSymbolInfo(node).Symbol;
            var visited = (MemberAccessExpressionSyntax)base.VisitMemberAccessExpression(node)!;
            if (symbol is not IPropertySymbol { Name: "ThreadState", IsStatic: false } property || !IsThread(property.ContainingType)) return visited;
            Changed = true;
            return SyntaxFactory.InvocationExpression(
                    Member("GetThreadState"),
                    SyntaxFactory.ArgumentList(SyntaxFactory.SingletonSeparatedList(SyntaxFactory.Argument(visited.Expression.WithoutTrivia()))))
                .WithTriviaFrom(visited);
        }

        public override SyntaxNode? VisitObjectCreationExpression(ObjectCreationExpressionSyntax node) =>
            WrapThreadStart(node, base.VisitObjectCreationExpression(node));

        public override SyntaxNode? VisitImplicitObjectCreationExpression(ImplicitObjectCreationExpressionSyntax node) =>
            WrapThreadStart(node, base.VisitImplicitObjectCreationExpression(node));

        /// <summary>new Thread(start) 的第一个参数包一层 LegacyThreads.Wrap，线程被 Abort 时安静地结束</summary>
        private SyntaxNode? WrapThreadStart(BaseObjectCreationExpressionSyntax original, SyntaxNode? visitedNode)
        {
            if (visitedNode is not BaseObjectCreationExpressionSyntax visited
                || model.GetSymbolInfo(original).Symbol is not IMethodSymbol { MethodKind: MethodKind.Constructor } constructor
                || !IsThread(constructor.ContainingType)
                || constructor.Parameters.Length == 0
                || visited.ArgumentList is not { Arguments.Count: > 0 } argumentList)
            {
                return visitedNode;
            }
            var first = argumentList.Arguments[0];
            if (first.Expression.IsKind(SyntaxKind.NullLiteralExpression)) return visited;
            var delegateType = constructor.Parameters[0].Type.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat);
            // new ThreadStart(方法名或 lambda)：明确委托类型，Wrap 的重载就不会有歧义
            var wrapped = SyntaxFactory.ParseExpression($"{Target}.Wrap(new {delegateType}({first.Expression.WithoutTrivia().ToFullString()}))");
            Changed = true;
            return visited.WithArgumentList(argumentList.WithArguments(
                argumentList.Arguments.Replace(first, first.WithExpression(wrapped.WithTriviaFrom(first.Expression)))));
        }

        private static ExpressionSyntax Member(string name) => SyntaxFactory.ParseExpression($"{Target}.{name}");
    }
}
