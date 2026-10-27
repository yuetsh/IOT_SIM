using System.Collections.Generic;
using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

/// <summary>
/// 窗体。Show() 时先触发 Load，再把整个控件树发给浏览器；Close() 依次触发 FormClosing、FormClosed。
/// </summary>
public class Form : ContainerControl
{
    // Windows 10 下可调边框窗体的标题栏和边框尺寸，Size = ClientSize + 边框
    private static readonly Size NonClientSize = new(16, 39);

    private Size _clientSize = new(284, 261);
    private FormBorderStyle _formBorderStyle = FormBorderStyle.Sizable;
    private bool _maximizeBox = true;
    private bool _minimizeBox = true;
    private bool _controlBox = true;
    private bool _loaded;
    private bool _closed;
    private bool _modal;
    private DialogResult _dialogResult;

    private protected override bool SupportsTransparentBackColor => false;

    public Form()
    {
        base.Visible = false;
    }

    internal bool IsOpenInBrowser { get; private set; }

    public override Size ClientSize
    {
        get => _clientSize;
        set
        {
            if (SetProp(ref _clientSize, value, nameof(ClientSize))) PerformLayout();
        }
    }

    public new Size Size
    {
        get => _formBorderStyle == FormBorderStyle.None ? _clientSize : _clientSize + NonClientSize;
        set => ClientSize = _formBorderStyle == FormBorderStyle.None ? value : value - NonClientSize;
    }

    public FormBorderStyle FormBorderStyle
    {
        get => _formBorderStyle;
        set => SetProp(ref _formBorderStyle, value, nameof(FormBorderStyle));
    }

    public bool MaximizeBox
    {
        get => _maximizeBox;
        set => SetProp(ref _maximizeBox, value, nameof(MaximizeBox));
    }

    public bool MinimizeBox
    {
        get => _minimizeBox;
        set => SetProp(ref _minimizeBox, value, nameof(MinimizeBox));
    }

    public bool ControlBox
    {
        get => _controlBox;
        set => SetProp(ref _controlBox, value, nameof(ControlBox));
    }

    public FormStartPosition StartPosition { get; set; } = FormStartPosition.WindowsDefaultLocation;
    public FormWindowState WindowState { get; set; }
    public bool ShowInTaskbar { get; set; } = true;
    public bool TopMost { get; set; }
    public bool KeyPreview { get; set; }
    public double Opacity { get; set; } = 1;
    public IButtonControl? AcceptButton { get; set; }
    public IButtonControl? CancelButton { get; set; }
    public Form? Owner { get; set; }
    public bool Modal => _modal;

    public DialogResult DialogResult
    {
        get => _dialogResult;
        set
        {
            _dialogResult = value;
            // 模态窗体设置 DialogResult 后自动关闭
            if (_modal && value != DialogResult.None) Close();
        }
    }

    public event EventHandler? Load;
    public event EventHandler? Shown;
    public event EventHandler? Activated;
    public event FormClosingEventHandler? FormClosing;
    public event FormClosedEventHandler? FormClosed;

    protected virtual void OnLoad(EventArgs e) => Load?.Invoke(this, e);
    protected virtual void OnShown(EventArgs e) => Shown?.Invoke(this, e);
    protected virtual void OnActivated(EventArgs e) => Activated?.Invoke(this, e);
    protected virtual void OnFormClosing(FormClosingEventArgs e) => FormClosing?.Invoke(this, e);
    protected virtual void OnFormClosed(FormClosedEventArgs e) => FormClosed?.Invoke(this, e);

    public new void Show()
    {
        if (_closed) throw new ObjectDisposedException(Name, "无法访问已释放的对象。");
        if (IsOpenInBrowser)
        {
            Visible = true;
            return;
        }
        SimHost.Ui.Send(() => Open(modal: false));
    }

    public void Show(IWin32Window? owner) => Show();

    public DialogResult ShowDialog() => ShowDialog(null);

    public DialogResult ShowDialog(IWin32Window? owner)
    {
        if (IsOpenInBrowser && Visible) throw new InvalidOperationException("窗体已可见，不能显示为模式对话框。");
        // 模态窗体关闭后不释放，可以再次 ShowDialog（Load 只在第一次触发）
        _closed = false;
        _dialogResult = DialogResult.None;
        _modal = true;
        Open(modal: true);
        // 嵌套消息循环：等到窗体关闭（或被隐藏）后 ShowDialog 才返回
        SimHost.Ui.RunUntil(() => _closed || !Visible);
        _modal = false;
        return _dialogResult == DialogResult.None ? DialogResult.Cancel : _dialogResult;
    }

    private void Open(bool modal)
    {
        if (!_loaded)
        {
            _loaded = true;
            OnLoad(EventArgs.Empty);
            if (_closed) return; // Load 里调用了 Close()
            RaiseUserControlLoad(this);
        }
        base.Visible = true;
        IsOpenInBrowser = true;
        Application.OpenFormsList.Add(this);
        SimHost.Send(new JsonObject { ["type"] = "formShown", ["form"] = Snapshot(), ["modal"] = modal });
        OnShown(EventArgs.Empty);
        OnActivated(EventArgs.Empty);
    }

    private static void RaiseUserControlLoad(Control parent)
    {
        foreach (var child in parent.Controls)
        {
            if (child is UserControl userControl) userControl.RaiseLoadOnce();
            RaiseUserControlLoad(child);
        }
    }

    public void Close() => CloseCore(CloseReason.UserClosing);

    internal void CloseCore(CloseReason reason)
    {
        if (_closed) return;
        if (!IsOpenInBrowser)
        {
            _closed = true;
            return;
        }
        var closing = new FormClosingEventArgs(reason, false);
        OnFormClosing(closing);
        if (closing.Cancel) return;
        _closed = true;
        if (_modal && _dialogResult == DialogResult.None) _dialogResult = DialogResult.Cancel;
        OnFormClosed(new FormClosedEventArgs(reason));
        IsOpenInBrowser = false;
        Application.OpenFormsList.Remove(this);
        SimHost.Send(new JsonObject { ["type"] = "formClosed", ["formId"] = SimId });
        SimHost.Ui.Wake();
        if (!_modal) Dispose();
    }

    internal bool IsClosed => _closed;

    public void Activate() { }

    public void CenterToScreen() { }

    protected override void OnUserAction(UserAction action)
    {
        if (action.Action == "close")
        {
            CloseCore(CloseReason.UserClosing);
            return;
        }
        base.OnUserAction(action);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Size"] = PropValue.From(Size);
        props["ClientSize"] = PropValue.From(_clientSize);
        props["FormBorderStyle"] = _formBorderStyle.ToString();
        props["MaximizeBox"] = _maximizeBox;
        props["MinimizeBox"] = _minimizeBox;
        props["ControlBox"] = _controlBox;
        props["StartPosition"] = StartPosition.ToString();
    }
}
