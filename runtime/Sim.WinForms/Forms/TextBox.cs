using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public abstract class TextBoxBase : Control
{
    private bool _multiline;
    private bool _readOnly;
    private BorderStyle _borderStyle = BorderStyle.Fixed3D;

    private protected override Color? OwnBackColor => _readOnly ? SystemColors.Control : SystemColors.Window;
    private protected override Color? OwnForeColor => SystemColors.WindowText;
    private protected override bool SupportsTransparentBackColor => false;

    public bool Multiline
    {
        get => _multiline;
        set => SetProp(ref _multiline, value, nameof(Multiline));
    }

    public bool ReadOnly
    {
        get => _readOnly;
        set => SetProp(ref _readOnly, value, nameof(ReadOnly));
    }

    public BorderStyle BorderStyle
    {
        get => _borderStyle;
        set => SetProp(ref _borderStyle, value, nameof(BorderStyle));
    }

    public int MaxLength { get; set; } = 32767;
    public bool WordWrap { get; set; } = true;
    public bool HideSelection { get; set; } = true;
    public bool Modified { get; set; }
    public int SelectionStart { get; set; }
    public int SelectionLength { get; set; }
    public int TextLength => Text.Length;

    public string[] Lines
    {
        get => Text.Replace("\r\n", "\n").Split('\n');
        set => Text = string.Join("\r\n", value);
    }

    public void AppendText(string text) => Text += text;
    public void Clear() => Text = "";
    public void SelectAll() { }
    public void Select(int start, int length) { }
    public void ScrollToCaret() { }

    protected override void OnUserAction(UserAction action)
    {
        if (action.Action == "text" && !ReadOnly)
        {
            Modified = true;
            SetTextFromUser(action.Value ?? "");
            return;
        }
        base.OnUserAction(action);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Multiline"] = _multiline;
        props["ReadOnly"] = _readOnly;
        props["BorderStyle"] = _borderStyle.ToString();
    }
}

public class TextBox : TextBoxBase
{
    private char _passwordChar;
    private bool _useSystemPasswordChar;
    private ScrollBars _scrollBars;

    protected override Size DefaultSize => new(100, 21);

    public char PasswordChar
    {
        get => _passwordChar;
        set => SetProp(ref _passwordChar, value, nameof(PasswordChar));
    }

    public bool UseSystemPasswordChar
    {
        get => _useSystemPasswordChar;
        set => SetProp(ref _useSystemPasswordChar, value, nameof(UseSystemPasswordChar));
    }

    public ScrollBars ScrollBars
    {
        get => _scrollBars;
        set => SetProp(ref _scrollBars, value, nameof(ScrollBars));
    }

    public HorizontalAlignment TextAlign { get; set; }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["PasswordChar"] = PropValue.From(_passwordChar);
        props["UseSystemPasswordChar"] = _useSystemPasswordChar;
        props["ScrollBars"] = _scrollBars.ToString();
    }
}

public enum HorizontalAlignment { Left, Right, Center }
