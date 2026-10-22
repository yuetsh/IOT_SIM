using System.ComponentModel;
using System.Drawing;
using System.Text.Json.Nodes;
using Sim.Host;

namespace System.Windows.Forms;

public enum PictureBoxSizeMode { Normal, StretchImage, AutoSize, CenterImage, Zoom }

/// <summary>图片框（教材项目 4 显示摄像头画面）</summary>
public class PictureBox : Control, ISupportInitialize
{
    private Image? _image;
    private PictureBoxSizeMode _sizeMode;
    private BorderStyle _borderStyle;

    protected override Size DefaultSize => new(100, 50);

    /// <summary>
    /// 要显示的图片。不检查调用线程：教材在摄像头回调（后台线程）里直接给 Image 赋值，
    /// 真实 WinForms 的 PictureBox 也不会因此报错。
    /// </summary>
    public Image? Image
    {
        get => _image;
        set
        {
            LegacyThreads.CheckPoint();
            if (ReferenceEquals(_image, value)) return;
            _image = value;
            NotifyChanged(nameof(Image), value);
            if (_sizeMode == PictureBoxSizeMode.AutoSize) FitToImage();
        }
    }

    public PictureBoxSizeMode SizeMode
    {
        get => _sizeMode;
        set
        {
            if (SetProp(ref _sizeMode, value, nameof(SizeMode)) && value == PictureBoxSizeMode.AutoSize) FitToImage();
        }
    }

    public BorderStyle BorderStyle
    {
        get => _borderStyle;
        set => SetProp(ref _borderStyle, value, nameof(BorderStyle));
    }

    public string? ImageLocation { get; set; }
    public Image? ErrorImage { get; set; }
    public Image? InitialImage { get; set; }
    public bool WaitOnLoad { get; set; }

    /// <summary>从文件加载图片（只支持本地文件）</summary>
    public void Load(string url)
    {
        ImageLocation = url;
        Image = Image.FromFile(url);
    }

    public void Load()
    {
        if (!string.IsNullOrEmpty(ImageLocation)) Load(ImageLocation);
    }

    // Designer.cs 里 VS 生成 ((ISupportInitialize)pictureBox1).BeginInit() / EndInit()
    public void BeginInit() { }
    public void EndInit() { }

    private void FitToImage()
    {
        if (_image != null) Size = _image.Size;
    }

    protected override void WriteProps(JsonObject props)
    {
        base.WriteProps(props);
        props["Image"] = PropValue.From(_image);
        props["SizeMode"] = _sizeMode.ToString();
        props["BorderStyle"] = _borderStyle.ToString();
    }
}
