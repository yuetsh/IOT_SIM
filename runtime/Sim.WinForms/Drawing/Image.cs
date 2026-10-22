using System.ComponentModel;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Sim.Host;

namespace System.Drawing;

/// <summary>
/// 图片。System.Drawing 在 Linux 上不受支持，这里只保存图片文件的原始数据（JPEG、PNG、GIF、BMP）和尺寸：
/// 能显示在 PictureBox 上、保存成文件、从文件或流读回，不能逐像素绘制。
/// </summary>
public abstract class Image : IDisposable, ICloneable
{
    private string? _simKey;

    private protected Image(byte[] data)
    {
        Data = data;
        (RawFormat, Width, Height) = ReadHeader(data) ?? throw new ArgumentException("参数无效：不是 JPEG、PNG、GIF 或 BMP 格式的图片。");
    }

    internal byte[] Data { get; }

    public int Width { get; }
    public int Height { get; }
    public Size Size => new(Width, Height);
    public ImageFormat RawFormat { get; }
    public object? Tag { get; set; }

    /// <summary>平台内部使用：图片内容的哈希，浏览器按它缓存图片，同一张图只传一次</summary>
    [EditorBrowsable(EditorBrowsableState.Never)]
    public string SimKey => _simKey ??= Convert.ToHexString(SHA1.HashData(Data)).ToLowerInvariant();

    internal string MimeType => RawFormat.MimeType;

    public static Image FromFile(string filename) => new Bitmap(filename);

    public static Image FromStream(Stream stream) => new Bitmap(stream);

    public void Save(string filename) => Save(filename, RawFormat);

    /// <summary>按原格式写出图片数据（不做格式转换）。目录不存在时和 GDI+ 一样报"一般性错误"</summary>
    public void Save(string filename, ImageFormat format)
    {
        try
        {
            File.WriteAllBytes(filename, Data);
        }
        catch (DirectoryNotFoundException)
        {
            throw new ExternalException("GDI+ 中发生一般性错误。（保存图片的文件夹不存在，先用 Directory.CreateDirectory 创建）");
        }
        SimHost.ImageSaved(Path.GetFullPath(filename), this);
    }

    public void Save(Stream stream, ImageFormat format) => stream.Write(Data, 0, Data.Length);

    public object Clone() => new Bitmap(this);

    public void Dispose() => GC.SuppressFinalize(this);

    private static (ImageFormat, int, int)? ReadHeader(byte[] d)
    {
        if (d.Length >= 24 && d[0] == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G')
            return (ImageFormat.Png, BigEndian(d, 16), BigEndian(d, 20));
        if (d.Length >= 10 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F')
            return (ImageFormat.Gif, d[6] | d[7] << 8, d[8] | d[9] << 8);
        if (d.Length >= 26 && d[0] == 'B' && d[1] == 'M')
            return (ImageFormat.Bmp, BitConverter.ToInt32(d, 18), Math.Abs(BitConverter.ToInt32(d, 22)));
        if (d.Length >= 4 && d[0] == 0xFF && d[1] == 0xD8)
        {
            // 依次跳过各段，找到记录尺寸的 SOF 段
            var i = 2;
            while (i + 9 < d.Length && d[i] == 0xFF)
            {
                var marker = d[i + 1];
                var length = d[i + 2] << 8 | d[i + 3];
                if (marker is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC)
                    return (ImageFormat.Jpeg, d[i + 7] << 8 | d[i + 8], d[i + 5] << 8 | d[i + 6]);
                i += 2 + length;
            }
        }
        return null;
    }

    private static int BigEndian(byte[] d, int offset) => d[offset] << 24 | d[offset + 1] << 16 | d[offset + 2] << 8 | d[offset + 3];
}

public sealed class Bitmap : Image
{
    public Bitmap(string filename) : base(File.ReadAllBytes(filename)) { }

    public Bitmap(Stream stream) : base(ReadAll(stream)) { }

    public Bitmap(Image original) : base(original.Data) { }

    private static byte[] ReadAll(Stream stream)
    {
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
