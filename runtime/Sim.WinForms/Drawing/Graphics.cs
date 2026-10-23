namespace System.Drawing;

/// <summary>
/// 绘图面。平台的控件由浏览器绘制，学生程序不能自己画（没有 DrawLine 等方法）；
/// 只为让 VS 生成的空 Paint 事件处理程序（panel1_Paint）能编译。
/// </summary>
public sealed class Graphics : IDisposable
{
    private Graphics()
    {
    }

    public void Dispose() => GC.SuppressFinalize(this);
}
