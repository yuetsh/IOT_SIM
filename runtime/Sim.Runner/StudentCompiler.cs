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

    private static readonly string[] SimAssemblies = { "Sim.WinForms.dll", "Sim.Devices.dll" };

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
        var emit = compilation.Emit(peStream, pdbStream,
            options: new EmitOptions(debugInformationFormat: DebugInformationFormat.PortablePdb));
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
