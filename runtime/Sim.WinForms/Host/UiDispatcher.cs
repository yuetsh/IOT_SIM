using System;
using System.Collections.Concurrent;
using System.Threading;

namespace Sim.Host;

/// <summary>
/// 模拟 WinForms 的界面线程消息循环：所有用户操作、Timer.Tick、Invoke 都排队到界面线程上依次执行。
/// </summary>
public sealed class UiDispatcher
{
    private readonly BlockingCollection<Action> _queue = new();

    public Thread? UiThread { get; private set; }

    public bool IsUiThread => Thread.CurrentThread == UiThread;

    /// <summary>由运行器在启动学生程序的线程上调用一次</summary>
    public void BindToCurrentThread() => UiThread = Thread.CurrentThread;

    public void Post(Action action) => _queue.Add(action);

    /// <summary>在界面线程上同步执行（Control.Invoke、SynchronizationContext.Send）</summary>
    public void Send(Action action)
    {
        if (IsUiThread)
        {
            action();
            return;
        }
        using var done = new ManualResetEventSlim();
        Exception? error = null;
        Post(() =>
        {
            try { action(); }
            catch (Exception ex) { error = ex; }
            finally { done.Set(); }
        });
        done.Wait();
        if (error != null) throw new System.Reflection.TargetInvocationException(error);
    }

    /// <summary>
    /// 运行消息循环，直到 <paramref name="done"/> 为真。可以嵌套：
    /// Application.Run、ShowDialog、MessageBox.Show 都会在这里等待，期间 Timer 等照常执行。
    /// </summary>
    public void RunUntil(Func<bool> done)
    {
        while (!done())
        {
            if (_queue.TryTake(out var action, 50)) Execute(action);
        }
    }

    /// <summary>处理队列里已有的消息后返回（Application.DoEvents）</summary>
    public void DoEvents()
    {
        while (_queue.TryTake(out var action)) Execute(action);
    }

    /// <summary>唤醒等待中的消息循环，让它重新检查结束条件</summary>
    public void Wake() => Post(static () => { });

    private static void Execute(Action action)
    {
        try
        {
            action();
        }
        catch (Exception ex)
        {
            // 真实 WinForms 会弹出"未经处理的异常"对话框，点"继续"后程序接着运行，这里同样继续
            SimHost.ReportException(ex);
        }
        finally
        {
            SimHost.FlushChanges();
        }
    }
}
