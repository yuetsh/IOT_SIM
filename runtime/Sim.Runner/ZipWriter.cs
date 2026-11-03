using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace Sim.Runner;

/// <summary>
/// 写 zip 文件。文件名照中文 Windows 的习惯用 GBK 编码（资源管理器自带的解压、老版本的压缩软件都按 GBK 读，
/// 用 UTF-8 时 Windows 7 等会显示乱码），另附 Info-ZIP 的 Unicode 文件名扩展字段（0x7075），
/// 7-Zip、Linux 的 unzip 等认这个字段的软件在别的语言的系统上也能显示正确。
/// GBK 表示不了的文件名改用 UTF-8 并设置 UTF-8 标志位。
/// </summary>
internal sealed class ZipWriter
{
    private static readonly Encoding Gbk;
    private static readonly uint[] CrcTable = new uint[256];

    static ZipWriter()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        Gbk = Encoding.GetEncoding(936, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
        for (uint n = 0; n < 256; n++)
        {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
            CrcTable[n] = c;
        }
    }

    private sealed record Entry(byte[] Name, byte[] Extra, ushort Flags, ushort Method, uint Crc, uint CompressedSize, uint Size, uint Offset);

    private readonly MemoryStream output = new();
    private readonly List<Entry> entries = new();
    private readonly ushort dosTime;
    private readonly ushort dosDate;

    /// <param name="time">文件的修改时间（机房电脑上解压后看到的时间）</param>
    public ZipWriter(DateTime time)
    {
        dosTime = (ushort)((time.Hour << 11) | (time.Minute << 5) | (time.Second / 2));
        dosDate = (ushort)(((time.Year - 1980) << 9) | (time.Month << 5) | time.Day);
    }

    /// <summary>添加文件，path 用 / 分隔</summary>
    public void Add(string path, byte[] data)
    {
        byte[] name;
        byte[] extra = Array.Empty<byte>();
        ushort flags = 0;
        try
        {
            name = Gbk.GetBytes(path);
            var utf8 = Encoding.UTF8.GetBytes(path);
            if (utf8.Length != name.Length || !utf8.AsSpan().SequenceEqual(name))
            {
                // Unicode Path Extra Field：版本 1、GBK 文件名的 CRC、UTF-8 文件名
                extra = new byte[4 + 1 + 4 + utf8.Length];
                BitConverter.TryWriteBytes(extra.AsSpan(0), (ushort)0x7075);
                BitConverter.TryWriteBytes(extra.AsSpan(2), (ushort)(1 + 4 + utf8.Length));
                extra[4] = 1;
                BitConverter.TryWriteBytes(extra.AsSpan(5), Crc32(name));
                utf8.CopyTo(extra, 9);
            }
        }
        catch (EncoderFallbackException)
        {
            name = Encoding.UTF8.GetBytes(path);
            flags = 1 << 11;
        }

        var crc = Crc32(data);
        var compressed = Deflate(data);
        var method = (ushort)8;
        if (compressed.Length >= data.Length)
        {
            compressed = data;
            method = 0;
        }

        var entry = new Entry(name, extra, flags, method, crc, (uint)compressed.Length, (uint)data.Length, (uint)output.Position);
        entries.Add(entry);
        using var w = new BinaryWriter(output, Encoding.UTF8, leaveOpen: true);
        w.Write(0x04034b50u);
        w.Write((ushort)20);
        w.Write(entry.Flags);
        w.Write(entry.Method);
        w.Write(dosTime);
        w.Write(dosDate);
        w.Write(entry.Crc);
        w.Write(entry.CompressedSize);
        w.Write(entry.Size);
        w.Write((ushort)entry.Name.Length);
        w.Write((ushort)entry.Extra.Length);
        w.Write(entry.Name);
        w.Write(entry.Extra);
        w.Write(compressed);
    }

    /// <summary>写中央目录，返回整个 zip</summary>
    public byte[] Finish()
    {
        var start = (uint)output.Position;
        using (var w = new BinaryWriter(output, Encoding.UTF8, leaveOpen: true))
        {
            foreach (var e in entries)
            {
                w.Write(0x02014b50u);
                w.Write((ushort)20); // 由 MS-DOS 兼容的系统生成：解压时不设置 Unix 权限
                w.Write((ushort)20);
                w.Write(e.Flags);
                w.Write(e.Method);
                w.Write(dosTime);
                w.Write(dosDate);
                w.Write(e.Crc);
                w.Write(e.CompressedSize);
                w.Write(e.Size);
                w.Write((ushort)e.Name.Length);
                w.Write((ushort)e.Extra.Length);
                w.Write((ushort)0); // 注释长度
                w.Write((ushort)0); // 磁盘号
                w.Write((ushort)0); // 内部属性
                w.Write(0u);        // 外部属性
                w.Write(e.Offset);
                w.Write(e.Name);
                w.Write(e.Extra);
            }
            var size = (uint)output.Position - start;
            w.Write(0x06054b50u);
            w.Write((ushort)0);
            w.Write((ushort)0);
            w.Write((ushort)entries.Count);
            w.Write((ushort)entries.Count);
            w.Write(size);
            w.Write(start);
            w.Write((ushort)0);
        }
        return output.ToArray();
    }

    private static byte[] Deflate(byte[] data)
    {
        using var stream = new MemoryStream();
        using (var deflate = new DeflateStream(stream, CompressionLevel.Optimal, leaveOpen: true)) deflate.Write(data);
        return stream.ToArray();
    }

    private static uint Crc32(byte[] data)
    {
        var c = 0xFFFFFFFFu;
        foreach (var b in data) c = CrcTable[(c ^ b) & 0xFF] ^ (c >> 8);
        return c ^ 0xFFFFFFFFu;
    }
}
