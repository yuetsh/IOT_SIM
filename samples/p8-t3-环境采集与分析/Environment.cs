using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using DeviceCtrlLibrary;
using DeviceCtrlLibrary.Model;
using 智慧校园.SQLHelpers;
using System.Threading;

namespace 智慧校园
{
    public partial class Environment : Form
    {
        public Environment()
        {
            InitializeComponent();
        }
        //用于各类耗时长的操作（SQL、数据采集、设备控制等）
        Thread thread;
        //用于异步通行
        SynchronizationContext _main;
        //结果模型
        ADAM4017ResModel ResModel_4017;
        ADAM4150ResModel ResModel_4150;
        //设置自动控制路灯的光照值
        double environmentLight, setLight;
        //按钮状态标志
        bool IsAuto_Lamp = false;
        bool IsAuto_FireMsg = false;
        bool IsLampOpen = false;
        private void panel1_Paint(object sender, PaintEventArgs e)
        {

        }

        private void lb_return_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        private void Environment_Load(object sender, EventArgs e)
        {
            try
            {

                //隐藏曲线图
                chart1.Visible = false;
                thread = new Thread(new ThreadStart(Tick));
                _main = WindowsFormsSynchronizationContext.Current;
                thread.Start();
            }
            catch
            {
            }

        }
        private void Tick()
        {
            try
            {
                while (true)
                {
                    //数据采集
                    ResModel_4017 = DeviceCtrlHelper.adam4017Helper.SetData();
                    Thread.Sleep(500);
                    ResModel_4150 = DeviceCtrlHelper.adam4150Helper.SetData();

                    //UI显示数据

                    _main.Send(_ =>
                    {
                        try  //防止无数据出错
                        {
                            txt_fire.Text = (ResModel_4150.fireValue ? "发生火情" : "正常");
                            txt_smoke.Text = (ResModel_4150.smokeValue ? "发生烟情" : "正常");
                            txt_light.Text = ResModel_4017.lightValue;
                            txt_temperature.Text = ResModel_4017.temperatureValue;
                            txt_humidity.Text = ResModel_4017.humidityValue;
                        }
                        catch { }
                    }, null);

                    //自动路灯控制
                    double.TryParse(ResModel_4017.lightValue, out environmentLight);
                    if (IsAuto_Lamp && environmentLight < setLight)
                    {
                        LampOnOff(1, true);
                    }
                    else if (IsAuto_Lamp && !(environmentLight < setLight))
                    {
                        LampOnOff(1, false);
                    }

                    //自动推送火情LED信息控制
                    if (IsAuto_FireMsg)
                    {
                        if (ResModel_4150.fireValue && ResModel_4150.smokeValue)
                            DeviceCtrlHelper.ledHelper.SendLedString("发生严重火灾    ");
                        else if (ResModel_4150.fireValue)
                            DeviceCtrlHelper.ledHelper.SendLedString("发现火情    ");
                        else if (ResModel_4150.smokeValue)
                            DeviceCtrlHelper.ledHelper.SendLedString("发现烟情    ");
                    }

                    //执行数据上传
                    SQLBLL.EnvironmentUpData(ResModel_4150.fireValue, ResModel_4150.smokeValue, ResModel_4017.lightValue, ResModel_4017.temperatureValue, ResModel_4017.humidityValue);

                    Thread.Sleep(5000);
                }
            }
            catch
            {
            }
        }
        private void LampOnOff(int RelayNum, bool IsOpen)
        {
            try
            {
                //开启路灯
                DeviceCtrlHelper.zigBeeHelper.OnOff(RelayNum, IsOpen);

                //切换UI背景
                _main.Send(_ =>
                {
                    if (IsOpen)
                    {
                        pic_lampOpen.BackgroundImage = Properties.Resources.switch_on;
                        panel_bg.BackgroundImage = Properties.Resources.day_01;
                    }
                    else
                    {
                        panel_bg.BackgroundImage = Properties.Resources.day_02;
                        pic_lampOpen.BackgroundImage = Properties.Resources.switch_off;
                    }
                }, null);
            }
            catch
            {
            }
        }

        private void Environment_FormClosed(object sender, FormClosedEventArgs e)
        { 
            try
            {
                thread.Suspend();
                thread = null;
               
            }
            catch
            {
            }
        

        }

        private void btn_dataAnalyse_Click(object sender, EventArgs e)
        {
            try
            {
                if (btn_dataAnalyse.Text.Equals("数据分析"))
                {
                    //绑定图标数据
                    chart1.DataSource = SQLBLL.GetEnvironmentGraphData();
                    //更新图标数据
                    chart1.DataBind();
                    chart1.Visible = true;
                    btn_dataAnalyse.Text = "关闭图表";
                }
                else if (btn_dataAnalyse.Text.Equals("关闭图表"))
                {
                    chart1.Visible = false;
                    btn_dataAnalyse.Text = "数据分析";
                }
            }
            catch
            {
            }

        }

        private void pic_lampOpen_Click(object sender, EventArgs e)
        {
            //手动路灯控制
            try
            {
                if (!IsLampOpen)
                {
                    LampOnOff(1, true);

                }
                else
                {
                    LampOnOff(1, false);

                }

                IsLampOpen = !IsLampOpen;
            }
            catch
            {
            }
        }

        private void btn_ledEnvironment1_Click(object sender, EventArgs e)
        {
            try
            {
                //推送LED天气信息
                if (ResModel_4017 != null && ResModel_4150 != null)
                    DeviceCtrlHelper.ledHelper.SendLedString("当前温度:" + ResModel_4017.temperatureValue + "℃ 湿度:" + ResModel_4017.humidityValue + "%");
            }
            catch
            {
            }
        }

        private void btn_ledEnvironment2_Click(object sender, EventArgs e)
        {
            try
            {
                //推送LED天气信息
                if (ResModel_4017 != null && ResModel_4150 != null)
                    DeviceCtrlHelper.ledHelper.SendLedString("当前温度:" + ResModel_4017.temperatureValue + "℃ 湿度:" + ResModel_4017.humidityValue + "%");
            }
            catch
            {
            }
        }

        private void panel3_Paint(object sender, PaintEventArgs e)
        {

        }

        private void txt_autoLight_TextChanged(object sender, EventArgs e)
        {
            try 
            {
              //获取光照比较值
                double.TryParse(txt_autoLight.Text,out setLight);
            
            }
            
            catch 
            {
            }
        }

        private void btn_ledSendMsg_Click(object sender, EventArgs e)
        {
            try
            {
                //推送LED信息
                DeviceCtrlHelper.ledHelper.SendLedString(txt_ledMsg.Text);
            }
            catch
            {
            }
        }

        private void ch_autoLamp_CheckedChanged(object sender, EventArgs e)
        {
            //自动控制路灯
            IsAuto_Lamp = ch_autoLamp.Checked;
        }

        private void ch_autoLedFire_CheckedChanged(object sender, EventArgs e)
        {
            //自动推送火情
            IsAuto_FireMsg = ch_autoLedFire.Checked;
        }
    }
}
