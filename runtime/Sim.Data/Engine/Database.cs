using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using Microsoft.Data.Sqlite;

namespace Sim.Data.Engine;

/// <summary>一列的定义（来自元数据表，保留建表时的 T-SQL 写法）</summary>
internal sealed record ColumnInfo(string Name, TSqlType Type, bool Nullable, bool Identity, bool PrimaryKey, string? Default);

internal sealed record TableInfo(string Name, IReadOnlyList<ColumnInfo> Columns)
{
    public ColumnInfo? Find(string column) => Columns.FirstOrDefault(c => string.Equals(c.Name, column, StringComparison.OrdinalIgnoreCase));
    public ColumnInfo? Identity => Columns.FirstOrDefault(c => c.Identity);
}

/// <summary>
/// 一个学生的全部数据库：一个目录，每个库一个 SQLite 文件（库名.db）。
/// master 是默认库（连接字符串里不写 Initial Catalog 时连到它），和 SQL Server 一样也能在里面建表。
/// </summary>
internal sealed class DatabaseStore
{
    public const string Master = "master";
    /// <summary>元数据表：每列的 T-SQL 类型、是否自增等。学生的 SQL 里不能引用它</summary>
    public const string MetaTable = "__sim_columns";
    private const int MaxDatabases = 20;
    /// <summary>每个库最多约 50 MB（4 KB 一页）</summary>
    private const int MaxPages = 12800;

    public DatabaseStore(string directory) => Directory = directory;

    public string Directory { get; }

    /// <summary>学生程序运行时：服务器通过环境变量 SIM_DB_DIR 指定（沙箱里挂载学生自己的数据库目录）</summary>
    public static DatabaseStore? FromEnvironment() =>
        Environment.GetEnvironmentVariable("SIM_DB_DIR") is { Length: > 0 } dir ? new DatabaseStore(dir) : null;

    public IEnumerable<string> List() =>
        System.IO.Directory.Exists(Directory)
            ? System.IO.Directory.EnumerateFiles(Directory, "*.db").Select(f => Path.GetFileNameWithoutExtension(f)!).Where(n => n != Master).Order(StringComparer.Ordinal)
            : Enumerable.Empty<string>();

    /// <summary>库名大小写不敏感（和 SQL Server 一样），返回磁盘上实际的名字</summary>
    public string? Resolve(string name)
    {
        if (string.Equals(name, Master, StringComparison.OrdinalIgnoreCase)) return Master;
        return List().FirstOrDefault(n => string.Equals(n, name, StringComparison.OrdinalIgnoreCase));
    }

    public SqliteConnection Open(string name)
    {
        var resolved = Resolve(name);
        if (resolved == null) throw SqlException.CannotOpenDatabase(name);
        if (resolved == Master && !File.Exists(PathOf(Master))) Create(Master, allowMaster: true);
        // 不用连接池：最后一个连接关闭时 WAL 里的数据写回主文件，复制、恢复数据库文件时不会丢数据
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = PathOf(resolved), Mode = SqliteOpenMode.ReadWrite, Pooling = false }.ToString());
        connection.Open();
        Functions.Register(connection);
        using var pragma = connection.CreateCommand();
        pragma.CommandText = $"PRAGMA max_page_count = {MaxPages}; PRAGMA case_sensitive_like = OFF;";
        pragma.ExecuteNonQuery();
        return connection;
    }

    public void Create(string name, bool allowMaster = false)
    {
        CheckName(name);
        if (!allowMaster && Resolve(name) != null) throw SqlException.DatabaseExists(name);
        if (List().Count() >= MaxDatabases) throw new SqlException(1105, $"最多只能建 {MaxDatabases} 个数据库，先删除不用的数据库。");
        System.IO.Directory.CreateDirectory(Directory);
        using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = PathOf(name), Mode = SqliteOpenMode.ReadWriteCreate, Pooling = false }.ToString());
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText =
            "PRAGMA journal_mode = WAL;" +
            $"CREATE TABLE IF NOT EXISTS {MetaTable} (table_name TEXT NOT NULL COLLATE NOCASE, column_name TEXT NOT NULL COLLATE NOCASE, " +
            "ordinal INTEGER NOT NULL, type_name TEXT NOT NULL, nullable INTEGER NOT NULL, is_identity INTEGER NOT NULL, " +
            "is_primary_key INTEGER NOT NULL, default_text TEXT, PRIMARY KEY (table_name, column_name));";
        command.ExecuteNonQuery();
    }

    public void Drop(string name)
    {
        var resolved = Resolve(name);
        if (resolved == null || resolved == Master) throw new SqlException(3701, $"无法对 数据库 '{name}' 执行 删除，因为它不存在，或者您没有所需的权限。");
        foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(PathOf(resolved) + suffix);
    }

    private string PathOf(string name) => Path.Combine(Directory, name + ".db");

    /// <summary>库名就是文件名：不能有路径分隔符等字符</summary>
    private static void CheckName(string name)
    {
        if (name.Length is 0 or > 64 || name.StartsWith('.') || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || name.IndexOfAny(['\\', ':', '*', '?', '"', '<', '>', '|']) >= 0)
            throw new SqlException(102, $"数据库名 '{name}' 无效：不能为空、不能超过 64 个字，也不能包含 \\ / : * ? \" < > | 等字符。");
    }

    // ---------- 表结构（元数据表） ----------

    public static TableInfo? GetTable(SqliteConnection connection, string name)
    {
        if (IsHidden(name)) return null;
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = $name COLLATE NOCASE";
        command.Parameters.AddWithValue("$name", name);
        if (command.ExecuteScalar() is not string actual) return null;

        command.CommandText = $"SELECT column_name, type_name, nullable, is_identity, is_primary_key, default_text FROM {MetaTable} WHERE table_name = $name ORDER BY ordinal";
        var columns = new List<ColumnInfo>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                columns.Add(new ColumnInfo(reader.GetString(0), TSqlType.Parse(reader.GetString(1)), reader.GetInt64(2) != 0,
                    reader.GetInt64(3) != 0, reader.GetInt64(4) != 0, reader.IsDBNull(5) ? null : reader.GetString(5)));
            }
        }
        return new TableInfo(actual, columns);
    }

    public static IReadOnlyList<string> ListTables(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
        var tables = new List<string>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var name = reader.GetString(0);
            if (!IsHidden(name)) tables.Add(name);
        }
        return tables;
    }

    public static void SaveColumns(SqliteConnection connection, string table, IEnumerable<ColumnInfo> columns, int firstOrdinal = 0)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"INSERT OR REPLACE INTO {MetaTable} VALUES ($t, $c, $o, $type, $null, $id, $pk, $def)";
        var ordinal = firstOrdinal;
        foreach (var column in columns)
        {
            command.Parameters.Clear();
            command.Parameters.AddWithValue("$t", table);
            command.Parameters.AddWithValue("$c", column.Name);
            command.Parameters.AddWithValue("$o", ordinal++);
            command.Parameters.AddWithValue("$type", column.Type.ToString());
            command.Parameters.AddWithValue("$null", column.Nullable ? 1 : 0);
            command.Parameters.AddWithValue("$id", column.Identity ? 1 : 0);
            command.Parameters.AddWithValue("$pk", column.PrimaryKey ? 1 : 0);
            command.Parameters.AddWithValue("$def", (object?)column.Default ?? DBNull.Value);
            command.ExecuteNonQuery();
        }
    }

    public static void DeleteColumns(SqliteConnection connection, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"DELETE FROM {MetaTable} WHERE table_name = $t";
        command.Parameters.AddWithValue("$t", table);
        command.ExecuteNonQuery();
    }

    /// <summary>平台内部的表和 SQLite 系统表，学生看不到也不能引用</summary>
    public static bool IsHidden(string name) =>
        name.StartsWith("__sim", StringComparison.OrdinalIgnoreCase) || name.StartsWith("sqlite_", StringComparison.OrdinalIgnoreCase);
}
