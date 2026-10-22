using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Windows.Forms;
using Sim.Host;

namespace Sim.Runner;

/// <summary>
/// 运行一个已编译的学生程序：在模拟的界面线程上执行 Main，主线程从标准输入读取浏览器的操作。
/// 这个类不能引用 Roslyn 的任何类型，否则运行模式也会加载编译器。
/// </summary>
internal static class StudentProgramHost
{
    public static int Run(string dir)
    {
        var processStart = Process.GetCurrentProcess().StartTime;
        SimHost.Initialize(Console.OpenStandardOutput());
        var console = new ConsoleForwarder();
        Console.SetOut(console);
        Console.SetIn(TextReader.Null); // 标准输入用于协议，学生的 Console.ReadLine 读不到内容

        // 和中文 Windows 一致：DateTime.ToString() 等按 zh-CN 格式输出
        var zhCN = CultureInfo.GetCultureInfo("zh-CN");
        CultureInfo.DefaultThreadCurrentCulture = zhCN;
        CultureInfo.DefaultThreadCurrentUICulture = zhCN;
        CultureInfo.CurrentCulture = zhCN;
        CultureInfo.CurrentUICulture = zhCN;

        var assembly = AssemblyLoadContext.Default.LoadFromStream(
            new MemoryStream(File.ReadAllBytes(Path.Combine(dir, CompileServer.AssemblyFile))),
            new MemoryStream(File.ReadAllBytes(Path.Combine(dir, CompileServer.PdbFile))));
        SimHost.StudentAssembly = assembly;
        var entryPoint = assembly.EntryPoint;
        if (entryPoint == null)
        {
            SimHost.Send(new JsonObject { ["type"] = "exception", ["message"] = "程序中找不到 Main 方法", ["detail"] = "" });
            return 1;
        }

        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            // 学生创建的后台线程抛出未处理异常时，和真实程序一样整个程序结束
            if (e.ExceptionObject is Exception ex) SimHost.ReportException(ex);
            console.Flush();
        };

        var uiThread = new Thread(() =>
        {
            SimHost.Ui.BindToCurrentThread();
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
            SimHost.Send(new JsonObject { ["type"] = "started", ["ms"] = (long)(DateTime.Now - processStart).TotalMilliseconds });
            try
            {
                var parameters = entryPoint.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
                entryPoint.Invoke(null, parameters);
            }
            catch (Exception ex)
            {
                SimHost.ReportException(ex);
            }
            finally
            {
                console.Flush();
                SimHost.FlushChanges();
                Environment.Exit(0);
            }
        }) { Name = "UI" };
        uiThread.Start();

        ReadActions();
        // 服务器关闭了标准输入：结束运行
        Environment.Exit(0);
        return 0;
    }

    /// <summary>读取浏览器发来的操作，排队到界面线程执行</summary>
    private static void ReadActions()
    {
        using var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        while (input.ReadLine() is { } line)
        {
            JsonObject? message;
            try
            {
                message = JsonNode.Parse(line) as JsonObject;
            }
            catch (JsonException)
            {
                continue;
            }
            switch ((string?)message?["type"])
            {
                case "action":
                    if (SimHost.FindControl((string?)message!["id"] ?? "") is { } control)
                    {
                        var action = UserAction.FromJson(message);
                        SimHost.Ui.Post(() => control.PerformUserAction(action));
                    }
                    break;
                case "board":
                    DeviceCtrlLibrary.TrainingBoard.Update(message!);
                    break;
                case "reply":
                    SimHost.CompleteRequest((int?)message!["requestId"] ?? 0, message["result"]?.DeepClone());
                    break;
                case "stop":
                    Environment.Exit(0);
                    break;
            }
        }
    }
}
