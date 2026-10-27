using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Reflection;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

/// <summary>
/// 仿真控件的基类。属性保存在本进程里；控件所在窗体显示后，属性变化以 patch 消息发给浏览器渲染。
/// Font、BackColor、ForeColor 是"环境属性"：没有显式设置时沿用父控件的值（文本框等的颜色除外，见 OwnBackColor），只把显式设置的值发给浏览器。
/// </summary>
public class Control : Component, IWin32Window
{
    private static readonly Font DefaultFontValue = new("宋体", 9F);

    private string _name = "";
    private string _text = "";
    private Point _location;
    private Size _size;
    private bool _visible = true;
    private bool _enabled = true;
    private Color _backColor;
    private Color _foreColor;
    private Font? _font;
    private bool _autoSize;
    private DockStyle _dock;
    private Padding _padding;
    private int _layoutSuspendCount;
    private Image? _backgroundImage;
    private ImageLayout _backgroundImageLayout = ImageLayout.Tile;
    private AnchorStyles _anchor = AnchorStyles.Top | AnchorStyles.Left;
    private Control? _parent;

    public Control()
    {
        SimId = SimHost.NewControlId();
        SimHost.Register(this);
        _size = DefaultSize;
        Controls = CreateControlsInstance();
    }

    public Control(string text) : this() => _text = text ?? "";

    /// <summary>平台内部使用：控件在浏览器端的编号</summary>
    [EditorBrowsable(EditorBrowsableState.Never)]
    public string SimId { get; }

    /// <summary>为 true 时，从非界面线程修改已显示控件的属性会抛出异常（和在 VS 里按 F5 调试时一致）</summary>
    public static bool CheckForIllegalCrossThreadCalls { get; set; } = true;

    public static Color DefaultBackColor => Color.FromArgb(240, 240, 240);
    public static Color DefaultForeColor => Color.Black;
    public static Font DefaultFont => DefaultFontValue;

    protected virtual Size DefaultSize => Size.Empty;

    // ---------- 层级 ----------

    public ControlCollection Controls { get; }

    protected virtual ControlCollection CreateControlsInstance() => new(this);

    public Control? Parent
    {
        get => _parent;
        set
        {
            if (value == _parent) return;
            _parent?.Controls.Remove(this);
            value?.Controls.Add(this);
        }
    }

    internal void SetParentInternal(Control? parent) => _parent = parent;

    public Form? FindForm()
    {
        for (var c = _parent; c != null; c = c._parent)
            if (c is Form form) return form;
        return null;
    }

    /// <summary>控件已经显示在浏览器里（所在窗体已打开）时，属性变化才需要发送</summary>
    internal virtual bool IsAttached
    {
        get
        {
            var root = this;
            while (root._parent != null) root = root._parent;
            return root is Form { IsOpenInBrowser: true };
        }
    }

    // ---------- 常用属性 ----------

    public string Name
    {
        get => _name;
        set => _name = value ?? "";
    }

    public virtual string Text
    {
        get => _text;
        set
        {
            LegacyThreads.CheckPoint();
            value ??= "";
            if (_text == value) return;
            EnsureThreadAccess();
            _text = value;
            NotifyChanged(nameof(Text), value);
            OnTextChanged(EventArgs.Empty);
        }
    }

    /// <summary>来自浏览器输入的文字：只修改值并触发事件，不再回传给浏览器（避免打字时光标跳动）</summary>
    internal void SetTextFromUser(string value)
    {
        if (_text == value) return;
        _text = value;
        OnTextChanged(EventArgs.Empty);
    }

    public Point Location
    {
        get => _location;
        set => SetProp(ref _location, value, nameof(Location));
    }

    public Size Size
    {
        get => _size;
        set
        {
            if (!SetProp(ref _size, value, nameof(Size))) return;
            // 大小变了：自己的停靠子控件重新排；自己是停靠的，父容器也要重新排
            PerformLayout();
            if (_dock != DockStyle.None) _parent?.PerformLayout();
        }
    }

    public int Left { get => _location.X; set => Location = new Point(value, _location.Y); }
    public int Top { get => _location.Y; set => Location = new Point(_location.X, value); }
    public int Width { get => _size.Width; set => Size = new Size(value, _size.Height); }
    public int Height { get => _size.Height; set => Size = new Size(_size.Width, value); }
    public int Right => Left + Width;
    public int Bottom => Top + Height;

    public Rectangle Bounds
    {
        get => new(_location, _size);
        set
        {
            Location = value.Location;
            Size = value.Size;
        }
    }

    public virtual Size ClientSize
    {
        get => Size;
        set => Size = value;
    }

    public bool Visible
    {
        get => _visible;
        set
        {
            if (!SetProp(ref _visible, value, nameof(Visible))) return;
            if (_dock != DockStyle.None) _parent?.PerformLayout();
            OnVisibleChanged(EventArgs.Empty);
        }
    }

    /// <summary>和 WinForms 一样：父控件（分组框、面板）禁用时子控件也是禁用的，读出 false、不响应操作；浏览器按同样的规则画成灰色</summary>
    public bool Enabled
    {
        get => _enabled && (_parent?.Enabled ?? true);
        set
        {
            var old = Enabled;
            SetProp(ref _enabled, value, nameof(Enabled));
            if (Enabled != old) OnEnabledChanged(EventArgs.Empty);
        }
    }

    /// <summary>
    /// 没有显式设置时控件自己的颜色；null 表示沿用父控件。文本框、列表框、下拉框、日期选择是白底黑字（SystemColors.Window / WindowText），
    /// 不沿用父控件：分组框设成白字时，里面的文本框还是黑字。
    /// </summary>
    private protected virtual Color? OwnBackColor => null;

    private protected virtual Color? OwnForeColor => null;

    /// <summary>能不能把 BackColor 设成透明（含半透明）：窗体、文本框、列表框、下拉框、日期选择、数据表格不行，和 WinForms 一样报错</summary>
    private protected virtual bool SupportsTransparentBackColor => true;

    public virtual Color BackColor
    {
        get => !_backColor.IsEmpty ? _backColor : OwnBackColor ?? _parent?.BackColor ?? DefaultBackColor;
        set
        {
            if (!value.IsEmpty && value.A < 255 && !SupportsTransparentBackColor) throw new ArgumentException("控件不支持透明的背景色。");
            SetProp(ref _backColor, value, nameof(BackColor));
        }
    }

    public virtual Color ForeColor
    {
        get => !_foreColor.IsEmpty ? _foreColor : OwnForeColor ?? _parent?.ForeColor ?? DefaultForeColor;
        set => SetProp(ref _foreColor, value, nameof(ForeColor));
    }

    public virtual Font Font
    {
        get => _font ?? _parent?.Font ?? DefaultFont;
        set => SetProp(ref _font, value, nameof(Font));
    }

    public virtual bool AutoSize
    {
        get => _autoSize;
        set => SetProp(ref _autoSize, value, nameof(AutoSize));
    }

    public DockStyle Dock
    {
        get => _dock;
        set
        {
            if (SetProp(ref _dock, value, nameof(Dock))) _parent?.PerformLayout();
        }
    }

    public Padding Padding
    {
        get => _padding;
        set
        {
            if (_padding.Equals(value)) return;
            _padding = value;
            PerformLayout();
        }
    }

    /// <summary>背景图片；BackgroundImageLayout 决定平铺（默认）、居中、拉伸或按比例缩放</summary>
    public virtual Image? BackgroundImage
    {
        get => _backgroundImage;
        set
        {
            LegacyThreads.CheckPoint();
            if (ReferenceEquals(_backgroundImage, value)) return;
            _backgroundImage = value;
            NotifyChanged(nameof(BackgroundImage), value);
        }
    }

    public virtual ImageLayout BackgroundImageLayout
    {
        get => _backgroundImageLayout;
        set => SetProp(ref _backgroundImageLayout, value, nameof(BackgroundImageLayout));
    }

    public AnchorStyles Anchor
    {
        get => _anchor;
        set => SetProp(ref _anchor, value, nameof(Anchor));
    }

    // 以下属性只保存值，暂不影响浏览器显示
    public int TabIndex { get; set; }
    public bool TabStop { get; set; } = true;
    public object? Tag { get; set; }
    public Padding Margin { get; set; } = new(3);
    public ImeMode ImeMode { get; set; } = ImeMode.NoControl;
    public virtual RightToLeft RightToLeft { get; set; } = RightToLeft.No;
    public virtual bool AllowDrop { get; set; }
    public bool CausesValidation { get; set; } = true;

    public bool Focused { get; private set; }

    [EditorBrowsable(EditorBrowsableState.Never)]
    public IntPtr Handle => new(int.Parse(SimId));

    public bool IsHandleCreated => IsAttached;
    public bool IsDisposed { get; private set; }

    // ---------- 事件 ----------

    public event EventHandler? Click;
    public event EventHandler? DoubleClick;
    public event MouseEventHandler? MouseClick;
    public event MouseEventHandler? MouseDown;
    public event MouseEventHandler? MouseUp;
    public event EventHandler? MouseEnter;
    public event EventHandler? MouseLeave;
    public event EventHandler? TextChanged;
    public event EventHandler? VisibleChanged;
    public event EventHandler? EnabledChanged;
    public event EventHandler? GotFocus;
    public event EventHandler? LostFocus;
    public event EventHandler? Enter;
    public event EventHandler? Leave;
    /// <summary>重绘。平台由浏览器绘制控件，不会触发这个事件（VS 双击 Panel 生成的空处理程序照常能编译）</summary>
    public event PaintEventHandler? Paint;

    protected virtual void OnClick(EventArgs e) => Click?.Invoke(this, e);
    protected virtual void OnDoubleClick(EventArgs e) => DoubleClick?.Invoke(this, e);
    protected virtual void OnMouseClick(MouseEventArgs e) => MouseClick?.Invoke(this, e);
    protected virtual void OnMouseDown(MouseEventArgs e) => MouseDown?.Invoke(this, e);
    protected virtual void OnMouseUp(MouseEventArgs e) => MouseUp?.Invoke(this, e);
    protected virtual void OnMouseEnter(EventArgs e) => MouseEnter?.Invoke(this, e);
    protected virtual void OnMouseLeave(EventArgs e) => MouseLeave?.Invoke(this, e);
    protected virtual void OnTextChanged(EventArgs e) => TextChanged?.Invoke(this, e);
    protected virtual void OnVisibleChanged(EventArgs e) => VisibleChanged?.Invoke(this, e);
    protected virtual void OnEnabledChanged(EventArgs e)
    {
        EnabledChanged?.Invoke(this, e);
        // 自己没被禁用的子控件实际状态也跟着变，同样触发 EnabledChanged（WinForms 的 OnParentEnabledChanged）
        for (var i = 0; i < Controls.Count; i++)
            if (Controls[i]._enabled) Controls[i].OnEnabledChanged(e);
    }

    protected virtual void OnGotFocus(EventArgs e) => GotFocus?.Invoke(this, e);
    protected virtual void OnLostFocus(EventArgs e) => LostFocus?.Invoke(this, e);
    protected virtual void OnPaint(PaintEventArgs e) => Paint?.Invoke(this, e);
    protected virtual void OnEnter(EventArgs e) => Enter?.Invoke(this, e);
    protected virtual void OnLeave(EventArgs e) => Leave?.Invoke(this, e);

    /// <summary>平台内部使用：在界面线程上处理浏览器上报的用户操作</summary>
    [EditorBrowsable(EditorBrowsableState.Never)]
    public void PerformUserAction(UserAction action)
    {
        if (!Enabled || !Visible) return;
        OnUserAction(action);
    }

    /// <summary>按真实 WinForms 的顺序，把一个用户操作翻译成事件</summary>
    protected virtual void OnUserAction(UserAction action)
    {
        switch (action.Action)
        {
            case "click":
                var args = new MouseEventArgs(MouseButtons.Left, 1, action.X, action.Y, 0);
                OnClick(args);
                OnMouseClick(args);
                break;
            case "doubleClick":
                OnDoubleClick(EventArgs.Empty);
                break;
            case "mouseDown":
                OnMouseDown(new MouseEventArgs(ToMouseButtons(action.Button), 1, action.X, action.Y, 0));
                break;
            case "mouseUp":
                OnMouseUp(new MouseEventArgs(ToMouseButtons(action.Button), 1, action.X, action.Y, 0));
                break;
        }
    }

    private static MouseButtons ToMouseButtons(string button) => button == "right" ? MouseButtons.Right : MouseButtons.Left;

    // ---------- 方法 ----------

    public void Show() => Visible = true;
    public void Hide() => Visible = false;
    public bool Focus() => true;
    public void Select() { }
    public void BringToFront() { }
    public void SendToBack() { }
    public void Refresh() { }
    public void Invalidate() { }
    public void Update() { }
    public void SuspendLayout() => _layoutSuspendCount++;
    public void ResumeLayout() => ResumeLayout(true);

    public void ResumeLayout(bool performLayout)
    {
        if (_layoutSuspendCount > 0) _layoutSuspendCount--;
        if (performLayout) PerformLayout();
    }

    /// <summary>
    /// 停靠布局（和 WinForms 一样）：按 Controls 集合从后往前，Top / Bottom / Left / Right 依次贴边并占掉那一条，
    /// Fill 占剩下的全部。VS 在 Designer.cs 里写的位置大小就是这样排出来的；代码里改停靠、大小、可见时重新排。
    /// </summary>
    public void PerformLayout()
    {
        if (_layoutSuspendCount > 0) return;
        var rect = DisplayRectangle;
        for (var i = Controls.Count - 1; i >= 0; i--)
        {
            var child = Controls[i];
            if (!child._visible || child._dock == DockStyle.None) continue;
            var size = child._size;
            Rectangle bounds;
            switch (child._dock)
            {
                case DockStyle.Top:
                    bounds = new Rectangle(rect.X, rect.Y, rect.Width, size.Height);
                    rect = new Rectangle(rect.X, rect.Y + size.Height, rect.Width, Math.Max(0, rect.Height - size.Height));
                    break;
                case DockStyle.Bottom:
                    bounds = new Rectangle(rect.X, rect.Bottom - size.Height, rect.Width, size.Height);
                    rect = new Rectangle(rect.X, rect.Y, rect.Width, Math.Max(0, rect.Height - size.Height));
                    break;
                case DockStyle.Left:
                    bounds = new Rectangle(rect.X, rect.Y, size.Width, rect.Height);
                    rect = new Rectangle(rect.X + size.Width, rect.Y, Math.Max(0, rect.Width - size.Width), rect.Height);
                    break;
                case DockStyle.Right:
                    bounds = new Rectangle(rect.Right - size.Width, rect.Y, size.Width, rect.Height);
                    rect = new Rectangle(rect.X, rect.Y, Math.Max(0, rect.Width - size.Width), rect.Height);
                    break;
                default:
                    bounds = rect;
                    break;
            }
            child.SetBoundsFromLayout(bounds);
        }
    }

    /// <summary>停靠布局给出的位置大小：不再反过来触发父容器的布局</summary>
    private void SetBoundsFromLayout(Rectangle bounds)
    {
        SetProp(ref _location, bounds.Location, nameof(Location));
        if (SetProp(ref _size, bounds.Size, nameof(Size))) PerformLayout();
    }

    /// <summary>容器里用来停靠子控件的区域：客户区去掉内边距（分组框、带边框的面板再去掉边框）</summary>
    public virtual Rectangle DisplayRectangle =>
        new(_padding.Left, _padding.Top, Math.Max(0, ClientSize.Width - _padding.Horizontal), Math.Max(0, ClientSize.Height - _padding.Vertical));

    public bool InvokeRequired => !SimHost.Ui.IsUiThread;

    public object? Invoke(Delegate method) => Invoke(method, Array.Empty<object>());

    public object? Invoke(Delegate method, params object?[]? args)
    {
        object? result = null;
        SimHost.Ui.Send(() => result = method.DynamicInvoke(args));
        return result;
    }

    public void Invoke(Action method) => SimHost.Ui.Send(method);

    public IAsyncResult BeginInvoke(Delegate method) => BeginInvoke(method, Array.Empty<object>());

    public IAsyncResult BeginInvoke(Delegate method, params object?[]? args)
    {
        var result = new SimpleAsyncResult();
        SimHost.Ui.Post(() =>
        {
            try { result.Value = method.DynamicInvoke(args); }
            finally { result.Complete(); }
        });
        return result;
    }

    public object? EndInvoke(IAsyncResult asyncResult)
    {
        var result = (SimpleAsyncResult)asyncResult;
        result.AsyncWaitHandle.WaitOne();
        return result.Value;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !IsDisposed)
        {
            IsDisposed = true;
            _parent?.Controls.Remove(this);
        }
        base.Dispose(disposing);
    }

    // ---------- 属性变化与快照 ----------

    /// <summary>修改字段并在需要时通知浏览器；返回值表示是否真的改变</summary>
    protected bool SetProp<T>(ref T field, T value, string prop)
    {
        // 后台线程改界面时响应 Suspend / Abort（教材的线程方法每次循环都会改控件）
        LegacyThreads.CheckPoint();
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        EnsureThreadAccess();
        field = value;
        NotifyChanged(prop, value);
        return true;
    }

    protected void NotifyChanged(string prop, object? value)
    {
        if (IsAttached) SimHost.QueueChange(this, prop, value);
    }

    protected void EnsureThreadAccess()
    {
        if (CheckForIllegalCrossThreadCalls && IsAttached && !SimHost.Ui.IsUiThread)
            throw new InvalidOperationException($"线程间操作无效: 从不是创建控件“{Name}”的线程访问它。");
    }

    /// <summary>平台内部使用：生成发给浏览器的控件树</summary>
    [EditorBrowsable(EditorBrowsableState.Never)]
    public JsonObject Snapshot()
    {
        var props = new JsonObject();
        WriteProps(props);
        var children = new JsonArray();
        foreach (var child in Controls) children.Add(child.Snapshot());
        return new JsonObject
        {
            ["id"] = SimId,
            ["type"] = ClientType,
            ["name"] = Name,
            ["props"] = props,
            ["children"] = children,
        };
    }

    /// <summary>写入浏览器渲染需要的属性；子类追加自己的属性</summary>
    protected virtual void WriteProps(JsonObject props)
    {
        props["Text"] = Text;
        props["Location"] = PropValue.From(_location);
        props["Size"] = PropValue.From(_size);
        props["Visible"] = _visible;
        props["Enabled"] = _enabled;
        props["BackColor"] = PropValue.ColorCss(_backColor);
        props["ForeColor"] = PropValue.ColorCss(_foreColor);
        props["Font"] = PropValue.From(_font);
        props["AutoSize"] = _autoSize;
        props["Dock"] = _dock.ToString();
        props["BackgroundImage"] = PropValue.From(_backgroundImage);
        props["BackgroundImageLayout"] = _backgroundImageLayout.ToString();
    }

    /// <summary>浏览器按这个类型名选择渲染方式。学生自己继承的控件按最近的仿真库基类渲染。</summary>
    private string ClientType
    {
        get
        {
            for (var type = GetType(); type != null; type = type.BaseType)
            {
                var attribute = type.GetCustomAttribute<ClientTypeAttribute>(inherit: false);
                if (attribute != null) return attribute.Name;
                if (type.Assembly == typeof(Control).Assembly) return type.Name;
            }
            return nameof(Control);
        }
    }

    private sealed class SimpleAsyncResult : IAsyncResult
    {
        private readonly System.Threading.ManualResetEvent _done = new(false);
        public object? Value { get; set; }
        public object? AsyncState => null;
        public System.Threading.WaitHandle AsyncWaitHandle => _done;
        public bool CompletedSynchronously => false;
        public bool IsCompleted { get; private set; }

        public void Complete()
        {
            IsCompleted = true;
            _done.Set();
        }
    }

    public class ControlCollection : IEnumerable<Control>
    {
        private readonly List<Control> _items = new();

        public ControlCollection(Control owner) => Owner = owner;

        public Control Owner { get; }
        public int Count => _items.Count;
        public Control this[int index] => _items[index];
        public Control? this[string key] => _items.Find(c => string.Equals(c.Name, key, StringComparison.OrdinalIgnoreCase));

        public virtual void Add(Control? value)
        {
            if (value == null || value.Parent == Owner) return;
            value.Parent?.Controls.Remove(value);
            _items.Add(value);
            value.SetParentInternal(Owner);
            if (value.Dock != DockStyle.None) Owner.PerformLayout();
            if (Owner.IsAttached)
            {
                SimHost.Send(new JsonObject
                {
                    ["type"] = "controlAdded",
                    ["parentId"] = Owner.SimId,
                    ["index"] = _items.Count - 1,
                    ["node"] = value.Snapshot(),
                });
            }
        }

        public void AddRange(Control[] controls)
        {
            foreach (var control in controls) Add(control);
        }

        public void Remove(Control? value)
        {
            if (value == null || !_items.Remove(value)) return;
            var wasAttached = Owner.IsAttached;
            value.SetParentInternal(null);
            if (value.Dock != DockStyle.None) Owner.PerformLayout();
            if (wasAttached) SimHost.Send(new JsonObject { ["type"] = "controlRemoved", ["id"] = value.SimId });
        }

        public void RemoveAt(int index) => Remove(_items[index]);

        public void Clear()
        {
            foreach (var control in _items.ToArray()) Remove(control);
        }

        public bool Contains(Control? control) => control != null && _items.Contains(control);
        public int IndexOf(Control? control) => control == null ? -1 : _items.IndexOf(control);

        public IEnumerator<Control> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}

/// <summary>仿真库内部使用：指定浏览器端的渲染类型名（教材控件库的控件用完整类名）</summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class ClientTypeAttribute : Attribute
{
    public ClientTypeAttribute(string name) => Name = name;

    public string Name { get; }
}
