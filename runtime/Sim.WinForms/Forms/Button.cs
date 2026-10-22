using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public abstract class ButtonBase : Control
{
    private FlatStyle _flatStyle = FlatStyle.Standard;

    public bool UseVisualStyleBackColor { get; set; } = true;
    public bool UseMnemonic { get; set; } = true;
    public ContentAlignment TextAlign { get; set; } = ContentAlignment.MiddleCenter;

    public FlatStyle FlatStyle
    {
        get => _flatStyle;
        set => SetProp(ref _flatStyle, value, nameof(FlatStyle));
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["FlatStyle"] = _flatStyle.ToString();
    }
}

public class Button : ButtonBase, IButtonControl
{
    protected override Size DefaultSize => new(75, 23);

    public DialogResult DialogResult { get; set; }

    public void NotifyDefault(bool value) { }

    public void PerformClick()
    {
        if (Enabled && Visible) OnClick(EventArgs.Empty);
    }

    protected override void OnClick(EventArgs e)
    {
        // 按钮设置了 DialogResult 时，点击会把结果交给所在的模态窗体并关闭它
        if (DialogResult != DialogResult.None && FindForm() is { } form) form.DialogResult = DialogResult;
        base.OnClick(e);
    }
}
