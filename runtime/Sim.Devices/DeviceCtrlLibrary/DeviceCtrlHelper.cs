using System;
using System.Collections.Generic;
using System.Linq;
using DeviceCtrlLibrary.Model;
using Sim.Host;

namespace DeviceCtrlLibrary;

/// <summary>
/// 教材的设备控制入口：DeviceCtrlHelper.ledHelper.SendLedString(...) 等。
/// 返回值约定与教材仿真版 dll 保持一致；不同之处是数值来自虚拟实训台，而不是随机数，
/// 并且和真机版一样，设备要在它接的那个串口上打开才有反应（接线见 TrainingBoard）。
/// </summary>
public class DeviceCtrlHelper
{
    // 教材 dll 里这些是公开静态字段（不是属性），这里保持一致
    public static SerialPortHelper serialPortHelper = new();
    public static LEDHelper ledHelper = new();
    public static ADAM4017Helper adam4017Helper = new();
    public static ADAM4150Helper adam4150Helper = new();
    public static ZigBeeHelper zigBeeHelper = new();
    public static IPCameraHelper ipCameraHelper = new();
}

/// <summary>
/// 告诉实训台程序在哪个串口上打开、关闭了设备，以及串口没打开时还在读写设备（网页上据此提示）。
/// 没变就不发：书上有在定时器里反复 Open 的写法；没打开时的读写每次打开之后最多报一次
/// </summary>
internal static class PortReport
{
    private static readonly HashSet<string> Unopened = new();

    public static string? Open(string device, string? current, string? portName)
    {
        lock (Unopened) Unopened.Remove(device);
        if (current != portName) SimHost.SendDevice(device, "open", portName ?? "");
        return portName;
    }

    public static string? Close(string device, string? current)
    {
        if (current is not null) SimHost.SendDevice(device, "close", null);
        return null;
    }

    /// <summary>串口没打开（portName 为空）时返回 true，并报告一次</summary>
    public static bool NotOpen(string device, string? portName)
    {
        if (!string.IsNullOrWhiteSpace(portName)) return false;
        bool first;
        lock (Unopened) first = Unopened.Add(device);
        if (first) SimHost.SendDevice(device, "unopened", null);
        return true;
    }
}

public class SerialPortHelper
{
    private string? _portName;
    private int _baudRate;

    public void Open(string portName, int BaudRate)
    {
        _portName = portName;
        _baudRate = BaudRate;
    }

    /// <summary>返回一串十六进制字节（大写、空格分隔、末尾带空格），未打开时返回 "Error"</summary>
    public string GetStringData()
    {
        if (string.IsNullOrWhiteSpace(_portName) || _baudRate == 0) return "Error";
        var bytes = new byte[27];
        Random.Shared.NextBytes(bytes);
        return string.Concat(bytes.Select(b => $"{b:X2} "));
    }

    public void Close() => _portName = null;
}

public class LEDHelper
{
    private const string SendFailed = "Error:发送失败";
    private string? _portName;

    public void OpenLedCom(string portName) => _portName = PortReport.Open("led", _portName, portName);

    /// <summary>
    /// 成功时原样返回发送的文字，并显示到实训台的 LED 屏上；串口未打开时返回 "Error:发送失败"。
    /// 打开的串口上没接 LED 屏时和真机一样也原样返回（真机只管发出去、不等回应），只是屏上不显示
    /// </summary>
    public string SendLedString(string sendString)
    {
        if (PortReport.NotOpen("led", _portName)) return SendFailed;
        if (TrainingBoard.Reaches("led", _portName)) SimHost.SendDevice("led", "text", sendString);
        return sendString;
    }

    /// <summary>教材 dll 里没有这个方法，但书上项目 2 任务 3 调用了它；保留它让书上代码能编译</summary>
    public void Close() => _portName = PortReport.Close("led", _portName);
}

public class ADAM4017Helper
{
    private string? _portName;
    private int[] _channels = { 0, 1, 2, 3, 4, 5, 6 };

    public void Open(string PortName, int Temperature_Port = 0, int Humidity_Port = 1, int Light_Port = 2,
        int AirPressure_Port = 3, int AirQuality_Port = 4, int CO2_Port = 5, int Wind_Port = 6)
    {
        _portName = PortReport.Open("adam4017", _portName, PortName);
        _channels = new[] { Temperature_Port, Humidity_Port, Light_Port, AirPressure_Port, AirQuality_Port, CO2_Port, Wind_Port };
    }

    /// <summary>
    /// 读取各通道数值。数值一律是整数字符串（教材项目 7 用 Convert.ToInt16 转换，带小数会出错）；
    /// 串口未打开时所有属性为 null，与教材仿真版一致；打开的串口上没接 4017+ 时收不到回应，和真机版一样也全是 null。
    /// </summary>
    public ADAM4017ResModel SetData()
    {
        LegacyThreads.CheckPoint();
        var model = new ADAM4017ResModel();
        if (PortReport.NotOpen("adam4017", _portName) || !TrainingBoard.Reaches("adam4017", _portName)) return model;
        model.temperatureValue = Read(0);
        model.humidityValue = Read(1);
        model.lightValue = Read(2);
        model.airPressureValue = Read(3);
        model.airQualityValue = Read(4);
        model.CO2Value = Read(5);
        model.windValue = Read(6);
        return model;
    }

    private string Read(int quantity) => TrainingBoard.ReadAnalog(_channels[quantity]).ToString();

    public void Close() => _portName = PortReport.Close("adam4017", _portName);
}

public class ADAM4150Helper
{
    private string? _portName;
    private int[] _channels = { 0, 1, 2, 3 };

    public void Open(string PortName, int BodyInfrared_Port = 0, int Fire_Port = 1, int Smoke_Port = 2, int Infrared_Port = 3)
    {
        _portName = PortReport.Open("adam4150", _portName, PortName);
        _channels = new[] { BodyInfrared_Port, Fire_Port, Smoke_Port, Infrared_Port };
    }

    /// <summary>读取人体红外、火焰、烟雾、红外对射；串口未打开、或打开的串口上没接 4150（收不到回应）时全部为 false</summary>
    public ADAM4150ResModel SetData()
    {
        LegacyThreads.CheckPoint();
        var model = new ADAM4150ResModel();
        if (PortReport.NotOpen("adam4150", _portName) || !TrainingBoard.Reaches("adam4150", _portName)) return model;
        model.bodyInfraredValue = Read(0);
        model.fireValue = Read(1);
        model.smokeValue = Read(2);
        model.infraredValue = Read(3);
        return model;
    }

    private bool Read(int sensor) => TrainingBoard.ReadDigital(_channels[sensor]);

    /// <summary>
    /// 控制继电器 DO0–DO4（DO0 报警灯、DO1 照明灯、DO2 路灯、DO3/DO4 插座）。
    /// 和真实设备一样，串口没有打开时控制无效、返回 false（教材仿真版不检查，这里更贴近实物）；
    /// 真机版只管发出命令、不等回应，所以打开的串口上没接 4150 时也返回 true，只是继电器不动作。
    /// </summary>
    public bool OnOff(int DO, bool IsOpen)
    {
        if (DO < 0 || DO > 4 || PortReport.NotOpen("adam4150", _portName)) return false;
        if (TrainingBoard.Reaches("adam4150", _portName)) SimHost.SendDevice("adam4150", "do", new[] { DO, IsOpen ? 1 : 0 });
        return true;
    }

    public void Close() => _portName = PortReport.Close("adam4150", _portName);
}

public class ZigBeeHelper
{
    private string? _portName;

    public void Open(string PortName) => _portName = PortReport.Open("zigbee", _portName, PortName);

    /// <summary>
    /// 控制 ZigBee 继电器节点 0、1（教材用节点 1 控制路灯）；串口没有打开时控制无效、返回 false。
    /// 真机版要等协调器回应，打开的串口上没接协调器时收不到回应，也返回 false
    /// </summary>
    public bool OnOff(int RelayNum, bool IsOpen)
    {
        if (RelayNum < 0 || RelayNum > 1 || PortReport.NotOpen("zigbee", _portName) || !TrainingBoard.Reaches("zigbee", _portName)) return false;
        SimHost.SendDevice("zigbee", "relay", new[] { RelayNum, IsOpen ? 1 : 0 });
        return true;
    }

    public void Close() => _portName = PortReport.Close("zigbee", _portName);
}
