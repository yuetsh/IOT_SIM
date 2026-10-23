using System;
using System.Data.SqlClient;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Sim.Data.Engine;

/// <summary>值在 .NET、SQLite、T-SQL 之间的转换。日期一律以 "yyyy-MM-dd HH:mm:ss" 文本保存，按文本比较即按时间先后。</summary>
internal static class Values
{
    private static readonly string[] DateFormats =
    {
        "yyyy-M-d", "yyyy-M-d H:m", "yyyy-M-d H:m:s", "yyyy-M-d H:m:s.FFFFFFF", "yyyy-M-dTH:m:s", "yyyy-M-dTH:m:s.FFFFFFF",
        "yyyy/M/d", "yyyy/M/d H:m", "yyyy/M/d H:m:s", "yyyy/M/d H:m:s.FFFFFFF",
        "yyyyMMdd", "yyyyMMdd H:m:s",
        "yyyy.M.d", "yyyy.M.d H:m:s",
    };

    /// <summary>形如日期的字符串字面量（比较时转成标准格式，例如 BETWEEN '2024/1/16 9:05:03' AND ...）</summary>
    private static readonly Regex DateLike = new(@"^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}([ T]\d{1,2}:\d{1,2}(:\d{1,2}(\.\d+)?)?)?$");

    public static bool LooksLikeDate(string text) => DateLike.IsMatch(text.Trim());

    /// <summary>按 SQL Server 接受的写法解析日期（包括中文 Windows 上 DateTime.ToString() 的 2024/1/16 9:05:03）</summary>
    public static bool TryParseDateTime(string text, out DateTime value) =>
        DateTime.TryParseExact(text.Trim(), DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out value);

    public static string FormatDateTime(DateTime value) =>
        value.Millisecond == 0 && value.Ticks % TimeSpan.TicksPerMillisecond == 0
            ? value.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)
            : value.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);

    public static string FormatDate(DateTime value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>字符串里的日期改成标准格式；只有日期没有时间的保持只有日期（与 datetime 比较时相当于当天 0 点）</summary>
    public static string NormalizeDateLiteral(string text)
    {
        if (!TryParseDateTime(text, out var value)) return text;
        return text.Contains(':') ? FormatDateTime(value) : FormatDate(value);
    }

    /// <summary>C# 传进来的参数值 → SQLite 能保存的值</summary>
    public static object? ToStorage(object? value) => value switch
    {
        null or DBNull => null,
        DateTime d => FormatDateTime(d),
        DateTimeOffset d => FormatDateTime(d.LocalDateTime),
        TimeSpan t => t.ToString(@"hh\:mm\:ss", CultureInfo.InvariantCulture),
        bool b => b ? 1L : 0L,
        Guid g => g.ToString().ToUpperInvariant(),
        decimal m => (double)m,
        Enum e => Convert.ToInt64(e, CultureInfo.InvariantCulture),
        _ => value,
    };

    /// <summary>SQLite 读出的值 → SQL Server 对这个类型返回的 .NET 值</summary>
    public static object FromStorage(object value, TSqlType? type)
    {
        if (value is DBNull) return value;
        if (type == null || type.ClrType == typeof(object)) return FromExpression(value);
        try
        {
            return type.ClrType switch
            {
                var t when t == typeof(int) => Convert.ToInt32(value, CultureInfo.InvariantCulture),
                var t when t == typeof(long) => Convert.ToInt64(value, CultureInfo.InvariantCulture),
                var t when t == typeof(short) => Convert.ToInt16(value, CultureInfo.InvariantCulture),
                var t when t == typeof(byte) => Convert.ToByte(value, CultureInfo.InvariantCulture),
                var t when t == typeof(bool) => Convert.ToInt64(value, CultureInfo.InvariantCulture) != 0,
                var t when t == typeof(double) => Convert.ToDouble(value, CultureInfo.InvariantCulture),
                var t when t == typeof(float) => Convert.ToSingle(value, CultureInfo.InvariantCulture),
                var t when t == typeof(decimal) => Convert.ToDecimal(value, CultureInfo.InvariantCulture),
                var t when t == typeof(DateTime) => value is string s && TryParseDateTime(s, out var d) ? d : value,
                var t when t == typeof(TimeSpan) => value is string s && TimeSpan.TryParse(s, CultureInfo.InvariantCulture, out var ts) ? ts : value,
                var t when t == typeof(Guid) => value is string s && Guid.TryParse(s, out var g) ? g : value,
                var t when t == typeof(string) => Convert.ToString(value, CultureInfo.InvariantCulture)!,
                _ => value,
            };
        }
        catch (Exception ex) when (ex is FormatException or OverflowException or InvalidCastException)
        {
            return value;
        }
    }

    /// <summary>表达式列（如 count(*)、getdate()）没有声明类型：整数按 int 返回，日期样子的文本按 DateTime 返回</summary>
    public static object FromExpression(object value) => value switch
    {
        long l when l is >= int.MinValue and <= int.MaxValue => (int)l,
        string s when DateLike.IsMatch(s) && s.Contains(':') && TryParseDateTime(s, out var d) => d,
        _ => value,
    };

    /// <summary>T-SQL 字符串字面量</summary>
    public static string Quote(string text) => "'" + text.Replace("'", "''") + "'";

    /// <summary>SQLite 标识符</summary>
    public static string QuoteName(string name) => "\"" + name.Replace("\"", "\"\"") + "\"";

    public static SqlException ConvertError(object? value, string type) =>
        SqlException.ConvertFailed(Convert.ToString(value, CultureInfo.InvariantCulture) ?? "", type);
}
