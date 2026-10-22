namespace System.Drawing.Imaging;

/// <summary>图片格式。Image.Save 时只用来对应文件类型，不做格式转换</summary>
public sealed class ImageFormat
{
    private readonly string _name;

    private ImageFormat(string name, string mimeType)
    {
        _name = name;
        MimeType = mimeType;
    }

    internal string MimeType { get; }

    public static ImageFormat Jpeg { get; } = new("Jpeg", "image/jpeg");
    public static ImageFormat Png { get; } = new("Png", "image/png");
    public static ImageFormat Gif { get; } = new("Gif", "image/gif");
    public static ImageFormat Bmp { get; } = new("Bmp", "image/bmp");
    public static ImageFormat Icon { get; } = new("Icon", "image/x-icon");

    public override string ToString() => _name;
}
