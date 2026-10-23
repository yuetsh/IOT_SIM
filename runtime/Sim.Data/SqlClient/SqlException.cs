using System.Data.Common;

namespace System.Data.SqlClient;

/// <summary>
/// 数据库报错。Number 和 Message 与中文版 SQL Server 一致（如 208"对象名 'X' 无效。"），
/// 学生在网上搜报错信息能找到对应的说明。
/// </summary>
public sealed class SqlException : DbException
{
    internal SqlException(int number, string message, int lineNumber = 1) : base(message, unchecked((int)0x80131904))
    {
        Number = number;
        LineNumber = lineNumber;
    }

    public int Number { get; }
    public int LineNumber { get; }
    public byte Class => 16;
    public byte State => 1;
    public string Server => ".";
    public string Procedure => "";

    /// <summary>在 SqlClient 的公开方法里重新抛出：学生看到的调用栈从 SqlCommand.ExecuteNonQuery 等开始，不含平台内部的实现</summary>
    internal SqlException Rethrow() => new(Number, Message, LineNumber);

    public override string ToString() => $"{GetType().FullName} (0x80131904): {Message}{(StackTrace != null ? Environment.NewLine + StackTrace : "")}";

    // ---------- 常见报错 ----------

    internal static SqlException Syntax(string near, int line = 1) =>
        new(102, IsKeyword(near) ? $"关键字 '{near}' 附近有语法错误。" : $"'{near}' 附近有语法错误。", line);

    internal static SqlException InvalidObject(string name) => new(208, $"对象名 '{name}' 无效。");
    internal static SqlException InvalidColumn(string name) => new(207, $"列名 '{name}' 无效。");
    internal static SqlException AmbiguousColumn(string name) => new(209, $"列名 '{name}' 不明确。");
    internal static SqlException ColumnCountMismatch() => new(213, "列名或所提供值的数目与表定义不匹配。");
    internal static SqlException IdentityInsert(string table) => new(544, $"当 IDENTITY_INSERT 设置为 OFF 时，不能为表 '{table}' 中的标识列插入显式值。");
    internal static SqlException NullNotAllowed(string column, string table) => new(515, $"不能将值 NULL 插入列 '{column}'，表 '{table}'；列不允许有 Null 值。INSERT 失败。");
    internal static SqlException DuplicateKey(string table) => new(2627, $"违反了 PRIMARY KEY 约束。不能在对象 'dbo.{table}' 中插入重复键。");
    internal static SqlException Truncated() => new(8152, "将截断字符串或二进制数据。");
    internal static SqlException ConvertFailed(string value, string type) => new(245, $"在将 varchar 值 '{value}' 转换成数据类型 {type} 时失败。");
    internal static SqlException DateConvertFailed() => new(241, "从字符串转换日期和/或时间时，转换失败。");
    internal static SqlException ObjectExists(string name) => new(2714, $"数据库中已存在名为 '{name}' 的对象。");
    internal static SqlException DatabaseExists(string name) => new(1801, $"数据库 '{name}' 已存在。请选择其他数据库名称。");
    internal static SqlException CannotOpenDatabase(string name) => new(4060, $"无法打开登录所请求的数据库 \"{name}\"。登录失败。");
    internal static SqlException DatabaseNotFound(string name) => new(911, $"数据库 '{name}' 不存在。请确保正确地输入了该名称。");
    internal static SqlException DatabaseInUse(string name) => new(3702, $"无法删除数据库 \"{name}\"，因为该数据库当前正在使用。");
    internal static SqlException CannotDropTable(string name) => new(3701, $"无法对 表 '{name}' 执行 删除，因为它不存在，或者您没有所需的权限。");
    internal static SqlException UnknownFunction(string name) => new(195, $"'{name}' 不是可以识别的 内置函数名称。");
    internal static SqlException UndeclaredVariable(string name) => new(137, $"必须声明标量变量 \"{name}\"。");
    internal static SqlException DivideByZero() => new(8134, "遇到以零作除数错误。");
    internal static SqlException NotSupported(string what) => new(40000, $"平台暂不支持 {what}。");

    private static bool IsKeyword(string word) => word.ToUpperInvariant() is
        "SELECT" or "FROM" or "WHERE" or "INSERT" or "INTO" or "VALUES" or "UPDATE" or "SET" or "DELETE" or "CREATE" or "TABLE"
        or "DROP" or "ALTER" or "AND" or "OR" or "NOT" or "NULL" or "ORDER" or "GROUP" or "BY" or "HAVING" or "AS" or "ON"
        or "JOIN" or "INNER" or "LEFT" or "RIGHT" or "OUTER" or "IS" or "IN" or "LIKE" or "BETWEEN" or "TOP" or "DISTINCT"
        or "PRIMARY" or "KEY" or "IDENTITY" or "DEFAULT" or "DATABASE" or "USE" or "CASE" or "WHEN" or "THEN" or "ELSE" or "END";
}
