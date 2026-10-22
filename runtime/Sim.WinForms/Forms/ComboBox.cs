using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public class ComboBox : Control
{
    private int _selectedIndex = -1;
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

    public int SelectedIndex
    {
        get => _selectedIndex;
        set
        {
            if (value < -1 || value >= Items.Count)
                throw new ArgumentOutOfRangeException(nameof(value), $"“{value}”的值对于“SelectedIndex”无效。");
            if (value == _selectedIndex) return;
            SetProp(ref _selectedIndex, value, nameof(SelectedIndex));
            // 选中项变化时 Text 随之变化（先 TextChanged，再 SelectedIndexChanged，与 WinForms 一致）
            Text = value >= 0 ? Items[value]?.ToString() ?? "" : "";
            OnSelectedIndexChanged(EventArgs.Empty);
            OnSelectedValueChanged(EventArgs.Empty);
        }
    }

    public object? SelectedItem
    {
        get => _selectedIndex >= 0 ? Items[_selectedIndex] : null;
        set => SelectedIndex = value == null ? -1 : Items.IndexOf(value);
    }

    public string SelectedText { get; set; } = "";

    public event EventHandler? SelectedIndexChanged;
    public event EventHandler? SelectedValueChanged;
    public event EventHandler? DropDown;
    public event EventHandler? DropDownClosed;

    protected virtual void OnSelectedIndexChanged(EventArgs e) => SelectedIndexChanged?.Invoke(this, e);
    protected virtual void OnSelectedValueChanged(EventArgs e) => SelectedValueChanged?.Invoke(this, e);
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
                if (match != _selectedIndex) _selectedIndex = match;
                break;
            default:
                base.OnUserAction(action);
                break;
        }
    }

    internal void ItemsChanged()
    {
        if (_selectedIndex >= Items.Count) _selectedIndex = -1;
        NotifyChanged(nameof(Items), Items.Select(i => i?.ToString() ?? "").ToArray());
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Items"] = PropValue.From(Items.Select(i => i?.ToString() ?? "").ToArray());
        props["SelectedIndex"] = _selectedIndex;
        props["DropDownStyle"] = _dropDownStyle.ToString();
    }

    public class ObjectCollection : IList, IEnumerable<object?>
    {
        private readonly List<object?> _items = new();
        private readonly ComboBox _owner;

        public ObjectCollection(ComboBox owner) => _owner = owner;

        public int Count => _items.Count;
        public bool IsReadOnly => false;
        bool IList.IsFixedSize => false;
        bool ICollection.IsSynchronized => false;
        object ICollection.SyncRoot => this;

        public object? this[int index]
        {
            get => _items[index];
            set
            {
                _items[index] = value;
                _owner.ItemsChanged();
            }
        }

        public int Add(object? item)
        {
            if (item == null) throw new ArgumentNullException(nameof(item), "值不能为 null。");
            _items.Add(item);
            _owner.ItemsChanged();
            return _items.Count - 1;
        }

        public void AddRange(object[] items)
        {
            _items.AddRange(items);
            _owner.ItemsChanged();
        }

        public void Insert(int index, object? item)
        {
            _items.Insert(index, item);
            _owner.ItemsChanged();
        }

        public void Remove(object? item)
        {
            if (_items.Remove(item)) _owner.ItemsChanged();
        }

        public void RemoveAt(int index)
        {
            _items.RemoveAt(index);
            _owner.ItemsChanged();
        }

        public void Clear()
        {
            _items.Clear();
            _owner.SelectedIndex = -1;
            _owner.ItemsChanged();
        }

        public bool Contains(object? item) => _items.Contains(item);
        public int IndexOf(object? item) => _items.IndexOf(item);
        public void CopyTo(Array array, int index) => ((ICollection)_items).CopyTo(array, index);
        public IEnumerator<object?> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
