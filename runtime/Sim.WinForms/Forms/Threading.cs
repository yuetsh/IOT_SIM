using System.Threading;
using Sim.Host;

namespace System.Windows.Forms;

public delegate void MethodInvoker();

/// <summary>界面线程的同步上下文：Send 同步执行，Post 排队执行（教材项目 8 用它从后台线程更新界面）</summary>
public sealed class WindowsFormsSynchronizationContext : SynchronizationContext
{
    public override void Send(SendOrPostCallback d, object? state) => SimHost.Ui.Send(() => d(state));

    public override void Post(SendOrPostCallback d, object? state) => SimHost.Ui.Post(() => d(state));

    public override SynchronizationContext CreateCopy() => new WindowsFormsSynchronizationContext();
}
