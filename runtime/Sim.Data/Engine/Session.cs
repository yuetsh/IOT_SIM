using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Sim.Data.Engine;

/// <summary>结果集的一列：名字、T-SQL 类型（表达式列为 null），以及来自哪张表的哪一列（SqlCommandBuilder 生成语句时要用）</summary>
internal sealed record ResultColumn(string Name, TSqlType? Type, string? BaseTable, string? BaseColumn, bool IsKey, bool IsIdentity, bool AllowNull)
{
    public Type ClrType => Type?.ClrType is { } t && t != typeof(object) ? t : typeof(object);
}

/// <summary>一个结果集（读完放在内存里）</summary>
internal sealed record QueryResult(IReadOnlyList<ResultColumn> Columns, List<object[]> Rows);

/// <summary>一批语句的执行结果：各个结果集和受影响的行数（只有增删改时才算，否则为 -1）</summary>
internal sealed record BatchResult(List<QueryResult> Results, int RecordsAffected);

/// <summary>
/// 一个打开的数据库连接：当前库（USE 可以切换）、事务，执行一批 T-SQL。
/// SqlConnection 和数据库页面的查询窗口都用它。
/// </summary>
internal sealed class Session : IDisposable
{
    private SqliteTransaction? _transaction;
    private long _deadline = long.MaxValue;

    public Session(DatabaseStore store, string database, TimeSpan? timeLimit = null)
    {
        Store = store;
        TimeLimit = timeLimit;
        Connection = Open(database);
        Database = store.Resolve(database)!;
    }

    /// <summary>每批语句最长执行时间（数据库页面的查询窗口用；学生程序里由沙箱的 CPU 时间限制兜底）</summary>
    public TimeSpan? TimeLimit { get; }

    private SqliteConnection Open(string database)
    {
        var connection = Store.Open(database);
        if (TimeLimit != null)
        {
            // 每执行一千条虚拟机指令检查一次，超时就中断（SQLite 报 interrupted）
            SQLitePCL.raw.sqlite3_progress_handler(connection.Handle, 1000, _ => Environment.TickCount64 > _deadline ? 1 : 0, null);
        }
        return connection;
    }

    public DatabaseStore Store { get; }
    public SqliteConnection Connection { get; private set; }
    public string Database { get; private set; }
    public bool InTransaction => _transaction != null;

    public TableInfo? Lookup(string table) => DatabaseStore.GetTable(Connection, table);

    public void ChangeDatabase(string name)
    {
        if (Store.Resolve(name) == null) throw SqlException.DatabaseNotFound(name);
        if (_transaction != null) throw new SqlException(226, "在多语句事务内不允许使用 USE 语句。");
        var next = Open(name);
        Connection.Dispose();
        Connection = next;
        Database = Store.Resolve(name)!;
    }

    public void BeginTransaction()
    {
        if (_transaction != null) throw new InvalidOperationException("SqlConnection 不支持并行事务。");
        _transaction = Connection.BeginTransaction();
    }

    public void Commit()
    {
        _transaction?.Commit();
        _transaction = null;
    }

    public void Rollback()
    {
        _transaction?.Rollback();
        _transaction = null;
    }

    /// <summary>执行一批语句；parameter 按名字（带不带 @ 都行）取参数值</summary>
    public BatchResult Execute(string sql, Func<string, (bool Found, object? Value)> parameter)
    {
        var statements = Translator.Parse(sql);
        if (TimeLimit is { } limit) _deadline = Environment.TickCount64 + (long)limit.TotalMilliseconds;
        var results = new List<QueryResult>();
        var affected = -1;
        foreach (var parsed in statements)
        {
            var statement = Translate(parsed);
            switch (statement)
            {
                case CreateDatabase create:
                    Store.Create(create.Name);
                    break;
                case DropDatabases drop:
                    foreach (var name in drop.Names)
                    {
                        if (string.Equals(Store.Resolve(name), Database, StringComparison.OrdinalIgnoreCase)) throw SqlException.DatabaseInUse(name);
                        Store.Drop(name);
                    }
                    break;
                case UseDatabase use:
                    ChangeDatabase(use.Name);
                    break;
                case SqliteStatement run:
                    var (result, changes) = Run(run, parameter);
                    if (result != null) results.Add(result);
                    else if (changes >= 0) affected = Math.Max(affected, 0) + changes;
                    break;
            }
        }
        return new BatchResult(results, affected);
    }

    private Statement Translate(TSqlStatement statement)
    {
        try
        {
            return Translator.Translate(statement, Lookup);
        }
        catch (SqliteException ex)
        {
            throw Map(ex);
        }
    }

    private (QueryResult? Result, int Changes) Run(SqliteStatement statement, Func<string, (bool Found, object? Value)> parameter)
    {
        using var command = Connection.CreateCommand();
        command.Transaction = _transaction;
        command.CommandText = statement.Sql;
        foreach (var name in statement.Parameters)
        {
            var (found, value) = parameter(name);
            if (!found) throw SqlException.UndeclaredVariable(name);
            command.Parameters.AddWithValue(name, Values.ToStorage(value) ?? DBNull.Value);
        }

        // 建表等语句和元数据一起提交；已经在学生的事务里时就用那个事务
        var own = _transaction == null && statement.AfterExecute != null ? Connection.BeginTransaction() : null;
        if (own != null) command.Transaction = own;
        try
        {
            QueryResult? result = null;
            int changes;
            if (statement.IsQuery)
            {
                result = Read(command);
                changes = -1;
            }
            else
            {
                changes = command.ExecuteNonQuery();
                statement.AfterExecute?.Invoke(Connection);
                if (statement.AfterExecute != null) changes = -1;
            }
            own?.Commit();
            return (result, changes);
        }
        catch (SqliteException ex)
        {
            own?.Rollback();
            throw Map(ex);
        }
        finally
        {
            own?.Dispose();
        }
    }

    private QueryResult Read(SqliteCommand command)
    {
        using var reader = command.ExecuteReader();
        var schema = reader.GetSchemaTable();
        var tables = new Dictionary<string, TableInfo?>(StringComparer.OrdinalIgnoreCase);
        var columns = new List<ResultColumn>();
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var row = schema.Rows[i];
            var baseTable = row["BaseTableName"] as string;
            var baseColumn = row["BaseColumnName"] as string;
            ColumnInfo? info = null;
            if (!string.IsNullOrEmpty(baseTable) && !string.IsNullOrEmpty(baseColumn))
            {
                if (!tables.TryGetValue(baseTable, out var table)) tables[baseTable] = table = Lookup(baseTable);
                info = table?.Find(baseColumn);
            }
            columns.Add(new ResultColumn(reader.GetName(i), info?.Type, info != null ? baseTable : null, info?.Name,
                info?.PrimaryKey ?? false, info?.Identity ?? false, info?.Nullable ?? true));
        }
        var rows = new List<object[]>();
        while (reader.Read())
        {
            var values = new object[reader.FieldCount];
            reader.GetValues(values);
            for (var i = 0; i < values.Length; i++) values[i] = Values.FromStorage(values[i], columns[i].Type);
            rows.Add(values);
        }
        return new QueryResult(columns, rows);
    }

    /// <summary>SQLite 的报错转成 SQL Server 的错误号和中文信息</summary>
    private SqlException Map(SqliteException ex)
    {
        if (Functions.TakePending() is { } pending) return pending;
        var message = ex.Message;
        Match m;
        if ((m = Regex.Match(message, @"no such table: (?:main\.)?(.+?)'?$")).Success) return SqlException.InvalidObject(m.Groups[1].Value);
        // SQLite 对写错的列名会附带"是不是想写字符串"的提示，只取列名本身
        if ((m = Regex.Match(message, @"no such column: ""?([^""\s']+)")).Success) return SqlException.InvalidColumn(m.Groups[1].Value);
        if ((m = Regex.Match(message, @"ambiguous column name: (.+?)'?$")).Success) return SqlException.AmbiguousColumn(m.Groups[1].Value);
        if ((m = Regex.Match(message, @"UNIQUE constraint failed: (\w+)\.")).Success) return SqlException.DuplicateKey(m.Groups[1].Value);
        if ((m = Regex.Match(message, @"NOT NULL constraint failed: (.+?)\.(.+?)'?$")).Success)
            return SqlException.NullNotAllowed(m.Groups[2].Value, $"{Database}.dbo.{m.Groups[1].Value}");
        if (message.Contains("CHECK constraint failed: trunc:")) return SqlException.Truncated();
        if ((m = Regex.Match(message, @"CHECK constraint failed: bit:(.+?)'?$")).Success) return new SqlException(245, $"列 '{m.Groups[1].Value}' 是 bit 类型，只能保存 0、1 或 NULL。");
        if ((m = Regex.Match(message, @"cannot store (\w+) value in (\w+) column (.+?)\.(.+?)'?$")).Success)
        {
            var type = Lookup(m.Groups[3].Value)?.Find(m.Groups[4].Value)?.Type.Name ?? m.Groups[2].Value.ToLowerInvariant();
            return new SqlException(245, $"将数据插入列 '{m.Groups[4].Value}' 时，无法把值转换成数据类型 {type}。");
        }
        if (message.Contains("database or disk is full")) return new SqlException(1105, "数据库已满：每个数据库最多约 50 MB。");
        if (message.Contains("misuse of aggregate")) return new SqlException(147, "聚合不应出现在 WHERE 子句中，除非该聚合位于 HAVING 子句或选择列表所包含的子查询中。");
        if (message.Contains("interrupted")) return new SqlException(-2, $"执行超时：查询超过 {TimeLimit?.TotalSeconds ?? 0} 秒，已停止。检查是否缺少 WHERE 条件或连接条件。");
        if (message.Contains("database is locked")) return new SqlException(1222, "已超过了锁请求超时时段：数据库正被其他程序修改，请稍后再试。");
        return new SqlException(50000, "执行出错：" + message.Replace("SQLite Error ", "").Trim());
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        Connection.Dispose();
    }
}
