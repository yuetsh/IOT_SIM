using System;
using System.IO;
using Sim.Runner;

// 三种模式，都通过标准输入输出与 Bun 服务器交换 JSON 消息（每行一条）：
//   dotnet Sim.Runner.dll compile-server   常驻编译服务，全服务器共用一个，编译学生工程并把程序集写回工程目录
//   dotnet Sim.Runner.dll language-server  常驻语言服务，全服务器共用一个：代码补全、悬停提示、参数提示、边写边检查
//   dotnet Sim.Runner.dll run <工程目录>    运行已编译的学生程序，每次运行一个进程
// 运行模式不加载 Roslyn，单个学生程序的内存占用因此小得多。

return args switch
{
    ["compile-server"] => CompileServer.Run(),
    ["language-server"] => LanguageServer.Run(),
    ["run", var dir] when Directory.Exists(dir) => StudentProgramHost.Run(dir),
    _ => Usage(),
};

static int Usage()
{
    Console.Error.WriteLine("用法：Sim.Runner compile-server | Sim.Runner language-server | Sim.Runner run <工程目录>");
    return 2;
}
