using System;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Sim.Data.Engine;

/// <summary>
/// 一列的 T-SQL 数据类型，如 varchar(50)、int、datetime。
/// SQLite 表用 STRICT 模式保存（类型见 <see cref="StorageType"/>），原始的 T-SQL 类型记在元数据表里，
/// 读取时按它把值还原成 SQL Server 返回的 .NET 类型。
/// </summary>
internal sealed record TSqlType(string Name, int? Length = null, bool IsMax = false, int? Precision = null, int? Scale = null)
{
    public static readonly TSqlType Unknown = new("sql_variant");

    /// <summary>如 varchar(50)、varchar(MAX)、decimal(10, 2)</summary>
    public override string ToString() => Name switch
    {
        _ when IsMax => $"{Name}(MAX)",
        _ when Length != null => $"{Name}({Length})",
        "decimal" or "numeric" when Precision != null => Scale != null ? $"{Name}({Precision}, {Scale})" : $"{Name}({Precision})",
        _ => Name,
    };

    public static TSqlType Parse(string text)
    {
        var m = Regex.Match(text.Trim(), @"^(\w+)\s*(?:\(\s*(MAX|\d+)\s*(?:,\s*(\d+)\s*)?\))?$", RegexOptions.IgnoreCase);
        if (!m.Success) return Unknown;
        var name = m.Groups[1].Value.ToLowerInvariant();
        if (!m.Groups[2].Success) return new TSqlType(name);
        if (m.Groups[2].Value.Equals("MAX", StringComparison.OrdinalIgnoreCase)) return new TSqlType(name, IsMax: true);
        var first = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        if (name is "decimal" or "numeric")
            return new TSqlType(name, Precision: first, Scale: m.Groups[3].Success ? int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture) : null);
        return new TSqlType(name, Length: first);
    }

    public bool IsString => Name is "char" or "varchar" or "nchar" or "nvarchar" or "text" or "ntext";
    public bool IsDateTime => Name is "datetime" or "datetime2" or "smalldatetime";
    public bool IsDate => Name == "date";
    public bool IsInteger => Name is "int" or "bigint" or "smallint" or "tinyint";
    public bool IsBit => Name == "bit";
    public bool IsFloat => Name is "float" or "real" or "decimal" or "numeric" or "money" or "smallmoney";
    public bool IsBinary => Name is "binary" or "varbinary" or "image";

    /// <summary>SQLite STRICT 表的列类型</summary>
    public string StorageType => this switch
    {
        { IsInteger: true } or { IsBit: true } => "INTEGER",
        { IsFloat: true } => "REAL",
        { IsBinary: true } => "BLOB",
        { IsString: true } or { IsDateTime: true } or { IsDate: true } or { Name: "time" or "uniqueidentifier" } => "TEXT",
        _ => "ANY",
    };

    /// <summary>字符串列的长度上限（超出时和 SQL Server 一样报"将截断字符串"）</summary>
    public int? MaxLength => IsString && !IsMax && Name is not ("text" or "ntext") ? Length ?? 1 : null;

    /// <summary>SQL Server 返回这一列时的 .NET 类型（DataTable 的列类型、DataGridView 的显示方式由它决定）</summary>
    public Type ClrType => Name switch
    {
        "int" => typeof(int),
        "bigint" => typeof(long),
        "smallint" => typeof(short),
        "tinyint" => typeof(byte),
        "bit" => typeof(bool),
        "float" => typeof(double),
        "real" => typeof(float),
        "decimal" or "numeric" or "money" or "smallmoney" => typeof(decimal),
        "date" or "datetime" or "datetime2" or "smalldatetime" => typeof(DateTime),
        "time" => typeof(TimeSpan),
        "uniqueidentifier" => typeof(Guid),
        "binary" or "varbinary" or "image" => typeof(byte[]),
        "char" or "varchar" or "nchar" or "nvarchar" or "text" or "ntext" => typeof(string),
        _ => typeof(object),
    };

    /// <summary>平台支持的 T-SQL 类型（建表时检查）</summary>
    public static bool IsSupported(string name) => name is
        "int" or "bigint" or "smallint" or "tinyint" or "bit" or "float" or "real" or "decimal" or "numeric" or "money" or "smallmoney"
        or "date" or "datetime" or "datetime2" or "smalldatetime" or "time" or "uniqueidentifier"
        or "binary" or "varbinary" or "image" or "char" or "varchar" or "nchar" or "nvarchar" or "text" or "ntext";
}
