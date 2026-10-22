using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sim.Runner;

/// <summary>
/// 常驻编译服务：从标准输入读取 {"id":…,"dir":…}，编译该目录下的学生工程，
/// 成功时把 StudentApp.dll / StudentApp.pdb 写到同一目录，回复 {"id":…,"type":"compiled",…}。
/// 编译器常驻，第一次之后的编译不再有加载和预热开销。
/// </summary>
internal static class CompileServer
{
    public const string AssemblyFile = "StudentApp.dll";
    public const string PdbFile = "StudentApp.pdb";

    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static int Run()
    {
        using var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        using var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

        WarmUp();
        output.WriteLine(new JsonObject { ["type"] = "ready" }.ToJsonString(JsonOptions));

        while (input.ReadLine() is { } line)
        {
            JsonObject reply;
            JsonNode? id = null;
            try
            {
                var request = JsonNode.Parse(line)!.AsObject();
                id = request["id"]?.DeepClone();
                reply = Compile((string?)request["dir"] ?? throw new ArgumentException("缺少 dir"));
            }
            catch (Exception ex)
            {
                reply = new JsonObject { ["type"] = "compileFailed", ["message"] = ex.Message };
            }
            reply["id"] = id;
            output.WriteLine(reply.ToJsonString(JsonOptions));
        }
        return 0;
    }

    private static JsonObject Compile(string dir)
    {
        var watch = Stopwatch.StartNew();
        var result = StudentCompiler.Compile(dir);
        if (result.Success)
        {
            File.WriteAllBytes(Path.Combine(dir, AssemblyFile), result.Assembly);
            File.WriteAllBytes(Path.Combine(dir, PdbFile), result.Pdb);
        }
        return new JsonObject
        {
            ["type"] = "compiled",
            ["ok"] = result.Success,
            ["diagnostics"] = result.Diagnostics,
            ["ms"] = watch.ElapsedMilliseconds,
        };
    }

    /// <summary>启动时编译一个小程序，让 Roslyn 完成加载和 JIT，学生第一次点"运行"时就不用等</summary>
    private static void WarmUp()
    {
        var dir = Directory.CreateTempSubdirectory("sim-warmup-");
        try
        {
            File.WriteAllText(Path.Combine(dir.FullName, "Program.cs"),
                "using System.Windows.Forms; static class P { static void Main() { var f = new Form(); f.Text = \"预热\"; } }");
            StudentCompiler.Compile(dir.FullName);
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}
