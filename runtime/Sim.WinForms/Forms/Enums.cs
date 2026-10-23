// WinForms 中设计器代码和教材代码会用到的枚举与结构体，取值与 .NET Framework 一致。
using System;

namespace System.Windows.Forms;

public enum AutoScaleMode { None, Font, Dpi, Inherit }

public enum FormBorderStyle { None, FixedSingle, Fixed3D, FixedDialog, Sizable, FixedToolWindow, SizableToolWindow }

public enum FormStartPosition { Manual, CenterScreen, WindowsDefaultLocation, WindowsDefaultBounds, CenterParent }

public enum FormWindowState { Normal, Minimized, Maximized }

public enum DialogResult { None, OK, Cancel, Abort, Retry, Ignore, Yes, No, TryAgain = 10, Continue = 11 }

public enum MessageBoxButtons { OK, OKCancel, AbortRetryIgnore, YesNoCancel, YesNo, RetryCancel, CancelTryContinue }

public enum MessageBoxIcon
{
    None = 0,
    Hand = 16,
    Stop = 16,
    Error = 16,
    Question = 32,
    Exclamation = 48,
    Warning = 48,
    Asterisk = 64,
    Information = 64,
}

public enum MessageBoxDefaultButton { Button1 = 0, Button2 = 256, Button3 = 512, Button4 = 768 }

public enum FlatStyle { Flat, Popup, Standard, System }

public enum BorderStyle { None, FixedSingle, Fixed3D }

public enum ScrollBars { None, Horizontal, Vertical, Both }

public enum ComboBoxStyle { Simple, DropDown, DropDownList }

public enum DockStyle { None, Top, Bottom, Left, Right, Fill }

[Flags]
public enum AnchorStyles { None = 0, Top = 1, Bottom = 2, Left = 4, Right = 8 }

public enum ImeMode { Inherit = -1, NoControl = 0, On = 1, Off = 2, Disable = 3 }

public enum RightToLeft { No, Yes, Inherit }

[Flags]
public enum MouseButtons { None = 0, Left = 0x100000, Right = 0x200000, Middle = 0x400000, XButton1 = 0x800000, XButton2 = 0x1000000 }

public enum CloseReason { None, WindowsShutDown, MdiFormClosing, UserClosing, TaskManagerClosing, FormOwnerClosing, ApplicationExitCall }

public struct Padding : IEquatable<Padding>
{
    public static readonly Padding Empty = new(0);

    public Padding(int all) : this(all, all, all, all) { }

    public Padding(int left, int top, int right, int bottom)
    {
        Left = left;
        Top = top;
        Right = right;
        Bottom = bottom;
    }

    public int Left { get; set; }
    public int Top { get; set; }
    public int Right { get; set; }
    public int Bottom { get; set; }
    public int All
    {
        get => Left == Top && Top == Right && Right == Bottom ? Left : -1;
        set => Left = Top = Right = Bottom = value;
    }
    public int Horizontal => Left + Right;
    public int Vertical => Top + Bottom;

    public bool Equals(Padding other) => Left == other.Left && Top == other.Top && Right == other.Right && Bottom == other.Bottom;
    public override bool Equals(object? obj) => obj is Padding other && Equals(other);
    public override int GetHashCode() => HashCode.Combine(Left, Top, Right, Bottom);
    public static bool operator ==(Padding a, Padding b) => a.Equals(b);
    public static bool operator !=(Padding a, Padding b) => !a.Equals(b);
    public override string ToString() => $"{{Left={Left},Top={Top},Right={Right},Bottom={Bottom}}}";
}

/// <summary>窗口句柄接口；MessageBox.Show(owner, ...) 的 owner 参数类型</summary>
public interface IWin32Window
{
    IntPtr Handle { get; }
}

public interface IButtonControl
{
    DialogResult DialogResult { get; set; }
    void NotifyDefault(bool value);
    void PerformClick();
}
public enum LeftRightAlignment { Left, Right }
