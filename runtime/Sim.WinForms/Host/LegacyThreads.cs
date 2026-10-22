using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;

namespace Sim.Host;

/// <summary>
/// 教材项目 5 用到的旧版线程 API：Thread.Suspend / Resume / Abort 在新版 .NET 上会抛出 PlatformNotSupportedException。
/// 编译时把学生代码里对它们（以及 new Thread、Thread.Sleep、ThreadState）的调用改写成这里的方法（见 Sim.Runner/LegacyThreadRewriter.cs）。
/// <para>
/// 新版 .NET 不能从外部强行停住或中止一个线程，所以这里是"协作式"的：被挂起或中止的线程在下一个检查点停下或结束。
/// 检查点是 Thread.Sleep、从后台线程修改控件属性、调用设备类库、弹出提示框，
/// 教材里的线程方法每次循环都会经过它们，看到的效果和 .NET Framework 一致。
/// </para>
/// </summary>
[EditorBrowsable(EditorBrowsableState.Never)]
public static class LegacyThreads
{
    private sealed class State
    {
        public volatile bool Suspended;
        public volatile bool AbortRequested;
    }

    // 线程少、操作不频繁，用一把锁保护所有线程的状态；挂起和休眠都在这把锁上等待
    private static readonly object Gate = new();
    private static readonly ConditionalWeakTable<Thread, State> States = new();

    /// <summary>当前线程是学生用 new Thread 创建的线程时，指向它的状态</summary>
    [ThreadStatic] private static State? _current;

    private static State StateOf(Thread thread) => States.GetValue(thread, static _ => new State());

    // ---------- 改写后的调用 ----------

    /// <summary>new Thread(GetData) → new Thread(Wrap(new ThreadStart(GetData)))：线程被中止时安静地结束</summary>
    public static ThreadStart Wrap(ThreadStart start) => () => RunThread(() => start());

    public static ParameterizedThreadStart Wrap(ParameterizedThreadStart start) => obj => RunThread(() => start(obj));

    private static void RunThread(Action body)
    {
        var state = StateOf(Thread.CurrentThread);
        _current = state;
        try
        {
            // 启动前就被 Abort 的线程（.NET Framework 里启动后立即结束）
            CheckPoint(state);
            body();
        }
        catch (ThreadAbortedException)
        {
            // 和 .NET Framework 一样，被中止的线程结束时不算未处理的异常
        }
    }

    public static void Suspend(Thread thread)
    {
        lock (Gate)
        {
            if ((thread.ThreadState & (ThreadState.Unstarted | ThreadState.Stopped)) != 0)
                throw new ThreadStateException("线程没有在运行，无法挂起。");
            StateOf(thread).Suspended = true;
        }
        // 线程挂起自己：立即停下，直到别的线程调用 Resume
        if (thread == Thread.CurrentThread) CheckPoint(StateOf(thread));
    }

    public static void Resume(Thread thread)
    {
        lock (Gate)
        {
            var state = StateOf(thread);
            if (!state.Suspended) throw new ThreadStateException("线程没有被挂起，无法继续（Resume 只能用在调用过 Suspend 的线程上）。");
            state.Suspended = false;
            Monitor.PulseAll(Gate);
        }
    }

    public static void Abort(Thread thread) => Abort(thread, null);

    public static void Abort(Thread thread, object? stateInfo)
    {
        lock (Gate)
        {
            if ((thread.ThreadState & ThreadState.Stopped) != 0) return;
            var state = StateOf(thread);
            state.AbortRequested = true;
            // 正在 Thread.Sleep 的线程立即醒来结束
            Monitor.PulseAll(Gate);
            // .NET Framework 不能直接中止挂起的线程：抛出异常，等它被 Resume 后才结束
            if (state.Suspended) throw new ThreadStateException("线程已挂起，不能直接终止。先调用 Resume() 让线程继续，再调用 Abort()。");
        }
        if (thread == Thread.CurrentThread) throw new ThreadAbortedException();
    }

    /// <summary>thd.ThreadState：在真实状态上加上挂起、请求中止</summary>
    public static ThreadState GetThreadState(Thread thread)
    {
        var actual = thread.ThreadState;
        if (!States.TryGetValue(thread, out var state) || (actual & ThreadState.Stopped) != 0) return actual;
        var result = actual & (ThreadState.Background | ThreadState.Unstarted);
        if (state.Suspended) result |= ThreadState.Suspended;
        else if ((actual & ThreadState.Unstarted) == 0) result |= actual & ThreadState.WaitSleepJoin;
        if (state.AbortRequested) result |= ThreadState.AbortRequested;
        return result;
    }

    public static void Sleep(int millisecondsTimeout)
    {
        var state = _current;
        if (state == null)
        {
            Thread.Sleep(millisecondsTimeout);
            return;
        }
        if (millisecondsTimeout < Timeout.Infinite) throw new ArgumentOutOfRangeException(nameof(millisecondsTimeout), "休眠时间不能是负数（-1 表示一直休眠）。");
        CheckPoint(state);
        var deadline = Environment.TickCount64 + millisecondsTimeout;
        lock (Gate)
        {
            // 休眠中被 Abort 时提前醒来；被 Suspend 的线程睡完后在检查点停下
            while (!state.AbortRequested)
            {
                if (millisecondsTimeout == Timeout.Infinite)
                {
                    Monitor.Wait(Gate);
                    continue;
                }
                var remaining = deadline - Environment.TickCount64;
                if (remaining <= 0) break;
                Monitor.Wait(Gate, (int)remaining);
            }
        }
        CheckPoint(state);
    }

    public static void Sleep(TimeSpan timeout) => Sleep((int)timeout.TotalMilliseconds);

    // ---------- 检查点 ----------

    /// <summary>平台内部使用：学生创建的线程在这里响应 Suspend 和 Abort（其他线程直接返回）</summary>
    public static void CheckPoint()
    {
        var state = _current;
        if (state != null) CheckPoint(state);
    }

    private static void CheckPoint(State state)
    {
        if (!state.Suspended && !state.AbortRequested) return;
        lock (Gate)
        {
            while (state.Suspended) Monitor.Wait(Gate);
            if (state.AbortRequested) throw new ThreadAbortedException();
        }
    }
}

/// <summary>线程被 Abort 时在线程里抛出（对应 .NET Framework 的 ThreadAbortException）</summary>
public sealed class ThreadAbortedException : Exception
{
    public ThreadAbortedException() : base("正在中止线程。") { }
}
