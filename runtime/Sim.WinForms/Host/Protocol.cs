// 运行器与服务器之间的消息格式，对应 shared/protocol.ts，两边修改时要同步。
// 运行器 → 服务器的消息在各处用 JsonObject 直接构造；这里只集中定义从服务器收到的动作。
using System.Text.Json.Nodes;

namespace Sim.Host;

/// <summary>浏览器上报的用户操作（shared/protocol.ts 中的 UserAction）</summary>
public sealed class UserAction
{
    public required string Action { get; init; }
    public string? Value { get; init; }
    public int Index { get; init; }
    public string Button { get; init; } = "left";
    public int X { get; init; }
    public int Y { get; init; }

    public static UserAction FromJson(JsonObject json) => new()
    {
        Action = (string?)json["action"] ?? "",
        Value = (string?)json["value"],
        Index = (int?)json["index"] ?? -1,
        Button = (string?)json["button"] ?? "left",
        X = (int?)json["x"] ?? 0,
        Y = (int?)json["y"] ?? 0,
    };
}
