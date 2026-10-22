using System.ComponentModel;
using Sim.Host;

namespace System.Windows.Forms;

/// <summary>窗体定时器：Tick 事件总是在界面线程上触发，上一次 Tick 处理完之前不会重复排队</summary>
public class Timer : Component
{
    private System.Threading.Timer? _timer;
    private int _interval = 100;
    private bool _enabled;
    private int _tickQueued;

    public Timer() { }

    public Timer(IContainer container) : this() => container.Add(this);

    public int Interval
    {
        get => _interval;
        set
        {
            if (value < 1) throw new ArgumentOutOfRangeException(nameof(value), $"值“{value}”对于 Interval 无效。Interval 必须大于 0。");
            _interval = value;
            if (_enabled) _timer?.Change(value, value);
        }
    }

    public bool Enabled
    {
        get => _enabled;
        set
        {
            if (_enabled == value) return;
            _enabled = value;
            if (value)
            {
                _timer ??= new System.Threading.Timer(_ => QueueTick());
                _timer.Change(_interval, _interval);
            }
            else
            {
                _timer?.Change(System.Threading.Timeout.Infinite, System.Threading.Timeout.Infinite);
            }
        }
    }

    public object? Tag { get; set; }

    public event EventHandler? Tick;

    public void Start() => Enabled = true;

    public void Stop() => Enabled = false;

    protected virtual void OnTick(EventArgs e) => Tick?.Invoke(this, e);

    private void QueueTick()
    {
        if (System.Threading.Interlocked.Exchange(ref _tickQueued, 1) == 1) return;
        SimHost.Ui.Post(() =>
        {
            _tickQueued = 0;
            if (_enabled) OnTick(EventArgs.Empty);
        });
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _enabled = false;
            _timer?.Dispose();
            _timer = null;
        }
        base.Dispose(disposing);
    }
}
