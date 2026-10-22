using System.Drawing;
using System.Text.Json.Nodes;

namespace System.Windows.Forms;

public class Label : Control
{
    private BorderStyle _borderStyle;
    private ContentAlignment _textAlign = ContentAlignment.TopLeft;

    protected override Size DefaultSize => new(100, 23);

    public BorderStyle BorderStyle
    {
        get => _borderStyle;
        set => SetProp(ref _borderStyle, value, nameof(BorderStyle));
    }

    public ContentAlignment TextAlign
    {
        get => _textAlign;
        set => SetProp(ref _textAlign, value, nameof(TextAlign));
    }

    public bool UseMnemonic { get; set; } = true;
    public FlatStyle FlatStyle { get; set; } = FlatStyle.Standard;

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["BorderStyle"] = _borderStyle.ToString();
        props["TextAlign"] = _textAlign.ToString();
    }
}
