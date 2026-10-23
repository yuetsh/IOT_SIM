using System.ComponentModel;
using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum TickStyle { None, TopLeft, BottomRight, Both }

public enum Orientation { Horizontal, Vertical }

/// <summary>滑动条（教材项目 7 模拟空调温度、窗帘开合）</summary>
public class TrackBar : Control, ISupportInitialize
{
    private int _minimum;
    private int _maximum = 10;
    private int _value;
    private int _tickFrequency = 1;
    private TickStyle _tickStyle = TickStyle.BottomRight;
    private Orientation _orientation = Orientation.Horizontal;
    private bool _initializing;

    public TrackBar() => AutoSize = true;

    protected override Size DefaultSize => new(104, 45);

    public int Minimum
    {
        get => _minimum;
        set => SetRange(value, Math.Max(value, _maximum));
    }

    public int Maximum
    {
        get => _maximum;
        set => SetRange(Math.Min(value, _minimum), value);
    }

    public int Value
    {
        get => _value;
        set
        {
            if (!_initializing && (value < _minimum || value > _maximum))
                throw new ArgumentOutOfRangeException(nameof(value), $"“{value}”的值对于“Value”无效。“Value”应介于 'Minimum' 和 'Maximum' 之间。");
            if (SetProp(ref _value, value, nameof(Value))) OnValueChanged(EventArgs.Empty);
        }
    }

    public int TickFrequency
    {
        get => _tickFrequency;
        set => SetProp(ref _tickFrequency, value, nameof(TickFrequency));
    }

    public TickStyle TickStyle
    {
        get => _tickStyle;
        set => SetProp(ref _tickStyle, value, nameof(TickStyle));
    }

    public Orientation Orientation
    {
        get => _orientation;
        set
        {
            if (value == _orientation) return;
            SetProp(ref _orientation, value, nameof(Orientation));
            Size = new Size(Height, Width);
        }
    }

    public int LargeChange { get; set; } = 5;
    public int SmallChange { get; set; } = 1;

    public event EventHandler? Scroll;
    public event EventHandler? ValueChanged;

    protected virtual void OnScroll(EventArgs e) => Scroll?.Invoke(this, e);
    protected virtual void OnValueChanged(EventArgs e) => ValueChanged?.Invoke(this, e);

    public void SetRange(int minValue, int maxValue)
    {
        SetProp(ref _minimum, minValue, nameof(Minimum));
        SetProp(ref _maximum, Math.Max(minValue, maxValue), nameof(Maximum));
        if (_value < _minimum) Value = _minimum;
        else if (_value > _maximum) Value = _maximum;
    }

    // Designer.cs 里 VS 生成 ((ISupportInitialize)trackBar1).BeginInit() / EndInit()：期间先设 Value 再设范围也不报错
    public void BeginInit() => _initializing = true;

    public void EndInit()
    {
        _initializing = false;
        if (_value < _minimum || _value > _maximum) Value = Math.Clamp(_value, _minimum, _maximum);
    }

    /// <summary>用户拖动滑块、点轨道或按方向键：和 WinForms 一样先改 Value（ValueChanged），再触发 Scroll</summary>
    protected override void OnUserAction(UserAction action)
    {
        if (action.Action != "scroll" || !int.TryParse(action.Value, out var value))
        {
            base.OnUserAction(action);
            return;
        }
        Value = Math.Clamp(value, _minimum, _maximum);
        OnScroll(EventArgs.Empty);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Minimum"] = _minimum;
        props["Maximum"] = _maximum;
        props["Value"] = _value;
        props["TickFrequency"] = _tickFrequency;
        props["TickStyle"] = _tickStyle.ToString();
        props["Orientation"] = _orientation.ToString();
        props["LargeChange"] = LargeChange;
        props["SmallChange"] = SmallChange;
    }
}
