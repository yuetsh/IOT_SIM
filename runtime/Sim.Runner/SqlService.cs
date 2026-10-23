using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Sim.Data.Engine;

namespace Sim.Runner;

/// <summary>
/// 常驻 SQL 服务：数据库页面（代替 SSMS）的查询、对象资源管理器，以及评分前按实验预置脚本准备数据库。
/// 请求里的目录由服务器给出（学生自己的数据库目录或评分用的临时目录），学生的 SQL 经转写后只能操作这个目录里的库。
/// 每行一个请求 {"id":…,"type":"exec"|"script"|"explorer",…}，回复带同样的 id；请求可以并发处理。
/// </summary>
internal static class SqlService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static readonly TimeSpan TimeLimit = TimeSpan.FromSeconds(5);
    /// <summary>查询窗口最多显示的行数</summary>
    private const int MaxRows = 1000;

    public static int Run()
    {
        // 日期等按中文 Windows 上 SSMS 的样子显示
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.GetCultureInfo("zh-CN");
        using var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
        var writeLock = new object();
        using var slots = new SemaphoreSlim(4);

        output.WriteLine(new JsonObject { ["type"] = "ready" }.ToJsonString(JsonOptions));
        while (input.ReadLine() is { } line)
        {
            slots.Wait();
            Task.Run(() =>
            {
                JsonObject reply;
                JsonNode? id = null;
                try
                {
                    var request = JsonNode.Parse(line)!.AsObject();
                    id = request["id"]?.DeepClone();
                    reply = Handle(request);
                }
                catch (SqlException ex)
                {
                    reply = Error(ex);
                }
                catch (Exception ex)
                {
                    reply = new JsonObject { ["type"] = "error", ["number"] = 0, ["message"] = ex.Message, ["line"] = 1 };
                }
                finally
                {
                    slots.Release();
                }
                reply["id"] = id;
                lock (writeLock) output.WriteLine(reply.ToJsonString(JsonOptions));
            });
        }
        return 0;
    }

    private static JsonObject Handle(JsonObject request)
    {
        var dir = (string?)request["dir"] ?? throw new ArgumentException("缺少 dir");
        var store = new DatabaseStore(dir);
        return (string?)request["type"] switch
        {
            "exec" => Exec(store, (string?)request["database"] ?? DatabaseStore.Master, (string?)request["sql"] ?? ""),
            "script" => Script(store, (string?)request["sql"] ?? ""),
            "explorer" => Explorer(store),
            var type => throw new ArgumentException($"不认识的请求 {type}"),
        };
    }

    /// <summary>查询窗口执行一批语句：返回各个结果集（最多 1000 行）、受影响的行数，以及执行后的当前库（USE 可能切换了）</summary>
    private static JsonObject Exec(DatabaseStore store, string database, string sql)
    {
        var started = Environment.TickCount64;
        using var session = new Session(store, database, TimeLimit);
        var batch = session.Execute(sql, name => (false, null));
        var results = new JsonArray();
        foreach (var result in batch.Results)
        {
            var columns = new JsonArray();
            foreach (var column in result.Columns) columns.Add(new JsonObject { ["name"] = column.Name, ["type"] = column.Type?.ToString() });
            var rows = new JsonArray();
            foreach (var row in result.Rows.Take(MaxRows))
            {
                var cells = new JsonArray();
                for (var i = 0; i < row.Length; i++) cells.Add(Display(row[i], result.Columns[i].Type?.IsDate == true));
                rows.Add(cells);
            }
            results.Add(new JsonObject { ["columns"] = columns, ["rows"] = rows, ["total"] = result.Rows.Count });
        }
        return new JsonObject
        {
            ["type"] = "result",
            ["database"] = session.Database,
            ["results"] = results,
            ["affected"] = batch.RecordsAffected,
            ["ms"] = Environment.TickCount64 - started,
        };
    }

    /// <summary>执行一个脚本（多批语句，用单独一行的 GO 分隔），从 master 开始，USE 对后面的批次有效</summary>
    private static JsonObject Script(DatabaseStore store, string sql)
    {
        var batches = Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase).Where(b => !string.IsNullOrWhiteSpace(b));
        using var session = new Session(store, DatabaseStore.Master, TimeSpan.FromSeconds(30));
        foreach (var batch in batches) session.Execute(batch, name => (false, null));
        return new JsonObject { ["type"] = "done" };
    }

    /// <summary>对象资源管理器：所有库、库里的表、表的列</summary>
    private static JsonObject Explorer(DatabaseStore store)
    {
        var databases = new JsonArray();
        foreach (var name in store.List())
        {
            var tables = new JsonArray();
            using (var connection = store.Open(name))
            {
                foreach (var table in DatabaseStore.ListTables(connection))
                {
                    var info = DatabaseStore.GetTable(connection, table);
                    var columns = new JsonArray();
                    foreach (var column in info?.Columns ?? Array.Empty<ColumnInfo>())
                    {
                        columns.Add(new JsonObject
                        {
                            ["name"] = column.Name,
                            ["type"] = column.Type.ToString(),
                            ["nullable"] = column.Nullable,
                            ["identity"] = column.Identity,
                            ["primaryKey"] = column.PrimaryKey,
                        });
                    }
                    tables.Add(new JsonObject { ["name"] = table, ["columns"] = columns });
                }
            }
            databases.Add(new JsonObject { ["name"] = name, ["tables"] = tables });
        }
        return new JsonObject { ["type"] = "explorer", ["databases"] = databases };
    }

    /// <summary>结果网格里显示的样子，和 SSMS 一致：日期 2024-01-16 09:05:03.000，bit 显示 1 / 0，二进制显示 0x…</summary>
    private static JsonNode? Display(object value, bool dateOnly) => value switch
    {
        DBNull => null,
        DateTime d when dateOnly => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime d => d.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture),
        bool b => b ? 1 : 0,
        byte[] bytes => "0x" + Convert.ToHexString(bytes.AsSpan(0, Math.Min(bytes.Length, 32))) + (bytes.Length > 32 ? "…" : ""),
        int i => i,
        long l => l,
        double x => x,
        decimal m => m,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };

    private static JsonObject Error(SqlException ex) =>
        new() { ["type"] = "error", ["number"] = ex.Number, ["message"] = ex.Message, ["line"] = ex.LineNumber };
}
