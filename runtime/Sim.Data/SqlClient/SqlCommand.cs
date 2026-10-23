using System.Collections;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using Sim.Data.Engine;

namespace System.Data.SqlClient;

/// <summary>执行 T-SQL 语句。一条命令里可以有多条语句（用分号或换行分开）</summary>
public sealed class SqlCommand : DbCommand, ICloneable
{
    private SqlConnection? _connection;
    private string _commandText = "";
    private CommandType _commandType = CommandType.Text;

    public SqlCommand() { }

    public SqlCommand(string cmdText) => CommandText = cmdText;

    public SqlCommand(string cmdText, SqlConnection connection) : this(cmdText) => Connection = connection;

    public SqlCommand(string cmdText, SqlConnection connection, SqlTransaction transaction) : this(cmdText, connection) => Transaction = transaction;

    [Diagnostics.CodeAnalysis.AllowNull]
    public override string CommandText
    {
        get => _commandText;
        set => _commandText = value ?? "";
    }

    public override int CommandTimeout { get; set; } = 30;

    public override CommandType CommandType
    {
        get => _commandType;
        set => _commandType = value;
    }

    public new SqlConnection? Connection
    {
        get => _connection;
        set => _connection = value;
    }

    protected override DbConnection? DbConnection
    {
        get => _connection;
        set => _connection = (SqlConnection?)value;
    }

    public new SqlParameterCollection Parameters { get; } = new();
    protected override DbParameterCollection DbParameterCollection => Parameters;

    public new SqlTransaction? Transaction { get; set; }

    protected override DbTransaction? DbTransaction
    {
        get => Transaction;
        set => Transaction = (SqlTransaction?)value;
    }

    public override bool DesignTimeVisible { get; set; } = true;
    public override UpdateRowSource UpdatedRowSource { get; set; } = UpdateRowSource.Both;

    public override int ExecuteNonQuery() => Run(nameof(ExecuteNonQuery)).RecordsAffected;

    public override object? ExecuteScalar()
    {
        var result = Run(nameof(ExecuteScalar));
        return result.Results.Count > 0 && result.Results[0].Rows.Count > 0 ? result.Results[0].Rows[0][0] : null;
    }

    public new SqlDataReader ExecuteReader() => ExecuteReader(CommandBehavior.Default);

    public new SqlDataReader ExecuteReader(CommandBehavior behavior) =>
        new(Run(nameof(ExecuteReader)), behavior.HasFlag(CommandBehavior.CloseConnection) ? _connection : null);

    protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => ExecuteReader(behavior);

    public override void Cancel() { }
    public override void Prepare() { }

    public new SqlParameter CreateParameter() => new();
    protected override DbParameter CreateDbParameter() => CreateParameter();

    public SqlCommand Clone()
    {
        var clone = new SqlCommand(_commandText, _connection!) { CommandType = _commandType, CommandTimeout = CommandTimeout, Transaction = Transaction };
        foreach (SqlParameter parameter in Parameters) clone.Parameters.Add(parameter.Clone());
        return clone;
    }

    object ICloneable.Clone() => Clone();

    private BatchResult Run(string operation)
    {
        if (_connection == null) throw new InvalidOperationException($"{operation}: Connection 属性尚未初始化。");
        var session = _connection.Session(operation);
        if (string.IsNullOrWhiteSpace(_commandText)) throw new InvalidOperationException($"{operation}: CommandText 属性尚未初始化");
        if (_commandType == CommandType.StoredProcedure) throw SqlException.NotSupported("存储过程");
        try
        {
            return session.Execute(_commandText, name =>
            {
                var parameter = Parameters.Find(name);
                return parameter == null ? (false, null) : (true, parameter.Value);
            });
        }
        catch (SqlException ex)
        {
            throw ex.Rethrow();
        }
    }
}

public sealed class SqlParameter : DbParameter, ICloneable
{
    private SqlDbType _sqlDbType = SqlDbType.NVarChar;
    private bool _typeSet;
    private string _parameterName = "";
    private string _sourceColumn = "";

    public SqlParameter() { }

    public SqlParameter(string parameterName, object? value)
    {
        ParameterName = parameterName;
        Value = value;
    }

    public SqlParameter(string parameterName, SqlDbType dbType)
    {
        ParameterName = parameterName;
        SqlDbType = dbType;
    }

    public SqlParameter(string parameterName, SqlDbType dbType, int size) : this(parameterName, dbType) => Size = size;

    public SqlParameter(string parameterName, SqlDbType dbType, int size, string sourceColumn) : this(parameterName, dbType, size) => SourceColumn = sourceColumn;

    [Diagnostics.CodeAnalysis.AllowNull]
    public override string ParameterName
    {
        get => _parameterName;
        set => _parameterName = value ?? "";
    }

    public override object? Value { get; set; }

    public SqlDbType SqlDbType
    {
        get => _sqlDbType;
        set
        {
            _sqlDbType = value;
            _typeSet = true;
        }
    }

    public override DbType DbType
    {
        get => _sqlDbType switch
        {
            SqlDbType.Int => DbType.Int32,
            SqlDbType.BigInt => DbType.Int64,
            SqlDbType.SmallInt => DbType.Int16,
            SqlDbType.TinyInt => DbType.Byte,
            SqlDbType.Bit => DbType.Boolean,
            SqlDbType.Float => DbType.Double,
            SqlDbType.Real => DbType.Single,
            SqlDbType.Decimal or SqlDbType.Money => DbType.Decimal,
            SqlDbType.DateTime or SqlDbType.SmallDateTime or SqlDbType.Date => DbType.DateTime,
            SqlDbType.VarBinary or SqlDbType.Image or SqlDbType.Binary => DbType.Binary,
            SqlDbType.UniqueIdentifier => DbType.Guid,
            SqlDbType.VarChar or SqlDbType.Char or SqlDbType.Text => DbType.AnsiString,
            _ => DbType.String,
        };
        set => SqlDbType = value switch
        {
            DbType.Int32 => SqlDbType.Int,
            DbType.Int64 => SqlDbType.BigInt,
            DbType.Int16 => SqlDbType.SmallInt,
            DbType.Byte => SqlDbType.TinyInt,
            DbType.Boolean => SqlDbType.Bit,
            DbType.Double => SqlDbType.Float,
            DbType.Single => SqlDbType.Real,
            DbType.Decimal or DbType.Currency => SqlDbType.Decimal,
            DbType.DateTime or DbType.Date => SqlDbType.DateTime,
            DbType.Binary => SqlDbType.VarBinary,
            DbType.Guid => SqlDbType.UniqueIdentifier,
            DbType.AnsiString => SqlDbType.VarChar,
            _ => SqlDbType.NVarChar,
        };
    }

    public override ParameterDirection Direction { get; set; } = ParameterDirection.Input;
    public override bool IsNullable { get; set; }
    public override int Size { get; set; }
    public new byte Precision { get; set; }
    public new byte Scale { get; set; }

    [Diagnostics.CodeAnalysis.AllowNull]
    public override string SourceColumn
    {
        get => _sourceColumn;
        set => _sourceColumn = value ?? "";
    }

    public override bool SourceColumnNullMapping { get; set; }
    public override DataRowVersion SourceVersion { get; set; } = DataRowVersion.Current;

    public override void ResetDbType()
    {
        _sqlDbType = SqlDbType.NVarChar;
        _typeSet = false;
    }

    internal bool TypeSet => _typeSet;

    public SqlParameter Clone() => new(_parameterName, Value)
    {
        _sqlDbType = _sqlDbType,
        _typeSet = _typeSet,
        Direction = Direction,
        Size = Size,
        SourceColumn = SourceColumn,
        SourceVersion = SourceVersion,
        SourceColumnNullMapping = SourceColumnNullMapping,
        IsNullable = IsNullable,
    };

    object ICloneable.Clone() => Clone();

    public override string ToString() => _parameterName;
}

public sealed class SqlParameterCollection : DbParameterCollection
{
    private readonly List<SqlParameter> _items = new();

    public override int Count => _items.Count;
    public override object SyncRoot => this;

    public new SqlParameter this[int index]
    {
        get => _items[index];
        set => _items[index] = value;
    }

    public new SqlParameter this[string parameterName]
    {
        get => Find(parameterName) ?? throw new IndexOutOfRangeException($"此 SqlParameterCollection 中未包含带有 ParameterName“{parameterName}”的 SqlParameter。");
        set => _items[IndexOf(parameterName)] = value;
    }

    /// <summary>按名字找参数，"@id" 和 "id" 视为同一个（和 SqlClient 一样不区分大小写）</summary>
    internal SqlParameter? Find(string name)
    {
        var bare = name.TrimStart('@');
        return _items.FirstOrDefault(p => string.Equals(p.ParameterName.TrimStart('@'), bare, StringComparison.OrdinalIgnoreCase));
    }

    public SqlParameter Add(SqlParameter value)
    {
        _items.Add(value ?? throw new ArgumentNullException(nameof(value)));
        return value;
    }

    public override int Add(object value)
    {
        Add(value as SqlParameter ?? throw new InvalidCastException("SqlParameterCollection 只接受非空的 SqlParameter 类型对象。"));
        return _items.Count - 1;
    }

    public SqlParameter Add(string parameterName, SqlDbType sqlDbType) => Add(new SqlParameter(parameterName, sqlDbType));
    public SqlParameter Add(string parameterName, SqlDbType sqlDbType, int size) => Add(new SqlParameter(parameterName, sqlDbType, size));
    public SqlParameter Add(string parameterName, SqlDbType sqlDbType, int size, string sourceColumn) => Add(new SqlParameter(parameterName, sqlDbType, size, sourceColumn));
    public SqlParameter AddWithValue(string parameterName, object? value) => Add(new SqlParameter(parameterName, value));

    public override void AddRange(Array values)
    {
        foreach (var value in values) Add(value);
    }

    public void AddRange(SqlParameter[] values) => AddRange((Array)values);

    public override void Clear() => _items.Clear();
    public override bool Contains(object value) => value is SqlParameter p && _items.Contains(p);
    public override bool Contains(string value) => Find(value) != null;
    public override void CopyTo(Array array, int index) => ((ICollection)_items).CopyTo(array, index);
    public override IEnumerator GetEnumerator() => _items.GetEnumerator();
    public override int IndexOf(object value) => value is SqlParameter p ? _items.IndexOf(p) : -1;
    public override int IndexOf(string parameterName) => Find(parameterName) is { } p ? _items.IndexOf(p) : -1;
    public override void Insert(int index, object value) => _items.Insert(index, (SqlParameter)value);
    public override void Remove(object value) => _items.Remove((SqlParameter)value);
    public override void RemoveAt(int index) => _items.RemoveAt(index);
    public override void RemoveAt(string parameterName) => _items.RemoveAt(IndexOf(parameterName));
    protected override DbParameter GetParameter(int index) => _items[index];
    protected override DbParameter GetParameter(string parameterName) => this[parameterName];
    protected override void SetParameter(int index, DbParameter value) => _items[index] = (SqlParameter)value;
    protected override void SetParameter(string parameterName, DbParameter value) => this[parameterName] = (SqlParameter)value;
}
