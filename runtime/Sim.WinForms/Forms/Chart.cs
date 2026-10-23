using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms.DataVisualization.Charting;

public enum SeriesChartType
{
    Point, FastPoint, Bubble, Line, Spline, StepLine, FastLine, Bar, StackedBar, StackedBar100, Column, StackedColumn, StackedColumn100,
    Area, SplineArea, StackedArea, StackedArea100, Pie, Doughnut, Stock, Candlestick, Range, SplineRange, RangeBar, RangeColumn,
    Radar, Polar, ErrorBar, BoxPlot, Renko, ThreeLineBreak, Kagi, PointAndFigure, Funnel, Pyramid,
}

public enum ChartValueType { Auto, Double, Single, Int32, Int64, UInt32, UInt64, String, DateTime, Date, Time, DateTimeOffset }
public enum Docking { Top, Right, Bottom, Left }
public enum MarkerStyle { None, Square, Circle, Diamond, Triangle, Cross, Star4, Star5, Star6, Star10 }
public enum ChartColorPalette { None, Bright, Grayscale, Excel, Light, Pastel, EarthTones, SemiTransparent, Berry, Chocolate, Fire, SeaGreen, BrightPastel }
public enum StringAlignment { Near, Center, Far }

/// <summary>图表里的元素（ChartArea、Legend、Series、Title）：有名字，改动时通知所在的图表重画</summary>
public abstract class ChartNamedElement
{
    private string _name = "";

    internal Chart? Owner { get; set; }

    public string Name
    {
        get => _name;
        set
        {
            _name = value ?? "";
            Changed();
        }
    }

    public object? Tag { get; set; }

    internal void Changed() => Owner?.Invalidated();
}

/// <summary>ChartAreas、Legends、Series、Titles 共用：按序号或名字取，Add 一个对象或一个名字</summary>
public class ChartNamedElementCollection<T> : IEnumerable<T> where T : ChartNamedElement, new()
{
    private readonly List<T> _items = new();
    private readonly Chart _owner;
    private readonly string _prefix;

    internal ChartNamedElementCollection(Chart owner, string prefix)
    {
        _owner = owner;
        _prefix = prefix;
    }

    public int Count => _items.Count;
    public T this[int index] => _items[index];

    public T this[string name] =>
        FindByName(name) ?? throw new ArgumentException($"在集合中找不到名为“{name}”的图表元素。");

    public T? FindByName(string name) => _items.FirstOrDefault(i => i.Name == name);

    public void Add(T item)
    {
        if (string.IsNullOrEmpty(item.Name)) item.Name = NextName();
        item.Owner = _owner;
        _items.Add(item);
        _owner.Invalidated();
    }

    public T Add(string name)
    {
        var item = new T { Name = name };
        Add(item);
        return item;
    }

    public int IndexOf(string name) => _items.FindIndex(i => i.Name == name);
    public bool Remove(T item)
    {
        var removed = _items.Remove(item);
        _owner.Invalidated();
        return removed;
    }

    public void RemoveAt(int index)
    {
        _items.RemoveAt(index);
        _owner.Invalidated();
    }

    public void Clear()
    {
        _items.Clear();
        _owner.Invalidated();
    }

    private string NextName()
    {
        for (var i = 1; ; i++)
            if (FindByName($"{_prefix}{i}") == null) return $"{_prefix}{i}";
    }

    public IEnumerator<T> GetEnumerator() => _items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public class Axis
{
    public string Title { get; set; } = "";
    public double Minimum { get; set; } = double.NaN;
    public double Maximum { get; set; } = double.NaN;
    public double Interval { get; set; }
    public Grid MajorGrid { get; } = new();
    public LabelStyle LabelStyle { get; } = new();
    public bool IsStartedFromZero { get; set; } = true;
}

public class Grid
{
    public bool Enabled { get; set; } = true;
    public Color LineColor { get; set; } = Color.Black;
}

public class LabelStyle
{
    public string Format { get; set; } = "";
    public int Angle { get; set; }
}

public class ChartArea : ChartNamedElement
{
    public ChartArea() { }
    public ChartArea(string name) => Name = name;

    public Axis AxisX { get; } = new();
    public Axis AxisY { get; } = new();
    public Axis AxisX2 { get; } = new();
    public Axis AxisY2 { get; } = new();
    public Color BackColor { get; set; }
}

public class Legend : ChartNamedElement
{
    public Legend() { }
    public Legend(string name) => Name = name;

    public bool Enabled { get; set; } = true;
    public Docking Docking { get; set; } = Docking.Right;
    public string Title { get; set; } = "";
    public Color TitleForeColor { get; set; } = Color.Black;
    public Color BackColor { get; set; }
    public Color ForeColor { get; set; } = Color.Black;
    public StringAlignment Alignment { get; set; }
}

public class Title : ChartNamedElement
{
    private string _text = "";

    public Title() { }
    public Title(string text) => _text = text;

    public string Text
    {
        get => _text;
        set
        {
            _text = value ?? "";
            Changed();
        }
    }

    public Font? Font { get; set; }
    public Color ForeColor { get; set; } = Color.Black;
    public Docking Docking { get; set; } = Docking.Top;
}

public class DataPoint
{
    public DataPoint() { }

    public DataPoint(double xValue, double yValue)
    {
        XValue = xValue;
        YValues = new[] { yValue };
    }

    public double XValue { get; set; }
    public double[] YValues { get; set; } = { 0 };
    /// <summary>X 值是文字（如日期字符串）时显示的标签</summary>
    public string AxisLabel { get; set; } = "";
    public string Label { get; set; } = "";
    public Color Color { get; set; }
    public bool IsEmpty { get; set; }
    public string ToolTip { get; set; } = "";
}

public class DataPointCollection : IEnumerable<DataPoint>
{
    private readonly List<DataPoint> _items = new();
    private readonly Series _series;

    internal DataPointCollection(Series series) => _series = series;

    public int Count => _items.Count;
    public DataPoint this[int index] => _items[index];

    /// <summary>加一个点：X 是数字或日期时按数值，否则（如字符串）当作分类标签，和 WinForms 一样</summary>
    public int AddXY(object? xValue, params object?[] yValue)
    {
        var point = new DataPoint { YValues = yValue.Select(ToDouble).ToArray() };
        switch (xValue)
        {
            case null or DBNull:
                break;
            case DateTime d:
                point.XValue = d.ToOADate();
                point.AxisLabel = d.ToString(CultureInfo.CurrentCulture);
                break;
            case IConvertible c when xValue is not string:
                point.XValue = c.ToDouble(CultureInfo.InvariantCulture);
                break;
            default:
                point.AxisLabel = Convert.ToString(xValue, CultureInfo.CurrentCulture) ?? "";
                point.XValue = _items.Count + 1;
                break;
        }
        _items.Add(point);
        _series.Changed();
        return _items.Count - 1;
    }

    public int AddY(params object?[] yValue) => AddXY(_items.Count + 1, yValue);

    public void Add(DataPoint point)
    {
        _items.Add(point);
        _series.Changed();
    }

    public void Clear()
    {
        _items.Clear();
        _series.Changed();
    }

    public void RemoveAt(int index)
    {
        _items.RemoveAt(index);
        _series.Changed();
    }

    /// <summary>按两组值绑定：xValues 和 yValues 一一对应</summary>
    public void DataBindXY(IEnumerable xValues, params IEnumerable[] yValues)
    {
        _items.Clear();
        var xs = xValues.Cast<object?>().ToList();
        var ys = yValues.Select(y => y.Cast<object?>().ToList()).ToList();
        for (var i = 0; i < xs.Count; i++) AddXY(xs[i], ys.Select(y => i < y.Count ? y[i] : null).ToArray());
        _series.Changed();
    }

    public void DataBindY(params IEnumerable[] yValues) => DataBindXY(Enumerable.Range(1, yValues[0].Cast<object>().Count()).ToList(), yValues);

    internal static double ToDouble(object? value) => value switch
    {
        null or DBNull => double.NaN,
        DateTime d => d.ToOADate(),
        IConvertible c => double.TryParse(Convert.ToString(c, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : double.NaN,
        _ => double.NaN,
    };

    public IEnumerator<DataPoint> GetEnumerator() => _items.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public class Series : ChartNamedElement
{
    private SeriesChartType _chartType = SeriesChartType.Column;
    private string _legendText = "";
    private Color _color;

    public Series()
    {
        Points = new DataPointCollection(this);
    }

    public Series(string name) : this() => Name = name;

    public DataPointCollection Points { get; }

    public SeriesChartType ChartType
    {
        get => _chartType;
        set
        {
            _chartType = value;
            Changed();
        }
    }

    public string ChartArea { get; set; } = "";
    public string Legend { get; set; } = "";

    public string LegendText
    {
        get => _legendText;
        set
        {
            _legendText = value ?? "";
            Changed();
        }
    }

    public string XValueMember { get; set; } = "";
    public string YValueMembers { get; set; } = "";
    public ChartValueType XValueType { get; set; }
    public ChartValueType YValueType { get; set; }
    public int YValuesPerPoint { get; set; } = 1;
    public bool IsVisibleInLegend { get; set; } = true;
    public bool IsValueShownAsLabel { get; set; }
    public bool Enabled { get; set; } = true;
    public int BorderWidth { get; set; } = 1;
    public MarkerStyle MarkerStyle { get; set; }
    public int MarkerSize { get; set; } = 5;
    public Font? Font { get; set; }
    public string Label { get; set; } = "";
    public string ToolTip { get; set; } = "";

    public Color Color
    {
        get => _color;
        set
        {
            _color = value;
            Changed();
        }
    }
}

/// <summary>
/// 图表（教材项目 8 显示最近 7 天的最高温和平均温）。和 WinForms 的 Chart 一样，设置 DataSource 后调用 DataBind()
/// 按各 Series 的 XValueMember / YValueMembers 取数据，也可以用 Points.AddXY 自己加点。浏览器用 Chart.js 画。
/// </summary>
public class Chart : Control, ISupportInitialize
{
    private bool _initializing;
    private bool _dirty;

    public Chart()
    {
        ChartAreas = new ChartNamedElementCollection<ChartArea>(this, "ChartArea");
        Legends = new ChartNamedElementCollection<Legend>(this, "Legend");
        Series = new ChartNamedElementCollection<Series>(this, "Series");
        Titles = new ChartNamedElementCollection<Title>(this, "Title");
        BackColor = Color.White;
    }

    protected override Size DefaultSize => new(300, 300);

    public ChartNamedElementCollection<ChartArea> ChartAreas { get; }
    public ChartNamedElementCollection<Legend> Legends { get; }
    public ChartNamedElementCollection<Series> Series { get; }
    public ChartNamedElementCollection<Title> Titles { get; }
    public object? DataSource { get; set; }
    public ChartColorPalette Palette { get; set; } = ChartColorPalette.BrightPastel;
    public Color BorderlineColor { get; set; }
    public int BorderlineWidth { get; set; } = 1;

    public void BeginInit() => _initializing = true;

    public void EndInit()
    {
        _initializing = false;
        Invalidated();
    }

    /// <summary>按 DataSource 重新取数据：每个设置了 YValueMembers 的 Series 清空后，按行加点</summary>
    public void DataBind()
    {
        var rows = Rows(DataSource);
        foreach (var series in Series)
        {
            if (string.IsNullOrEmpty(series.YValueMembers)) continue;
            series.Points.Clear();
            var yMembers = series.YValueMembers.Split(',').Select(m => m.Trim()).ToArray();
            foreach (var row in rows)
            {
                var x = string.IsNullOrEmpty(series.XValueMember) ? null : Field(row, series.XValueMember);
                series.Points.AddXY(x ?? series.Points.Count + 1, yMembers.Select(m => Field(row, m)).ToArray());
            }
        }
        Invalidated();
    }

    private static List<object> Rows(object? source) => source switch
    {
        null => new List<object>(),
        DataSet set => set.Tables.Count > 0 ? set.Tables[0].Rows.Cast<object>().ToList() : new List<object>(),
        DataTable table => table.Rows.Cast<object>().ToList(),
        DataView view => view.Cast<object>().ToList(),
        IEnumerable list => list.Cast<object>().ToList(),
        _ => throw new ArgumentException("图表的 DataSource 要是 DataTable、DataView、DataSet 或列表。"),
    };

    private static object? Field(object row, string member)
    {
        try
        {
            return row switch
            {
                DataRow r => r[member],
                DataRowView v => v[member],
                _ => row.GetType().GetProperty(member)?.GetValue(row),
            };
        }
        catch (ArgumentException)
        {
            throw new ArgumentException($"数据源里没有名为“{member}”的列（检查 XValueMember / YValueMembers）。");
        }
    }

    /// <summary>图表内容变了：攒到这一轮消息处理结束时再发给浏览器</summary>
    internal void Invalidated()
    {
        if (_initializing || !IsAttached || _dirty) return;
        _dirty = true;
        SimHost.Ui.Post(() =>
        {
            _dirty = false;
            NotifyChanged("Chart", ChartJson());
        });
    }

    private JsonObject ChartJson()
    {
        var series = new JsonArray();
        foreach (var s in Series)
        {
            if (!s.Enabled) continue;
            var points = new JsonArray();
            foreach (var p in s.Points)
                points.Add(new JsonObject { ["x"] = p.AxisLabel.Length > 0 ? p.AxisLabel : p.XValue, ["y"] = p.YValues.Length > 0 && !double.IsNaN(p.YValues[0]) ? p.YValues[0] : null });
            series.Add(new JsonObject
            {
                ["name"] = s.Name,
                ["type"] = s.ChartType.ToString(),
                ["legend"] = s.LegendText.Length > 0 ? s.LegendText : s.Name,
                ["inLegend"] = s.IsVisibleInLegend && Legends.Count > 0 && Legends.Any(l => l.Enabled),
                ["color"] = PropValue.ColorCss(s.Color),
                ["width"] = s.BorderWidth,
                ["labels"] = s.IsValueShownAsLabel,
                ["points"] = points,
            });
        }
        var titles = new JsonArray();
        foreach (var t in Titles) titles.Add(t.Text);
        var area = ChartAreas.Count > 0 ? ChartAreas[0] : null;
        return new JsonObject
        {
            ["series"] = series,
            ["titles"] = titles,
            ["legendDocking"] = Legends.Count > 0 ? Legends[0].Docking.ToString() : "Right",
            ["yMin"] = area != null && !double.IsNaN(area.AxisY.Minimum) ? area.AxisY.Minimum : null,
            ["yMax"] = area != null && !double.IsNaN(area.AxisY.Maximum) ? area.AxisY.Maximum : null,
        };
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Chart"] = ChartJson();
    }
}
