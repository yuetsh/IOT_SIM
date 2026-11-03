using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Sim.Runner;

/// <summary>
/// 导出 VS 工程：把学生工程打包成教材那样的 VS 2012 窗体应用工程（zip），在机房电脑上用 VS 打开接着改、按 F5 运行。
/// <list type="bullet">
/// <item>先照机房的环境检查：C# 5（VS 2012 的编译器）、.NET Framework 4.5、真机版设备类库，有错误就不导出。</item>
/// <item>平台生成的 Properties/Resources.Designer.cs 从素材库取图，导出时换成 VS 生成的写法和 Resources.resx，图片放在 Resources 文件夹；
/// 代码里按文件名用到的素材（如 ring.mp3）设成复制到输出目录，运行时在 bin\Debug\Resources 下，和教材一样。</item>
/// <item>教材 dll 放在工程的 lib 文件夹，用到的才加引用（和教材工程一样只引用设备类库、控件库），编译时 VS 把它们和依赖复制到 bin\Debug。</item>
/// <item>文本文件用带 BOM 的 UTF-8 和 CRLF 换行（VS 2012 打开不带 BOM 的文件会把中文当成 GBK）。</item>
/// </list>
/// </summary>
internal static class ProjectExporter
{
    public sealed record Result(bool Success, byte[] Zip, JsonArray Diagnostics);

    /// <summary>VS 2012 的编译器支持到 C# 5</summary>
    internal static readonly CSharpParseOptions Vs2012 = new(LanguageVersion.CSharp5);

    private const string PlatformResourcesFile = "Properties/Resources.Designer.cs";
    private const string LedCompatFile = "LedHelperCompat.cs";
    private const string LedCompatClass = "LedHelperCompat";

    private static readonly Regex ResourceMember = new(
        @"internal static (System\.Drawing\.Bitmap|byte\[\]) ([\p{L}\p{N}_]+) \{\s*get \{ return global::Sim\.Host\.ProjectResources\.(?:Image|Bytes)\(""([^""]+)""\); \}");
    private static readonly Regex ResourcesNamespace = new(@"namespace\s+([\p{L}\p{N}_.]+)\.Properties\b");
    private static readonly Regex FirstNamespace = new(@"^\s*namespace\s+([\p{L}\p{N}_.]+)", RegexOptions.Multiline);

    /// <summary>VS 2012 窗体应用模板默认的引用（教材工程都有这些）</summary>
    private static readonly string[] DefaultReferences =
    {
        "System", "System.Core", "System.Xml.Linq", "System.Data.DataSetExtensions", "Microsoft.CSharp",
        "System.Data", "System.Deployment", "System.Drawing", "System.Windows.Forms", "System.Xml",
    };

    private const string BitmapType = "System.Drawing.Bitmap, System.Drawing, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a";
    private const string BytesType = "System.Byte[], mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089";

    private sealed record ResourceItem(string Name, bool Image, string File);

    private sealed record Source(string Path, string Text);

    /// <summary>libsDir：教材 dll 所在目录；galleryDir：平台素材库；name：工程名（也是程序集名、文件夹名）</summary>
    public static Result Export(string projectDir, string libsDir, string galleryDir, string name)
    {
        var libs = ExeExporter.TextbookLibs(libsDir, "导出工程");
        var sources = StudentCompiler.SourceFiles(projectDir)
            .Select(path => new Source(Path.GetRelativePath(projectDir, path).Replace('\\', '/'), File.ReadAllText(path)))
            .ToList();

        var platformResources = sources.FirstOrDefault(s => s.Path == PlatformResourcesFile)?.Text;
        var items = platformResources == null
            ? new List<ResourceItem>()
            : ResourceMember.Matches(platformResources)
                .Select(m => new ResourceItem(m.Groups[2].Value, m.Groups[1].Value != "byte[]", Path.GetFileName(m.Groups[3].Value)))
                .ToList();
        var rootNamespace = RootNamespace(sources, platformResources, name);
        sources.RemoveAll(s => s.Path == PlatformResourcesFile);

        // VS 模板里有、平台上没有的文件（Properties 文件夹由平台管理，学生建不了同名文件）
        var generated = new List<Source>
        {
            new("Properties/AssemblyInfo.cs", AssemblyInfo(name)),
            new("Properties/Resources.Designer.cs", ResourcesDesigner(rootNamespace, items)),
            new("Properties/Settings.Designer.cs", SettingsDesigner(rootNamespace)),
        };
        var compat = new Source(LedCompatFile, LedCompat);

        // 照机房的环境编译一遍：C# 5、.NET Framework 4.5、真机版设备类库
        var trees = sources.Concat(generated).Append(compat)
            .Select(s => CSharpSyntaxTree.ParseText(SourceText.From(s.Text, Encoding.UTF8), Vs2012, path: s.Path))
            .ToList();
        var libReferences = libs.ToDictionary(p => (MetadataReference)MetadataReference.CreateFromFile(p), p => p);
        var compilation = CSharpCompilation.Create(name, trees, ExeExporter.Framework.Value.Concat(libReferences.Keys), ExeExporter.Options);
        using (var pe = new MemoryStream())
        {
            var emit = compilation.Emit(pe);
            var diagnostics = new JsonArray();
            foreach (var diagnostic in emit.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error))
            {
                diagnostics.Add(StudentCompiler.ToJson(diagnostic));
            }
            if (!emit.Success) return new Result(false, Array.Empty<byte>(), diagnostics);
        }

        var studentTrees = trees.Take(sources.Count).ToList();
        var code = sources.Concat(generated).ToList();
        if (UsesLedCompat(compilation, studentTrees))
        {
            code.Add(compat);
            studentTrees.Add(trees[^1]);
        }
        else
        {
            compilation = compilation.RemoveSyntaxTrees(trees[^1]);
        }

        // 引用：和教材工程一样，教材 dll 只引用代码里直接用到的（其他的作为依赖由 VS 复制到输出目录），
        // 框架引用在 VS 模板默认的之外加上用到的（如图表控件）。只带这些引用编译不过时（用到的类型的基类在别的 dll 里等）引用全部教材 dll
        var direct = DirectlyUsedAssemblies(compilation, studentTrees);
        var frameworkReferences = DefaultReferences
            .Concat(ExeExporter.Framework.Value.OfType<PortableExecutableReference>()
                .Select(r => Path.GetFileNameWithoutExtension(r.FilePath)).OfType<string>()
                .Where(n => direct.Contains(n) && n != "mscorlib" && !DefaultReferences.Contains(n))
                .OrderBy(n => n, StringComparer.Ordinal))
            .ToList();
        var textbookReferences = libs.Where(p => direct.Contains(Path.GetFileNameWithoutExtension(p))).ToList();
        var reduced = compilation.WithReferences(ExeExporter.Framework.Value.Concat(libReferences.Where(r => textbookReferences.Contains(r.Value)).Select(r => r.Key)));
        if (reduced.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error)) textbookReferences = libs.ToList();
        textbookReferences = textbookReferences.Select(p => Path.GetFileName(p)).ToList();

        var forms = Forms(compilation, sources, studentTrees);
        var media = ExeExporter.ReferencedMedia(galleryDir, sources.Select(s => s.Text));
        var images = items.Select(i => i.File).Where(f => File.Exists(Path.Combine(galleryDir, f))).Distinct().ToList();

        var zip = new ZipWriter(DateTime.UtcNow.AddHours(8));
        var root = $"{name}/";
        var dir = $"{name}/{name}/";
        zip.Add(root + name + ".sln", Text(Solution(name)));
        zip.Add(dir + name + ".csproj", Text(Project(name, rootNamespace, code, forms, frameworkReferences, textbookReferences, images, media)));
        zip.Add(dir + "App.config", Text(AppConfig));
        zip.Add(dir + "Properties/Settings.settings", Text(SettingsFile));
        zip.Add(dir + "Properties/Resources.resx", Text(Resx(items.Select(ResourceEntry))));
        foreach (var source in code) zip.Add(dir + source.Path, Text(source.Text));
        foreach (var form in forms.Where(f => f.Resx))
        {
            zip.Add(dir + Path.ChangeExtension(form.Path, ".resx"), Text(Resx(form.OcxKeys.Select(OcxEntry))));
        }
        foreach (var file in images.Union(media).OrderBy(f => f, StringComparer.Ordinal))
        {
            zip.Add(dir + "Resources/" + file, File.ReadAllBytes(Path.Combine(galleryDir, file)));
        }
        foreach (var lib in libs) zip.Add(dir + "lib/" + Path.GetFileName(lib), File.ReadAllBytes(lib));
        return new Result(true, zip.Finish(), new JsonArray());
    }

    /// <summary>工程的默认命名空间：平台的资源类所在的命名空间，否则取 Program.cs（再其次其他文件）里的第一个命名空间</summary>
    private static string RootNamespace(List<Source> sources, string? platformResources, string name)
    {
        if (platformResources != null && ResourcesNamespace.Match(platformResources) is { Success: true } r) return r.Groups[1].Value;
        foreach (var source in sources.OrderBy(s => s.Path == "Program.cs" ? 0 : 1).ThenBy(s => s.Path, StringComparer.Ordinal))
        {
            var m = FirstNamespace.Match(source.Text);
            if (m.Success) return m.Groups[1].Value;
        }
        return name;
    }

    /// <summary>代码里直接用到的类型、成员所在的程序集（程序集名）</summary>
    private static HashSet<string> DirectlyUsedAssemblies(CSharpCompilation compilation, List<SyntaxTree> trees)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(ISymbol? symbol)
        {
            while (symbol is IArrayTypeSymbol array) symbol = array.ElementType;
            if (symbol?.ContainingAssembly is { } assembly) names.Add(assembly.Identity.Name);
            if (symbol is INamedTypeSymbol { IsGenericType: true } generic)
            {
                foreach (var argument in generic.TypeArguments) Add(argument);
            }
        }
        foreach (var tree in trees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var node in tree.GetRoot().DescendantNodes())
            {
                Add(model.GetSymbolInfo(node).Symbol);
                Add(model.GetTypeInfo(node).Type);
            }
        }
        return names;
    }

    /// <summary>学生代码是否用到了补上的 ledHelper.Close()（教材类库里没有）</summary>
    private static bool UsesLedCompat(CSharpCompilation compilation, List<SyntaxTree> trees)
    {
        foreach (var tree in trees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var invocation in tree.GetRoot().DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (model.GetSymbolInfo(invocation).Symbol is IMethodSymbol { ReducedFrom.ContainingType.Name: LedCompatClass }) return true;
            }
        }
        return false;
    }

    /// <summary>窗体、用户控件：VS 里显示成可以打开设计器的文件，Designer.cs 和 .resx 挂在它下面</summary>
    private sealed record Form(string Path, string SubType, bool Resx, List<string> OcxKeys);

    private static List<Form> Forms(CSharpCompilation compilation, List<Source> sources, List<SyntaxTree> trees)
    {
        var form = compilation.GetTypeByMetadataName("System.Windows.Forms.Form");
        var userControl = compilation.GetTypeByMetadataName("System.Windows.Forms.UserControl");
        var result = new List<Form>();
        for (var i = 0; i < sources.Count; i++)
        {
            var path = sources[i].Path;
            if (path.EndsWith(".Designer.cs")) continue;
            var designer = sources.FirstOrDefault(s => s.Path == path[..^3] + ".Designer.cs");
            var model = compilation.GetSemanticModel(trees[i]);
            var type = trees[i].GetRoot().DescendantNodes().OfType<ClassDeclarationSyntax>()
                .Select(c => model.GetDeclaredSymbol(c)).FirstOrDefault(t => t != null);
            string? subType = null;
            for (var t = type?.BaseType; t != null && subType == null; t = t.BaseType)
            {
                if (SymbolEqualityComparer.Default.Equals(t, form)) subType = "Form";
                else if (SymbolEqualityComparer.Default.Equals(t, userControl)) subType = "UserControl";
            }
            if (subType == null) continue;
            var keys = designer == null
                ? new List<string>()
                : ExeExporter.OcxStateKey.Matches(designer.Text).Select(m => m.Groups[1].Value).Distinct().OrderBy(k => k, StringComparer.Ordinal).ToList();
            result.Add(new Form(path, subType, designer != null, keys));
        }
        return result;
    }

    private static string Project(string name, string rootNamespace, List<Source> code, List<Form> forms,
        List<string> frameworkReferences, List<string> textbookReferences, List<string> images, List<string> media)
    {
        static string Win(string path) => path.Replace('/', '\\');
        static string X(string text) => SecurityElement.Escape(text);

        var s = new StringBuilder();
        s.Append($"""
            <?xml version="1.0" encoding="utf-8"?>
            <Project ToolsVersion="4.0" DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
              <Import Project="$(MSBuildExtensionsPath)\$(MSBuildToolsVersion)\Microsoft.Common.props" Condition="Exists('$(MSBuildExtensionsPath)\$(MSBuildToolsVersion)\Microsoft.Common.props')" />
              <PropertyGroup>
                <Configuration Condition=" '$(Configuration)' == '' ">Debug</Configuration>
                <Platform Condition=" '$(Platform)' == '' ">AnyCPU</Platform>
                <ProjectGuid>{ProjectGuid(name)}</ProjectGuid>
                <OutputType>WinExe</OutputType>
                <AppDesignerFolder>Properties</AppDesignerFolder>
                <RootNamespace>{X(rootNamespace)}</RootNamespace>
                <AssemblyName>{X(name)}</AssemblyName>
                <TargetFrameworkVersion>v4.5</TargetFrameworkVersion>
                <FileAlignment>512</FileAlignment>
              </PropertyGroup>
              <PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Debug|AnyCPU' ">
                <PlatformTarget>AnyCPU</PlatformTarget>
                <DebugSymbols>true</DebugSymbols>
                <DebugType>full</DebugType>
                <Optimize>false</Optimize>
                <OutputPath>bin\Debug\</OutputPath>
                <DefineConstants>DEBUG;TRACE</DefineConstants>
                <ErrorReport>prompt</ErrorReport>
                <WarningLevel>4</WarningLevel>
              </PropertyGroup>
              <PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Release|AnyCPU' ">
                <PlatformTarget>AnyCPU</PlatformTarget>
                <DebugType>pdbonly</DebugType>
                <Optimize>true</Optimize>
                <OutputPath>bin\Release\</OutputPath>
                <DefineConstants>TRACE</DefineConstants>
                <ErrorReport>prompt</ErrorReport>
                <WarningLevel>4</WarningLevel>
              </PropertyGroup>
              <ItemGroup>

            """);
        foreach (var lib in textbookReferences)
        {
            s.Append($"""
                    <Reference Include="{X(Path.GetFileNameWithoutExtension(lib))}">
                      <HintPath>lib\{X(lib)}</HintPath>
                    </Reference>

                """);
        }
        foreach (var reference in frameworkReferences) s.Append($"    <Reference Include=\"{reference}\" />\n");
        s.Append("  </ItemGroup>\n  <ItemGroup>\n");

        var formPaths = forms.ToDictionary(f => f.Path);
        // 和 VS 一样 Form1.cs 在 Form1.Designer.cs 前面
        static string Order(string path) => path.EndsWith(".Designer.cs") ? path[..^12] + ".cs\u0001" : path;
        foreach (var source in code.Where(c => !c.Path.StartsWith("Properties/")).OrderBy(c => Order(c.Path), StringComparer.Ordinal))
        {
            var path = source.Path;
            if (formPaths.TryGetValue(path, out var form))
            {
                s.Append($"    <Compile Include=\"{X(Win(path))}\">\n      <SubType>{form.SubType}</SubType>\n    </Compile>\n");
            }
            else if (path.EndsWith(".Designer.cs") && formPaths.ContainsKey(path[..^12] + ".cs"))
            {
                s.Append($"    <Compile Include=\"{X(Win(path))}\">\n      <DependentUpon>{X(Path.GetFileName(path[..^12] + ".cs"))}</DependentUpon>\n    </Compile>\n");
            }
            else
            {
                s.Append($"    <Compile Include=\"{X(Win(path))}\" />\n");
            }
        }
        s.Append("    <Compile Include=\"Properties\\AssemblyInfo.cs\" />\n");
        foreach (var form in forms.Where(f => f.Resx).OrderBy(f => f.Path, StringComparer.Ordinal))
        {
            s.Append($"    <EmbeddedResource Include=\"{X(Win(Path.ChangeExtension(form.Path, ".resx")))}\">\n      <DependentUpon>{X(Path.GetFileName(form.Path))}</DependentUpon>\n    </EmbeddedResource>\n");
        }
        s.Append("""
                <EmbeddedResource Include="Properties\Resources.resx">
                  <Generator>ResXFileCodeGenerator</Generator>
                  <LastGenOutput>Resources.Designer.cs</LastGenOutput>
                  <SubType>Designer</SubType>
                </EmbeddedResource>
                <Compile Include="Properties\Resources.Designer.cs">
                  <AutoGen>True</AutoGen>
                  <DependentUpon>Resources.resx</DependentUpon>
                  <DesignTime>True</DesignTime>
                </Compile>
                <None Include="Properties\Settings.settings">
                  <Generator>SettingsSingleFileGenerator</Generator>
                  <LastGenOutput>Settings.Designer.cs</LastGenOutput>
                </None>
                <Compile Include="Properties\Settings.Designer.cs">
                  <AutoGen>True</AutoGen>
                  <DependentUpon>Settings.settings</DependentUpon>
                  <DesignTimeSharedInput>True</DesignTimeSharedInput>
                </Compile>
              </ItemGroup>
              <ItemGroup>
                <None Include="App.config" />
              </ItemGroup>

            """);
        var files = images.Union(media).OrderBy(f => f, StringComparer.Ordinal).ToList();
        if (files.Count > 0)
        {
            s.Append("  <ItemGroup>\n");
            foreach (var file in files)
            {
                // 代码里按文件名用的素材复制到 bin\Debug\Resources（和教材工程的输出目录一样）；Properties.Resources 的图片编译进程序
                s.Append(media.Contains(file)
                    ? $"    <Content Include=\"Resources\\{X(file)}\">\n      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>\n    </Content>\n"
                    : $"    <None Include=\"Resources\\{X(file)}\" />\n");
            }
            s.Append("  </ItemGroup>\n");
        }
        s.Append("""
              <Import Project="$(MSBuildToolsPath)\Microsoft.CSharp.targets" />
            </Project>
            """);
        return s.ToString();
    }

    private static string Solution(string name) => $$"""

        Microsoft Visual Studio Solution File, Format Version 12.00
        # Visual Studio 2012
        Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "{{name}}", "{{name}}\{{name}}.csproj", "{{ProjectGuid(name)}}"
        EndProject
        Global
        	GlobalSection(SolutionConfigurationPlatforms) = preSolution
        		Debug|Any CPU = Debug|Any CPU
        		Release|Any CPU = Release|Any CPU
        	EndGlobalSection
        	GlobalSection(ProjectConfigurationPlatforms) = postSolution
        		{{ProjectGuid(name)}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
        		{{ProjectGuid(name)}}.Debug|Any CPU.Build.0 = Debug|Any CPU
        		{{ProjectGuid(name)}}.Release|Any CPU.ActiveCfg = Release|Any CPU
        		{{ProjectGuid(name)}}.Release|Any CPU.Build.0 = Release|Any CPU
        	EndGlobalSection
        	GlobalSection(SolutionProperties) = preSolution
        		HideSolutionNode = FALSE
        	EndGlobalSection
        EndGlobal

        """;

    /// <summary>同一个工程名每次导出的 GUID 相同（重新导出后覆盖旧的，VS 认成同一个工程）</summary>
    private static string ProjectGuid(string name) => "{" + NameGuid("project:" + name).ToString().ToUpperInvariant() + "}";

    private static Guid NameGuid(string text) => new(MD5.HashData(Encoding.UTF8.GetBytes(text)));

    private static string AssemblyInfo(string name) => $$"""
        using System.Reflection;
        using System.Runtime.CompilerServices;
        using System.Runtime.InteropServices;

        // 有关程序集的常规信息通过以下
        // 特性集控制。更改这些特性值可修改
        // 与程序集关联的信息。
        [assembly: AssemblyTitle({{SymbolDisplay.FormatLiteral(name, true)}})]
        [assembly: AssemblyDescription("")]
        [assembly: AssemblyConfiguration("")]
        [assembly: AssemblyCompany("")]
        [assembly: AssemblyProduct({{SymbolDisplay.FormatLiteral(name, true)}})]
        [assembly: AssemblyCopyright("Copyright ©  {{DateTime.UtcNow.AddHours(8).Year}}")]
        [assembly: AssemblyTrademark("")]
        [assembly: AssemblyCulture("")]

        // 将 ComVisible 设置为 false 使此程序集中的类型
        // 对 COM 组件不可见。如果需要从 COM 访问此程序集中的类型，
        // 则将该类型上的 ComVisible 特性设置为 true。
        [assembly: ComVisible(false)]

        // 如果此项目向 COM 公开，则下列 GUID 用于类型库的 ID
        [assembly: Guid("{{NameGuid("assembly:" + name)}}")]

        // 程序集的版本信息由下面四个值组成:
        //
        //      主版本
        //      次版本
        //      生成号
        //      修订号
        //
        // 可以指定所有这些值，也可以使用“生成号”和“修订号”的默认值，
        // 方法是按如下所示使用“*”:
        // [assembly: AssemblyVersion("1.0.*")]
        [assembly: AssemblyVersion("1.0.0.0")]
        [assembly: AssemblyFileVersion("1.0.0.0")]

        """;

    /// <summary>和 VS 2012 的 ResXFileCodeGenerator 生成的一样（中文版 VS 的注释）</summary>
    private static string ResourcesDesigner(string ns, List<ResourceItem> items)
    {
        var members = string.Concat(items.Select(item =>
        {
            var type = item.Image ? "System.Drawing.Bitmap" : "byte[]";
            var what = item.Image ? "System.Drawing.Bitmap" : "System.Byte[]";
            return $$"""

                        /// <summary>
                        ///   查找 {{what}} 类型的本地化资源。
                        /// </summary>
                        internal static {{type}} {{item.Name}} {
                            get {
                                object obj = ResourceManager.GetObject("{{item.Name}}", resourceCulture);
                                return (({{type}})(obj));
                            }
                        }

                """;
        }));
        return $$"""
            //------------------------------------------------------------------------------
            // <auto-generated>
            //     此代码由工具生成。
            //     运行时版本:4.0.30319.42000
            //
            //     对此文件的更改可能会导致不正确的行为，并且如果
            //     重新生成代码，这些更改将会丢失。
            // </auto-generated>
            //------------------------------------------------------------------------------

            namespace {{ns}}.Properties {
                using System;


                /// <summary>
                ///   一个强类型的资源类，用于查找本地化的字符串等。
                /// </summary>
                // 此类是由 StronglyTypedResourceBuilder
                // 类通过类似于 ResGen 或 Visual Studio 的工具自动生成的。
                // 若要添加或移除成员，请编辑 .ResX 文件，然后重新运行 ResGen
                // (以 /str 作为命令选项)，或重新生成 VS 项目。
                [global::System.CodeDom.Compiler.GeneratedCodeAttribute("System.Resources.Tools.StronglyTypedResourceBuilder", "4.0.0.0")]
                [global::System.Diagnostics.DebuggerNonUserCodeAttribute()]
                [global::System.Runtime.CompilerServices.CompilerGeneratedAttribute()]
                internal class Resources {

                    private static global::System.Resources.ResourceManager resourceMan;

                    private static global::System.Globalization.CultureInfo resourceCulture;

                    [global::System.Diagnostics.CodeAnalysis.SuppressMessageAttribute("Microsoft.Performance", "CA1811:AvoidUncalledPrivateCode")]
                    internal Resources() {
                    }

                    /// <summary>
                    ///   返回此类使用的缓存的 ResourceManager 实例。
                    /// </summary>
                    [global::System.ComponentModel.EditorBrowsableAttribute(global::System.ComponentModel.EditorBrowsableState.Advanced)]
                    internal static global::System.Resources.ResourceManager ResourceManager {
                        get {
                            if (object.ReferenceEquals(resourceMan, null)) {
                                global::System.Resources.ResourceManager temp = new global::System.Resources.ResourceManager("{{ns}}.Properties.Resources", typeof(Resources).Assembly);
                                resourceMan = temp;
                            }
                            return resourceMan;
                        }
                    }

                    /// <summary>
                    ///   使用此强类型资源类，为所有资源查找
                    ///   重写当前线程的 CurrentUICulture 属性。
                    /// </summary>
                    [global::System.ComponentModel.EditorBrowsableAttribute(global::System.ComponentModel.EditorBrowsableState.Advanced)]
                    internal static global::System.Globalization.CultureInfo Culture {
                        get {
                            return resourceCulture;
                        }
                        set {
                            resourceCulture = value;
                        }
                    }
            {{members}}    }
            }

            """;
    }

    private static string SettingsDesigner(string ns) => $$"""
        //------------------------------------------------------------------------------
        // <auto-generated>
        //     This code was generated by a tool.
        //     Runtime Version:4.0.30319.42000
        //
        //     Changes to this file may cause incorrect behavior and will be lost if
        //     the code is regenerated.
        // </auto-generated>
        //------------------------------------------------------------------------------

        namespace {{ns}}.Properties
        {


            [global::System.Runtime.CompilerServices.CompilerGeneratedAttribute()]
            [global::System.CodeDom.Compiler.GeneratedCodeAttribute("Microsoft.VisualStudio.Editors.SettingsDesigner.SettingsSingleFileGenerator", "11.0.0.0")]
            internal sealed partial class Settings : global::System.Configuration.ApplicationSettingsBase
            {

                private static Settings defaultInstance = ((Settings)(global::System.Configuration.ApplicationSettingsBase.Synchronized(new Settings())));

                public static Settings Default
                {
                    get
                    {
                        return defaultInstance;
                    }
                }
            }
        }

        """;

    private const string SettingsFile = """
        <?xml version='1.0' encoding='utf-8'?>
        <SettingsFile xmlns="http://schemas.microsoft.com/VisualStudio/2004/01/settings" CurrentProfile="(Default)">
          <Profiles>
            <Profile Name="(Default)" />
          </Profiles>
          <Settings />
        </SettingsFile>
        """;

    private const string AppConfig = """
        <?xml version="1.0" encoding="utf-8" ?>
        <configuration>
            <startup>
                <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.5" />
            </startup>
        </configuration>
        """;

    /// <summary>
    /// 书上项目 2 任务 3 调用 DeviceCtrlHelper.ledHelper.Close()，教材的类库里没有这个方法（LED 屏每次发送才用串口，不占着），
    /// 平台补上了它。用到时导出工程里也带上这个文件，书上的代码照样能编译。
    /// </summary>
    private const string LedCompat = """
        // 教材的设备类库里 LEDHelper 没有 Close 方法（LED 屏每次发送时才打开串口，发完就关），
        // 书上的代码调用了 ledHelper.Close()，这里补一个什么都不做的方法，让代码能编译。
        internal static class LedHelperCompat
        {
            internal static void Close(this global::DeviceCtrlLibrary.LEDHelper helper)
            {
            }
        }

        """;

    private static readonly Lazy<string> ResxHeader = new(() =>
    {
        using var stream = typeof(ProjectExporter).Assembly.GetManifestResourceStream("ResxHeader.xml")!;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd().TrimEnd('\n');
    });

    private static string Resx(IEnumerable<string> entries)
    {
        var list = entries.ToList();
        var s = new StringBuilder(ResxHeader.Value).Append('\n');
        if (list.Any(e => e.Contains("ResXFileRef")))
        {
            s.Append("  <assembly alias=\"System.Windows.Forms\" name=\"System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089\" />\n");
        }
        foreach (var entry in list) s.Append(entry);
        return s.Append("</root>").ToString();
    }

    private static string ResourceEntry(ResourceItem item) =>
        $"  <data name=\"{SecurityElement.Escape(item.Name)}\" type=\"System.Resources.ResXFileRef, System.Windows.Forms\">\n" +
        $"    <value>..\\Resources\\{SecurityElement.Escape(item.File)};{(item.Image ? BitmapType : BytesType)}</value>\n" +
        "  </data>\n";

    /// <summary>媒体播放器的 OcxState：教材 Form1.resx 里的默认状态，和 VS 一样每行 80 个字符</summary>
    private static string OcxEntry(string key)
    {
        var data = ExeExporter.MediaPlayerOcxState;
        var lines = Enumerable.Range(0, (data.Length + 79) / 80).Select(i => "        " + data.Substring(i * 80, Math.Min(80, data.Length - i * 80)));
        return $"  <data name=\"{SecurityElement.Escape(key)}\" mimetype=\"application/x-microsoft.net.object.binary.base64\">\n" +
               "    <value>\n" + string.Join("\n", lines) + "\n</value>\n  </data>\n";
    }

    /// <summary>文本文件：带 BOM 的 UTF-8，CRLF 换行</summary>
    private static byte[] Text(string text)
    {
        var crlf = text.Replace("\r\n", "\n").Replace("\n", "\r\n");
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(crlf)).ToArray();
    }
}
