using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>用 Roslyn 在内存里编译学生工程，报错信息用简体中文</summary>
internal static class StudentCompiler
{
    private static readonly CultureInfo Chinese = CultureInfo.GetCultureInfo("zh-Hans");

    /// <summary>
    /// 框架里不能给学生代码引用的程序集：System.Drawing.dll 门面把 Font、Image 等转发到 Linux 不支持的
    /// System.Drawing.Common，会和仿真库里的同名类型冲突。
    /// </summary>
    private static readonly HashSet<string> ExcludedFrameworkAssemblies = new(StringComparer.OrdinalIgnoreCase)
    {
        "System.Drawing.dll",
    };

    private static readonly string[] SimAssemblies = { "Sim.WinForms.dll", "Sim.Devices.dll", "Sim.Data.dll" };

    public sealed record Result(bool Success, byte[] Assembly, byte[] Pdb, JsonArray Diagnostics);

    /// <summary>编译和语言服务（代码补全等）共用同一套选项</summary>
    internal static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.Latest);

    internal static readonly CSharpCompilationOptions CompilationOptions = new CSharpCompilationOptions(OutputKind.WindowsApplication)
        .WithOptimizationLevel(OptimizationLevel.Debug)
        .WithNullableContextOptions(NullableContextOptions.Disable)
        .WithAllowUnsafe(false)
        .WithConcurrentBuild(true);

    public static Result Compile(string projectDir)
    {
        var parseOptions = ParseOptions;
        var trees = Directory.EnumerateFiles(projectDir, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(projectDir, path))
            .OrderBy(path => path, StringComparer.Ordinal)
            .Select(path => CSharpSyntaxTree.ParseText(
                SourceText.From(File.ReadAllText(path), Encoding.UTF8),
                parseOptions,
                path: Path.GetRelativePath(projectDir, path)))
            .ToList();

        var compilation = CSharpCompilation.Create("StudentApp", trees, References.Value, CompilationOptions);

        using var peStream = new MemoryStream();
        using var pdbStream = new MemoryStream();
        // 编译改写后的代码（旧版线程 API 换成平台实现，DateTime.Now 换成虚拟时钟），API 检查仍针对学生写的原始代码
        var emit = ClockRewriter.Rewrite(LegacyThreadRewriter.Rewrite(compilation)).Emit(peStream, pdbStream,
            options: new EmitOptions(debugInformationFormat: DebugInformationFormat.PortablePdb),
            manifestResources: EmptyControlResources(compilation));
        var denied = ApiPolicy.Check(compilation).ToList();

        var diagnostics = new JsonArray();
        foreach (var diagnostic in emit.Diagnostics.Concat(denied)
                     .Where(d => d.Severity is DiagnosticSeverity.Error or DiagnosticSeverity.Warning)
                     .OrderBy(d => d.Severity == DiagnosticSeverity.Error ? 0 : 1))
        {
            diagnostics.Add(ToJson(diagnostic));
        }
        return new Result(emit.Success && denied.Count == 0, peStream.ToArray(), pdbStream.ToArray(), diagnostics);
    }

    private static readonly Lazy<byte[]> EmptyResources = new(() =>
    {
        var stream = new MemoryStream();
        using (var writer = new System.Resources.ResourceWriter(stream)) writer.Generate();
        return stream.ToArray();
    });

    /// <summary>
    /// 给学生工程里的每个窗体、控件类嵌一份空的 .resources：VS 生成的 Designer.cs 会用
    /// ComponentResourceManager(typeof(窗体)).GetObject("…OcxState") 读窗体的 .resx（如 Windows Media Player 控件），
    /// 平台没有 .resx，有了空资源时取到 null，而不是报"找不到资源"。
    /// </summary>
    private static List<ResourceDescription> EmptyControlResources(CSharpCompilation compilation)
    {
        var control = compilation.GetTypeByMetadataName("System.Windows.Forms.Control");
        var resources = new List<ResourceDescription>();
        if (control == null) return resources;
        var names = new HashSet<string>();
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var declaration in tree.GetRoot().DescendantNodes().OfType<Microsoft.CodeAnalysis.CSharp.Syntax.ClassDeclarationSyntax>())
            {
                if (model.GetDeclaredSymbol(declaration) is not { } type) continue;
                var derives = false;
                for (var t = type.BaseType; t != null && !derives; t = t.BaseType) derives = SymbolEqualityComparer.Default.Equals(t, control);
                var name = type.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat).Replace("global::", "") + ".resources";
                if (derives && names.Add(name)) resources.Add(new ResourceDescription(name, () => new MemoryStream(EmptyResources.Value), isPublic: true));
            }
        }
        return resources;
    }

    internal static JsonObject ToJson(Diagnostic diagnostic)
    {
        var span = diagnostic.Location.GetMappedLineSpan();
        var message = diagnostic.GetMessage(Chinese);
        var json = new JsonObject
        {
            ["file"] = span.Path,
            ["line"] = span.StartLinePosition.Line + 1,
            ["column"] = span.StartLinePosition.Character + 1,
            ["severity"] = diagnostic.Severity == DiagnosticSeverity.Error ? "error" : "warning",
            ["code"] = diagnostic.Id,
            ["message"] = message,
        };
        var hint = CompileHints.For(diagnostic);
        if (hint != null) json["hint"] = hint;
        return json;
    }

    private static bool IsBuildOutput(string projectDir, string path)
    {
        var relative = Path.GetRelativePath(projectDir, path).Replace('\\', '/');
        return relative.StartsWith("bin/") || relative.StartsWith("obj/") || relative.Contains("/bin/") || relative.Contains("/obj/");
    }

    /// <summary>学生代码可引用的程序集：.NET 框架（去掉冲突的门面）+ 仿真库</summary>
    internal static readonly Lazy<IReadOnlyList<MetadataReference>> References = new(() =>
    {
        var frameworkDir = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
        var framework = Directory.EnumerateFiles(frameworkDir, "*.dll")
            .Where(path => !ExcludedFrameworkAssemblies.Contains(Path.GetFileName(path)))
            .Where(IsManagedAssembly);
        var sim = SimAssemblies.Select(name => Path.Combine(AppContext.BaseDirectory, name));
        return framework.Concat(sim).Select(path => (MetadataReference)MetadataReference.CreateFromFile(path)).ToList();
    });

    private static bool IsManagedAssembly(string path)
    {
        try
        {
            AssemblyName.GetAssemblyName(path);
            return true;
        }
        catch (BadImageFormatException)
        {
            return false; // 框架目录里的原生库
        }
    }
}
