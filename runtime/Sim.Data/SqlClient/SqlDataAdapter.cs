using System.Data.Common;

namespace System.Data.SqlClient;

public delegate void SqlRowUpdatingEventHandler(object sender, SqlRowUpdatingEventArgs e);
public delegate void SqlRowUpdatedEventHandler(object sender, SqlRowUpdatedEventArgs e);

public sealed class SqlRowUpdatingEventArgs : RowUpdatingEventArgs
{
    public SqlRowUpdatingEventArgs(DataRow row, IDbCommand? command, StatementType statementType, DataTableMapping tableMapping)
        : base(row, command, statementType, tableMapping) { }

    public new SqlCommand? Command
    {
        get => (SqlCommand?)base.Command;
        set => base.Command = value;
    }
}

public sealed class SqlRowUpdatedEventArgs : RowUpdatedEventArgs
{
    public SqlRowUpdatedEventArgs(DataRow row, IDbCommand? command, StatementType statementType, DataTableMapping tableMapping)
        : base(row, command, statementType, tableMapping) { }

    public new SqlCommand? Command => (SqlCommand?)base.Command;
}

/// <summary>在数据库和 DataSet 之间搬运数据：Fill 读出来，Update 把 DataTable 里改过的行写回去</summary>
public sealed class SqlDataAdapter : DbDataAdapter, ICloneable
{
    public SqlDataAdapter() { }

    public SqlDataAdapter(SqlCommand selectCommand) => SelectCommand = selectCommand;

    public SqlDataAdapter(string selectCommandText, SqlConnection selectConnection) => SelectCommand = new SqlCommand(selectCommandText, selectConnection);

    public SqlDataAdapter(string selectCommandText, string selectConnectionString) =>
        SelectCommand = new SqlCommand(selectCommandText, new SqlConnection(selectConnectionString));

    public new SqlCommand? SelectCommand
    {
        get => (SqlCommand?)base.SelectCommand;
        set => base.SelectCommand = value;
    }

    public new SqlCommand? InsertCommand
    {
        get => (SqlCommand?)base.InsertCommand;
        set => base.InsertCommand = value;
    }

    public new SqlCommand? UpdateCommand
    {
        get => (SqlCommand?)base.UpdateCommand;
        set => base.UpdateCommand = value;
    }

    public new SqlCommand? DeleteCommand
    {
        get => (SqlCommand?)base.DeleteCommand;
        set => base.DeleteCommand = value;
    }

    public event SqlRowUpdatingEventHandler? RowUpdating;
    public event SqlRowUpdatedEventHandler? RowUpdated;

    protected override RowUpdatingEventArgs CreateRowUpdatingEvent(DataRow dataRow, IDbCommand? command, StatementType statementType, DataTableMapping tableMapping) =>
        new SqlRowUpdatingEventArgs(dataRow, command, statementType, tableMapping);

    protected override RowUpdatedEventArgs CreateRowUpdatedEvent(DataRow dataRow, IDbCommand? command, StatementType statementType, DataTableMapping tableMapping) =>
        new SqlRowUpdatedEventArgs(dataRow, command, statementType, tableMapping);

    protected override void OnRowUpdating(RowUpdatingEventArgs value) => RowUpdating?.Invoke(this, (SqlRowUpdatingEventArgs)value);

    protected override void OnRowUpdated(RowUpdatedEventArgs value) => RowUpdated?.Invoke(this, (SqlRowUpdatedEventArgs)value);

    object ICloneable.Clone() => new SqlDataAdapter { SelectCommand = SelectCommand, InsertCommand = InsertCommand, UpdateCommand = UpdateCommand, DeleteCommand = DeleteCommand };
}

/// <summary>按 SqlDataAdapter 的查询语句自动生成 INSERT / UPDATE / DELETE（要求查询包含主键列）</summary>
public sealed class SqlCommandBuilder : DbCommandBuilder
{
    public SqlCommandBuilder()
    {
        QuotePrefix = "[";
        QuoteSuffix = "]";
    }

    public SqlCommandBuilder(SqlDataAdapter adapter) : this() => DataAdapter = adapter;

    public new SqlDataAdapter? DataAdapter
    {
        get => (SqlDataAdapter?)base.DataAdapter;
        set => base.DataAdapter = value;
    }

    public new SqlCommand GetInsertCommand() => (SqlCommand)base.GetInsertCommand();
    public new SqlCommand GetInsertCommand(bool useColumnsForParameterNames) => (SqlCommand)base.GetInsertCommand(useColumnsForParameterNames);
    public new SqlCommand GetUpdateCommand() => (SqlCommand)base.GetUpdateCommand();
    public new SqlCommand GetUpdateCommand(bool useColumnsForParameterNames) => (SqlCommand)base.GetUpdateCommand(useColumnsForParameterNames);
    public new SqlCommand GetDeleteCommand() => (SqlCommand)base.GetDeleteCommand();
    public new SqlCommand GetDeleteCommand(bool useColumnsForParameterNames) => (SqlCommand)base.GetDeleteCommand(useColumnsForParameterNames);

    protected override void ApplyParameterInfo(DbParameter parameter, DataRow row, StatementType statementType, bool whereClause) { }

    protected override string GetParameterName(int parameterOrdinal) => "@p" + parameterOrdinal.ToString(Globalization.CultureInfo.InvariantCulture);
    protected override string GetParameterName(string parameterName) => "@" + parameterName;
    protected override string GetParameterPlaceholder(int parameterOrdinal) => GetParameterName(parameterOrdinal);

    public override string QuoteIdentifier(string unquotedIdentifier) => "[" + unquotedIdentifier.Replace("]", "]]") + "]";

    protected override void SetRowUpdatingHandler(DbDataAdapter adapter)
    {
        if (adapter is not SqlDataAdapter sql) throw new InvalidOperationException("SqlCommandBuilder 只能用于 SqlDataAdapter。");
        if (adapter == base.DataAdapter) sql.RowUpdating += Handler;
        else sql.RowUpdating -= Handler;
    }

    private void Handler(object sender, SqlRowUpdatingEventArgs e) => RowUpdatingHandler(e);
}
