using System.Collections.Concurrent;

namespace DeviceCtrlLibrary;

/// <summary>
/// 虚拟实训台的设备状态。第 0 阶段先放在运行器进程里、用固定的默认值；
/// 第 1 阶段改为向 Bun 服务器上的实训台查询，数值由网页上的滑块和开关控制。
/// </summary>
internal static class TrainingBoard
{
    /// <summary>ADAM-4017 各通道的读数（Vin0 温度、Vin1 湿度、Vin2 光照……），按教材格式保存为整数</summary>
    public static readonly ConcurrentDictionary<int, int> AnalogInputs = new()
    {
        [0] = 25,   // 温度 ℃
        [1] = 60,   // 湿度 %
        [2] = 500,  // 光照 lx
        [3] = 101,  // 气压 kPa
        [4] = 60,   // 空气质量
        [5] = 600,  // CO2 ppm
        [6] = 20,   // 风速
    };

    /// <summary>ADAM-4150 数字量输入（DI0 人体红外、DI1 火焰、DI2 烟雾、DI3 红外对射）</summary>
    public static readonly ConcurrentDictionary<int, bool> DigitalInputs = new();
}
