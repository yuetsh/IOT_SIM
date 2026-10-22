using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Windows.Forms;

namespace Sim.Host;

/// <summary>
/// 运行器的全局状态：向服务器发消息、收集控件属性变化、登记控件、等待浏览器的应答。
/// </summary>
public static class SimHost
{
    // 中文原样输出，不转义成 \uXXXX
    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static readonly object WriteLock = new();
    private static readonly List<JsonObject> PendingChanges = new();
    private static readonly ConcurrentDictionary<string, Control> ControlsById = new();
    private static readonly ConcurrentDictionary<int, PendingRequest> Requests = new();
    private static TextWriter _output = TextWriter.Null;
    private static int _nextControlId;
    private static int _nextRequestId;

    public static UiDispatcher Ui { get; } = new();

    /// <summary>学生程序所在的程序集，用于筛选异常堆栈中属于学生代码的部分</summary>
    public static Assembly? StudentAssembly { get; set; }

    /// <summary>运行器启动时调用：协议消息写到真正的标准输出（学生的 Console 输出另行转发）</summary>
    public static void Initialize(Stream stdout)
    {
        _output = new StreamWriter(stdout, new UTF8Encoding(false)) { AutoFlush = true };
    }

    // ---------- 发送消息 ----------

    public static void Send(JsonObject message)
    {
        lock (WriteLock)
        {
            FlushChangesLocked();
            _output.WriteLine(message.ToJsonString(JsonOptions));
        }
    }

    /// <summary>记录一个已显示控件的属性变化；在界面线程上会合并到本轮消息处理结束时一起发送</summary>
    public static void QueueChange(Control control, string prop, object? value)
    {
        var change = new JsonObject { ["id"] = control.SimId, ["prop"] = prop, ["value"] = PropValue.From(value) };
        lock (WriteLock)
        {
            PendingChanges.Add(change);
            if (!Ui.IsUiThread) FlushChangesLocked();
        }
    }

    public static void FlushChanges()
    {
        lock (WriteLock) FlushChangesLocked();
    }

    private static void FlushChangesLocked()
    {
        if (PendingChanges.Count == 0) return;
        var changes = new JsonArray();
        foreach (var change in PendingChanges) changes.Add(change);
        PendingChanges.Clear();
        _output.WriteLine(new JsonObject { ["type"] = "patch", ["changes"] = changes }.ToJsonString(JsonOptions));
    }

    public static void SendConsole(string text) => Send(new JsonObject { ["type"] = "console", ["text"] = text });

    public static void SendDevice(string device, string action, object? data) => Send(new JsonObject
    {
        ["type"] = "device",
        ["device"] = device,
        ["action"] = action,
        ["data"] = PropValue.From(data),
    });

    // ---------- 异常 ----------

    public static void ReportException(Exception ex)
    {
        while (ex is TargetInvocationException { InnerException: not null } wrapper) ex = wrapper.InnerException!;
        Send(new JsonObject
        {
            ["type"] = "exception",
            ["message"] = $"{ex.GetType().FullName}: {ex.Message}",
            ["detail"] = StudentStackTrace(ex),
        });
    }

    /// <summary>只保留学生代码的堆栈行，去掉仿真库内部的调用</summary>
    private static string StudentStackTrace(Exception ex)
    {
        var lines = (ex.StackTrace ?? "").Split('\n').Select(l => l.TrimEnd());
        var studentLines = lines.Where(l => l.Contains(".cs:") && !l.Contains("/runtime/Sim.")).ToList();
        return string.Join("\n", studentLines.Count > 0 ? studentLines : lines);
    }

    // ---------- 控件登记 ----------

    public static string NewControlId() => Interlocked.Increment(ref _nextControlId).ToString();

    public static void Register(Control control) => ControlsById[control.SimId] = control;

    public static Control? FindControl(string id) => ControlsById.TryGetValue(id, out var control) ? control : null;

    // ---------- 请求与应答（如 MessageBox 等待用户点按钮） ----------

    /// <summary>
    /// 向浏览器发出请求并阻塞等待应答。在界面线程上调用时会继续处理消息队列（和真实的模态对话框一样，Timer 照常触发）。
    /// </summary>
    public static JsonNode? Request(JsonObject message)
    {
        var id = Interlocked.Increment(ref _nextRequestId);
        var pending = new PendingRequest();
        Requests[id] = pending;
        message["requestId"] = id;
        Send(message);
        if (Ui.IsUiThread) Ui.RunUntil(() => pending.Done.IsSet);
        else pending.Done.Wait();
        Requests.TryRemove(id, out _);
        return pending.Result;
    }

    public static void CompleteRequest(int id, JsonNode? result)
    {
        if (!Requests.TryGetValue(id, out var pending)) return;
        pending.Result = result;
        pending.Done.Set();
        Ui.Wake();
    }

    private sealed class PendingRequest
    {
        public ManualResetEventSlim Done { get; } = new();
        public JsonNode? Result { get; set; }
    }
}
