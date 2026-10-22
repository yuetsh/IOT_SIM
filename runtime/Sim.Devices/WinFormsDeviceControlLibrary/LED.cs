using System.Drawing;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace WinFormsDeviceControlLibrary;

/// <summary>
/// 教材控件库的 LED 显示屏：默认黑底、宋体 70pt 红字，setLedText 后文字从右向左滚动（滚动由浏览器完成）。
/// </summary>
[ClientType("WinFormsDeviceControlLibrary.LED")]
public class LED : UserControl
{
    private string _ledText = "";

    public LED()
    {
        BackColor = Color.Black;
        ForeColor = Color.Red;
        Font = new Font("宋体", 70F);
    }

    protected override Size DefaultSize => new(800, 130);

    public void setLedText(string LedText)
    {
        EnsureThreadAccess();
        _ledText = LedText ?? "";
        NotifyChanged("LedText", _ledText);
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["LedText"] = _ledText;
    }
}
