using System.IO;
using System.Text;
using Sim.Host;

namespace Sim.Runner;

/// <summary>把学生程序的 Console 输出按行转发给浏览器（标准输出本身留给协议消息使用）</summary>
internal sealed class ConsoleForwarder : TextWriter
{
    private readonly StringBuilder _buffer = new();

    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value)
    {
        lock (_buffer)
        {
            _buffer.Append(value);
            if (value == '\n') FlushBuffer();
        }
    }

    public override void Write(string? value)
    {
        if (value == null) return;
        lock (_buffer)
        {
            _buffer.Append(value);
            if (value.Contains('\n')) FlushBuffer();
        }
    }

    public override void Flush()
    {
        lock (_buffer) FlushBuffer();
    }

    private void FlushBuffer()
    {
        if (_buffer.Length == 0) return;
        SimHost.SendConsole(_buffer.ToString());
        _buffer.Clear();
    }
}
