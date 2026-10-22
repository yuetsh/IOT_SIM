using System;
using System.Collections;
using System.Drawing;
using System.Globalization;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace Sim.Host;

/// <summary>把控件属性值转换成发给浏览器的 JSON（格式见 web/src/winforms/format.ts）</summary>
public static class PropValue
{
    public static JsonNode? From(object? value) => value switch
    {
        null => null,
        string s => JsonValueOf(s),
        bool b => JsonValueOf(b),
        char c => JsonValueOf(c == '\0' ? "" : c.ToString()),
        int or long or short or byte => JsonValueOf(Convert.ToInt64(value, CultureInfo.InvariantCulture)),
        float or double or decimal => JsonValueOf(Convert.ToDouble(value, CultureInfo.InvariantCulture)),
        Enum e => JsonValueOf(e.ToString()),
        Point p => new JsonObject { ["x"] = p.X, ["y"] = p.Y },
        Size s => new JsonObject { ["width"] = s.Width, ["height"] = s.Height },
        Color c => ColorCss(c),
        Font f => new JsonObject
        {
            ["family"] = f.Name,
            ["size"] = f.SizeInPoints,
            ["bold"] = f.Bold,
            ["italic"] = f.Italic,
            ["underline"] = f.Underline,
            ["strikeout"] = f.Strikeout,
        },
        Padding p => new JsonObject { ["left"] = p.Left, ["top"] = p.Top, ["right"] = p.Right, ["bottom"] = p.Bottom },
        IEnumerable list => ListOf(list),
        _ => JsonValueOf(value.ToString() ?? ""),
    };

    /// <summary>未设置的颜色（Color.Empty）返回 null，表示沿用父控件的颜色</summary>
    public static JsonNode? ColorCss(Color color)
    {
        if (color.IsEmpty) return null;
        if (color.A == 0) return "transparent";
        if (color.A < 255)
            return $"rgba({color.R},{color.G},{color.B},{(color.A / 255.0).ToString("0.###", CultureInfo.InvariantCulture)})";
        return $"#{color.R:x2}{color.G:x2}{color.B:x2}";
    }

    private static JsonArray ListOf(IEnumerable items)
    {
        var array = new JsonArray();
        foreach (var item in items) array.Add(From(item is string or null ? item : item.ToString()));
        return array;
    }

    private static JsonNode JsonValueOf<T>(T value) => JsonValue.Create(value)!;
}
