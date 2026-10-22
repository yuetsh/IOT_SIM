// 与教材 dll 一致：ADAM-4017 的数值全部是字符串，ADAM-4150 的数值全部是 bool。
namespace DeviceCtrlLibrary.Model;

public class ADAM4017ResModel
{
    public string temperatureValue { get; set; }
    public string humidityValue { get; set; }
    public string lightValue { get; set; }
    public string airPressureValue { get; set; }
    public string airQualityValue { get; set; }
    public string CO2Value { get; set; }
    public string windValue { get; set; }
}

public class ADAM4150ResModel
{
    public bool bodyInfraredValue { get; set; }
    public bool fireValue { get; set; }
    public bool smokeValue { get; set; }
    public bool infraredValue { get; set; }
}

public class ZigBeeResModel
{
    public string waterLevelValue { get; set; }
    public string waterTemperatureValue { get; set; }
    public string soilMoistureValue { get; set; }
    // 拼写与教材 dll 一致
    public string soilTemperatuerValue { get; set; }
}
