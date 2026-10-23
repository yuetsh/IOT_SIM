using System.Collections;
using System.Data.Common;
using System.Globalization;
using Sim.Data.Engine;

namespace System.Data.SqlClient;

/// <summary>按行读取查询结果（结果已在内存里，读的时候不再访问数据库）</summary>
public sealed class SqlDataReader : DbDataReader
{
    private readonly BatchResult _batch;
    private readonly SqlConnection? _closeConnection;
    private int _resultIndex;
    private int _row = -1;
    private bool _closed;

    internal SqlDataReader(BatchResult batch, SqlConnection? closeConnection)
    {
        _batch = batch;
        _closeConnection = closeConnection;
    }

    private QueryResult? Current => _resultIndex < _batch.Results.Count ? _batch.Results[_resultIndex] : null;

    private object[] Row
    {
        get
        {
            if (_closed) throw new InvalidOperationException("阅读器关闭时尝试调用 Read 无效。");
            var current = Current;
            if (current == null || _row < 0 || _row >= current.Rows.Count) throw new InvalidOperationException("不存在数据时进行无效的读取尝试。");
            return current.Rows[_row];
        }
    }

    public override int FieldCount => Current?.Columns.Count ?? 0;
    public override bool HasRows => Current?.Rows.Count > 0;
    public override bool IsClosed => _closed;
    public override int RecordsAffected => _batch.RecordsAffected;
    public override int Depth => 0;

    public override object this[int ordinal] => GetValue(ordinal);
    public override object this[string name] => GetValue(GetOrdinal(name));

    public override bool Read()
    {
        if (_closed) throw new InvalidOperationException("阅读器关闭时尝试调用 Read 无效。");
        var current = Current;
        if (current == null) return false;
        _row++;
        return _row < current.Rows.Count;
    }

    public override bool NextResult()
    {
        _resultIndex++;
        _row = -1;
        return Current != null;
    }

    public override void Close()
    {
        if (_closed) return;
        _closed = true;
        _closeConnection?.Close();
    }

    public override string GetName(int ordinal) => Column(ordinal).Name;

    public override int GetOrdinal(string name)
    {
        var columns = Current?.Columns ?? throw new IndexOutOfRangeException(name);
        for (var i = 0; i < columns.Count; i++)
            if (string.Equals(columns[i].Name, name, StringComparison.OrdinalIgnoreCase)) return i;
        throw new IndexOutOfRangeException(name);
    }

    public override Type GetFieldType(int ordinal) => Column(ordinal).ClrType;
    public override string GetDataTypeName(int ordinal) => Column(ordinal).Type?.Name ?? "sql_variant";

    public override object GetValue(int ordinal)
    {
        Column(ordinal);
        return Row[ordinal];
    }

    public override int GetValues(object[] values)
    {
        var row = Row;
        var count = Math.Min(values.Length, row.Length);
        Array.Copy(row, values, count);
        return count;
    }

    public override bool IsDBNull(int ordinal) => GetValue(ordinal) is DBNull;

    public override bool GetBoolean(int ordinal) => Cast<bool>(ordinal);
    public override byte GetByte(int ordinal) => Cast<byte>(ordinal);
    public override char GetChar(int ordinal) => throw new NotSupportedException("SqlDataReader 不支持 GetChar。");
    public override DateTime GetDateTime(int ordinal) => Cast<DateTime>(ordinal);
    public override decimal GetDecimal(int ordinal) => Cast<decimal>(ordinal);
    public override double GetDouble(int ordinal) => Cast<double>(ordinal);
    public override float GetFloat(int ordinal) => Cast<float>(ordinal);
    public override Guid GetGuid(int ordinal) => Cast<Guid>(ordinal);
    public override short GetInt16(int ordinal) => Cast<short>(ordinal);
    public override int GetInt32(int ordinal) => Cast<int>(ordinal);
    public override long GetInt64(int ordinal) => Cast<long>(ordinal);
    public override string GetString(int ordinal) => Cast<string>(ordinal);

    /// <summary>和 SqlClient 一样严格：列是 varchar 时 GetInt32 报"指定的转换无效"，是 NULL 时报"数据为空"</summary>
    private T Cast<T>(int ordinal)
    {
        var value = GetValue(ordinal);
        if (value is DBNull) throw new InvalidCastException("数据为空。不能对空值调用此方法或属性。");
        if (value is T typed) return typed;
        // 表达式列（如 count(*)）没有声明类型，数字之间可以互相转换
        if (Column(ordinal).Type == null && value is IConvertible && typeof(T) != typeof(string))
            return (T)Convert.ChangeType(value, typeof(T), CultureInfo.InvariantCulture);
        throw new InvalidCastException("指定的转换无效。");
    }

    public override long GetBytes(int ordinal, long dataOffset, byte[]? buffer, int bufferOffset, int length)
    {
        var bytes = Cast<byte[]>(ordinal);
        if (buffer == null) return bytes.Length;
        var count = (int)Math.Min(length, bytes.Length - dataOffset);
        if (count <= 0) return 0;
        Array.Copy(bytes, dataOffset, buffer, bufferOffset, count);
        return count;
    }

    public override long GetChars(int ordinal, long dataOffset, char[]? buffer, int bufferOffset, int length)
    {
        var text = Cast<string>(ordinal);
        if (buffer == null) return text.Length;
        var count = (int)Math.Min(length, text.Length - dataOffset);
        if (count <= 0) return 0;
        text.CopyTo((int)dataOffset, buffer, bufferOffset, count);
        return count;
    }

    public override IEnumerator GetEnumerator() => new DbEnumerator(this, closeReader: false);

    /// <summary>列的结构信息：DbDataAdapter 填充、SqlCommandBuilder 生成增删改语句时要用（主键、自增、来自哪张表的哪一列）</summary>
    public override DataTable GetSchemaTable()
    {
        var table = new DataTable("SchemaTable");
        table.Columns.Add(SchemaTableColumn.ColumnName, typeof(string));
        table.Columns.Add(SchemaTableColumn.ColumnOrdinal, typeof(int));
        table.Columns.Add(SchemaTableColumn.ColumnSize, typeof(int));
        table.Columns.Add(SchemaTableColumn.NumericPrecision, typeof(short));
        table.Columns.Add(SchemaTableColumn.NumericScale, typeof(short));
        table.Columns.Add(SchemaTableColumn.IsUnique, typeof(bool));
        table.Columns.Add(SchemaTableColumn.IsKey, typeof(bool));
        table.Columns.Add(SchemaTableOptionalColumn.BaseServerName, typeof(string));
        table.Columns.Add(SchemaTableOptionalColumn.BaseCatalogName, typeof(string));
        table.Columns.Add(SchemaTableColumn.BaseColumnName, typeof(string));
        table.Columns.Add(SchemaTableColumn.BaseSchemaName, typeof(string));
        table.Columns.Add(SchemaTableColumn.BaseTableName, typeof(string));
        table.Columns.Add(SchemaTableColumn.DataType, typeof(Type));
        table.Columns.Add(SchemaTableColumn.AllowDBNull, typeof(bool));
        table.Columns.Add(SchemaTableColumn.ProviderType, typeof(int));
        table.Columns.Add(SchemaTableColumn.IsAliased, typeof(bool));
        table.Columns.Add(SchemaTableColumn.IsExpression, typeof(bool));
        table.Columns.Add("IsIdentity", typeof(bool));
        table.Columns.Add(SchemaTableOptionalColumn.IsAutoIncrement, typeof(bool));
        table.Columns.Add(SchemaTableOptionalColumn.IsRowVersion, typeof(bool));
        table.Columns.Add(SchemaTableOptionalColumn.IsHidden, typeof(bool));
        table.Columns.Add(SchemaTableColumn.IsLong, typeof(bool));
        table.Columns.Add(SchemaTableOptionalColumn.IsReadOnly, typeof(bool));
        table.Columns.Add("DataTypeName", typeof(string));

        var columns = Current?.Columns ?? Array.Empty<ResultColumn>();
        for (var i = 0; i < columns.Count; i++)
        {
            var c = columns[i];
            var row = table.NewRow();
            row[SchemaTableColumn.ColumnName] = c.Name;
            row[SchemaTableColumn.ColumnOrdinal] = i;
            row[SchemaTableColumn.ColumnSize] = c.Type?.MaxLength ?? (c.Type?.IsMax == true ? int.MaxValue : 0);
            row[SchemaTableColumn.NumericPrecision] = (short)(c.Type?.Precision ?? 0);
            row[SchemaTableColumn.NumericScale] = (short)(c.Type?.Scale ?? 0);
            row[SchemaTableColumn.IsUnique] = c.IsKey;
            row[SchemaTableColumn.IsKey] = c.IsKey;
            row[SchemaTableColumn.BaseColumnName] = (object?)c.BaseColumn ?? DBNull.Value;
            row[SchemaTableColumn.BaseSchemaName] = c.BaseTable != null ? "dbo" : DBNull.Value;
            row[SchemaTableColumn.BaseTableName] = (object?)c.BaseTable ?? DBNull.Value;
            row[SchemaTableColumn.DataType] = c.ClrType;
            row[SchemaTableColumn.AllowDBNull] = c.AllowNull;
            row[SchemaTableColumn.ProviderType] = 0;
            row[SchemaTableColumn.IsAliased] = c.BaseColumn != null && !string.Equals(c.BaseColumn, c.Name, StringComparison.OrdinalIgnoreCase);
            row[SchemaTableColumn.IsExpression] = c.BaseColumn == null;
            row["IsIdentity"] = c.IsIdentity;
            row[SchemaTableOptionalColumn.IsAutoIncrement] = c.IsIdentity;
            row[SchemaTableOptionalColumn.IsRowVersion] = false;
            row[SchemaTableOptionalColumn.IsHidden] = false;
            row[SchemaTableColumn.IsLong] = c.Type is { IsMax: true } or { Name: "text" or "ntext" or "image" };
            row[SchemaTableOptionalColumn.IsReadOnly] = c.IsIdentity || c.BaseColumn == null;
            row["DataTypeName"] = c.Type?.Name ?? "sql_variant";
            table.Rows.Add(row);
        }
        return table;
    }

    private ResultColumn Column(int ordinal)
    {
        var columns = Current?.Columns;
        if (columns == null || ordinal < 0 || ordinal >= columns.Count) throw new IndexOutOfRangeException("索引超出了数组界限。");
        return columns[ordinal];
    }
}
