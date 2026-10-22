using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace System.Windows.Forms;

/// <summary>ComboBox 和 ListBox 的共同基类：列表项、选中项</summary>
public abstract class ListControl : Control
{
    /// <summary>选中项的序号。列表项增删时直接调整（和 WinForms 一样不触发 SelectedIndexChanged）</summary>
    private protected int SelectedIndexValue = -1;

    public abstract int SelectedIndex { get; set; }

    public string DisplayMember { get; set; } = "";
    public string ValueMember { get; set; } = "";

    public event EventHandler? SelectedValueChanged;

    protected virtual void OnSelectedValueChanged(EventArgs e) => SelectedValueChanged?.Invoke(this, e);

    public string GetItemText(object? item) => item?.ToString() ?? "";

    /// <summary>列表项变化后调用：把新的列表和选中项发给浏览器</summary>
    internal abstract void ItemsChanged();

    /// <summary>Items.Clear() 时调用：先取消选中，再刷新列表</summary>
    internal abstract void ItemsCleared();

    internal void ItemInserted(int index)
    {
        if (SelectedIndexValue >= index) SelectedIndexValue++;
        ItemsChanged();
    }

    /// <summary>删掉的正是选中项时取消选中，删掉前面的项时选中项序号前移</summary>
    internal void ItemRemoved(int index)
    {
        if (SelectedIndexValue == index) SelectedIndexValue = -1;
        else if (SelectedIndexValue > index) SelectedIndexValue--;
        ItemsChanged();
    }

    protected string[] ItemTexts(IEnumerable<object?> items) => items.Select(GetItemText).ToArray();
}

/// <summary>ComboBox.ObjectCollection 和 ListBox.ObjectCollection 共用的实现</summary>
public abstract class ListItemCollection : IList, IEnumerable<object?>
{
    private readonly List<object?> _items = new();
    private readonly ListControl _owner;

    private protected ListItemCollection(ListControl owner) => _owner = owner;

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
        _owner.ItemInserted(index);
    }

    public void Remove(object? item)
    {
        var index = _items.IndexOf(item);
        if (index >= 0) RemoveAt(index);
    }

    public void RemoveAt(int index)
    {
        _items.RemoveAt(index);
        _owner.ItemRemoved(index);
    }

    public void Clear()
    {
        _items.Clear();
        _owner.ItemsCleared();
    }

    public bool Contains(object? item) => _items.Contains(item);
    public int IndexOf(object? item) => _items.IndexOf(item);
    public void CopyTo(Array array, int index) => ((ICollection)_items).CopyTo(array, index);
    public IEnumerator<object?> GetEnumerator() => _items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
