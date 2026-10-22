using System.ComponentModel;

namespace System.IO.Ports;

/// <summary>
/// 学生代码只用 SerialPort.GetPortNames() 填下拉框，设备读写都走 DeviceCtrlHelper。
/// 这里返回实训台上的虚拟串口；直接读写串口不在教学范围内，调用时给出提示。
/// </summary>
public class SerialPort : Component
{
    /// <summary>COM1 是电脑自带串口，COM2–COM5 对应实训台上的 4017、4150、ZigBee 协调器和 LED 屏</summary>
    private static readonly string[] VirtualPorts = { "COM1", "COM2", "COM3", "COM4", "COM5" };

    public SerialPort() { }

    public SerialPort(string portName) => PortName = portName;

    public SerialPort(string portName, int baudRate) : this(portName) => BaudRate = baudRate;

    public static string[] GetPortNames() => (string[])VirtualPorts.Clone();

    public string PortName { get; set; } = "COM1";
    public int BaudRate { get; set; } = 9600;
    public int DataBits { get; set; } = 8;
    public int ReadTimeout { get; set; } = -1;
    public int WriteTimeout { get; set; } = -1;
    public bool IsOpen { get; private set; }

    public void Open() => throw NotSupported();
    public void Close() => IsOpen = false;
    public void Write(string text) => throw NotSupported();
    public void WriteLine(string text) => throw NotSupported();
    public string ReadLine() => throw NotSupported();
    public string ReadExisting() => throw NotSupported();

    private static NotSupportedException NotSupported() =>
        new("仿真平台不支持直接读写串口，请使用 DeviceCtrlHelper 操作实训台设备。");
}
