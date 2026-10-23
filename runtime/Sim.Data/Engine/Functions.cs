using System;
using System.Data.SqlClient;
using System.Globalization;
using Microsoft.Data.Sqlite;

namespace Sim.Data.Engine;

/// <summary>
/// 注册到 SQLite 连接上的 T-SQL 函数和运算（转写后的 SQL 调用它们，学生的 SQL 不能直接调用 tsql_ 开头的名字）。
/// 函数里抛出的 SqlException 先记在 <see cref="Pending"/>，执行语句处取出原样抛给学生（SQLite 只能传回文字信息）。
/// </summary>
internal static class Functions
{
    [ThreadStatic] private static SqlException? _pending;

    public static SqlException? TakePending()
    {
        var pending = _pending;
        _pending = null;
        return pending;
    }

    private static Exception Fail(SqlException error)
    {
        _pending = error;
        return error;
    }

    public static void Register(SqliteConnection c)
    {
        c.CreateFunction<object?, object?, object?>("tsql_add", Add, isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_div", Divide, isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_mod", Modulo, isDeterministic: true);
        c.CreateFunction("tsql_getdate", () => Values.FormatDateTime(TruncateToMilliseconds(DateTime.Now)));
        c.CreateFunction<string, object?, object?>("tsql_datepart", DatePart, isDeterministic: true);
        c.CreateFunction<string, object?, object?, object?>("tsql_dateadd", DateAdd, isDeterministic: true);
        c.CreateFunction<string, object?, object?, object?>("tsql_datediff", DateDiff, isDeterministic: true);
        c.CreateFunction<string, object?, object?, object?, object?>("tsql_convert", Convert, isDeterministic: true);
        c.CreateFunction<object?, object?>("tsql_len", s => s is null ? null : (long)Text(s).TrimEnd(' ').Length, isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_left", (s, n) => s is null || n is null ? null : Left(Text(s), ToLong(n)), isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_right", (s, n) => s is null || n is null ? null : Right(Text(s), ToLong(n)), isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_charindex", (f, s) => f is null || s is null ? null : (long)Text(s).IndexOf(Text(f), StringComparison.OrdinalIgnoreCase) + 1, isDeterministic: true);
        c.CreateFunction<object?, object?>("tsql_floor", x => x is null ? null : Math.Floor(ToDouble(x)), isDeterministic: true);
        c.CreateFunction<object?, object?>("tsql_ceiling", x => x is null ? null : Math.Ceiling(ToDouble(x)), isDeterministic: true);
        c.CreateFunction<object?, object?, object?>("tsql_power", (x, y) => x is null || y is null ? null : Math.Pow(ToDouble(x), ToDouble(y)), isDeterministic: true);
        c.CreateFunction<object?, object?>("tsql_sqrt", x => x is null ? null : Math.Sqrt(ToDouble(x)), isDeterministic: true);
        c.CreateFunction("tsql_newid", () => Guid.NewGuid().ToString().ToUpperInvariant());
        c.CreateFunction("tsql_rand", () => Random.Shared.NextDouble());
    }

    private static DateTime TruncateToMilliseconds(DateTime value) => new(value.Ticks - value.Ticks % TimeSpan.TicksPerMillisecond, value.Kind);

    // ---------- 运算 ----------

    /// <summary>T-SQL 的 +：两边都是字符串时连接，有数字时按数字相加（字符串转不成数字时报错）</summary>
    private static object? Add(object? a, object? b)
    {
        if (a is null || b is null) return null;
        if (a is string sa && b is string sb) return sa + sb;
        if (a is byte[] || b is byte[]) throw Fail(SqlException.NotSupported("二进制数据的 + 运算"));
        var x = Number(a);
        var y = Number(b);
        return x is long lx && y is long ly ? lx + ly : ToDouble(x) + ToDouble(y);
    }

    private static object? Divide(object? a, object? b)
    {
        if (a is null || b is null) return null;
        var x = Number(a);
        var y = Number(b);
        if (ToDouble(y) == 0) throw Fail(SqlException.DivideByZero());
        return x is long lx && y is long ly ? lx / ly : ToDouble(x) / ToDouble(y);
    }

    private static object? Modulo(object? a, object? b)
    {
        if (a is null || b is null) return null;
        var x = Number(a);
        var y = Number(b);
        if (ToDouble(y) == 0) throw Fail(SqlException.DivideByZero());
        return x is long lx && y is long ly ? lx % ly : ToDouble(x) % ToDouble(y);
    }

    /// <summary>数字原样返回；字符串按 T-SQL 隐式转换成 int（带小数点时转成 float），转不了时报 245</summary>
    private static object Number(object value) => value switch
    {
        long or double => value,
        string s when long.TryParse(s.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l) => l,
        string s when s.Contains('.') && double.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) => d,
        _ => throw Fail(Values.ConvertError(value, "int")),
    };

    private static double ToDouble(object value) => value switch
    {
        long l => l,
        double d => d,
        _ => ToDouble(Number(value)),
    };

    private static long ToLong(object value) => value is long l ? l : (long)ToDouble(value);

    private static string Text(object value) => value switch
    {
        string s => s,
        double d => d.ToString(CultureInfo.InvariantCulture),
        _ => System.Convert.ToString(value, CultureInfo.InvariantCulture) ?? "",
    };

    private static string Left(string s, long n) => n <= 0 ? "" : s[..(int)Math.Min(n, s.Length)];
    private static string Right(string s, long n) => n <= 0 ? "" : s[^(int)Math.Min(n, s.Length)..];

    // ---------- 日期 ----------

    private static DateTime ToDateTime(object value)
    {
        if (value is string s && Values.TryParseDateTime(s, out var d)) return d;
        throw Fail(SqlException.DateConvertFailed());
    }

    private static object? DatePart(string part, object? value)
    {
        if (value is null) return null;
        var d = ToDateTime(value);
        return part.ToLowerInvariant() switch
        {
            "year" or "yy" or "yyyy" => d.Year,
            "quarter" or "qq" or "q" => (d.Month - 1) / 3 + 1,
            "month" or "mm" or "m" => d.Month,
            "dayofyear" or "dy" or "y" => d.DayOfYear,
            "day" or "dd" or "d" => d.Day,
            "week" or "wk" or "ww" => CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(d, CalendarWeekRule.FirstDay, DayOfWeek.Sunday),
            "weekday" or "dw" or "w" => (int)d.DayOfWeek + 1,
            "hour" or "hh" => d.Hour,
            "minute" or "mi" or "n" => d.Minute,
            "second" or "ss" or "s" => d.Second,
            "millisecond" or "ms" => d.Millisecond,
            _ => throw Fail(new SqlException(155, $"'{part}' 不是可以识别的 datepart 选项。")),
        };
    }

    private static object? DateAdd(string part, object? amount, object? value)
    {
        if (amount is null || value is null) return null;
        var d = ToDateTime(value);
        var n = ToLong(amount);
        var result = part.ToLowerInvariant() switch
        {
            "year" or "yy" or "yyyy" => d.AddYears((int)n),
            "quarter" or "qq" or "q" => d.AddMonths((int)n * 3),
            "month" or "mm" or "m" => d.AddMonths((int)n),
            "day" or "dd" or "d" or "dayofyear" or "dy" or "y" or "weekday" or "dw" or "w" => d.AddDays(n),
            "week" or "wk" or "ww" => d.AddDays(n * 7),
            "hour" or "hh" => d.AddHours(n),
            "minute" or "mi" or "n" => d.AddMinutes(n),
            "second" or "ss" or "s" => d.AddSeconds(n),
            "millisecond" or "ms" => d.AddMilliseconds(n),
            _ => throw Fail(new SqlException(155, $"'{part}' 不是可以识别的 dateadd 选项。")),
        };
        return Values.FormatDateTime(result);
    }

    /// <summary>和 SQL Server 一样数跨过的边界：DATEDIFF(day, '2024-01-01 23:00', '2024-01-02 01:00') = 1</summary>
    private static object? DateDiff(string part, object? start, object? end)
    {
        if (start is null || end is null) return null;
        var a = ToDateTime(start);
        var b = ToDateTime(end);
        return part.ToLowerInvariant() switch
        {
            "year" or "yy" or "yyyy" => (long)(b.Year - a.Year),
            "quarter" or "qq" or "q" => (long)((b.Year - a.Year) * 4 + (b.Month - 1) / 3 - (a.Month - 1) / 3),
            "month" or "mm" or "m" => (long)((b.Year - a.Year) * 12 + b.Month - a.Month),
            "day" or "dd" or "d" or "dayofyear" or "dy" or "y" => (long)(b.Date - a.Date).TotalDays,
            "week" or "wk" or "ww" => (long)((b.Date.AddDays(-(int)b.DayOfWeek) - a.Date.AddDays(-(int)a.DayOfWeek)).TotalDays / 7),
            "hour" or "hh" => (long)(Trim(b, TimeSpan.TicksPerHour) - Trim(a, TimeSpan.TicksPerHour)).TotalHours,
            "minute" or "mi" or "n" => (long)(Trim(b, TimeSpan.TicksPerMinute) - Trim(a, TimeSpan.TicksPerMinute)).TotalMinutes,
            "second" or "ss" or "s" => (long)(Trim(b, TimeSpan.TicksPerSecond) - Trim(a, TimeSpan.TicksPerSecond)).TotalSeconds,
            "millisecond" or "ms" => (long)(b - a).TotalMilliseconds,
            _ => throw Fail(new SqlException(155, $"'{part}' 不是可以识别的 datediff 选项。")),
        };
    }

    private static DateTime Trim(DateTime d, long unit) => new(d.Ticks - d.Ticks % unit);

    // ---------- CONVERT / CAST，以及插入、修改时按列类型转换 ----------

    /// <summary>tsql_convert('varchar', 10, 值, 120)：转换成 T-SQL 类型；日期按 style 格式化</summary>
    private static object? Convert(string type, object? length, object? value, object? style)
    {
        if (value is null) return null;
        var t = TSqlType.Parse(length is null ? type : $"{type}({(ToLong(length) < 0 ? "MAX" : ToLong(length).ToString(CultureInfo.InvariantCulture))})");
        if (t.IsString)
        {
            var text = style is not null && value is string s && Values.TryParseDateTime(s, out var date)
                ? FormatStyle(date, (int)ToLong(style))
                : Text(value);
            return t.MaxLength is { } max && text.Length > max ? text[..max] : text;
        }
        if (t.IsInteger)
        {
            return value switch
            {
                long => value,
                double d => (long)Math.Truncate(d),
                string s when long.TryParse(s.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l) => l,
                _ => throw Fail(Values.ConvertError(value, t.Name)),
            };
        }
        if (t.IsBit)
        {
            return value switch
            {
                long l => l != 0 ? 1L : 0L,
                double d => d != 0 ? 1L : 0L,
                string s when s.Trim().Equals("true", StringComparison.OrdinalIgnoreCase) => 1L,
                string s when s.Trim().Equals("false", StringComparison.OrdinalIgnoreCase) => 0L,
                string s when long.TryParse(s.Trim(), out var l) => l != 0 ? 1L : 0L,
                _ => throw Fail(Values.ConvertError(value, "bit")),
            };
        }
        if (t.IsFloat)
        {
            return value switch
            {
                long l => (double)l,
                double => value,
                string s when double.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) => d,
                _ => throw Fail(Values.ConvertError(value, t.Name)),
            };
        }
        if (t.IsDateTime || t.IsDate)
        {
            if (value is not string s || !Values.TryParseDateTime(s, out var d)) throw Fail(SqlException.DateConvertFailed());
            return t.IsDate ? Values.FormatDate(d) : Values.FormatDateTime(d);
        }
        return value;
    }

    /// <summary>CONVERT 的日期样式（教材用 120：yyyy-mm-dd hh:mi:ss）</summary>
    private static string FormatStyle(DateTime d, int style) => style switch
    {
        20 or 120 => d.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
        21 or 25 or 121 => d.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture),
        23 => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        101 => d.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture),
        102 => d.ToString("yyyy.MM.dd", CultureInfo.InvariantCulture),
        103 => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
        108 or 8 => d.ToString("HH:mm:ss", CultureInfo.InvariantCulture),
        111 => d.ToString("yyyy/MM/dd", CultureInfo.InvariantCulture),
        112 => d.ToString("yyyyMMdd", CultureInfo.InvariantCulture),
        126 => d.ToString("yyyy-MM-ddTHH:mm:ss.fff", CultureInfo.InvariantCulture),
        _ => d.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
    };
}
