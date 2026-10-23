using System.ComponentModel;
using System.Drawing;
using System.IO;

namespace Sim.Host;

/// <summary>
/// 项目资源（Properties.Resources）的素材库。平台为学生工程生成的 Properties/Resources.Designer.cs 通过这里读取素材，
/// 和 VS 一样每次取图片都得到一个新的 Bitmap。
/// </summary>
[EditorBrowsable(EditorBrowsableState.Never)]
public static class ProjectResources
{
    /// <summary>素材文件所在目录（运行器目录下的 Resources/gallery）</summary>
    public static string Directory { get; } = Path.Combine(Path.GetDirectoryName(typeof(ProjectResources).Assembly.Location)!, "Resources", "gallery");

    public static Bitmap Image(string file) => (Bitmap)System.Drawing.Image.FromStream(new MemoryStream(Bytes(file)));

    public static byte[] Bytes(string file) => File.ReadAllBytes(Path.Combine(Directory, Path.GetFileName(file)));
}
