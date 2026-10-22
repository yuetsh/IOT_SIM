using System;
using System.Text.Json.Nodes;

namespace DeviceCtrlLibrary;

/// <summary>
/// 学生程序进程里的实训台传感器读数副本。权威状态在 Bun 服务器上（网页滑块和开关控制）：
/// 启动时从环境变量 SIM_BOARD 读入，之后服务器每次变化都通过标准输入推送过来。
/// SetData() 直接读这里，不需要等待网络往返。
/// </summary>
public static class TrainingBoard
{
    private static readonly object Lock = new();
    // ADAM-4017 Vin0–Vin7（温度、湿度、光照、气压、空气质量、CO2、风速、预留）
    private static int[] _analog = { 25, 60, 500, 101, 60, 600, 3, 0 };
    // ADAM-4150 DI0–DI6（人体红外、火焰、烟雾、红外对射、预留）
    private static bool[] _digital = new bool[7];

    static TrainingBoard()
    {
        var initial = Environment.GetEnvironmentVariable("SIM_BOARD");
        if (!string.IsNullOrEmpty(initial) && JsonNode.Parse(initial) is JsonObject json) Update(json);
    }

    /// <summary>平台内部使用：应用服务器推送的 {"analog":[…],"digital":[…]}</summary>
    public static void Update(JsonObject json)
    {
        lock (Lock)
        {
            if (json["analog"] is JsonArray analog)
                for (var i = 0; i < analog.Count && i < _analog.Length; i++) _analog[i] = (int?)analog[i] ?? 0;
            if (json["digital"] is JsonArray digital)
                for (var i = 0; i < digital.Count && i < _digital.Length; i++) _digital[i] = (bool?)digital[i] ?? false;
        }
    }

    internal static int ReadAnalog(int channel)
    {
        lock (Lock) return channel >= 0 && channel < _analog.Length ? _analog[channel] : 0;
    }

    internal static bool ReadDigital(int channel)
    {
        lock (Lock) return channel >= 0 && channel < _digital.Length && _digital[channel];
    }
}
