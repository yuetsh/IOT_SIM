using System.ComponentModel;

namespace Sim.Host;

/// <summary>
/// Windows 写法的路径（教材里常见 BaseDirectory + "Camera\\"）在 Linux 上要把反斜杠换成斜杠，否则反斜杠成了文件名的一部分。
/// 编译时把学生代码里传给文件、文件夹、图片读写方法的路径参数包上这个方法（见 Sim.Runner/PathRewriter.cs）。
/// </summary>
[EditorBrowsable(EditorBrowsableState.Never)]
public static class WindowsPaths
{
    public static string Fix(string path) => path?.Replace('\\', '/')!;
}
