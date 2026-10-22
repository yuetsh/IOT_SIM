using System;
using System.ComponentModel;

namespace System.Windows.Forms;

public class MouseEventArgs : EventArgs
{
    public MouseEventArgs(MouseButtons button, int clicks, int x, int y, int delta)
    {
        Button = button;
        Clicks = clicks;
        X = x;
        Y = y;
        Delta = delta;
    }

    public MouseButtons Button { get; }
    public int Clicks { get; }
    public int X { get; }
    public int Y { get; }
    public int Delta { get; }
    public System.Drawing.Point Location => new(X, Y);
}

public delegate void MouseEventHandler(object? sender, MouseEventArgs e);

public class FormClosingEventArgs : CancelEventArgs
{
    public FormClosingEventArgs(CloseReason closeReason, bool cancel) : base(cancel) => CloseReason = closeReason;

    public CloseReason CloseReason { get; }
}

public delegate void FormClosingEventHandler(object? sender, FormClosingEventArgs e);

public class FormClosedEventArgs : EventArgs
{
    public FormClosedEventArgs(CloseReason closeReason) => CloseReason = closeReason;

    public CloseReason CloseReason { get; }
}

public delegate void FormClosedEventHandler(object? sender, FormClosedEventArgs e);
