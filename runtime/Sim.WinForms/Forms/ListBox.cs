using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum SelectionMode { None, One, MultiSimple, MultiExtended }

/// <summary>列表框（教材项目 5 任务 3 显示历史灾情记录）。只支持单选。</summary>
public class ListBox : ListControl
{
    private int _itemHeight = 12;
    private BorderStyle _borderStyle = BorderStyle.Fixed3D;

    public ListBox() => Items = new ObjectCollection(this);

    protected override Size DefaultSize => new(120, 96);

    public ObjectCollection Items { get; }

    public bool FormattingEnabled { get; set; }
    public bool IntegralHeight { get; set; } = true;
    public bool HorizontalScrollbar { get; set; }
    public bool ScrollAlwaysVisible { get; set; }
    public bool MultiColumn { get; set; }
    public bool Sorted { get; set; }
    public SelectionMode SelectionMode { get; set; } = SelectionMode.One;
    public int TopIndex { get; set; }

    public int ItemHeight
    {
        get => _itemHeight;
        set => SetProp(ref _itemHeight, value, nameof(ItemHeight));
    }

    public BorderStyle BorderStyle
    {
        get => _borderStyle;
        set => SetProp(ref _borderStyle, value, nameof(BorderStyle));
    }

    public override int SelectedIndex
    {
        get => SelectedIndexValue;
        set
        {
            if (value < -1 || value >= Items.Count)
                throw new ArgumentOutOfRangeException(nameof(value), $"“{value}”的值对于“SelectedIndex”无效。");
            if (!SetProp(ref SelectedIndexValue, value, nameof(SelectedIndex))) return;
            OnSelectedIndexChanged(EventArgs.Empty);
            OnSelectedValueChanged(EventArgs.Empty);
        }
    }

    public object? SelectedItem
    {
        get => SelectedIndexValue >= 0 ? Items[SelectedIndexValue] : null;
        set => SelectedIndex = value == null ? -1 : Items.IndexOf(value);
    }

    /// <summary>和 WinForms 一样，列表框的 Text 是选中项的文字；赋值时选中文字相同的项</summary>
    public override string Text
    {
        get => GetItemText(SelectedItem);
        set
        {
            var index = FindStringExact(value ?? "");
            if (index >= 0) SelectedIndex = index;
        }
    }

    public event EventHandler? SelectedIndexChanged;

    protected virtual void OnSelectedIndexChanged(EventArgs e) => SelectedIndexChanged?.Invoke(this, e);

    public void ClearSelected() => SelectedIndex = -1;

    public void SetSelected(int index, bool value)
    {
        if (value) SelectedIndex = index;
        else if (index == SelectedIndexValue) SelectedIndex = -1;
    }

    public bool GetSelected(int index) => index == SelectedIndexValue;

    /// <summary>第一个以 s 开头的项（不区分大小写），没有时返回 -1</summary>
    public int FindString(string s)
    {
        for (var i = 0; i < Items.Count; i++)
            if (GetItemText(Items[i]).StartsWith(s, StringComparison.OrdinalIgnoreCase)) return i;
        return -1;
    }

    public int FindStringExact(string s)
    {
        for (var i = 0; i < Items.Count; i++)
            if (string.Equals(GetItemText(Items[i]), s, StringComparison.OrdinalIgnoreCase)) return i;
        return -1;
    }

    public void BeginUpdate() { }
    public void EndUpdate() { }

    protected override void OnUserAction(UserAction action)
    {
        switch (action.Action)
        {
            case "select":
                // 和 WinForms 一样，按下鼠标时先改变选中项，松开后才触发 Click
                if (action.Index >= 0 && action.Index < Items.Count) SelectedIndex = action.Index;
                base.OnUserAction(new UserAction { Action = "click", X = action.X, Y = action.Y });
                break;
            default:
                base.OnUserAction(action);
                break;
        }
    }

    internal override void ItemsChanged()
    {
        NotifyChanged(nameof(Items), ItemTexts(Items));
        NotifyChanged(nameof(SelectedIndex), SelectedIndexValue);
    }

    internal override void ItemsCleared()
    {
        SelectedIndex = -1;
        ItemsChanged();
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Items"] = PropValue.From(ItemTexts(Items));
        props["SelectedIndex"] = SelectedIndexValue;
        props["ItemHeight"] = _itemHeight;
        props["BorderStyle"] = _borderStyle.ToString();
    }

    public class ObjectCollection : ListItemCollection
    {
        public ObjectCollection(ListBox owner) : base(owner) { }
    }
}
