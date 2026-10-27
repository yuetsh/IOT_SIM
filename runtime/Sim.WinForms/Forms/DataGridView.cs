using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum DataGridViewColumnHeadersHeightSizeMode { EnableResizing, DisableResizing, AutoSize }
public enum DataGridViewRowHeadersWidthSizeMode { EnableResizing, DisableResizing, AutoSizeToAllHeaders, AutoSizeToDisplayedHeaders, AutoSizeToFirstHeader }
public enum DataGridViewSelectionMode { CellSelect, FullRowSelect, FullColumnSelect, RowHeaderSelect, ColumnHeaderSelect }
public enum DataGridViewAutoSizeColumnsMode { None = 1, ColumnHeader = 2, AllCellsExceptHeader = 4, AllCells = 6, DisplayedCellsExceptHeader = 8, DisplayedCells = 10, Fill = 16 }
public enum DataGridViewAutoSizeColumnMode { NotSet = 0, None = 1, ColumnHeader = 2, AllCellsExceptHeader = 4, AllCells = 6, DisplayedCellsExceptHeader = 8, DisplayedCells = 10, Fill = 16 }
public enum DataGridViewEditMode { EditOnEnter, EditOnKeystroke, EditOnKeystrokeOrF2, EditOnF2, EditProgrammatically }
[Flags] public enum DataGridViewDataErrorContexts { Formatting = 1, Display = 2, PreferredSize = 4, RowDeletion = 8, Parsing = 256, Commit = 512, InitialValueRestoration = 1024, LeaveControl = 2048, CurrentCellChange = 4096, Scroll = 8192, ClipboardContent = 16384 }

public delegate void DataGridViewCellEventHandler(object sender, DataGridViewCellEventArgs e);
public delegate void DataGridViewDataErrorEventHandler(object sender, DataGridViewDataErrorEventArgs e);

public class DataGridViewCellEventArgs : EventArgs
{
    public DataGridViewCellEventArgs(int columnIndex, int rowIndex)
    {
        ColumnIndex = columnIndex;
        RowIndex = rowIndex;
    }

    public int ColumnIndex { get; }
    public int RowIndex { get; }
}

public class DataGridViewDataErrorEventArgs : DataGridViewCellCancelEventArgs
{
    public DataGridViewDataErrorEventArgs(Exception? exception, int columnIndex, int rowIndex, DataGridViewDataErrorContexts context) : base(columnIndex, rowIndex)
    {
        Exception = exception;
        Context = context;
    }

    public Exception? Exception { get; }
    public DataGridViewDataErrorContexts Context { get; }
    public bool ThrowException { get; set; }
}

public class DataGridViewCellCancelEventArgs : CancelEventArgs
{
    public DataGridViewCellCancelEventArgs(int columnIndex, int rowIndex)
    {
        ColumnIndex = columnIndex;
        RowIndex = rowIndex;
    }

    public int ColumnIndex { get; }
    public int RowIndex { get; }
}

public class DataGridViewCellStyle
{
    public Color BackColor { get; set; }
    public Color ForeColor { get; set; }
    public Color SelectionBackColor { get; set; }
    public Color SelectionForeColor { get; set; }
    public Font? Font { get; set; }
    public string Format { get; set; } = "";
    public DataGridViewContentAlignment Alignment { get; set; }
    public DataGridViewTriState WrapMode { get; set; }
    public object? NullValue { get; set; } = "";
}

public enum DataGridViewContentAlignment { NotSet = 0, TopLeft = 1, TopCenter = 2, TopRight = 4, MiddleLeft = 16, MiddleCenter = 32, MiddleRight = 64, BottomLeft = 256, BottomCenter = 512, BottomRight = 1024 }
public enum DataGridViewTriState { NotSet, True, False }
public enum DataGridViewColumnSortMode { NotSortable, Automatic, Programmatic }

/// <summary>一列：名字、标题、绑定的数据列、宽度</summary>
public class DataGridViewColumn : Component
{
    private string _headerText = "";
    private int _width = 100;
    private bool _visible = true;
    private bool _readOnly;

    internal DataGridView? Owner { get; set; }

    public string Name { get; set; } = "";

    public string HeaderText
    {
        get => _headerText;
        set
        {
            _headerText = value ?? "";
            Owner?.LayoutChanged();
        }
    }

    public string DataPropertyName { get; set; } = "";

    public int Width
    {
        get => _width;
        set
        {
            _width = value;
            Owner?.LayoutChanged();
        }
    }

    public bool Visible
    {
        get => _visible;
        set
        {
            _visible = value;
            Owner?.LayoutChanged();
        }
    }

    public bool ReadOnly
    {
        get => _readOnly;
        set
        {
            _readOnly = value;
            Owner?.LayoutChanged();
        }
    }

    public int Index => Owner?.Columns.IndexOf(this) ?? -1;
    public int DisplayIndex { get => Index; set { } }
    public Type? ValueType { get; set; }
    public DataGridViewAutoSizeColumnMode AutoSizeMode { get; set; }
    public DataGridViewColumnSortMode SortMode { get; set; } = DataGridViewColumnSortMode.Automatic;
    public DataGridViewCellStyle DefaultCellStyle { get; set; } = new();
    public int MinimumWidth { get; set; } = 5;
    public float FillWeight { get; set; } = 100;
    public bool Frozen { get; set; }
    public bool Resizable { get; set; } = true;
    public string ToolTipText { get; set; } = "";
    public object? Tag { get; set; }
    public bool IsDataBound => !string.IsNullOrEmpty(DataPropertyName) && Owner?.DataSource != null;

    internal virtual bool IsCheckBox => false;
}

public class DataGridViewTextBoxColumn : DataGridViewColumn
{
    public int MaxInputLength { get; set; } = 32767;
}

public class DataGridViewCheckBoxColumn : DataGridViewColumn
{
    public bool ThreeState { get; set; }
    internal override bool IsCheckBox => true;
}

/// <summary>一个单元格；值保存在绑定的 DataRow 里（绑定时）或行自己的数组里（不绑定时）</summary>
public class DataGridViewCell
{
    private readonly DataGridViewRow _row;

    internal DataGridViewCell(DataGridViewRow row, int columnIndex)
    {
        _row = row;
        ColumnIndex = columnIndex;
    }

    public int ColumnIndex { get; }
    public int RowIndex => _row.Index;
    public DataGridViewRow OwningRow => _row;
    public DataGridViewColumn? OwningColumn => _row.Grid?.Columns[ColumnIndex];
    public DataGridView? DataGridView => _row.Grid;

    public object? Value
    {
        get => _row.GetValue(ColumnIndex);
        set => _row.SetValue(ColumnIndex, value, fromUser: false);
    }

    public object? FormattedValue => DataGridView.Format(Value);
    public Type? ValueType => OwningColumn?.ValueType;
    public bool ReadOnly { get; set; }
    public bool Selected => _row.Grid?.IsCellSelected(RowIndex, ColumnIndex) ?? false;
    public object? Tag { get; set; }
    public string ToolTipText { get; set; } = "";
    public DataGridViewCellStyle Style { get; set; } = new();

    public override string ToString() => $"DataGridViewTextBoxCell {{ ColumnIndex={ColumnIndex}, RowIndex={RowIndex} }}";
}

public class DataGridViewCellCollection : IEnumerable<DataGridViewCell>
{
    private readonly DataGridViewRow _row;

    internal DataGridViewCellCollection(DataGridViewRow row) => _row = row;

    public int Count => _row.Grid?.Columns.Count ?? _row.UnboundValues.Count;

    public DataGridViewCell this[int index]
    {
        get
        {
            if (index < 0 || index >= Count) throw new ArgumentOutOfRangeException(nameof(index), "索引超出范围。必须为非负值并小于集合大小。");
            return _row.Cell(index);
        }
    }

    public DataGridViewCell this[string columnName]
    {
        get
        {
            var index = _row.Grid?.Columns.IndexOf(columnName) ?? -1;
            if (index < 0) throw new ArgumentException($"找不到名为 {columnName} 的列。列名不能为 null 或为空字符串。");
            return _row.Cell(index);
        }
    }

    public IEnumerator<DataGridViewCell> GetEnumerator()
    {
        for (var i = 0; i < Count; i++) yield return _row.Cell(i);
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>一行。绑定数据时对应一个 DataRowView；最后一行可能是供用户新增数据的空行（IsNewRow）</summary>
public class DataGridViewRow
{
    private readonly Dictionary<int, DataGridViewCell> _cells = new();
    private int _height = 23;

    public DataGridViewRow() => Cells = new DataGridViewCellCollection(this);

    internal DataGridView? Grid { get; set; }
    internal DataRowView? RowView { get; set; }
    internal List<object?> UnboundValues { get; } = new();

    public DataGridViewCellCollection Cells { get; }
    public int Index { get; internal set; } = -1;
    public bool IsNewRow { get; internal set; }
    public object? DataBoundItem => RowView;
    public bool ReadOnly { get; set; }
    public object? Tag { get; set; }
    public bool Visible { get; set; } = true;

    public int Height
    {
        get => _height;
        set
        {
            _height = value;
            Grid?.LayoutChanged();
        }
    }

    public bool Selected
    {
        get => Grid?.IsRowSelected(Index) ?? false;
        set => Grid?.SetRowSelected(Index, value);
    }

    public DataGridViewCellStyle DefaultCellStyle { get; set; } = new();

    internal DataGridViewCell Cell(int index) => _cells.TryGetValue(index, out var cell) ? cell : _cells[index] = new DataGridViewCell(this, index);

    internal object? GetValue(int column)
    {
        if (IsNewRow) return null;
        if (RowView != null)
        {
            var name = Grid!.Columns[column].DataPropertyName;
            return string.IsNullOrEmpty(name) || !RowView.Row.Table.Columns.Contains(name) ? null : RowView[name];
        }
        return column < UnboundValues.Count ? UnboundValues[column] : null;
    }

    internal void SetValue(int column, object? value, bool fromUser)
    {
        if (RowView != null)
        {
            var name = Grid!.Columns[column].DataPropertyName;
            RowView.BeginEdit();
            RowView[name] = value ?? DBNull.Value;
            RowView.EndEdit();
        }
        else
        {
            while (UnboundValues.Count <= column) UnboundValues.Add(null);
            UnboundValues[column] = value;
            Grid?.RowsChanged();
        }
        if (!fromUser) Grid?.RaiseCellValueChanged(column, Index);
    }

    public void SetValues(params object?[] values)
    {
        for (var i = 0; i < values.Length; i++) SetValue(i, values[i], fromUser: false);
    }
}

public class DataGridViewColumnCollection : IEnumerable<DataGridViewColumn>
{
    private readonly DataGridView _owner;
    private readonly List<DataGridViewColumn> _items = new();

    internal DataGridViewColumnCollection(DataGridView owner) => _owner = owner;

    public int Count => _items.Count;
    public DataGridViewColumn this[int index] => _items[index];

    public DataGridViewColumn this[string columnName] =>
        _items.FirstOrDefault(c => string.Equals(c.Name, columnName, StringComparison.OrdinalIgnoreCase))!;

    public int Add(DataGridViewColumn column)
    {
        column.Owner = _owner;
        _items.Add(column);
        _owner.ColumnsChanged();
        return _items.Count - 1;
    }

    public int Add(string columnName, string headerText) => Add(new DataGridViewTextBoxColumn { Name = columnName, HeaderText = headerText });

    public void AddRange(params DataGridViewColumn[] columns)
    {
        foreach (var column in columns)
        {
            column.Owner = _owner;
            _items.Add(column);
        }
        _owner.ColumnsChanged();
    }

    public void Insert(int index, DataGridViewColumn column)
    {
        column.Owner = _owner;
        _items.Insert(index, column);
        _owner.ColumnsChanged();
    }

    public void Remove(DataGridViewColumn column)
    {
        if (_items.Remove(column)) _owner.ColumnsChanged();
    }

    public void Remove(string columnName)
    {
        if (this[columnName] is { } column) Remove(column);
    }

    public void RemoveAt(int index)
    {
        _items.RemoveAt(index);
        _owner.ColumnsChanged();
    }

    public void Clear()
    {
        _items.Clear();
        _owner.ColumnsChanged();
    }

    public bool Contains(string columnName) => IndexOf(columnName) >= 0;
    public int IndexOf(DataGridViewColumn column) => _items.IndexOf(column);
    public int IndexOf(string columnName) => _items.FindIndex(c => string.Equals(c.Name, columnName, StringComparison.OrdinalIgnoreCase));

    internal void ReplaceAll(IEnumerable<DataGridViewColumn> columns)
    {
        _items.Clear();
        foreach (var column in columns)
        {
            column.Owner = _owner;
            _items.Add(column);
        }
    }

    public IEnumerator<DataGridViewColumn> GetEnumerator() => _items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public class DataGridViewRowCollection : IEnumerable<DataGridViewRow>
{
    private readonly DataGridView _owner;

    internal DataGridViewRowCollection(DataGridView owner) => _owner = owner;

    private List<DataGridViewRow> Items => _owner.AllRows;

    /// <summary>和 WinForms 一样包括最下面供新增的空行</summary>
    public int Count => Items.Count;

    public DataGridViewRow this[int index]
    {
        get
        {
            if (index < 0 || index >= Items.Count) throw new ArgumentOutOfRangeException(nameof(index), "索引超出范围。必须为非负值并小于集合大小。");
            return Items[index];
        }
    }

    public int Add() => Add(Array.Empty<object>());

    public int Add(params object?[] values)
    {
        if (_owner.DataSource != null) throw new InvalidOperationException("当控件被数据绑定时，无法以编程方式向 DataGridView 的行集合中添加行。");
        if (_owner.Columns.Count == 0) throw new InvalidOperationException("没有列时无法向 DataGridView 控件添加任何行。必须首先添加列。");
        var row = new DataGridViewRow();
        row.UnboundValues.AddRange(values);
        return _owner.AddUnboundRow(row);
    }

    public int Add(DataGridViewRow row) => _owner.AddUnboundRow(row);

    public void Clear()
    {
        if (_owner.DataSource != null) throw new ArgumentException("无法清除此列表。");
        _owner.ClearUnboundRows();
    }

    public void RemoveAt(int index) => _owner.RemoveRow(index);
    public void Remove(DataGridViewRow row) => _owner.RemoveRow(row.Index);
    public int GetRowCount(DataGridViewElementStates state) => Count;

    public IEnumerator<DataGridViewRow> GetEnumerator() => Items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

[Flags] public enum DataGridViewElementStates { None = 0, Displayed = 1, Frozen = 2, ReadOnly = 4, Resizable = 8, ResizableSet = 16, Selected = 32, Visible = 64 }

public class DataGridViewSelectedRowCollection : IEnumerable<DataGridViewRow>
{
    private readonly List<DataGridViewRow> _items;

    internal DataGridViewSelectedRowCollection(List<DataGridViewRow> items) => _items = items;

    public int Count => _items.Count;
    public DataGridViewRow this[int index] => _items[index];
    public IEnumerator<DataGridViewRow> GetEnumerator() => _items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>
/// 数据表格（教材项目 6、8 显示数据库查询结果）。绑定 DataView / DataTable / DataSet 时自动生成列，
/// 用户在单元格里修改的值写回绑定的 DataRow，配合 SqlDataAdapter.Update 保存到数据库。
/// 浏览器只负责显示和输入，单元格的值、当前单元格、选中的行都由这里决定。
/// </summary>
public class DataGridView : Control, ISupportInitialize
{
    /// <summary>发给浏览器的行数上限（太多时只显示前面这些）</summary>
    private const int MaxRowsSent = 2000;

    private object? _dataSource;
    private string _dataMember = "";
    private DataView? _view;
    private readonly List<DataGridViewRow> _rows = new();
    private readonly HashSet<int> _selectedRows = new();
    private (int Row, int Column)? _currentCell;
    private bool _readOnly;
    private bool _allowUserToAddRows = true;
    private bool _rowHeadersVisible = true;
    private bool _columnHeadersVisible = true;
    private DataGridViewSelectionMode _selectionMode = DataGridViewSelectionMode.RowHeaderSelect;
    private DataGridViewAutoSizeColumnsMode _autoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
    private Color _backgroundColor = SystemColors.AppWorkspace;
    private bool _initializing;
    private bool _rowsDirty;

    private protected override bool SupportsTransparentBackColor => false;

    public DataGridView()
    {
        Columns = new DataGridViewColumnCollection(this);
        Rows = new DataGridViewRowCollection(this);
        RowTemplate = new DataGridViewRow();
        UpdateNewRow();
    }

    protected override Size DefaultSize => new(240, 150);

    public DataGridViewColumnCollection Columns { get; }
    public DataGridViewRowCollection Rows { get; }
    public DataGridViewRow RowTemplate { get; set; }
    internal List<DataGridViewRow> AllRows => _rows;

    public bool AutoGenerateColumns { get; set; } = true;
    public DataGridViewColumnHeadersHeightSizeMode ColumnHeadersHeightSizeMode { get; set; } = DataGridViewColumnHeadersHeightSizeMode.EnableResizing;
    public DataGridViewRowHeadersWidthSizeMode RowHeadersWidthSizeMode { get; set; } = DataGridViewRowHeadersWidthSizeMode.EnableResizing;
    public int ColumnHeadersHeight { get; set; } = 23;
    public int RowHeadersWidth { get; set; } = 41;
    public bool AllowUserToDeleteRows { get; set; } = true;
    public bool AllowUserToResizeRows { get; set; } = true;
    public bool AllowUserToResizeColumns { get; set; } = true;
    public bool AllowUserToOrderColumns { get; set; }
    public bool MultiSelect { get; set; } = true;
    public DataGridViewEditMode EditMode { get; set; } = DataGridViewEditMode.EditOnKeystrokeOrF2;
    public BorderStyle BorderStyle { get; set; } = BorderStyle.FixedSingle;
    public Color GridColor { get; set; } = SystemColors.ControlDark;
    public DataGridViewCellStyle DefaultCellStyle { get; set; } = new();
    public DataGridViewCellStyle ColumnHeadersDefaultCellStyle { get; set; } = new();
    public DataGridViewCellStyle RowHeadersDefaultCellStyle { get; set; } = new();
    public DataGridViewCellStyle AlternatingRowsDefaultCellStyle { get; set; } = new();
    public DataGridViewCellStyle RowsDefaultCellStyle { get; set; } = new();
    public bool EnableHeadersVisualStyles { get; set; } = true;

    public object? DataSource
    {
        get => _dataSource;
        set
        {
            _dataSource = value;
            Bind();
        }
    }

    public string DataMember
    {
        get => _dataMember;
        set
        {
            _dataMember = value ?? "";
            Bind();
        }
    }

    public bool ReadOnly
    {
        get => _readOnly;
        set
        {
            _readOnly = value;
            UpdateNewRow();
            LayoutChanged();
        }
    }

    public bool AllowUserToAddRows
    {
        get => _allowUserToAddRows;
        set
        {
            _allowUserToAddRows = value;
            UpdateNewRow();
            RowsChanged();
        }
    }

    public bool RowHeadersVisible
    {
        get => _rowHeadersVisible;
        set => SetProp(ref _rowHeadersVisible, value, nameof(RowHeadersVisible));
    }

    public bool ColumnHeadersVisible
    {
        get => _columnHeadersVisible;
        set => SetProp(ref _columnHeadersVisible, value, nameof(ColumnHeadersVisible));
    }

    public DataGridViewSelectionMode SelectionMode
    {
        get => _selectionMode;
        set
        {
            _selectionMode = value;
            SelectionChangedInternal(raise: false);
        }
    }

    public DataGridViewAutoSizeColumnsMode AutoSizeColumnsMode
    {
        get => _autoSizeColumnsMode;
        set
        {
            _autoSizeColumnsMode = value;
            LayoutChanged();
        }
    }

    public Color BackgroundColor
    {
        get => _backgroundColor;
        set => SetProp(ref _backgroundColor, value, nameof(BackgroundColor));
    }

    public int RowCount
    {
        get => _rows.Count;
        set
        {
            if (_dataSource != null) throw new InvalidOperationException("当控件被数据绑定时，无法设置 RowCount 属性。");
            while (_rows.Count < value) Rows.Add();
        }
    }

    public int ColumnCount
    {
        get => Columns.Count;
        set
        {
            while (Columns.Count < value) Columns.Add($"Column{Columns.Count + 1}", "");
            while (Columns.Count > value) Columns.RemoveAt(Columns.Count - 1);
        }
    }

    public DataGridViewRow? CurrentRow => _currentCell is { } c && c.Row < _rows.Count ? _rows[c.Row] : null;

    public DataGridViewCell? CurrentCell
    {
        get => _currentCell is { } c && c.Row < _rows.Count && c.Column < Columns.Count ? _rows[c.Row].Cells[c.Column] : null;
        set => SetCurrentCell(value == null ? null : (value.RowIndex, value.ColumnIndex), raise: true);
    }

    public Point CurrentCellAddress => _currentCell is { } c ? new Point(c.Column, c.Row) : new Point(-1, -1);

    public DataGridViewSelectedRowCollection SelectedRows =>
        new(_selectedRows.Order().Where(i => i < _rows.Count).Select(i => _rows[i]).ToList());

    public bool IsCurrentCellInEditMode => false;
    public DataGridViewCell this[int columnIndex, int rowIndex] => Rows[rowIndex].Cells[columnIndex];
    public DataGridViewCell this[string columnName, int rowIndex] => Rows[rowIndex].Cells[columnName];

    public event DataGridViewCellEventHandler? CellClick;
    public event DataGridViewCellEventHandler? CellContentClick;
    public event DataGridViewCellEventHandler? CellDoubleClick;
    public event DataGridViewCellEventHandler? CellContentDoubleClick;
    public event DataGridViewCellEventHandler? CellValueChanged;
    public event DataGridViewCellEventHandler? CellEndEdit;
#pragma warning disable CS0067 // 只读表格没有当前单元格的概念，这两个事件不触发
    public event DataGridViewCellEventHandler? CellEnter;
    public event DataGridViewCellEventHandler? RowEnter;
#pragma warning restore CS0067
    public event DataGridViewDataErrorEventHandler? DataError;
    public event EventHandler? SelectionChanged;
    public event EventHandler? CurrentCellChanged;
    public event EventHandler? DataSourceChanged;
    public event EventHandler? DataBindingComplete;

    protected virtual void OnCellClick(DataGridViewCellEventArgs e) => CellClick?.Invoke(this, e);
    protected virtual void OnCellContentClick(DataGridViewCellEventArgs e) => CellContentClick?.Invoke(this, e);
    protected virtual void OnCellDoubleClick(DataGridViewCellEventArgs e) => CellDoubleClick?.Invoke(this, e);
    protected virtual void OnCellContentDoubleClick(DataGridViewCellEventArgs e) => CellContentDoubleClick?.Invoke(this, e);
    protected virtual void OnCellValueChanged(DataGridViewCellEventArgs e) => CellValueChanged?.Invoke(this, e);
    protected virtual void OnCellEndEdit(DataGridViewCellEventArgs e) => CellEndEdit?.Invoke(this, e);
    protected virtual void OnSelectionChanged(EventArgs e) => SelectionChanged?.Invoke(this, e);
    protected virtual void OnCurrentCellChanged(EventArgs e) => CurrentCellChanged?.Invoke(this, e);

    public void BeginInit() => _initializing = true;

    public void EndInit()
    {
        _initializing = false;
        LayoutChanged();
    }

    public void ClearSelection() => SelectionChangedInternal(raise: true, clear: true);

    public void SelectAll()
    {
        for (var i = 0; i < _rows.Count; i++) _selectedRows.Add(i);
        SelectionChangedInternal(raise: true);
    }

    public bool EndEdit() => true;
    public bool CancelEdit() => true;
    public bool BeginEdit(bool selectAll) => false;
    public void AutoResizeColumns() { }
    public void AutoResizeColumns(DataGridViewAutoSizeColumnsMode mode) { }
    public void AutoResizeRows() { }

    // ---------- 绑定 ----------

    private void Bind()
    {
        if (_view != null) _view.ListChanged -= OnListChanged;
        _view = _dataSource switch
        {
            DataView view => view,
            DataTable table => table.DefaultView,
            DataSet set when !string.IsNullOrEmpty(_dataMember) && set.Tables.Contains(_dataMember) => set.Tables[_dataMember]!.DefaultView,
            null => null,
            DataSet => null,
            _ => throw new ArgumentException("复杂的 DataBinding 接受 IList 或 IListSource 作为数据源：平台支持 DataTable、DataView 和 DataSet。"),
        };
        if (_view != null)
        {
            _view.ListChanged += OnListChanged;
            if (AutoGenerateColumns)
            {
                Columns.ReplaceAll(_view.Table!.Columns.Cast<DataColumn>().Select(column => (DataGridViewColumn)(column.DataType == typeof(bool)
                    ? new DataGridViewCheckBoxColumn { Name = column.ColumnName, HeaderText = column.ColumnName, DataPropertyName = column.ColumnName, ValueType = column.DataType }
                    : new DataGridViewTextBoxColumn { Name = column.ColumnName, HeaderText = column.ColumnName, DataPropertyName = column.ColumnName, ValueType = column.DataType })));
            }
        }
        else if (_dataSource == null && AutoGenerateColumns)
        {
            Columns.ReplaceAll(Columns.Where(c => string.IsNullOrEmpty(c.DataPropertyName)).ToList());
        }
        RebuildBoundRows();
        _currentCell = _rows.Count > 0 && Columns.Count > 0 && !_rows[0].IsNewRow ? (0, 0) : null;
        _selectedRows.Clear();
        if (_currentCell != null && _selectionMode == DataGridViewSelectionMode.FullRowSelect) _selectedRows.Add(0);
        LayoutChanged();
        DataSourceChanged?.Invoke(this, EventArgs.Empty);
        DataBindingComplete?.Invoke(this, EventArgs.Empty);
    }

    private void OnListChanged(object? sender, ListChangedEventArgs e)
    {
        RebuildBoundRows();
        RowsChanged();
    }

    private void RebuildBoundRows()
    {
        if (_view == null)
        {
            if (_dataSource != null) _rows.Clear();
            UpdateNewRow();
            return;
        }
        _rows.Clear();
        for (var i = 0; i < _view.Count; i++) _rows.Add(new DataGridViewRow { Grid = this, RowView = _view[i], Index = i });
        UpdateNewRow();
    }

    /// <summary>最下面供用户新增的空行（AllowUserToAddRows 且没有只读）</summary>
    private void UpdateNewRow()
    {
        _rows.RemoveAll(r => r.IsNewRow);
        var allowAdd = _allowUserToAddRows && !_readOnly && Columns.Count > 0 && (_view == null ? _dataSource == null : _view.AllowNew);
        if (allowAdd) _rows.Add(new DataGridViewRow { Grid = this, IsNewRow = true, Index = _rows.Count });
        if (_currentCell is { } c && c.Row >= _rows.Count) _currentCell = null;
    }

    internal int AddUnboundRow(DataGridViewRow row)
    {
        row.Grid = this;
        var index = _rows.FindIndex(r => r.IsNewRow);
        if (index < 0) index = _rows.Count;
        _rows.Insert(index, row);
        for (var i = 0; i < _rows.Count; i++) _rows[i].Index = i;
        if (_currentCell == null && Columns.Count > 0) _currentCell = (index, 0);
        RowsChanged();
        return index;
    }

    internal void ClearUnboundRows()
    {
        _rows.RemoveAll(r => !r.IsNewRow);
        for (var i = 0; i < _rows.Count; i++) _rows[i].Index = i;
        _currentCell = null;
        _selectedRows.Clear();
        RowsChanged();
    }

    internal void RemoveRow(int index)
    {
        var row = Rows[index];
        if (row.IsNewRow) throw new InvalidOperationException("无法删除未提交的新行。");
        if (row.RowView != null) row.RowView.Delete();
        else
        {
            _rows.RemoveAt(index);
            for (var i = 0; i < _rows.Count; i++) _rows[i].Index = i;
            RowsChanged();
        }
        _selectedRows.Clear();
        if (_currentCell is { } c && c.Row >= _rows.Count) _currentCell = null;
    }

    internal void ColumnsChanged()
    {
        if (_dataSource == null) UpdateNewRow();
        LayoutChanged();
    }

    internal void RaiseCellValueChanged(int column, int row)
    {
        if (row >= 0) OnCellValueChanged(new DataGridViewCellEventArgs(column, row));
    }

    // ---------- 选择 ----------

    internal bool IsRowSelected(int row) => _selectedRows.Contains(row);

    internal bool IsCellSelected(int row, int column) =>
        _selectedRows.Contains(row) || (_selectionMode is DataGridViewSelectionMode.CellSelect or DataGridViewSelectionMode.RowHeaderSelect && _currentCell == (row, column));

    internal void SetRowSelected(int row, bool selected)
    {
        if (selected) _selectedRows.Add(row);
        else _selectedRows.Remove(row);
        SelectionChangedInternal(raise: true);
    }

    private void SetCurrentCell((int Row, int Column)? cell, bool raise)
    {
        if (cell is { } c && (c.Row < 0 || c.Row >= _rows.Count || c.Column < 0 || c.Column >= Columns.Count))
            throw new InvalidOperationException("当前单元格无法设置为不可见单元格。");
        if (_currentCell == cell) return;
        _currentCell = cell;
        if (raise) OnCurrentCellChanged(EventArgs.Empty);
    }

    private void SelectionChangedInternal(bool raise, bool clear = false)
    {
        if (clear) _selectedRows.Clear();
        NotifySelection();
        if (raise) OnSelectionChanged(EventArgs.Empty);
    }

    // ---------- 用户操作 ----------

    protected override void OnUserAction(UserAction action)
    {
        switch (action.Action)
        {
            case "cellClick":
                ClickCell(action.Row, action.Column, doubleClick: false);
                break;
            case "cellDoubleClick":
                ClickCell(action.Row, action.Column, doubleClick: true);
                break;
            case "cellEdit":
                EditCell(action.Row, action.Column, action.Value ?? "");
                break;
            default:
                base.OnUserAction(action);
                break;
        }
    }

    /// <summary>点单元格：先改变当前单元格和选中的行，再依次触发 CellClick、CellContentClick、Click（列号 -1 是行标题）</summary>
    private void ClickCell(int row, int column, bool doubleClick)
    {
        if (row < 0 || row >= _rows.Count) return;
        if (!doubleClick)
        {
            var oldCell = _currentCell;
            var newCell = (row, Math.Max(column, 0));
            if (Columns.Count > 0) SetCurrentCell(newCell, raise: true);
            var selectRow = column < 0 ? _selectionMode is DataGridViewSelectionMode.RowHeaderSelect or DataGridViewSelectionMode.FullRowSelect
                : _selectionMode == DataGridViewSelectionMode.FullRowSelect;
            var changed = oldCell != _currentCell || _selectedRows.Count != (selectRow ? 1 : 0) || (selectRow && !_selectedRows.Contains(row));
            _selectedRows.Clear();
            if (selectRow) _selectedRows.Add(row);
            if (changed) SelectionChangedInternal(raise: true);
            var args = new DataGridViewCellEventArgs(column, row);
            OnCellClick(args);
            if (column >= 0) OnCellContentClick(args);
            OnClick(EventArgs.Empty);
        }
        else
        {
            var args = new DataGridViewCellEventArgs(column, row);
            OnCellDoubleClick(args);
            if (column >= 0) OnCellContentDoubleClick(args);
            OnDoubleClick(EventArgs.Empty);
        }
    }

    /// <summary>用户改了单元格：按列的类型转换后写回（转换失败时和 WinForms 一样触发 DataError，没有处理时弹出默认的错误对话框）</summary>
    private void EditCell(int rowIndex, int column, string text)
    {
        if (_readOnly || rowIndex < 0 || rowIndex >= _rows.Count || column < 0 || column >= Columns.Count || Columns[column].ReadOnly) return;
        var row = _rows[rowIndex];
        var columnType = Columns[column].ValueType ?? (row.RowView != null ? _view!.Table!.Columns[Columns[column].DataPropertyName]?.DataType : null) ?? typeof(object);
        object? value;
        try
        {
            value = Parse(text, columnType);
        }
        catch (Exception ex) when (ex is FormatException or OverflowException or InvalidCastException or ArgumentException)
        {
            var error = new DataGridViewDataErrorEventArgs(ex, column, rowIndex, DataGridViewDataErrorContexts.Parsing | DataGridViewDataErrorContexts.Commit);
            if (DataError != null) DataError(this, error);
            else MessageBox.Show($"DataGridView 中发生以下异常:\n\n{ex.GetType().FullName}: {ex.Message}\n\n若要替换此默认对话框，请处理 DataError 事件。", "DataGridView 默认错误对话框");
            RowsChanged();
            return;
        }

        if (row.IsNewRow)
        {
            if (_view != null)
            {
                // 在新行里输入：向绑定的 DataTable 加一行
                var added = _view.AddNew();
                added[Columns[column].DataPropertyName] = value ?? DBNull.Value;
                added.EndEdit();
            }
            else
            {
                var newRow = new DataGridViewRow();
                AddUnboundRow(newRow);
                newRow.SetValue(column, value, fromUser: true);
            }
            rowIndex = _rows.Count - (_rows.Any(r => r.IsNewRow) ? 2 : 1);
        }
        else
        {
            row.SetValue(column, value, fromUser: true);
        }
        RowsChanged();
        var args = new DataGridViewCellEventArgs(column, rowIndex);
        OnCellValueChanged(args);
        OnCellEndEdit(args);
    }

    private static object? Parse(string text, Type type)
    {
        if (text.Length == 0) return type == typeof(string) || type == typeof(object) ? text : DBNull.Value;
        var target = Nullable.GetUnderlyingType(type) ?? type;
        if (target == typeof(string) || target == typeof(object)) return text;
        if (target == typeof(bool)) return text is "True" or "true" or "1";
        return Convert.ChangeType(text, target, CultureInfo.CurrentCulture);
    }

    // ---------- 显示 ----------

    /// <summary>单元格显示的文字：和 WinForms 一样按当前区域格式化（日期显示为 2024/1/16 9:05:03）</summary>
    internal static string Format(object? value) => value switch
    {
        null or DBNull => "",
        byte[] => "",
        IFormattable f => f.ToString(null, CultureInfo.CurrentCulture),
        _ => value.ToString() ?? "",
    };

    internal void LayoutChanged()
    {
        if (_initializing) return;
        NotifyChanged("Columns", ColumnsJson());
        RowsChanged();
    }

    /// <summary>行有变化：攒到这一轮消息处理结束时一起发给浏览器（避免逐行修改时发很多次）</summary>
    internal void RowsChanged()
    {
        if (_initializing || !IsAttached) return;
        if (_rowsDirty) return;
        _rowsDirty = true;
        SimHost.Ui.Post(() =>
        {
            _rowsDirty = false;
            NotifyChanged("Rows", RowsJson());
            NotifySelection();
        });
    }

    private void NotifySelection()
    {
        NotifyChanged("CurrentCell", _currentCell is { } c ? new[] { c.Row, c.Column } : null);
        NotifyChanged("SelectedRows", _selectedRows.Order().ToArray());
    }

    private JsonArray ColumnsJson()
    {
        var columns = new JsonArray();
        foreach (var column in Columns)
        {
            columns.Add(new JsonObject
            {
                ["name"] = column.Name,
                ["header"] = column.HeaderText,
                ["width"] = column.Width,
                ["visible"] = column.Visible,
                ["readOnly"] = column.ReadOnly || _readOnly,
                ["check"] = column.IsCheckBox,
                ["fill"] = column.AutoSizeMode == DataGridViewAutoSizeColumnMode.Fill || (column.AutoSizeMode == DataGridViewAutoSizeColumnMode.NotSet && _autoSizeColumnsMode == DataGridViewAutoSizeColumnsMode.Fill),
            });
        }
        return columns;
    }

    private JsonObject RowsJson()
    {
        var rows = new JsonArray();
        foreach (var row in _rows.Take(MaxRowsSent))
        {
            var cells = new JsonArray();
            for (var i = 0; i < Columns.Count; i++)
            {
                var value = row.GetValue(i);
                cells.Add(Columns[i].IsCheckBox ? JsonValue.Create(value is true) : JsonValue.Create(Format(value)));
            }
            rows.Add(new JsonObject { ["cells"] = cells, ["isNew"] = row.IsNewRow });
        }
        return new JsonObject { ["items"] = rows, ["total"] = _rows.Count, ["height"] = RowTemplate.Height };
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Columns"] = ColumnsJson();
        props["Rows"] = RowsJson();
        props["CurrentCell"] = _currentCell is { } c ? new JsonArray(c.Row, c.Column) : null;
        props["SelectedRows"] = PropValue.From(_selectedRows.Order().ToArray());
        props["RowHeadersVisible"] = _rowHeadersVisible;
        props["ColumnHeadersVisible"] = _columnHeadersVisible;
        props["ReadOnly"] = _readOnly;
        props["BackgroundColor"] = PropValue.ColorCss(_backgroundColor);
        props["SelectionMode"] = _selectionMode.ToString();
    }
}
