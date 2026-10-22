using System;
using System.Drawing;
using System.IO;
using System.Threading;
using Sim.Host;

namespace DeviceCtrlLibrary;

/// <summary>摄像头每拍到一帧画面时触发（教材 dll 里的委托名就是 CameraImage）</summary>
public delegate void CameraImage(ImageReadEvenArgs e);

public class ImageEventArgs : EventArgs { }

/// <summary>摄像头画面事件的参数；类名拼写与教材 dll 一致（EvenArgs）</summary>
public class ImageReadEvenArgs
{
    public ImageEventArgs ImageEventArg { get; set; }
    public Image img { get; set; }
}

/// <summary>
/// 网络摄像机。画面是自绘的东围墙场景（Camera/scene.svg 切出的帧）：Pan 方法每次转动一格，
/// 实训台的红外对射被遮挡时画面里出现翻墙的人。和教材仿真版一样，ImageRead 在后台线程上定时触发。
/// </summary>
public class IPCameraHelper
{
    // 与 Camera/build-frames.ts 一致：左右 7 档、上下 3 档，开始时在正中
    private const int StepsX = 7;
    private const int StepsY = 3;
    private const int FrameIntervalMs = 250;

    private static readonly string FramesDir = Path.Combine(Path.GetDirectoryName(typeof(IPCameraHelper).Assembly.Location)!, "Camera", "frames");
    private static readonly Image?[] Frames = new Image?[StepsX * StepsY * 2];

    private readonly object _lock = new();
    private string? _ip;
    private Timer? _timer;
    private int _x = StepsX / 2;
    private int _y = StepsY / 2;
    private int _ticking;
    private bool _errorReported;

    public event CameraImage ImageRead;

    /// <summary>连接摄像机。任何非空的 IP 都能连上（教材用 admin、空密码）</summary>
    public void Open(string IpAdderss, string Uid, string Pwd) => _ip = IpAdderss;

    /// <summary>开始传送画面；没有 Open 时不传</summary>
    public void Start()
    {
        if (string.IsNullOrWhiteSpace(_ip)) return;
        lock (_lock)
        {
            _timer ??= new Timer(_ => Tick());
            _timer.Change(0, FrameIntervalMs);
        }
        SimHost.SendDevice("camera", "on", true);
    }

    public void Stop()
    {
        lock (_lock) _timer?.Change(Timeout.Infinite, Timeout.Infinite);
        SimHost.SendDevice("camera", "on", false);
    }

    public void Close()
    {
        Stop();
        _ip = null;
    }

    public void PanLeft() => Pan(-1, 0);
    public void PanRight() => Pan(1, 0);
    public void PanUp() => Pan(0, -1);
    public void PanDown() => Pan(0, 1);

    /// <summary>云台转动一格，到头后不再转；没有 Open 时无效</summary>
    private void Pan(int dx, int dy)
    {
        if (string.IsNullOrWhiteSpace(_ip)) return;
        int x, y;
        lock (_lock)
        {
            _x = Math.Clamp(_x + dx, 0, StepsX - 1);
            _y = Math.Clamp(_y + dy, 0, StepsY - 1);
            (x, y) = (_x, _y);
        }
        SimHost.SendDevice("camera", "pan", new[] { x, y });
    }

    private void Tick()
    {
        // 上一帧的处理方法还没执行完时跳过这一帧
        if (Interlocked.Exchange(ref _ticking, 1) == 1) return;
        try
        {
            var handler = ImageRead;
            if (handler == null) return;
            int x, y;
            lock (_lock) (x, y) = (_x, _y);
            handler(new ImageReadEvenArgs { ImageEventArg = new ImageEventArgs(), img = Frame(x, y, TrainingBoard.ReadDigital(3)) });
        }
        catch (Exception ex)
        {
            // 教材仿真版用 System.Timers.Timer，处理方法里的异常不会让程序退出；这里报告一次，之后照常传画面
            if (!_errorReported)
            {
                _errorReported = true;
                SimHost.ReportException(ex);
            }
        }
        finally
        {
            Volatile.Write(ref _ticking, 0);
        }
    }

    /// <summary>同一位置的画面复用同一个 Image 对象：赋给 PictureBox 的是同一张图时不用重新发送</summary>
    private static Image Frame(int x, int y, bool intruder)
    {
        var index = (y * StepsX + x) * 2 + (intruder ? 1 : 0);
        lock (Frames)
        {
            return Frames[index] ??= Image.FromStream(new MemoryStream(File.ReadAllBytes(Path.Combine(FramesDir, $"{x}-{y}-{(intruder ? 1 : 0)}.jpg"))));
        }
    }
}
