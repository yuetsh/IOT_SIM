using System;
using System.ComponentModel;
using System.Globalization;
using System.Text.Json.Nodes;

namespace Sim.Host;

/// <summary>
/// 虚拟时钟（实训台上可以拨时间、调倍速；教材项目 7 按时刻切换情景模式）。
/// 编译时把学生代码里的 DateTime.Now / Today / UtcNow 改写成这里的属性（见 Sim.Runner/ClockRewriter.cs）。
/// 没有拨过时就是真实时间。
/// </summary>
[EditorBrowsable(EditorBrowsableState.Never)]
public static class SimClock
{
    private sealed record Setting(DateTime Wall, long RealAt, double Speed);

    private static volatile Setting? _setting;

    public static DateTime Now
    {
        get
        {
            var setting = _setting;
            if (setting == null) return DateTime.Now;
            var elapsed = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - setting.RealAt;
            return setting.Wall.AddMilliseconds(elapsed * setting.Speed);
        }
    }

    public static DateTime Today => Now.Date;

    public static DateTime UtcNow => Now.ToUniversalTime();

    /// <summary>平台内部使用：应用服务器推送的 {"wall":"2024-01-16T06:40:00","realAt":…,"speed":60}，null 恢复真实时间</summary>
    public static void Update(JsonNode? clock)
    {
        if (clock is not JsonObject json
            || !DateTime.TryParseExact((string?)json["wall"], "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var wall))
        {
            _setting = null;
            return;
        }
        _setting = new Setting(DateTime.SpecifyKind(wall, DateTimeKind.Local), (long?)json["realAt"] ?? 0, (double?)json["speed"] ?? 1);
    }
}
