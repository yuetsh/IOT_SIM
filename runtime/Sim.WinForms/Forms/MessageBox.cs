using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

/// <summary>在浏览器里弹出对话框，阻塞到用户点击按钮后返回结果（期间界面线程照常处理 Timer 等消息）</summary>
public static class MessageBox
{
    public static DialogResult Show(string? text) => Show(text, "");

    public static DialogResult Show(string? text, string? caption) =>
        Show(text, caption, MessageBoxButtons.OK, MessageBoxIcon.None);

    public static DialogResult Show(string? text, string? caption, MessageBoxButtons buttons) =>
        Show(text, caption, buttons, MessageBoxIcon.None);

    public static DialogResult Show(string? text, string? caption, MessageBoxButtons buttons, MessageBoxIcon icon) =>
        ShowCore(text, caption, buttons, icon);

    public static DialogResult Show(string? text, string? caption, MessageBoxButtons buttons, MessageBoxIcon icon, MessageBoxDefaultButton defaultButton) =>
        ShowCore(text, caption, buttons, icon);

    public static DialogResult Show(IWin32Window? owner, string? text) => Show(text);

    public static DialogResult Show(IWin32Window? owner, string? text, string? caption) => Show(text, caption);

    public static DialogResult Show(IWin32Window? owner, string? text, string? caption, MessageBoxButtons buttons) =>
        Show(text, caption, buttons);

    public static DialogResult Show(IWin32Window? owner, string? text, string? caption, MessageBoxButtons buttons, MessageBoxIcon icon) =>
        Show(text, caption, buttons, icon);

    private static DialogResult ShowCore(string? text, string? caption, MessageBoxButtons buttons, MessageBoxIcon icon)
    {
        var reply = SimHost.Request(new JsonObject
        {
            ["type"] = "messageBox",
            ["text"] = text ?? "",
            ["caption"] = caption ?? "",
            ["buttons"] = buttons.ToString(),
            ["icon"] = icon.ToString(),
        });
        return Enum.TryParse<DialogResult>((string?)reply, out var result) ? result : DialogResult.Cancel;
    }
}
