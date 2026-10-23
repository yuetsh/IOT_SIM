using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Windows.Forms;
using Sim.Host;

namespace System.Windows.Forms
{
    /// <summary>
    /// ActiveX 控件的基类。VS 把 COM 控件拖到窗体上时生成 OcxState = resources.GetObject("…OcxState")，
    /// 平台编译时给每个窗体嵌了空的资源，这里取到的是 null，不影响使用。
    /// </summary>
    public abstract class AxHost : Control, ISupportInitialize
    {
        protected AxHost(string clsid) { }

        public State? OcxState { get; set; }

        public void BeginInit() { }
        public void EndInit() { }

        public class State { }
    }
}

namespace WMPLib
{
    public enum WMPPlayState
    {
        wmppsUndefined = 0, wmppsStopped = 1, wmppsPaused = 2, wmppsPlaying = 3, wmppsScanForward = 4, wmppsScanReverse = 5,
        wmppsBuffering = 6, wmppsWaiting = 7, wmppsMediaEnded = 8, wmppsTransitioning = 9, wmppsReady = 10, wmppsReconnecting = 11,
    }

    /// <summary>播放控制：axWindowsMediaPlayer1.Ctlcontrols.play()</summary>
    public interface IWMPControls
    {
        void play();
        void pause();
        void stop();
        double currentPosition { get; set; }
    }

    /// <summary>播放设置：axWindowsMediaPlayer1.settings.volume</summary>
    public interface IWMPSettings
    {
        bool autoStart { get; set; }
        int volume { get; set; }
        bool mute { get; set; }
        void setMode(string bstrMode, bool varfMode);
    }
}

namespace AxWMPLib
{
    using WMPLib;

    /// <summary>
    /// Windows Media Player 控件（教材项目 7 的"广播"播放 ring.mp3）。和真的一样：设置 URL 后自动开始播放（settings.autoStart），
    /// 也可以调用 Ctlcontrols.play()。声音在浏览器里播放；实训台上的广播喇叭随之亮起。只支持本机文件。
    /// </summary>
    [ClientType("AxWindowsMediaPlayer")]
    public class AxWindowsMediaPlayer : AxHost
    {
        private string _url = "";
        private WMPPlayState _playState = WMPPlayState.wmppsUndefined;

        public AxWindowsMediaPlayer() : base("6bf52a52-394a-11d3-b153-00c04f79faa6")
        {
            Ctlcontrols = new Controls(this);
            settings = new Settings();
        }

        protected override Size DefaultSize => new(245, 240);

        public string URL
        {
            get => _url;
            set
            {
                _url = value ?? "";
                if (settings.autoStart && _url.Length > 0) Play();
            }
        }

        public IWMPControls Ctlcontrols { get; }

        // 属性名和 COM 接口一样是小写
        public IWMPSettings settings { get; }

        public WMPPlayState playState => _playState;

        public string uiMode { get; set; } = "full";
        public bool stretchToFit { get; set; }
        public bool enableContextMenu { get; set; } = true;
        public string status => _playState == WMPPlayState.wmppsPlaying ? "正在播放" : "已停止";

        public event EventHandler? PlayStateChange;

        private void Play()
        {
            LegacyThreads.CheckPoint();
            // 教材写 BaseDirectory + "//Resources//ring.mp3"：路径里多余的斜杠在 Linux 上也能用
            var path = _url.StartsWith("file:///", StringComparison.OrdinalIgnoreCase) ? new Uri(_url).LocalPath : _url;
            if (!File.Exists(path))
            {
                SimHost.SendConsole($"Windows Media Player：找不到要播放的文件 {_url}\n");
                SetState(WMPPlayState.wmppsStopped);
                return;
            }
            var data = File.ReadAllBytes(path);
            var mime = Path.GetExtension(path).ToLowerInvariant() switch
            {
                ".wav" => "audio/wav",
                ".ogg" => "audio/ogg",
                ".m4a" or ".aac" => "audio/aac",
                _ => "audio/mpeg",
            };
            var key = SimHost.DataKey(Convert.ToHexString(SHA1.HashData(data)).ToLowerInvariant(), data, mime);
            SimHost.Send(new JsonObject { ["type"] = "media", ["id"] = SimId, ["action"] = "play", ["key"] = key, ["name"] = Path.GetFileName(path) });
            SetState(WMPPlayState.wmppsPlaying);
        }

        private void Stop()
        {
            if (_playState != WMPPlayState.wmppsPlaying) return;
            SimHost.Send(new JsonObject { ["type"] = "media", ["id"] = SimId, ["action"] = "stop" });
            SetState(WMPPlayState.wmppsStopped);
        }

        private void SetState(WMPPlayState state)
        {
            if (_playState == state) return;
            _playState = state;
            PlayStateChange?.Invoke(this, EventArgs.Empty);
        }

        protected override void WriteProps(JsonObject props)
        {
            base.WriteProps(props);
            props["URL"] = _url;
        }

        private sealed class Controls(AxWindowsMediaPlayer owner) : IWMPControls
        {
            public void play()
            {
                if (owner._playState != WMPPlayState.wmppsPlaying && owner._url.Length > 0) owner.Play();
            }

            public void pause() => owner.Stop();
            public void stop() => owner.Stop();
            public double currentPosition { get; set; }
        }

        private sealed class Settings : IWMPSettings
        {
            public bool autoStart { get; set; } = true;
            public int volume { get; set; } = 50;
            public bool mute { get; set; }
            public void setMode(string bstrMode, bool varfMode) { }
        }
    }
}
