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
        set
        {
            if (SetProp(ref _borderStyle, value, nameof(BorderStyle))) PerformLayout();
        }
    }

    /// <summary>边框占掉的宽度：单线 1 像素，立体 2 像素</summary>
    public override Rectangle DisplayRectangle
    {
        get
        {
            var inset = _borderStyle switch { BorderStyle.FixedSingle => 1, BorderStyle.Fixed3D => 2, _ => 0 };
            var rect = base.DisplayRectangle;
            return new Rectangle(rect.X, rect.Y, Math.Max(0, rect.Width - 2 * inset), Math.Max(0, rect.Height - 2 * inset));
        }
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

    /// <summary>分组框的边框和标题占掉的地方（宋体 9pt 时和 WinForms 一致）</summary>
    public override Rectangle DisplayRectangle
    {
        get
        {
            var rect = base.DisplayRectangle;
            return new Rectangle(rect.X + 3, rect.Y + 17, Math.Max(0, rect.Width - 6), Math.Max(0, rect.Height - 20));
        }
    }
}
