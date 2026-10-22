using System.Collections;
using System.Collections.Generic;
using Sim.Host;

namespace System.Windows.Forms;

public static class Application
{
    internal static readonly List<Form> OpenFormsList = new();
    private static bool _exitRequested;

    public static FormCollection OpenForms { get; } = new();

    public static string StartupPath => AppContext.BaseDirectory.TrimEnd('/', '\\');
    public static string ExecutablePath => System.IO.Path.Combine(StartupPath, "app.exe");
    public static string ProductName => "WindowsFormsApplication";

    public static void EnableVisualStyles() { }

    public static void SetCompatibleTextRenderingDefault(bool defaultValue) { }

    public static void SetHighDpiMode(object mode) { }

    /// <summary>显示主窗体并运行消息循环，直到主窗体关闭或调用 Application.Exit()</summary>
    public static void Run(Form mainForm)
    {
        mainForm.Show();
        SimHost.Ui.RunUntil(() => _exitRequested || mainForm.IsClosed);
        Exit();
    }

    public static void Run()
    {
        SimHost.Ui.RunUntil(() => _exitRequested);
    }

    public static void Exit()
    {
        _exitRequested = true;
        foreach (var form in OpenFormsList.ToArray()) form.CloseCore(CloseReason.ApplicationExitCall);
        SimHost.Ui.Wake();
    }

    public static void ExitThread() => Exit();

    public static void DoEvents() => SimHost.Ui.DoEvents();

    public sealed class FormCollection : IEnumerable<Form>
    {
        public int Count => OpenFormsList.Count;
        public Form this[int index] => OpenFormsList[index];
        public Form? this[string name] => OpenFormsList.Find(f => f.Name == name);
        public IEnumerator<Form> GetEnumerator() => OpenFormsList.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
