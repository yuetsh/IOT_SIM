using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum CheckState { Unchecked, Checked, Indeterminate }

public enum Appearance { Normal, Button }

/// <summary>
/// 复选框。用户点击时先切换 Checked（触发 CheckedChanged），再触发 Click——
/// 教材项目 3 在 Click 里读取 Checked，依赖这个顺序。
/// </summary>
public class CheckBox : ButtonBase
{
    private CheckState _checkState;

    protected override Size DefaultSize => new(104, 24);

    public bool AutoCheck { get; set; } = true;
    public bool ThreeState { get; set; }
    public Appearance Appearance { get; set; }
    public ContentAlignment CheckAlign { get; set; } = ContentAlignment.MiddleLeft;

    public bool Checked
    {
        get => _checkState != CheckState.Unchecked;
        set => CheckState = value ? CheckState.Checked : CheckState.Unchecked;
    }

    public CheckState CheckState
    {
        get => _checkState;
        set
        {
            if (_checkState == value) return;
            var wasChecked = Checked;
            SetProp(ref _checkState, value, nameof(CheckState));
            NotifyChanged(nameof(Checked), Checked);
            if (wasChecked != Checked) OnCheckedChanged(EventArgs.Empty);
            OnCheckStateChanged(EventArgs.Empty);
        }
    }

    public event EventHandler? CheckedChanged;
    public event EventHandler? CheckStateChanged;

    protected virtual void OnCheckedChanged(EventArgs e) => CheckedChanged?.Invoke(this, e);
    protected virtual void OnCheckStateChanged(EventArgs e) => CheckStateChanged?.Invoke(this, e);

    protected override void OnClick(EventArgs e)
    {
        if (AutoCheck)
        {
            CheckState = _checkState switch
            {
                CheckState.Unchecked => CheckState.Checked,
                CheckState.Checked when ThreeState => CheckState.Indeterminate,
                _ => CheckState.Unchecked,
            };
        }
        base.OnClick(e);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Checked"] = Checked;
        props["CheckState"] = _checkState.ToString();
    }
}

/// <summary>
/// 单选按钮。同一个容器里的单选按钮互斥。选中一个时，事件顺序与 WinForms 一致：
/// 先是原来选中的那个触发 CheckedChanged（变为未选中），再是新选中的触发 CheckedChanged，最后触发 Click。
/// 教材项目 3 任务 1 在两个按钮的 CheckedChanged 里分别开灯、关灯，最终状态依赖这个顺序。
/// </summary>
public class RadioButton : ButtonBase
{
    private bool _checked;

    protected override Size DefaultSize => new(104, 24);

    public bool AutoCheck { get; set; } = true;
    public Appearance Appearance { get; set; }
    public ContentAlignment CheckAlign { get; set; } = ContentAlignment.MiddleLeft;

    public bool Checked
    {
        get => _checked;
        set
        {
            if (_checked == value) return;
            SetProp(ref _checked, value, nameof(Checked));
            if (value && AutoCheck) UncheckSiblings();
            OnCheckedChanged(EventArgs.Empty);
        }
    }

    private void UncheckSiblings()
    {
        if (Parent == null) return;
        foreach (var sibling in Parent.Controls)
        {
            if (sibling != this && sibling is RadioButton { AutoCheck: true, Checked: true } radio) radio.Checked = false;
        }
    }

    public event EventHandler? CheckedChanged;

    protected virtual void OnCheckedChanged(EventArgs e) => CheckedChanged?.Invoke(this, e);

    public void PerformClick()
    {
        if (Enabled && Visible) OnClick(EventArgs.Empty);
    }

    protected override void OnClick(EventArgs e)
    {
        if (AutoCheck) Checked = true;
        base.OnClick(e);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Checked"] = _checked;
    }
}
