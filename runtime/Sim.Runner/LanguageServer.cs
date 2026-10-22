using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Completion;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Host.Mef;
using Microsoft.CodeAnalysis.QuickInfo;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 常驻语言服务：给浏览器里的代码编辑器提供代码补全、悬停提示、参数提示和边写边检查的编译错误。
/// 和 VS 的 IntelliSense 用同一套 Roslyn 引擎。从标准输入读取 {"id":…,"type":…,"session":…,"files":[…],"file":…,"line":…,"column":…}，
/// 回复 {"id":…,…}。请求并行处理（同一个会话内按顺序），学生在不同标签页里互不等待。
/// 每个浏览器标签页一个会话，保存一份工程；请求带上全部文件，只更新有变化的文件，Roslyn 能复用没变的部分。
/// 和编译服务分开成两个进程：编译不会被补全请求拖慢，反之亦然。
/// </summary>
internal static class LanguageServer
{
    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static readonly object OutputLock = new();
    private static readonly ConcurrentDictionary<string, Session> Sessions = new();
    private const int MaxSessions = 300;
    private const int MaxCompletionItems = 2000;

    public static int Run()
    {
        using var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

        WarmUp();
        Write(output, new JsonObject { ["type"] = "ready" });

        while (input.ReadLine() is { } line)
        {
            _ = Task.Run(() => HandleAsync(line, output));
        }
        return 0;
    }

    private static void Write(StreamWriter output, JsonObject message)
    {
        var text = message.ToJsonString(JsonOptions);
        lock (OutputLock) output.WriteLine(text);
    }

    private static async Task HandleAsync(string line, StreamWriter output)
    {
        JsonNode? id = null;
        JsonObject reply;
        try
        {
            var request = JsonNode.Parse(line)!.AsObject();
            id = request["id"]?.DeepClone();
            reply = await DispatchAsync(request);
        }
        catch (Exception ex)
        {
            reply = new JsonObject { ["type"] = "error", ["message"] = ex.Message };
        }
        reply["id"] = id;
        Write(output, reply);
    }

    private static async Task<JsonObject> DispatchAsync(JsonObject request)
    {
        var session = GetSession((string?)request["session"] ?? "default");
        await session.Lock.WaitAsync();
        try
        {
            session.LastUsed = DateTime.UtcNow;
            if (request["files"] is JsonArray files) session.Update(files);
            var type = (string?)request["type"];
            if (type == "diagnostics") return await DiagnosticsAsync(session);
            if (type == "completionDetail") return await CompletionDetailAsync(session, (int?)request["index"] ?? -1);

            var document = session.Document((string?)request["file"] ?? "");
            if (document == null) return new JsonObject { ["type"] = "empty" };
            var text = await document.GetTextAsync();
            var line = Math.Clamp(((int?)request["line"] ?? 1) - 1, 0, text.Lines.Count - 1);
            var column = Math.Clamp(((int?)request["column"] ?? 1) - 1, 0, text.Lines[line].End - text.Lines[line].Start);
            var position = text.Lines.GetPosition(new LinePosition(line, column));
            return type switch
            {
                "complete" => await CompleteAsync(session, document, text, position),
                "hover" => await HoverAsync(document, text, position),
                "signature" => await SignatureAsync(document, position),
                _ => new JsonObject { ["type"] = "error", ["message"] = $"不认识的请求 {type}" },
            };
        }
        finally
        {
            session.Lock.Release();
        }
    }

    private static Session GetSession(string id)
    {
        if (Sessions.TryGetValue(id, out var existing)) return existing;
        // 会话太多时丢掉最久没用的（浏览器关了也不会通知这里）
        if (Sessions.Count >= MaxSessions)
        {
            foreach (var old in Sessions.OrderBy(s => s.Value.LastUsed).Take(Sessions.Count - MaxSessions + 1)) Sessions.TryRemove(old.Key, out _);
        }
        return Sessions.GetOrAdd(id, _ => new Session());
    }

    // ---------- 代码补全 ----------

    private static async Task<JsonObject> CompleteAsync(Session session, Document document, SourceText text, int position)
    {
        var service = CompletionService.GetService(document)!;
        var list = await service.GetCompletionsAsync(document, position);
        session.LastCompletion = (document, list);
        var items = new JsonArray();
        foreach (var item in list.ItemsList.Take(MaxCompletionItems))
        {
            items.Add(new JsonObject
            {
                ["label"] = item.DisplayTextPrefix + item.DisplayText + item.DisplayTextSuffix,
                ["insert"] = item.DisplayText,
                ["filter"] = item.FilterText,
                ["sort"] = item.SortText,
                ["kind"] = item.Tags.FirstOrDefault() ?? "",
                ["detail"] = item.InlineDescription,
            });
        }
        return new JsonObject { ["type"] = "completions", ["range"] = Range(text, list.Span), ["items"] = items };
    }

    /// <summary>补全列表里选中某一项时，取它的说明（签名和文档）</summary>
    private static async Task<JsonObject> CompletionDetailAsync(Session session, int index)
    {
        if (session.LastCompletion is not var (document, list) || index < 0 || index >= list.ItemsList.Count)
        {
            return new JsonObject { ["type"] = "detail", ["text"] = null };
        }
        var description = await CompletionService.GetService(document)!.GetDescriptionAsync(document, list.ItemsList[index]);
        return new JsonObject { ["type"] = "detail", ["text"] = WithoutNullable(description?.Text) };
    }

    // ---------- 悬停提示 ----------

    private static async Task<JsonObject> HoverAsync(Document document, SourceText text, int position)
    {
        var info = await QuickInfoService.GetService(document)!.GetQuickInfoAsync(document, position);
        if (info == null) return new JsonObject { ["type"] = "hover", ["text"] = null };
        var sections = info.Sections.Select(s => s.Text).Where(t => !string.IsNullOrWhiteSpace(t));
        return new JsonObject { ["type"] = "hover", ["text"] = WithoutNullable(string.Join("\n\n", sections)), ["range"] = Range(text, info.Span) };
    }

    // ---------- 参数提示 ----------

    /// <summary>不显示可空注解：仿真类库开启了可空检查，学生代码没有开，VS 里看到的也是 string 而不是 string?</summary>
    private static readonly SymbolDisplayFormat TypeFormat = SymbolDisplayFormat.MinimallyQualifiedFormat
        .RemoveMiscellaneousOptions(SymbolDisplayMiscellaneousOptions.IncludeNullableReferenceTypeModifier);

    /// <summary>Roslyn 生成的说明文字里去掉可空注解（如 string? → string）</summary>
    private static string? WithoutNullable(string? text) =>
        text == null ? null : Regex.Replace(text, @"(?<=[\w>\]])\?(?=[\s,)\]>]|$)", "");

    /// <summary>光标在方法调用或 new 的括号里时，列出各个重载，标出正在填的是第几个参数</summary>
    private static async Task<JsonObject> SignatureAsync(Document document, int position)
    {
        var empty = new JsonObject { ["type"] = "signature", ["signatures"] = new JsonArray() };
        var root = await document.GetSyntaxRootAsync();
        var model = await document.GetSemanticModelAsync();
        if (root == null || model == null) return empty;

        var argumentList = root.FindToken(Math.Max(position - 1, 0)).Parent?
            .AncestorsAndSelf()
            .OfType<ArgumentListSyntax>()
            .FirstOrDefault(a => position > a.OpenParenToken.SpanStart && (a.CloseParenToken.IsMissing || position <= a.CloseParenToken.SpanStart));
        if (argumentList == null) return empty;

        IEnumerable<IMethodSymbol> methods;
        ISymbol? chosen;
        switch (argumentList.Parent)
        {
            case InvocationExpressionSyntax invocation:
                methods = model.GetMemberGroup(invocation.Expression).OfType<IMethodSymbol>();
                chosen = model.GetSymbolInfo(invocation).Symbol;
                break;
            case BaseObjectCreationExpressionSyntax creation when model.GetTypeInfo(creation).Type is INamedTypeSymbol type:
                methods = type.InstanceConstructors.Where(c => c.DeclaredAccessibility == Accessibility.Public);
                chosen = model.GetSymbolInfo(creation).Symbol;
                break;
            default:
                return empty;
        }

        var activeParameter = argumentList.Arguments.GetSeparators().Count(comma => comma.SpanStart < position);
        var signatures = new JsonArray();
        var list = methods.ToList();
        foreach (var method in list)
        {
            var label = new StringBuilder(method.MethodKind == MethodKind.Constructor ? method.ContainingType.Name : method.Name).Append('(');
            var parameters = new JsonArray();
            foreach (var p in method.Parameters)
            {
                if (p.Ordinal > 0) label.Append(", ");
                var start = label.Length;
                label.Append(p.Type.ToDisplayString(TypeFormat)).Append(' ').Append(p.Name);
                parameters.Add(new JsonArray(start, label.Length));
            }
            label.Append(')');
            if (method.MethodKind != MethodKind.Constructor) label.Insert(0, method.ReturnType.ToDisplayString(TypeFormat) + " ");
            // 返回类型插在前面，参数位置要跟着后移
            var offset = method.MethodKind != MethodKind.Constructor ? method.ReturnType.ToDisplayString(TypeFormat).Length + 1 : 0;
            foreach (var range in parameters.OfType<JsonArray>())
            {
                range[0] = (int)range[0]! + offset;
                range[1] = (int)range[1]! + offset;
            }
            signatures.Add(new JsonObject { ["label"] = label.ToString(), ["parameters"] = parameters });
        }
        // 已经能确定是哪个重载时选它，否则选参数够多的第一个
        var active = list.FindIndex(m => SymbolEqualityComparer.Default.Equals(m, chosen));
        if (active < 0) active = Math.Max(list.FindIndex(m => m.Parameters.Length > activeParameter), 0);
        return new JsonObject { ["type"] = "signature", ["signatures"] = signatures, ["activeSignature"] = active, ["activeParameter"] = activeParameter };
    }

    // ---------- 边写边检查 ----------

    /// <summary>整个工程的编译错误和警告（不生成程序集），提示和真正编译时一样</summary>
    private static async Task<JsonObject> DiagnosticsAsync(Session session)
    {
        var project = session.Workspace.CurrentSolution.GetProject(session.ProjectId)!;
        var compilation = (CSharpCompilation)(await project.GetCompilationAsync())!;
        var diagnostics = new JsonArray();
        foreach (var diagnostic in compilation.GetDiagnostics()
                     .Concat(ApiPolicy.Check(compilation))
                     .Where(d => d.Severity is DiagnosticSeverity.Error or DiagnosticSeverity.Warning && d.Location.IsInSource)
                     .Where(d => !LegacyThreadRewriter.IsSupportedObsoleteWarning(d))
                     .OrderBy(d => d.Severity == DiagnosticSeverity.Error ? 0 : 1))
        {
            diagnostics.Add(StudentCompiler.ToJson(diagnostic));
        }
        return new JsonObject { ["type"] = "diagnostics", ["diagnostics"] = diagnostics };
    }

    private static JsonObject Range(SourceText text, TextSpan span)
    {
        var lines = text.Lines.GetLinePositionSpan(span);
        return new JsonObject
        {
            ["startLine"] = lines.Start.Line + 1,
            ["startColumn"] = lines.Start.Character + 1,
            ["endLine"] = lines.End.Line + 1,
            ["endColumn"] = lines.End.Character + 1,
        };
    }

    /// <summary>启动时做一遍补全和检查，让 MEF 组合和 JIT 提前完成，学生第一次按"."时不用等几秒</summary>
    private static void WarmUp()
    {
        var session = new Session();
        session.Update(new JsonArray(new JsonObject
        {
            ["path"] = "Program.cs",
            ["content"] = "using System.Windows.Forms; static class P { static void Main() { var f = new Form(); f.Text = \"预热\"; MessageBox.Show(\"\"); } }",
        }));
        var document = session.Document("Program.cs")!;
        var text = document.GetTextAsync().Result;
        var position = text.ToString().IndexOf("f.Text", StringComparison.Ordinal) + 2;
        CompleteAsync(session, document, text, position).Wait();
        HoverAsync(document, text, position).Wait();
        SignatureAsync(document, text.ToString().IndexOf("Show(", StringComparison.Ordinal) + 5).Wait();
        DiagnosticsAsync(session).Wait();
    }

    /// <summary>一个浏览器标签页的工程</summary>
    private sealed class Session
    {
        public readonly AdhocWorkspace Workspace = new(MefHostServices.DefaultHost);
        public readonly ProjectId ProjectId = ProjectId.CreateNewId();
        public readonly SemaphoreSlim Lock = new(1, 1);
        public DateTime LastUsed = DateTime.UtcNow;
        /// <summary>最近一次补全的结果，选中某项时据此取说明</summary>
        public (Document, CompletionList)? LastCompletion;
        private readonly Dictionary<string, (DocumentId Id, string Content)> documents = new();

        public Session()
        {
            Workspace.AddProject(ProjectInfo.Create(
                ProjectId, VersionStamp.Create(), "StudentApp", "StudentApp", LanguageNames.CSharp,
                compilationOptions: StudentCompiler.CompilationOptions,
                parseOptions: StudentCompiler.ParseOptions,
                metadataReferences: StudentCompiler.References.Value));
        }

        /// <summary>同步浏览器里的文件：只更新有变化的，删掉已经没有的</summary>
        public void Update(JsonArray files)
        {
            var solution = Workspace.CurrentSolution;
            var seen = new HashSet<string>();
            foreach (var file in files.OfType<JsonObject>())
            {
                var path = (string?)file["path"];
                var content = (string?)file["content"] ?? "";
                if (path == null || !path.EndsWith(".cs", StringComparison.Ordinal)) continue;
                seen.Add(path);
                if (documents.TryGetValue(path, out var doc))
                {
                    if (doc.Content == content) continue;
                    solution = solution.WithDocumentText(doc.Id, SourceText.From(content));
                    documents[path] = (doc.Id, content);
                }
                else
                {
                    var id = DocumentId.CreateNewId(ProjectId);
                    solution = solution.AddDocument(id, path, SourceText.From(content), filePath: path);
                    documents[path] = (id, content);
                }
            }
            foreach (var path in documents.Keys.Where(p => !seen.Contains(p)).ToList())
            {
                solution = solution.RemoveDocument(documents[path].Id);
                documents.Remove(path);
            }
            Workspace.TryApplyChanges(solution);
        }

        public Document? Document(string path) =>
            documents.TryGetValue(path, out var doc) ? Workspace.CurrentSolution.GetDocument(doc.Id) : null;
    }
}
