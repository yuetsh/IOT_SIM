using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 导出 EXE：把学生工程照教材工程的样子（.NET Framework 4.5 窗体应用，引用真机版设备类库）编译成一个 exe，
/// 在机房的 Windows 上双击就能运行，控制真的实训台。
/// <list type="bullet">
/// <item>编译的是学生写的原始代码：平台为仿真做的改写（虚拟时钟、旧线程 API、Windows 路径）和 API 限制都不用，和在 VS 里编译一样。</item>
/// <item>教材 dll（设备类库、设备控件库、媒体播放器的 Interop）嵌进 exe，启动时由模块初始化器从 exe 里加载，学生的 Program.cs 不用改。</item>
/// <item>Properties.Resources 的图片、声音嵌进 exe；代码里按文件名用到的素材（如 Resources\ring.mp3）启动时放到 exe 旁边的 Resources 文件夹，和 VS 输出目录一样。</item>
/// </list>
/// </summary>
internal static class ExeExporter
{
    public sealed record Result(bool Success, byte[] Exe, JsonArray Diagnostics);

    private const string LibPrefix = "IotSimExport.lib.";
    private const string FilePrefix = "IotSimExport.file.";
    private const string MediaPrefix = "IotSimExport.media.";

    /// <summary>
    /// VS 设计器给媒体播放器存的 OcxState（AxHost.State 的 BinaryFormatter 序列化数据，取自教材项目 7 的 Form1.resx，是控件的默认状态）。
    /// 平台没有 .resx，导出时给每个 resources.GetObject("…OcxState") 都放这一份。
    /// </summary>
    private const string MediaPlayerOcxState =
        "AAEAAAD/////AQAAAAAAAAAMAgAAAFdTeXN0ZW0uV2luZG93cy5Gb3JtcywgVmVyc2lvbj00LjAuMC4w" +
        "LCBDdWx0dXJlPW5ldXRyYWwsIFB1YmxpY0tleVRva2VuPWI3N2E1YzU2MTkzNGUwODkFAQAAACFTeXN0" +
        "ZW0uV2luZG93cy5Gb3Jtcy5BeEhvc3QrU3RhdGUBAAAABERhdGEHAgIAAAAJAwAAAA8DAAAAtwAAAAIB" +
        "AAAAAQAAAAAAAAAAAAAAAKIAAAAAAwAACAAAAAAABQAAAAAAAADwPwMAAAAAAAUAAAAAAAAAAAAIAAIA" +
        "AAAAAAMAAQAAAAsA//8DAAAAAAALAP//CAACAAAAAAADADIAAAALAAAACAAKAAAAZgB1AGwAbAAAAAsA" +
        "AAALAAAACwD//wsA//8LAAAACAACAAAAAAAIAAIAAAAAAAgAAgAAAAAACAACAAAAAAALAAAANAYAAOcB" +
        "AAAL";

    private const string AxHostStateType =
        "System.Windows.Forms.AxHost+State, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089";

    /// <summary>平台生成的 Properties/Resources.Designer.cs 从素材库取图片，导出时改成从 exe 里取</summary>
    private const string PlatformResources = "global::Sim.Host.ProjectResources.";
    private const string EmbeddedResources = "global::IotSimExport.EmbeddedFiles.";

    private static readonly Regex ResourceFile = new(@"ProjectResources\.(?:Image|Bytes)\(""([^""]+)""\)");
    private static readonly Regex OcxStateKey = new(@"GetObject\(""([^""]+\.OcxState)""\)");

    private static readonly CSharpCompilationOptions Options = new CSharpCompilationOptions(OutputKind.WindowsApplication)
        .WithPlatform(Platform.AnyCpu32BitPreferred)
        .WithOptimizationLevel(OptimizationLevel.Release)
        .WithNullableContextOptions(NullableContextOptions.Disable)
        .WithAllowUnsafe(false)
        .WithConcurrentBuild(true);

    /// <summary>.NET Framework 4.5 的引用程序集（构建时复制到 netfx/，见 Sim.Runner.csproj）</summary>
    private static readonly Lazy<IReadOnlyList<MetadataReference>> Framework = new(() =>
        Directory.EnumerateFiles(Path.Combine(AppContext.BaseDirectory, "netfx"), "*.dll")
            .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path))
            .ToList());

    /// <summary>libsDir：教材 dll 所在目录；galleryDir：平台素材库</summary>
    public static Result Export(string projectDir, string libsDir, string galleryDir, string assemblyName)
    {
        var libs = Directory.Exists(libsDir) ? Directory.GetFiles(libsDir, "*.dll").OrderBy(p => p, StringComparer.Ordinal).ToArray() : Array.Empty<string>();
        if (!libs.Any(p => Path.GetFileName(p) == "DeviceCtrlLibrary.dll"))
            throw new InvalidOperationException("服务器上没有放教材的设备类库（真机版 DeviceCtrlLibrary.dll 等），不能导出 EXE，请联系老师");

        var sources = StudentCompiler.SourceFiles(projectDir)
            .Select(path => (Path: Path.GetRelativePath(projectDir, path), Text: File.ReadAllText(path)))
            .ToList();

        // 平台生成的资源类改成从 exe 里取，用到的素材文件嵌进去
        var files = new SortedSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < sources.Count; i++)
        {
            if (!sources[i].Text.Contains(PlatformResources)) continue;
            foreach (Match m in ResourceFile.Matches(sources[i].Text)) files.Add(Path.GetFileName(m.Groups[1].Value));
            sources[i] = (sources[i].Path, sources[i].Text.Replace(PlatformResources, EmbeddedResources));
        }
        // 代码里按文件名用到的素材（如 BaseDirectory + "//Resources//ring.mp3"），在 VS 里是复制到输出目录的 Resources 文件夹
        var media = Directory.Exists(galleryDir)
            ? Directory.GetFiles(galleryDir)
                .Select(Path.GetFileName)
                .OfType<string>()
                .Where(name => !name.Contains(".2x.") && name != "index.json")
                .Where(name => sources.Any(s => s.Text.Contains(name + "\"")))
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList()
            : new List<string>();

        var trees = sources
            .Select(s => CSharpSyntaxTree.ParseText(SourceText.From(s.Text, Encoding.UTF8), StudentCompiler.ParseOptions, path: s.Path))
            .Append(CSharpSyntaxTree.ParseText(SourceText.From(Bootstrap(media), Encoding.UTF8), StudentCompiler.ParseOptions, path: "IotSimExport.cs"))
            .ToList();
        var references = Framework.Value.Concat(libs.Select(p => (MetadataReference)MetadataReference.CreateFromFile(p))).ToList();
        var compilation = CSharpCompilation.Create(assemblyName, trees, references, Options);

        var resources = new List<ResourceDescription>();
        foreach (var lib in libs)
        {
            var path = lib;
            resources.Add(new ResourceDescription(LibPrefix + Path.GetFileName(path), () => File.OpenRead(path), isPublic: false));
        }
        foreach (var file in files)
        {
            var path = Path.Combine(galleryDir, file);
            if (File.Exists(path)) resources.Add(new ResourceDescription(FilePrefix + file, () => File.OpenRead(path), isPublic: false));
        }
        foreach (var file in media)
        {
            var path = Path.Combine(galleryDir, file);
            resources.Add(new ResourceDescription(MediaPrefix + file, () => File.OpenRead(path), isPublic: false));
        }
        resources.AddRange(ControlResources(compilation, sources.SelectMany(s => OcxStateKey.Matches(s.Text).Select(m => m.Groups[1].Value)).ToHashSet()));

        using var pe = new MemoryStream();
        using var win32 = compilation.CreateDefaultWin32Resources(versionResource: true, noManifest: false, manifestContents: null, iconInIcoFormat: null);
        var emit = compilation.Emit(pe, win32Resources: win32, manifestResources: resources,
            options: new EmitOptions(debugInformationFormat: DebugInformationFormat.Embedded));

        var diagnostics = new JsonArray();
        // 和平台运行时一样按编译器给出的顺序：语法错误在前，真正的出错原因一般是第一条
        foreach (var diagnostic in emit.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error))
        {
            diagnostics.Add(StudentCompiler.ToJson(diagnostic));
        }
        return new Result(emit.Success, pe.ToArray(), diagnostics);
    }

    /// <summary>
    /// 每个窗体、控件类的 .resources：VS 生成的 Designer.cs 用 ComponentResourceManager 读窗体的 .resx，
    /// 平台没有 .resx。媒体播放器的 OcxState 放默认状态，其他取到 null（和运行时一样）。
    /// </summary>
    private static List<ResourceDescription> ControlResources(CSharpCompilation compilation, HashSet<string> ocxKeys)
    {
        var stream = new MemoryStream();
        using (var writer = new System.Resources.ResourceWriter(stream))
        {
            var state = Convert.FromBase64String(MediaPlayerOcxState);
            foreach (var key in ocxKeys.OrderBy(k => k, StringComparer.Ordinal)) writer.AddResourceData(key, AxHostStateType, state);
            writer.Generate();
        }
        var data = stream.ToArray();

        var control = compilation.GetTypeByMetadataName("System.Windows.Forms.Control");
        var resources = new List<ResourceDescription>();
        if (control == null) return resources;
        var names = new HashSet<string>();
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var declaration in tree.GetRoot().DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (model.GetDeclaredSymbol(declaration) is not { } type) continue;
                var derives = false;
                for (var t = type.BaseType; t != null && !derives; t = t.BaseType) derives = SymbolEqualityComparer.Default.Equals(t, control);
                var name = type.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat).Replace("global::", "") + ".resources";
                if (derives && names.Add(name)) resources.Add(new ResourceDescription(name, () => new MemoryStream(data), isPublic: true));
            }
        }
        return resources;
    }

    /// <summary>
    /// 加进 exe 的启动代码：模块初始化器在 Main 之前运行（.NET Framework 也支持），
    /// 注册 AssemblyResolve，用到教材 dll 时从 exe 里加载；把代码里用到的素材文件放到 exe 旁边。
    /// </summary>
    private static string Bootstrap(IReadOnlyList<string> media) => $$"""
        [assembly: global::System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.5", FrameworkDisplayName = ".NET Framework 4.5")]

        namespace System.Runtime.CompilerServices
        {
            [global::System.AttributeUsage(global::System.AttributeTargets.Method, Inherited = false)]
            internal sealed class ModuleInitializerAttribute : global::System.Attribute { }
        }

        /// <summary>
        /// 书上项目 2 任务 3 调用 DeviceCtrlHelper.ledHelper.Close()，教材的类库里没有这个方法（LED 屏每次发送才用串口，不占着），
        /// 平台补上了它；导出时也补一个，书上的代码照样能编译。放在全局命名空间，不用 using 就能找到；类库自己有 Close 时用类库的。
        /// </summary>
        internal static class IotSimExportLedCompat
        {
            internal static void Close(this global::DeviceCtrlLibrary.LEDHelper helper) { }
        }

        namespace IotSimExport
        {
            using System;
            using System.Collections.Generic;
            using System.IO;
            using System.Reflection;

            internal static class Bootstrap
            {
                private static readonly Dictionary<string, Assembly> Loaded = new Dictionary<string, Assembly>(StringComparer.OrdinalIgnoreCase);

                [global::System.Runtime.CompilerServices.ModuleInitializer]
                internal static void Init()
                {
                    AppDomain.CurrentDomain.AssemblyResolve += Resolve;
                    ExtractMedia();
                }

                private static Assembly Resolve(object sender, ResolveEventArgs args)
                {
                    var name = new AssemblyName(args.Name).Name;
                    lock (Loaded)
                    {
                        Assembly assembly;
                        if (Loaded.TryGetValue(name, out assembly)) return assembly;
                        var bytes = EmbeddedFiles.Read("{{LibPrefix}}" + name + ".dll");
                        if (bytes == null) return null;
                        assembly = Assembly.Load(bytes);
                        Loaded[name] = assembly;
                        return assembly;
                    }
                }

                private static readonly string[] Media = { {{string.Join(", ", media.Select(m => SymbolDisplay.FormatLiteral(m, true)))}} };

                private static void ExtractMedia()
                {
                    foreach (var file in Media)
                    {
                        try
                        {
                            var dir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources");
                            var path = Path.Combine(dir, file);
                            if (File.Exists(path)) continue;
                            Directory.CreateDirectory(dir);
                            File.WriteAllBytes(path, EmbeddedFiles.Read("{{MediaPrefix}}" + file));
                        }
                        catch (Exception)
                        {
                            // 文件夹不能写（如放在只读的 U 盘上）时不影响程序运行，只是用不到这个文件
                        }
                    }
                }
            }

            internal static class EmbeddedFiles
            {
                internal static byte[] Read(string name)
                {
                    using (var stream = typeof(EmbeddedFiles).Assembly.GetManifestResourceStream(name))
                    {
                        if (stream == null) return null;
                        var bytes = new byte[stream.Length];
                        var read = 0;
                        while (read < bytes.Length) read += stream.Read(bytes, read, bytes.Length - read);
                        return bytes;
                    }
                }

                internal static global::System.Drawing.Bitmap Image(string file)
                {
                    return new global::System.Drawing.Bitmap(new MemoryStream(Bytes(file)));
                }

                internal static byte[] Bytes(string file)
                {
                    return Read("{{FilePrefix}}" + Path.GetFileName(file));
                }
            }
        }
        """;
}
