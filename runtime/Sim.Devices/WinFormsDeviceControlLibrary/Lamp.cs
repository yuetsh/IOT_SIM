using System.Drawing;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace WinFormsDeviceControlLibrary;

/// <summary>教材控件库的灯泡：OnOff(true) 显示亮灯图片，OnOff(false) 显示灭灯图片。只改变界面，不控制实训台</summary>
[ClientType("WinFormsDeviceControlLibrary.Lamp")]
public class Lamp : UserControl
{
    private bool _isOn;

    public Lamp() => BackColor = Color.White;

    protected override Size DefaultSize => new(104, 185);

    public void OnOff(bool IsOpen)
    {
        EnsureThreadAccess();
        _isOn = IsOpen;
        NotifyChanged("IsOn", _isOn);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["IsOn"] = _isOn;
    }
}

/// <summary>教材控件库的报警灯：OnOff(true) 显示报警图片。只改变界面，不控制实训台</summary>
[ClientType("WinFormsDeviceControlLibrary.Alarm")]
public class Alarm : UserControl
{
    private bool _isOn;

    public Alarm() => BackColor = Color.White;

    protected override Size DefaultSize => new(150, 150);

    public void OnOff(bool IsOpen)
    {
        EnsureThreadAccess();
        _isOn = IsOpen;
        NotifyChanged("IsOn", _isOn);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["IsOn"] = _isOn;
    }
}
