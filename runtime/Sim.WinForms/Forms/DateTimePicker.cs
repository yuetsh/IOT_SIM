using System.Drawing;
using System.Globalization;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum DateTimePickerFormat { Long = 1, Short = 2, Time = 4, Custom = 8 }

/// <summary>日期时间选择器（教材项目 6 任务 3 选查询的起止日期）。Text 按 Format 显示，和中文 Windows 一致（Long：2024年1月16日）</summary>
public class DateTimePicker : Control
{
    public static readonly DateTime MinimumDateTime = new(1753, 1, 1);
    public static readonly DateTime MaximumDateTime = new(9998, 12, 31);

    private DateTime _value = SimClock.Now;
    private DateTimePickerFormat _format = DateTimePickerFormat.Long;
    private string? _customFormat;
    private bool _showUpDown;
    private DateTime _minDate = MinimumDateTime;
    private DateTime _maxDate = MaximumDateTime;

    protected override Size DefaultSize => new(200, 21);

    public DateTime Value
    {
        get => _value;
        set
        {
            if (value < _minDate || value > _maxDate)
                throw new ArgumentOutOfRangeException(nameof(value), $"“{value}”的值对于“Value”无效。“Value”应介于“MinDate”和“MaxDate”之间。");
            if (value == _value) return;
            LegacyThreads.CheckPoint();
            _value = value;
            NotifyValue();
            OnValueChanged(EventArgs.Empty);
        }
    }

    public DateTimePickerFormat Format
    {
        get => _format;
        set
        {
            _format = value;
            NotifyValue();
            NotifyChanged(nameof(Format), value);
        }
    }

    public string? CustomFormat
    {
        get => _customFormat;
        set
        {
            _customFormat = value;
            NotifyValue();
        }
    }

    public bool ShowUpDown
    {
        get => _showUpDown;
        set => SetProp(ref _showUpDown, value, nameof(ShowUpDown));
    }

    public DateTime MinDate
    {
        get => _minDate;
        set => _minDate = value;
    }

    public DateTime MaxDate
    {
        get => _maxDate;
        set => _maxDate = value;
    }

    public bool ShowCheckBox { get; set; }
    public bool Checked { get; set; } = true;
    public LeftRightAlignment DropDownAlign { get; set; }

    /// <summary>显示的文字；赋值时按日期解析</summary>
    public override string Text
    {
        get => Display;
        set
        {
            if (string.IsNullOrEmpty(value)) return;
            Value = DateTime.Parse(value, CultureInfo.CurrentCulture);
        }
    }

    private string Display => _format switch
    {
        DateTimePickerFormat.Short => _value.ToString("d", CultureInfo.CurrentCulture),
        DateTimePickerFormat.Time => _value.ToString("T", CultureInfo.CurrentCulture),
        DateTimePickerFormat.Custom when !string.IsNullOrEmpty(_customFormat) => _value.ToString(_customFormat, CultureInfo.CurrentCulture),
        _ => _value.ToString("D", CultureInfo.CurrentCulture),
    };

    public event EventHandler? ValueChanged;
    public event EventHandler? CloseUp;
    public event EventHandler? DropDown;

    protected virtual void OnValueChanged(EventArgs e) => ValueChanged?.Invoke(this, e);

    /// <summary>浏览器里选了新的日期或时间（ISO 格式，本地时间）：和 WinForms 一样先 ValueChanged，再 CloseUp</summary>
    protected override void OnUserAction(UserAction action)
    {
        switch (action.Action)
        {
            case "dropDown":
                DropDown?.Invoke(this, EventArgs.Empty);
                break;
            case "pick" when DateTime.TryParse(action.Value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var picked):
                var clamped = picked < _minDate ? _minDate : picked > _maxDate ? _maxDate : picked;
                if (clamped != _value) Value = clamped;
                else NotifyValue();
                CloseUp?.Invoke(this, EventArgs.Empty);
                break;
            default:
                base.OnUserAction(action);
                break;
        }
    }

    private void NotifyValue()
    {
        NotifyChanged("Text", Display);
        NotifyChanged("Value", _value.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture));
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Value"] = _value.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        props["Format"] = _format.ToString();
        props["ShowUpDown"] = _showUpDown;
        props["HasTime"] = _format == DateTimePickerFormat.Time || (_format == DateTimePickerFormat.Custom && (_customFormat ?? "").IndexOfAny(['H', 'h', 'm', 's']) >= 0);
        props["HasDate"] = _format != DateTimePickerFormat.Time && !(_format == DateTimePickerFormat.Custom && (_customFormat ?? "").IndexOfAny(['y', 'M', 'd']) < 0);
    }
}
