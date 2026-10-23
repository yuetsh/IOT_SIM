using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 编译前把学生代码里的 DateTime.Now / Today / UtcNow 改写成虚拟时钟 Sim.Host.SimClock（实训台上可以拨时间、调倍速，
/// 教材项目 7 按 6:45 起床、22:00 熄灯等时刻切换情景模式）。只改写语义上确实是 System.DateTime 这三个属性的地方；
/// 改写不换行，报错和异常里的行号不变。学生在编辑器里看到的仍是原来的代码。
/// </summary>
internal static class ClockRewriter
{
    private const string Target = "global::Sim.Host.SimClock";

    public static CSharpCompilation Rewrite(CSharpCompilation compilation)
    {
        var result = compilation;
        foreach (var tree in compilation.SyntaxTrees)
        {
            var text = tree.GetText().ToString();
            if (!text.Contains("Now") && !text.Contains("Today")) continue;
            var rewriter = new Rewriter(compilation.GetSemanticModel(tree));
            var root = rewriter.Visit(tree.GetRoot());
            if (!rewriter.Changed) continue;
            result = result.ReplaceSyntaxTree(tree,
                CSharpSyntaxTree.ParseText(SourceText.From(root.ToFullString(), Encoding.UTF8), (CSharpParseOptions)tree.Options, tree.FilePath));
        }
        return result;
    }

    private static string? Replacement(ISymbol? symbol) =>
        symbol is IPropertySymbol { IsStatic: true, Name: "Now" or "Today" or "UtcNow" } property
        && property.ContainingType.SpecialType == SpecialType.System_DateTime
            ? $"{Target}.{property.Name}"
            : null;

    private sealed class Rewriter(SemanticModel model) : CSharpSyntaxRewriter
    {
        public bool Changed { get; private set; }

        public override SyntaxNode? VisitMemberAccessExpression(MemberAccessExpressionSyntax node)
        {
            // DateTime.Now、System.DateTime.Now
            if (Replacement(model.GetSymbolInfo(node).Symbol) is { } replacement)
            {
                Changed = true;
                return SyntaxFactory.ParseExpression(replacement).WithTriviaFrom(node);
            }
            return base.VisitMemberAccessExpression(node);
        }

        public override SyntaxNode? VisitIdentifierName(IdentifierNameSyntax node)
        {
            // using static System.DateTime; 之后直接写 Now
            if (node.Parent is not MemberAccessExpressionSyntax access || access.Expression == node)
            {
                if (Replacement(model.GetSymbolInfo(node).Symbol) is { } replacement)
                {
                    Changed = true;
                    return SyntaxFactory.ParseExpression(replacement).WithTriviaFrom(node);
                }
            }
            return base.VisitIdentifierName(node);
        }
    }
}
