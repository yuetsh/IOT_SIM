using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Sim.Data.Engine;

/// <summary>翻译好的一条语句</summary>
internal abstract record Statement;

/// <summary>在 SQLite 上执行的语句；IsQuery 表示有结果集；AfterExecute 在同一事务里更新元数据</summary>
internal sealed record SqliteStatement(string Sql, bool IsQuery, IReadOnlyList<string> Parameters, Action<Microsoft.Data.Sqlite.SqliteConnection>? AfterExecute = null) : Statement;

internal sealed record CreateDatabase(string Name) : Statement;
internal sealed record DropDatabases(IReadOnlyList<string> Names) : Statement;
internal sealed record UseDatabase(string Name) : Statement;
/// <summary>SET NOCOUNT ON 之类不影响结果的语句</summary>
internal sealed record IgnoredStatement : Statement;

/// <summary>
/// 把 T-SQL（SQL Server 2008 语法）转写成 SQLite 语句。只转写认识的语法节点，其余一律报"平台暂不支持"，
/// 生成的 SQL 里只会出现这里写出的关键字和 tsql_ 函数，学生的 SQL 无法借此执行 SQLite 特有的命令。
/// 一批语句先整体解析（语法错误和 SQL Server 一样在执行前报出），执行时再逐条转写（后面的语句能用到前面刚建的表）。
/// </summary>
internal sealed class Translator
{
    private readonly Func<string, TableInfo?> _lookup;
    private readonly StringBuilder _sql = new();
    private readonly List<string> _parameters = new();

    private Translator(Func<string, TableInfo?> lookup) => _lookup = lookup;

    /// <summary>解析整批语句；有语法错误时抛出 SqlException 102</summary>
    public static IReadOnlyList<TSqlStatement> Parse(string sql)
    {
        var parser = new TSql100Parser(initialQuotedIdentifiers: true);
        var fragment = parser.Parse(new StringReader(sql), out var errors);
        if (errors.Count > 0) throw SyntaxError(sql, errors[0]);
        return ((TSqlScript)fragment).Batches.SelectMany(b => b.Statements).ToList();
    }

    /// <summary>转写一条语句；lookup 按表名取表结构（INSERT 跳过自增列、按列类型转换值时要用）</summary>
    public static Statement Translate(TSqlStatement statement, Func<string, TableInfo?> lookup) => new Translator(lookup).Statement(statement);

    private static SqlException SyntaxError(string sql, ParseError error)
    {
        // ParseError 的信息是英文，这里取出错位置的词，按 SQL Server 中文版的格式报
        var rest = error.Offset < sql.Length ? sql[error.Offset..] : "";
        var token = new string(rest.TakeWhile(c => !char.IsWhiteSpace(c) && c is not (',' or ')' or '(' or ';')).ToArray());
        if (token.Length == 0 && rest.Length > 0) token = rest[..1];
        if (token.Length == 0) return new SqlException(102, "语句不完整，结尾附近有语法错误。", error.Line);
        if (token.StartsWith('\'')) return new SqlException(105, $"字符串 '{token.Trim('\'')}' 后的引号不完整。", error.Line);
        return SqlException.Syntax(token, error.Line);
    }

    // ---------- 语句 ----------

    private Statement Statement(TSqlStatement statement)
    {
        switch (statement)
        {
            case SelectStatement select:
                if (select.Into != null) throw SqlException.NotSupported("SELECT ... INTO");
                if (select.WithCtesAndXmlNamespaces != null) throw SqlException.NotSupported("WITH（公用表表达式）");
                Query(select.QueryExpression);
                return Done(isQuery: true);
            case InsertStatement insert:
                Insert(insert.InsertSpecification);
                return Done(isQuery: false);
            case UpdateStatement update:
                Update(update.UpdateSpecification);
                return Done(isQuery: false);
            case DeleteStatement delete:
                Delete(delete.DeleteSpecification);
                return Done(isQuery: false);
            case CreateTableStatement create:
                return CreateTable(create);
            case DropTableStatement drop:
                return DropTable(drop);
            case AlterTableAddTableElementStatement alter:
                return AddColumns(alter);
            case TruncateTableStatement truncate:
            {
                var table = RequireTable(truncate.TableName);
                _sql.Append("DELETE FROM ").Append(Values.QuoteName(table.Name));
                return Done(isQuery: false);
            }
            case CreateDatabaseStatement create:
                return new CreateDatabase(create.DatabaseName.Value);
            case DropDatabaseStatement drop:
                return new DropDatabases(drop.Databases.Select(d => d.Value).ToList());
            case UseStatement use:
                return new UseDatabase(use.DatabaseName.Value);
            case PredicateSetStatement:
                return new IgnoredStatement();
            default:
                throw SqlException.NotSupported(StatementName(statement));
        }
    }

    private SqliteStatement Done(bool isQuery, Action<Microsoft.Data.Sqlite.SqliteConnection>? after = null) =>
        new(_sql.ToString(), isQuery, _parameters.Distinct(StringComparer.OrdinalIgnoreCase).ToList(), after);

    private static string StatementName(TSqlStatement statement) => statement.GetType().Name.Replace("Statement", "") switch
    {
        "CreateProcedure" or "AlterProcedure" => "存储过程",
        "CreateView" or "AlterView" => "视图",
        "CreateTrigger" => "触发器",
        "CreateIndex" => "CREATE INDEX",
        "DeclareVariable" => "DECLARE 变量",
        "If" => "IF 语句",
        "While" => "WHILE 循环",
        "BeginEndBlock" => "BEGIN ... END",
        "Execute" => "EXEC",
        var name => name + " 语句",
    };

    // ---------- 查询 ----------

    private void Query(QueryExpression query)
    {
        switch (query)
        {
            case QuerySpecification spec:
                QuerySpec(spec);
                break;
            case BinaryQueryExpression binary:
                Query(binary.FirstQueryExpression);
                _sql.Append(binary.BinaryQueryExpressionType switch
                {
                    BinaryQueryExpressionType.Union => binary.All ? " UNION ALL " : " UNION ",
                    BinaryQueryExpressionType.Except => " EXCEPT ",
                    _ => " INTERSECT ",
                });
                Query(binary.SecondQueryExpression);
                OrderBy(binary.OrderByClause);
                break;
            case QueryParenthesisExpression paren:
                _sql.Append("SELECT * FROM (");
                Query(paren.QueryExpression);
                _sql.Append(')');
                OrderBy(paren.OrderByClause);
                break;
            default:
                throw SqlException.NotSupported(query.GetType().Name);
        }
    }

    private void QuerySpec(QuerySpecification spec)
    {
        _sql.Append("SELECT ");
        if (spec.UniqueRowFilter == UniqueRowFilter.Distinct) _sql.Append("DISTINCT ");
        for (var i = 0; i < spec.SelectElements.Count; i++)
        {
            if (i > 0) _sql.Append(", ");
            SelectElement(spec.SelectElements[i]);
        }
        if (spec.FromClause != null)
        {
            _sql.Append(" FROM ");
            for (var i = 0; i < spec.FromClause.TableReferences.Count; i++)
            {
                if (i > 0) _sql.Append(", ");
                TableReference(spec.FromClause.TableReferences[i]);
            }
        }
        Where(spec.WhereClause);
        if (spec.GroupByClause != null)
        {
            _sql.Append(" GROUP BY ");
            for (var i = 0; i < spec.GroupByClause.GroupingSpecifications.Count; i++)
            {
                if (i > 0) _sql.Append(", ");
                if (spec.GroupByClause.GroupingSpecifications[i] is not ExpressionGroupingSpecification group) throw SqlException.NotSupported("这种 GROUP BY 写法");
                Expression(group.Expression);
            }
        }
        if (spec.HavingClause != null)
        {
            _sql.Append(" HAVING ");
            Boolean(spec.HavingClause.SearchCondition);
        }
        OrderBy(spec.OrderByClause);
        Top(spec.TopRowFilter);
    }

    private void SelectElement(SelectElement element)
    {
        switch (element)
        {
            case SelectStarExpression star:
                if (star.Qualifier != null) _sql.Append(Values.QuoteName(star.Qualifier.Identifiers[^1].Value)).Append('.');
                _sql.Append('*');
                break;
            case SelectScalarExpression scalar:
                Expression(scalar.Expression);
                if (scalar.ColumnName != null)
                {
                    // as '编号' 和 as 编号 都按列名处理
                    _sql.Append(" AS ").Append(Values.QuoteName(scalar.ColumnName.Value));
                }
                else if (scalar.Expression is not ColumnReferenceExpression)
                {
                    // 和 SQL Server 一样，没有起别名的表达式列没有列名（DataTable 里叫 Column1）
                    _sql.Append(" AS \"\"");
                }
                break;
            default:
                throw SqlException.NotSupported("SELECT @变量 = ...");
        }
    }

    private void TableReference(TableReference reference)
    {
        switch (reference)
        {
            case NamedTableReference named:
                var table = RequireTable(named.SchemaObject);
                _sql.Append(Values.QuoteName(table.Name));
                if (named.Alias != null) _sql.Append(" AS ").Append(Values.QuoteName(named.Alias.Value));
                break;
            case QualifiedJoin join:
                TableReference(join.FirstTableReference);
                _sql.Append(join.QualifiedJoinType switch
                {
                    QualifiedJoinType.Inner => " INNER JOIN ",
                    QualifiedJoinType.LeftOuter => " LEFT JOIN ",
                    QualifiedJoinType.RightOuter => " RIGHT JOIN ",
                    _ => " FULL JOIN ",
                });
                TableReference(join.SecondTableReference);
                _sql.Append(" ON ");
                Boolean(join.SearchCondition);
                break;
            case UnqualifiedJoin cross when cross.UnqualifiedJoinType == UnqualifiedJoinType.CrossJoin:
                TableReference(cross.FirstTableReference);
                _sql.Append(" CROSS JOIN ");
                TableReference(cross.SecondTableReference);
                break;
            case QueryDerivedTable derived:
                _sql.Append('(');
                Query(derived.QueryExpression);
                _sql.Append(')');
                if (derived.Alias != null) _sql.Append(" AS ").Append(Values.QuoteName(derived.Alias.Value));
                break;
            default:
                throw SqlException.NotSupported("这种 FROM 写法");
        }
    }

    private void Where(WhereClause? where)
    {
        if (where == null) return;
        if (where.Cursor != null) throw SqlException.NotSupported("游标");
        _sql.Append(" WHERE ");
        Boolean(where.SearchCondition);
    }

    private void OrderBy(OrderByClause? orderBy)
    {
        if (orderBy == null) return;
        _sql.Append(" ORDER BY ");
        for (var i = 0; i < orderBy.OrderByElements.Count; i++)
        {
            if (i > 0) _sql.Append(", ");
            Expression(orderBy.OrderByElements[i].Expression);
            if (orderBy.OrderByElements[i].SortOrder == SortOrder.Descending) _sql.Append(" DESC");
        }
    }

    private void Top(TopRowFilter? top)
    {
        if (top == null) return;
        if (top.Percent) throw SqlException.NotSupported("TOP ... PERCENT");
        if (top.WithTies) throw SqlException.NotSupported("TOP ... WITH TIES");
        _sql.Append(" LIMIT ");
        Expression(top.Expression);
    }

    // ---------- 增删改 ----------

    private void Insert(InsertSpecification spec)
    {
        if (spec.TopRowFilter != null) throw SqlException.NotSupported("INSERT TOP");
        if (spec.Target is not NamedTableReference target) throw SqlException.NotSupported("这种 INSERT 写法");
        var table = RequireTable(target.SchemaObject);

        // 列：写了列名就按列名；没写就是除自增列以外的全部列（和 SQL Server 一样）
        List<ColumnInfo> columns;
        if (spec.Columns.Count > 0)
        {
            columns = spec.Columns.Select(c => RequireColumn(table, c.MultiPartIdentifier.Identifiers[^1].Value)).ToList();
            if (columns.FirstOrDefault(c => c.Identity) != null) throw SqlException.IdentityInsert(table.Name);
        }
        else
        {
            columns = table.Columns.Where(c => !c.Identity).ToList();
        }

        _sql.Append("INSERT INTO ").Append(Values.QuoteName(table.Name));
        switch (spec.InsertSource)
        {
            case ValuesInsertSource { IsDefaultValues: true }:
                _sql.Append(" DEFAULT VALUES");
                break;
            case ValuesInsertSource values:
                _sql.Append(" (").Append(string.Join(", ", columns.Select(c => Values.QuoteName(c.Name)))).Append(") VALUES ");
                for (var r = 0; r < values.RowValues.Count; r++)
                {
                    var row = values.RowValues[r].ColumnValues;
                    if (row.Count != columns.Count) throw SqlException.ColumnCountMismatch();
                    if (r > 0) _sql.Append(", ");
                    _sql.Append('(');
                    for (var i = 0; i < row.Count; i++)
                    {
                        if (i > 0) _sql.Append(", ");
                        ValueFor(columns[i], row[i]);
                    }
                    _sql.Append(')');
                }
                break;
            case SelectInsertSource select:
                _sql.Append(" (").Append(string.Join(", ", columns.Select(c => Values.QuoteName(c.Name)))).Append(") ");
                Query(select.Select);
                break;
            default:
                throw SqlException.NotSupported("INSERT ... EXEC");
        }
    }

    private void Update(UpdateSpecification spec)
    {
        if (spec.FromClause != null) throw SqlException.NotSupported("UPDATE ... FROM");
        if (spec.Target is not NamedTableReference target) throw SqlException.NotSupported("这种 UPDATE 写法");
        var table = RequireTable(target.SchemaObject);
        _sql.Append("UPDATE ").Append(Values.QuoteName(table.Name)).Append(" SET ");
        for (var i = 0; i < spec.SetClauses.Count; i++)
        {
            if (spec.SetClauses[i] is not AssignmentSetClause { Column: not null } set || set.AssignmentKind != AssignmentKind.Equals)
                throw SqlException.NotSupported("这种 SET 写法");
            var column = RequireColumn(table, set.Column.MultiPartIdentifier.Identifiers[^1].Value);
            if (column.Identity) throw new SqlException(8102, $"无法更新标识列 '{column.Name}'。");
            if (i > 0) _sql.Append(", ");
            _sql.Append(Values.QuoteName(column.Name)).Append(" = ");
            ValueFor(column, set.NewValue);
        }
        LimitedWhere(table, spec.WhereClause, spec.TopRowFilter);
    }

    private void Delete(DeleteSpecification spec)
    {
        if (spec.FromClause != null) throw SqlException.NotSupported("DELETE ... FROM ... JOIN");
        if (spec.Target is not NamedTableReference target) throw SqlException.NotSupported("这种 DELETE 写法");
        var table = RequireTable(target.SchemaObject);
        _sql.Append("DELETE FROM ").Append(Values.QuoteName(table.Name));
        LimitedWhere(table, spec.WhereClause, spec.TopRowFilter);
    }

    /// <summary>UPDATE TOP (n) / DELETE TOP (n)：SQLite 不支持，改成按 rowid 限定前 n 行</summary>
    private void LimitedWhere(TableInfo table, WhereClause? where, TopRowFilter? top)
    {
        if (top == null)
        {
            Where(where);
            return;
        }
        _sql.Append(" WHERE rowid IN (SELECT rowid FROM ").Append(Values.QuoteName(table.Name));
        Where(where);
        Top(top);
        _sql.Append(')');
    }

    /// <summary>插入、修改的值按目标列的类型转换（日期统一格式、字符串转数字失败时报和 SQL Server 一样的错）</summary>
    private void ValueFor(ColumnInfo column, ScalarExpression value)
    {
        if (value is NullLiteral || value is DefaultLiteral)
        {
            _sql.Append(value is NullLiteral ? "NULL" : throw SqlException.NotSupported("VALUES 里的 DEFAULT"));
            return;
        }
        var type = column.Type;
        if (type.IsString || type.IsBinary || type.StorageType == "ANY")
        {
            Expression(value);
            return;
        }
        _sql.Append("tsql_convert(").Append(Values.Quote(type.Name)).Append(", NULL, ");
        Expression(value);
        _sql.Append(", NULL)");
    }

    // ---------- 建表、删表、加列 ----------

    private Statement CreateTable(CreateTableStatement create)
    {
        var name = TableName(create.SchemaObjectName);
        if (DatabaseStore.IsHidden(name)) throw new SqlException(102, $"表名 '{name}' 是平台保留的名字，请换一个。");
        if (_lookup(name) != null) throw SqlException.ObjectExists(name);
        var definition = create.Definition;

        var primaryKey = definition.TableConstraints.OfType<UniqueConstraintDefinition>().FirstOrDefault(c => c.IsPrimaryKey);
        var keyColumns = primaryKey?.Columns.Select(c => c.Column.MultiPartIdentifier.Identifiers[^1].Value).ToList() ?? new List<string>();
        var columns = definition.ColumnDefinitions.Select(c => Column(c, keyColumns)).ToList();
        if (columns.Count(c => c.Identity) > 1) throw new SqlException(2744, $"为表 '{name}' 指定了多个标识列。只允许为每个表指定一个标识列。");
        foreach (var key in keyColumns)
            if (columns.All(c => !string.Equals(c.Name, key, StringComparison.OrdinalIgnoreCase))) throw SqlException.InvalidColumn(key);

        _sql.Append("CREATE TABLE ").Append(Values.QuoteName(name)).Append(" (");
        _sql.Append(string.Join(", ", columns.Select(c => ColumnSql(c, single: keyColumns.Count <= 1 && c.PrimaryKey))));
        if (keyColumns.Count > 1) _sql.Append(", PRIMARY KEY (").Append(string.Join(", ", keyColumns.Select(Values.QuoteName))).Append(')');
        _sql.Append(") STRICT");
        return Done(isQuery: false, after: c => DatabaseStore.SaveColumns(c, name, columns));
    }

    private Statement AddColumns(AlterTableAddTableElementStatement alter)
    {
        var table = RequireTable(alter.SchemaObjectName);
        if (alter.Definition.TableConstraints.Count > 0) throw SqlException.NotSupported("ALTER TABLE 添加约束");
        var columns = alter.Definition.ColumnDefinitions.Select(c => Column(c, new List<string>())).ToList();
        foreach (var column in columns)
        {
            if (table.Find(column.Name) != null) throw new SqlException(2705, $"各表中的列名必须唯一。在表 '{table.Name}' 中多次指定了列名 '{column.Name}'。");
            if (column.Identity || column.PrimaryKey) throw SqlException.NotSupported("ALTER TABLE 添加主键或标识列");
            if (_sql.Length > 0) _sql.Append("; ");
            _sql.Append("ALTER TABLE ").Append(Values.QuoteName(table.Name)).Append(" ADD COLUMN ").Append(ColumnSql(column, single: false));
        }
        return Done(isQuery: false, after: c => DatabaseStore.SaveColumns(c, table.Name, columns, table.Columns.Count));
    }

    private Statement DropTable(DropTableStatement drop)
    {
        var tables = drop.Objects.Select(o => _lookup(TableName(o)) ?? throw SqlException.CannotDropTable(TableName(o))).ToList();
        _sql.Append(string.Join("; ", tables.Select(t => "DROP TABLE " + Values.QuoteName(t.Name))));
        return Done(isQuery: false, after: c =>
        {
            foreach (var table in tables) DatabaseStore.DeleteColumns(c, table.Name);
        });
    }

    private ColumnInfo Column(ColumnDefinition definition, List<string> keyColumns)
    {
        var name = definition.ColumnIdentifier.Value;
        if (definition.DataType is not SqlDataTypeReference dataType) throw new SqlException(2715, $"第 1 个列、参数或变量: 找不到数据类型 {definition.DataType?.Name?.BaseIdentifier?.Value}。");
        var type = TypeOf(dataType);
        var identity = definition.IdentityOptions != null;
        if (identity && !type.IsInteger) throw new SqlException(2749, $"标识列 '{name}' 的数据类型必须是 int、bigint、smallint 或 tinyint。");
        var primaryKey = keyColumns.Any(k => string.Equals(k, name, StringComparison.OrdinalIgnoreCase))
            || definition.Constraints.OfType<UniqueConstraintDefinition>().Any(c => c.IsPrimaryKey);
        var nullable = !identity && !primaryKey && definition.Constraints.OfType<NullableConstraintDefinition>().All(c => c.Nullable);
        if (definition.Constraints.Any(c => c is not (NullableConstraintDefinition or UniqueConstraintDefinition { IsPrimaryKey: true })))
            throw SqlException.NotSupported("PRIMARY KEY、NULL / NOT NULL 以外的列约束");

        string? defaultText = null;
        if (definition.DefaultConstraint != null) defaultText = DefaultSql(definition.DefaultConstraint.Expression);
        if (identity && definition.IdentityOptions!.IdentitySeed is IntegerLiteral seed && seed.Value != "1")
            throw SqlException.NotSupported("从 1 以外的数开始的 IDENTITY");
        return new ColumnInfo(name, type, nullable, identity, primaryKey, defaultText);
    }

    private static TSqlType TypeOf(SqlDataTypeReference dataType)
    {
        var name = dataType.SqlDataTypeOption.ToString().ToLowerInvariant();
        if (!TSqlType.IsSupported(name)) throw SqlException.NotSupported($"数据类型 {name}");
        var parameters = dataType.Parameters;
        if (parameters.Count == 0) return new TSqlType(name);
        if (parameters[0] is MaxLiteral) return new TSqlType(name, IsMax: true);
        var first = int.Parse(parameters[0].Value, CultureInfo.InvariantCulture);
        if (name is "decimal" or "numeric")
            return new TSqlType(name, Precision: first, Scale: parameters.Count > 1 ? int.Parse(parameters[1].Value, CultureInfo.InvariantCulture) : null);
        return new TSqlType(name, Length: first);
    }

    /// <summary>SQLite 的列定义：STRICT 类型 + 约束；字符串长度和 bit 取值用 CHECK 实现（约束名用来认出是哪种错误）</summary>
    private static string ColumnSql(ColumnInfo column, bool single)
    {
        var sql = new StringBuilder(Values.QuoteName(column.Name));
        if (column.Identity && single)
        {
            sql.Append(" INTEGER PRIMARY KEY AUTOINCREMENT");
            return sql.ToString();
        }
        if (column.Identity) throw SqlException.NotSupported("标识列不是唯一主键的表");
        sql.Append(' ').Append(column.Type.StorageType);
        if (single && column.PrimaryKey) sql.Append(" PRIMARY KEY");
        if (!column.Nullable) sql.Append(" NOT NULL");
        if (column.Type.StorageType == "TEXT") sql.Append(" COLLATE NOCASE");
        if (column.Default != null) sql.Append(" DEFAULT ").Append(column.Default);
        if (column.Type.MaxLength is { } max)
            sql.Append(" CONSTRAINT ").Append(Values.QuoteName("trunc:" + column.Name)).Append(" CHECK (length(").Append(Values.QuoteName(column.Name)).Append(") <= ").Append(max).Append(')');
        if (column.Type.IsBit)
            sql.Append(" CONSTRAINT ").Append(Values.QuoteName("bit:" + column.Name)).Append(" CHECK (").Append(Values.QuoteName(column.Name)).Append(" IN (0, 1))");
        return sql.ToString();
    }

    /// <summary>DEFAULT 只支持常量和 getdate()</summary>
    private static string DefaultSql(ScalarExpression expression) => Unparen(expression) switch
    {
        IntegerLiteral i => i.Value,
        NumericLiteral n => n.Value,
        RealLiteral r => r.Value,
        StringLiteral s => Values.Quote(s.Value),
        NullLiteral => "NULL",
        UnaryExpression { UnaryExpressionType: UnaryExpressionType.Negative, Expression: IntegerLiteral or NumericLiteral } u => "-" + ((Literal)u.Expression).Value,
        FunctionCall f when f.FunctionName.Value.Equals("getdate", StringComparison.OrdinalIgnoreCase) => "(strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))",
        _ => throw SqlException.NotSupported("这种 DEFAULT 默认值"),
    };

    private static ScalarExpression Unparen(ScalarExpression expression) =>
        expression is ParenthesisExpression p ? Unparen(p.Expression) : expression;

    // ---------- 表名、列名 ----------

    /// <summary>dbo.表名、库名.dbo.表名 都取最后一段（跨库访问不支持）</summary>
    private static string TableName(SchemaObjectName name)
    {
        if (name.ServerIdentifier != null) throw SqlException.NotSupported("访问其他服务器上的表");
        if (name.SchemaIdentifier != null && !name.SchemaIdentifier.Value.Equals("dbo", StringComparison.OrdinalIgnoreCase))
            throw SqlException.NotSupported($"架构 {name.SchemaIdentifier.Value}（只有 dbo）");
        return name.BaseIdentifier.Value;
    }

    private TableInfo RequireTable(SchemaObjectName name)
    {
        if (name.DatabaseIdentifier != null) throw SqlException.NotSupported("在一条语句里访问其他数据库的表，请先用 USE 切换数据库");
        var table = TableName(name);
        return _lookup(table) ?? throw SqlException.InvalidObject(table);
    }

    private static ColumnInfo RequireColumn(TableInfo table, string column) => table.Find(column) ?? throw SqlException.InvalidColumn(column);

    // ---------- 表达式 ----------

    private void Expression(ScalarExpression expression)
    {
        switch (expression)
        {
            case ColumnReferenceExpression column:
                ColumnReference(column);
                break;
            case IntegerLiteral or NumericLiteral or RealLiteral or MoneyLiteral:
                _sql.Append(((Literal)expression).Value.TrimStart('$', '¥'));
                break;
            case StringLiteral s:
                _sql.Append(Values.Quote(s.Value));
                break;
            case NullLiteral:
                _sql.Append("NULL");
                break;
            case BinaryLiteral b:
                _sql.Append("X'").Append(b.Value[2..]).Append('\'');
                break;
            case VariableReference variable:
                _parameters.Add(variable.Name);
                _sql.Append(variable.Name);
                break;
            case GlobalVariableExpression global when global.Name.Equals("@@IDENTITY", StringComparison.OrdinalIgnoreCase):
                _sql.Append("last_insert_rowid()");
                break;
            case ParenthesisExpression paren:
                _sql.Append('(');
                Expression(paren.Expression);
                _sql.Append(')');
                break;
            case UnaryExpression unary:
                _sql.Append(unary.UnaryExpressionType switch
                {
                    UnaryExpressionType.Negative => "-",
                    UnaryExpressionType.Positive => "+",
                    _ => "~",
                });
                Expression(unary.Expression);
                break;
            case BinaryExpression binary:
                Binary(binary);
                break;
            case FunctionCall call:
                Function(call);
                break;
            case LeftFunctionCall left:
                Call("tsql_left", left.Parameters);
                break;
            case RightFunctionCall right:
                Call("tsql_right", right.Parameters);
                break;
            case CastCall cast:
                Conversion(cast.DataType, cast.Parameter, null);
                break;
            case ConvertCall convert:
                Conversion(convert.DataType, convert.Parameter, convert.Style);
                break;
            case CoalesceExpression coalesce:
                Call("coalesce", coalesce.Expressions);
                break;
            case NullIfExpression nullIf:
                Call("nullif", new[] { nullIf.FirstExpression, nullIf.SecondExpression });
                break;
            case SearchedCaseExpression searched:
                _sql.Append("CASE");
                foreach (var when in searched.WhenClauses)
                {
                    _sql.Append(" WHEN ");
                    Boolean(when.WhenExpression);
                    _sql.Append(" THEN ");
                    Expression(when.ThenExpression);
                }
                Else(searched.ElseExpression);
                break;
            case SimpleCaseExpression simple:
                _sql.Append("CASE ");
                Expression(simple.InputExpression);
                foreach (var when in simple.WhenClauses)
                {
                    _sql.Append(" WHEN ");
                    Expression(when.WhenExpression);
                    _sql.Append(" THEN ");
                    Expression(when.ThenExpression);
                }
                Else(simple.ElseExpression);
                break;
            case ScalarSubquery subquery:
                _sql.Append('(');
                Query(subquery.QueryExpression);
                _sql.Append(')');
                break;
            default:
                throw SqlException.NotSupported(expression.GetType().Name.Replace("Expression", "") + " 表达式");
        }
    }

    private void Else(ScalarExpression? otherwise)
    {
        if (otherwise != null)
        {
            _sql.Append(" ELSE ");
            Expression(otherwise);
        }
        _sql.Append(" END");
    }

    private void ColumnReference(ColumnReferenceExpression column)
    {
        if (column.ColumnType == ColumnType.Wildcard)
        {
            _sql.Append('*');
            return;
        }
        if (column.ColumnType != ColumnType.Regular) throw SqlException.NotSupported(column.ColumnType.ToString());
        var parts = column.MultiPartIdentifier.Identifiers;
        // 表名.列名 保留表名（或别名）；库名.dbo.表名.列名 只取最后两段
        var take = Math.Min(parts.Count, 2);
        _sql.Append(string.Join(".", parts.Skip(parts.Count - take).Select(p => Values.QuoteName(p.Value))));
    }

    private void Binary(BinaryExpression binary)
    {
        switch (binary.BinaryExpressionType)
        {
            // + 要在运行时看两边的类型：字符串连接还是数字相加
            case BinaryExpressionType.Add:
                Call("tsql_add", new[] { binary.FirstExpression, binary.SecondExpression });
                return;
            case BinaryExpressionType.Divide:
                Call("tsql_div", new[] { binary.FirstExpression, binary.SecondExpression });
                return;
            case BinaryExpressionType.Modulo:
                Call("tsql_mod", new[] { binary.FirstExpression, binary.SecondExpression });
                return;
        }
        _sql.Append('(');
        Expression(binary.FirstExpression);
        _sql.Append(binary.BinaryExpressionType switch
        {
            BinaryExpressionType.Subtract => " - ",
            BinaryExpressionType.Multiply => " * ",
            BinaryExpressionType.BitwiseAnd => " & ",
            BinaryExpressionType.BitwiseOr => " | ",
            _ => throw SqlException.NotSupported("^ 运算"),
        });
        Expression(binary.SecondExpression);
        _sql.Append(')');
    }

    private void Call(string name, IList<ScalarExpression> arguments)
    {
        _sql.Append(name).Append('(');
        for (var i = 0; i < arguments.Count; i++)
        {
            if (i > 0) _sql.Append(", ");
            Expression(arguments[i]);
        }
        _sql.Append(')');
    }

    private void Conversion(DataTypeReference dataType, ScalarExpression value, ScalarExpression? style)
    {
        if (dataType is not SqlDataTypeReference sqlType) throw SqlException.NotSupported($"转换成 {dataType.Name.BaseIdentifier.Value}");
        var type = TypeOf(sqlType);
        _sql.Append("tsql_convert(").Append(Values.Quote(type.Name)).Append(", ")
            .Append(type.IsMax ? "-1" : type.Length?.ToString(CultureInfo.InvariantCulture) ?? (type.IsString ? "30" : "NULL")).Append(", ");
        Expression(value);
        _sql.Append(", ");
        if (style != null) Expression(style);
        else _sql.Append("NULL");
        _sql.Append(')');
    }

    private void Function(FunctionCall call)
    {
        if (call.CallTarget != null) throw SqlException.NotSupported("这种函数调用");
        if (call.OverClause != null) throw SqlException.NotSupported("OVER（开窗函数）");
        var name = call.FunctionName.Value.ToLowerInvariant();
        var args = call.Parameters;
        var distinct = call.UniqueRowFilter == UniqueRowFilter.Distinct ? "DISTINCT " : "";

        void Expect(int min, int max)
        {
            if (args.Count < min || args.Count > max)
                throw new SqlException(174, $"{call.FunctionName.Value} 函数要求有 {(min == max ? min.ToString(CultureInfo.InvariantCulture) : $"{min} 到 {max}")} 个参数。");
        }

        switch (name)
        {
            case "count" or "sum" or "avg" or "min" or "max":
                Expect(1, 1);
                _sql.Append(name).Append('(').Append(distinct);
                if (args[0] is ColumnReferenceExpression { ColumnType: ColumnType.Wildcard }) _sql.Append('*');
                else Expression(args[0]);
                _sql.Append(')');
                return;
            case "getdate" or "current_timestamp" or "sysdatetime":
                Expect(0, 0);
                _sql.Append("tsql_getdate()");
                return;
            case "year" or "month" or "day":
                Expect(1, 1);
                _sql.Append("tsql_datepart('").Append(name).Append("', ");
                Expression(args[0]);
                _sql.Append(')');
                return;
            case "datepart" or "datename":
                Expect(2, 2);
                _sql.Append("tsql_datepart(").Append(Values.Quote(DatePartName(args[0]))).Append(", ");
                Expression(args[1]);
                _sql.Append(')');
                return;
            case "dateadd" or "datediff":
                Expect(3, 3);
                _sql.Append("tsql_").Append(name).Append('(').Append(Values.Quote(DatePartName(args[0]))).Append(", ");
                Expression(args[1]);
                _sql.Append(", ");
                Expression(args[2]);
                _sql.Append(')');
                return;
            case "scope_identity" or "ident_current":
                _sql.Append("last_insert_rowid()");
                return;
            case "len":
                Expect(1, 1);
                Call("tsql_len", args);
                return;
            case "datalength":
                Expect(1, 1);
                Call("length", args);
                return;
            case "substring":
                Expect(3, 3);
                Call("substr", args);
                return;
            case "charindex":
                Expect(2, 2);
                Call("tsql_charindex", args);
                return;
            case "upper" or "lower" or "ltrim" or "rtrim" or "replace" or "abs" or "round" or "sign":
                Expect(1, 3);
                Call(name, name == "round" ? args.Take(2).ToList() : args);
                return;
            case "isnull":
                Expect(2, 2);
                Call("ifnull", args);
                return;
            case "floor" or "ceiling" or "sqrt":
                Expect(1, 1);
                Call("tsql_" + name, args);
                return;
            case "power":
                Expect(2, 2);
                Call("tsql_power", args);
                return;
            case "newid":
                Expect(0, 0);
                _sql.Append("tsql_newid()");
                return;
            case "rand":
                _sql.Append("tsql_rand()");
                return;
            default:
                throw SqlException.UnknownFunction(call.FunctionName.Value);
        }
    }

    /// <summary>DATEADD(day, ...) 的第一个参数是关键字：ScriptDom 解析成 IdentifierLiteral（旧版本是列名）</summary>
    private static string DatePartName(ScalarExpression expression) => expression switch
    {
        IdentifierLiteral i => i.Value,
        ColumnReferenceExpression c => c.MultiPartIdentifier.Identifiers[^1].Value,
        StringLiteral s => s.Value,
        _ => throw SqlException.NotSupported("这种 datepart 写法"),
    };

    // ---------- 条件 ----------

    private void Boolean(BooleanExpression expression)
    {
        switch (expression)
        {
            case BooleanComparisonExpression comparison:
                _sql.Append('(');
                Comparand(comparison.FirstExpression);
                _sql.Append(comparison.ComparisonType switch
                {
                    BooleanComparisonType.Equals => " = ",
                    BooleanComparisonType.GreaterThan => " > ",
                    BooleanComparisonType.LessThan => " < ",
                    BooleanComparisonType.GreaterThanOrEqualTo or BooleanComparisonType.NotLessThan => " >= ",
                    BooleanComparisonType.LessThanOrEqualTo or BooleanComparisonType.NotGreaterThan => " <= ",
                    BooleanComparisonType.NotEqualToBrackets or BooleanComparisonType.NotEqualToExclamation => " <> ",
                    _ => throw SqlException.NotSupported(comparison.ComparisonType.ToString()),
                });
                Comparand(comparison.SecondExpression);
                _sql.Append(')');
                break;
            case BooleanBinaryExpression binary:
                _sql.Append('(');
                Boolean(binary.FirstExpression);
                _sql.Append(binary.BinaryExpressionType == BooleanBinaryExpressionType.And ? " AND " : " OR ");
                Boolean(binary.SecondExpression);
                _sql.Append(')');
                break;
            case BooleanNotExpression not:
                _sql.Append("NOT (");
                Boolean(not.Expression);
                _sql.Append(')');
                break;
            case BooleanParenthesisExpression paren:
                _sql.Append('(');
                Boolean(paren.Expression);
                _sql.Append(')');
                break;
            case BooleanIsNullExpression isNull:
                _sql.Append('(');
                Expression(isNull.Expression);
                _sql.Append(isNull.IsNot ? " IS NOT NULL)" : " IS NULL)");
                break;
            case LikePredicate like:
                _sql.Append('(');
                Expression(like.FirstExpression);
                _sql.Append(like.NotDefined ? " NOT LIKE " : " LIKE ");
                Expression(like.SecondExpression);
                if (like.EscapeExpression != null)
                {
                    _sql.Append(" ESCAPE ");
                    Expression(like.EscapeExpression);
                }
                _sql.Append(')');
                break;
            case InPredicate inPredicate:
                _sql.Append('(');
                Comparand(inPredicate.Expression);
                _sql.Append(inPredicate.NotDefined ? " NOT IN (" : " IN (");
                if (inPredicate.Subquery != null)
                {
                    Query(inPredicate.Subquery.QueryExpression);
                }
                else
                {
                    for (var i = 0; i < inPredicate.Values.Count; i++)
                    {
                        if (i > 0) _sql.Append(", ");
                        Comparand(inPredicate.Values[i]);
                    }
                }
                _sql.Append("))");
                break;
            case BooleanTernaryExpression between:
                _sql.Append('(');
                Comparand(between.FirstExpression);
                _sql.Append(between.TernaryExpressionType == BooleanTernaryExpressionType.NotBetween ? " NOT BETWEEN " : " BETWEEN ");
                Comparand(between.SecondExpression);
                _sql.Append(" AND ");
                Comparand(between.ThirdExpression);
                _sql.Append(')');
                break;
            case ExistsPredicate exists:
                _sql.Append("EXISTS (");
                Query(exists.Subquery.QueryExpression);
                _sql.Append(')');
                break;
            default:
                throw SqlException.NotSupported(expression.GetType().Name.Replace("Expression", "") + " 条件");
        }
    }

    /// <summary>比较里的日期字符串转成标准格式，日期列按文本比较才是按时间先后（BETWEEN '2024/1/16 9:05:03' AND ...）</summary>
    private void Comparand(ScalarExpression expression)
    {
        if (expression is StringLiteral s && Values.LooksLikeDate(s.Value))
        {
            _sql.Append(Values.Quote(Values.NormalizeDateLiteral(s.Value)));
            return;
        }
        // 参数的值执行时才知道：是日期样子的字符串时同样转成标准格式（教材 BETWEEN @time_start AND @time_end 传的是字符串）
        if (expression is VariableReference)
        {
            _sql.Append("tsql_cmp(");
            Expression(expression);
            _sql.Append(')');
            return;
        }
        Expression(expression);
    }
}
