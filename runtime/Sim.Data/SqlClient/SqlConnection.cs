using System.Collections.Generic;
using System.Data.Common;
using Sim.Data.Engine;

namespace System.Data.SqlClient;

/// <summary>
/// 数据库连接。连接字符串里的服务器名、账号、密码都不检查（书上的长服务器名、"." 都能连上），
/// 只按 Initial Catalog（或 Database）打开这个学生自己的同名数据库；不写时连到 master。
/// </summary>
public sealed class SqlConnection : DbConnection, ICloneable
{
    private static readonly HashSet<string> KnownKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "data source", "server", "address", "addr", "network address", "initial catalog", "database", "user id", "uid", "user",
        "password", "pwd", "integrated security", "trusted_connection", "persist security info", "persistsecurityinfo",
        "connect timeout", "connection timeout", "timeout", "pooling", "max pool size", "min pool size", "multipleactiveresultsets",
        "encrypt", "trustservercertificate", "application name", "app", "workstation id", "wsid", "packet size",
        "asynchronous processing", "async", "user instance", "attachdbfilename", "connection lifetime", "load balance timeout", "current language", "language",
    };

    private string _connectionString = "";
    private ConnectionState _state = ConnectionState.Closed;
    private Session? _session;

    public SqlConnection() { }

    public SqlConnection(string connectionString) => ConnectionString = connectionString;

    [Diagnostics.CodeAnalysis.AllowNull]
    public override string ConnectionString
    {
        get => _connectionString;
        set
        {
            if (_state != ConnectionState.Closed) throw new InvalidOperationException("不允许更改“ConnectionString”属性。连接的当前状态为打开。");
            _connectionString = value ?? "";
        }
    }

    public override string Database => _session?.Database ?? Setting("initial catalog", "database") ?? DatabaseStore.Master;
    public override string DataSource => Setting("data source", "server", "address", "addr", "network address") ?? "";
    public override string ServerVersion => "10.50.1600";
    public override ConnectionState State => _state;
    public override int ConnectionTimeout => 15;
    public string WorkstationId => Environment.MachineName;

    /// <summary>连接打开时的数据库会话（平台内部使用）</summary>
    internal Session Session(string operation) =>
        _state == ConnectionState.Open && _session != null
            ? _session
            : throw new InvalidOperationException($"{operation} 要求已打开且可用的连接。连接的当前状态为已关闭。");

    public override void Open()
    {
        if (_state == ConnectionState.Open) throw new InvalidOperationException("连接未关闭。连接的当前状态为打开。");
        CheckKeywords();
        var store = DatabaseStore.FromEnvironment()
            ?? throw new SqlException(-1, "在与 SQL Server 建立连接时出现与网络相关的或特定于实例的错误：这次运行没有准备数据库。");
        try
        {
            _session = new Session(store, Database);
        }
        catch (SqlException ex)
        {
            throw ex.Rethrow();
        }
        SetState(ConnectionState.Open);
    }

    public override void Close()
    {
        if (_session == null) return;
        _session.Dispose();
        _session = null;
        SetState(ConnectionState.Closed);
    }

    public override void ChangeDatabase(string databaseName) => Session("ChangeDatabase").ChangeDatabase(databaseName);

    public new SqlCommand CreateCommand() => new() { Connection = this };

    protected override DbCommand CreateDbCommand() => CreateCommand();

    public new SqlTransaction BeginTransaction() => BeginTransaction(IsolationLevel.ReadCommitted);

    public new SqlTransaction BeginTransaction(IsolationLevel iso)
    {
        Session("BeginTransaction").BeginTransaction();
        return new SqlTransaction(this, iso);
    }

    protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => BeginTransaction(isolationLevel);

    public object Clone() => new SqlConnection(_connectionString);

    public static void ClearAllPools() { }
    public static void ClearPool(SqlConnection connection) { }

    protected override void Dispose(bool disposing)
    {
        if (disposing) Close();
        base.Dispose(disposing);
    }

    private void SetState(ConnectionState state)
    {
        var original = _state;
        _state = state;
        OnStateChange(new StateChangeEventArgs(original, state));
    }

    private string? Setting(params string[] keys)
    {
        var builder = Parse();
        foreach (var key in keys)
            if (builder.TryGetValue(key, out var value) && value?.ToString() is { Length: > 0 } text) return text.Trim();
        return null;
    }

    private DbConnectionStringBuilder Parse()
    {
        try
        {
            return new DbConnectionStringBuilder { ConnectionString = _connectionString };
        }
        catch (ArgumentException)
        {
            throw new ArgumentException("初始化字符串的格式不符合从索引 0 处开始的规范。");
        }
    }

    private void CheckKeywords()
    {
        foreach (string key in Parse().Keys)
            if (!KnownKeywords.Contains(key)) throw new ArgumentException($"不支持关键字:“{key}”。");
        if (Setting("attachdbfilename") != null) throw new SqlException(-1, "平台不支持 AttachDbFilename：请用 Initial Catalog 指定数据库名。");
    }
}

public sealed class SqlTransaction : DbTransaction
{
    private readonly SqlConnection _connection;
    private bool _done;

    internal SqlTransaction(SqlConnection connection, IsolationLevel isolationLevel)
    {
        _connection = connection;
        IsolationLevel = isolationLevel;
    }

    public new SqlConnection Connection => _connection;
    protected override DbConnection DbConnection => _connection;
    public override IsolationLevel IsolationLevel { get; }

    public override void Commit()
    {
        if (_done) throw new InvalidOperationException("此 SqlTransaction 已完成；它再也无法使用。");
        _done = true;
        _connection.Session("Commit").Commit();
    }

    public override void Rollback()
    {
        if (_done) throw new InvalidOperationException("此 SqlTransaction 已完成；它再也无法使用。");
        _done = true;
        _connection.Session("Rollback").Rollback();
    }
}
