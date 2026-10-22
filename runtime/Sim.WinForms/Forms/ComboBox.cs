using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public class ComboBox : ListControl
{
    private ComboBoxStyle _dropDownStyle = ComboBoxStyle.DropDown;

    public ComboBox() => Items = new ObjectCollection(this);

    protected override Size DefaultSize => new(121, 20);

    public ObjectCollection Items { get; }

    public bool FormattingEnabled { get; set; }
    public int MaxDropDownItems { get; set; } = 8;
    public int DropDownWidth { get; set; } = 121;
    public int DropDownHeight { get; set; } = 106;
    public bool Sorted { get; set; }
    public bool DroppedDown { get; set; }

    public ComboBoxStyle DropDownStyle
    {
        get => _dropDownStyle;
        set => SetProp(ref _dropDownStyle, value, nameof(DropDownStyle));
    }

    public override int SelectedIndex
    {
        get => SelectedIndexValue;
        set
        {
            if (value < -1 || value >= Items.Count)
                throw new ArgumentOutOfRangeException(nameof(value), $"“{value}”的值对于“SelectedIndex”无效。");
            if (value == SelectedIndexValue) return;
            SetProp(ref SelectedIndexValue, value, nameof(SelectedIndex));
            // 选中项变化时 Text 随之变化（先 TextChanged，再 SelectedIndexChanged，与 WinForms 一致）
            Text = value >= 0 ? Items[value]?.ToString() ?? "" : "";
            OnSelectedIndexChanged(EventArgs.Empty);
            OnSelectedValueChanged(EventArgs.Empty);
        }
    }

    public object? SelectedItem
    {
        get => SelectedIndexValue >= 0 ? Items[SelectedIndexValue] : null;
        set => SelectedIndex = value == null ? -1 : Items.IndexOf(value);
    }

    public string SelectedText { get; set; } = "";

    public event EventHandler? SelectedIndexChanged;
    public event EventHandler? DropDown;
    public event EventHandler? DropDownClosed;

    protected virtual void OnSelectedIndexChanged(EventArgs e) => SelectedIndexChanged?.Invoke(this, e);
    protected virtual void OnDropDown(EventArgs e) => DropDown?.Invoke(this, e);
    protected virtual void OnDropDownClosed(EventArgs e) => DropDownClosed?.Invoke(this, e);

    public void BeginUpdate() { }
    public void EndUpdate() { }

    protected override void OnUserAction(UserAction action)
    {
        switch (action.Action)
        {
            case "dropDown":
                // 教材在 Click 事件里刷新串口列表，所以 Click 必须在列表展开之前触发
                OnClick(EventArgs.Empty);
                OnDropDown(EventArgs.Empty);
                break;
            case "select":
                if (action.Index >= 0 && action.Index < Items.Count) SelectedIndex = action.Index;
                OnDropDownClosed(EventArgs.Empty);
                break;
            case "text" when _dropDownStyle != ComboBoxStyle.DropDownList:
                SetTextFromUser(action.Value ?? "");
                var match = Items.IndexOf(Text);
                if (match != SelectedIndexValue) SelectedIndexValue = match;
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
        props["DropDownStyle"] = _dropDownStyle.ToString();
    }

    public class ObjectCollection : ListItemCollection
    {
        public ObjectCollection(ComboBox owner) : base(owner) { }
    }
}
