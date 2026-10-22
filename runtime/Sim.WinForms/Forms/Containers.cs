using System.Drawing;
using System.Text.Json.Nodes;

namespace System.Windows.Forms;

public class ScrollableControl : Control
{
    public bool AutoScroll { get; set; }
}

public class ContainerControl : ScrollableControl
{
    public SizeF AutoScaleDimensions { get; set; }
    public AutoScaleMode AutoScaleMode { get; set; } = AutoScaleMode.Inherit;
    public Control? ActiveControl { get; set; }
}

public class UserControl : ContainerControl
{
    protected override Size DefaultSize => new(150, 150);

    public event EventHandler? Load;

    protected virtual void OnLoad(EventArgs e) => Load?.Invoke(this, e);

    private bool _loaded;

    /// <summary>UserControl 的 Load 在第一次随窗体显示时触发</summary>
    internal void RaiseLoadOnce()
    {
        if (_loaded) return;
        _loaded = true;
        OnLoad(EventArgs.Empty);
    }
}

public class Panel : ScrollableControl
{
    private BorderStyle _borderStyle;

    protected override Size DefaultSize => new(200, 100);

    public BorderStyle BorderStyle
    {
        get => _borderStyle;
        set => SetProp(ref _borderStyle, value, nameof(BorderStyle));
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["BorderStyle"] = _borderStyle.ToString();
    }
}

public class GroupBox : Control
{
    protected override Size DefaultSize => new(200, 100);

    public FlatStyle FlatStyle { get; set; } = FlatStyle.Standard;
}
