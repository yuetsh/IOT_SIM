// System.Drawing.Common 在 Linux 上不受支持。Point、Size、Color、SystemColors 等框架自带（System.Drawing.Primitives），
// 这里只补上学生代码会用到、框架里又没有的类型。字体只记录名称和样式，真正的渲染在浏览器里完成。
// 注意：框架的 System.Drawing.dll 门面把 Font 等转发到 System.Drawing.Common，编译学生代码时不能引用它。
using System;

namespace System.Drawing;

public enum ContentAlignment
{
    TopLeft = 1,
    TopCenter = 2,
    TopRight = 4,
    MiddleLeft = 16,
    MiddleCenter = 32,
    MiddleRight = 64,
    BottomLeft = 256,
    BottomCenter = 512,
    BottomRight = 1024,
}

[Flags]
public enum FontStyle
{
    Regular = 0,
    Bold = 1,
    Italic = 2,
    Underline = 4,
    Strikeout = 8,
}

public enum GraphicsUnit
{
    World = 0,
    Display = 1,
    Pixel = 2,
    Point = 3,
    Inch = 4,
    Document = 5,
    Millimeter = 6,
}

public sealed class FontFamily
{
    public FontFamily(string name) => Name = name;

    public string Name { get; }

    public override string ToString() => $"[FontFamily: Name={Name}]";
}

public sealed class Font : IDisposable, ICloneable
{
    public Font(string familyName, float emSize)
        : this(familyName, emSize, FontStyle.Regular, GraphicsUnit.Point) { }

    public Font(string familyName, float emSize, FontStyle style)
        : this(familyName, emSize, style, GraphicsUnit.Point) { }

    public Font(string familyName, float emSize, GraphicsUnit unit)
        : this(familyName, emSize, FontStyle.Regular, unit) { }

    public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit)
    {
        if (emSize <= 0 || float.IsNaN(emSize) || float.IsInfinity(emSize))
            throw new ArgumentException($"“emSize”的值“{emSize}”无效。“emSize”应大于 0 且小于或等于 System.Single.MaxValue。", nameof(emSize));
        Name = string.IsNullOrWhiteSpace(familyName) ? "Microsoft Sans Serif" : familyName;
        Size = emSize;
        Style = style;
        Unit = unit;
    }

    public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit, byte gdiCharSet)
        : this(familyName, emSize, style, unit) => GdiCharSet = gdiCharSet;

    public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit, byte gdiCharSet, bool gdiVerticalFont)
        : this(familyName, emSize, style, unit, gdiCharSet) { }

    public Font(FontFamily family, float emSize) : this(family.Name, emSize) { }

    public Font(FontFamily family, float emSize, FontStyle style) : this(family.Name, emSize, style) { }

    public Font(Font prototype, FontStyle newStyle) : this(prototype.Name, prototype.Size, newStyle, prototype.Unit) { }

    public string Name { get; }
    public float Size { get; }
    public FontStyle Style { get; }
    public GraphicsUnit Unit { get; }
    public byte GdiCharSet { get; } = 1;
    public FontFamily FontFamily => new(Name);

    public bool Bold => (Style & FontStyle.Bold) != 0;
    public bool Italic => (Style & FontStyle.Italic) != 0;
    public bool Underline => (Style & FontStyle.Underline) != 0;
    public bool Strikeout => (Style & FontStyle.Strikeout) != 0;

    /// <summary>按 96 DPI 换算成磅</summary>
    public float SizeInPoints => Unit switch
    {
        GraphicsUnit.Pixel => Size * 72f / 96f,
        GraphicsUnit.Inch => Size * 72f,
        GraphicsUnit.Millimeter => Size * 72f / 25.4f,
        GraphicsUnit.Document => Size * 72f / 300f,
        _ => Size,
    };

    /// <summary>大致的行高（像素），中文字体约为字号的 1.33 倍</summary>
    public int Height => (int)Math.Ceiling(SizeInPoints * 96f / 72f * 1.14f);

    public object Clone() => new Font(Name, Size, Style, Unit, GdiCharSet);

    public void Dispose() { }

    public override string ToString() => $"[Font: Name={Name}, Size={Size}, Units={(int)Unit}, GdiCharSet={GdiCharSet}, GdiVerticalFont=False]";

    public override bool Equals(object? obj) =>
        obj is Font other && other.Name == Name && other.Size == Size && other.Style == Style && other.Unit == Unit;

    public override int GetHashCode() => HashCode.Combine(Name, Size, Style, Unit);
}
