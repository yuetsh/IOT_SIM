using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.IO.Ports;//引用系统IO端口库
using DeviceCtrlLibrary;//引用自定义设备控制库
using DeviceCtrlLibrary.Model;//引用自定义设备控制模型库
using System.Threading;//引用线程库

namespace 寝室情景模式
{
    public partial class frm_control : Form
    {
        bool IsOpen = false;//定义布尔变量记录串口打开情况，默认为false
        bool IsLampOopen = false;//定义布尔变量记录灯光打开情况，默认为false
        bool IsBoardcastOpen = false;//定义布尔变量记录广播打开情况，默认为false
        ADAM4017ResModel ResModel;//创建4017接收数据模型
        DateTime now;
        DateTime GetUp = DateTime.Today.AddHours(6.75);//6：45起床时间
        DateTime ClassBegin = DateTime.Today.AddHours(7.5);//7：30上课开始时间
        DateTime ClassEnd = DateTime.Today.AddHours(21.0);//21：00上课结束时间
        DateTime Sleep = DateTime.Today.AddHours(22.0);//22：00睡觉时间
        public frm_control()
        {
            InitializeComponent();
        }
        private void frm_control_Load(object sender, EventArgs e)
        {
            com_import.Items.Clear();
            //将系统串口名依次加入下拉列表框中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_import.Items.Add(item);
            }

        }

        private void btn_apply_Click(object sender, EventArgs e)
        {
            if (!IsOpen)
            {
                IsOpen = true;
                btn_apply.Text = "停止情景模式";
                DeviceCtrlHelper.adam4017Helper.Open(com_import.Text);
                DeviceCtrlHelper.adam4150Helper.Open(com_import.Text);
                timer.Start();

            }
            else
            {
                btn_apply.Text = "开启情景模式";
                timer.Stop();
                IsOpen = false;
                DeviceCtrlHelper.adam4017Helper.Close();
                DeviceCtrlHelper.adam4150Helper.Close();
            }
        }

        private void CheckMode()//切换各个模式
        {
            if (now >= GetUp && now < ClassBegin)
            {
                lbl_mode.Text = "智慧寝室正处于起床模式";
                if (IsLampOopen == false)
                {
                    IsLampOopen = true;
                    DeviceCtrlHelper.adam4150Helper.OnOff(1, true);
                    lamp.OnOff(true);
                }
                if (IsBoardcastOpen == false)
                {
                    IsBoardcastOpen = true;
                    Thread playthd = new Thread(PlayMp3);
                    playthd.Start();
                }
                trb_curtain.Value = 5;

            }
            else if (now >= ClassBegin && now < ClassEnd)
            {
                lbl_mode.Text = "智慧寝室正处于上课模式";
                if (IsLampOopen == true)
                {
                    IsLampOopen = false;
                    DeviceCtrlHelper.adam4150Helper.OnOff(1, false);
                    lamp.OnOff(false);
                }
                if (IsBoardcastOpen == true)
                {
                    IsBoardcastOpen = false;
                    pic_boardcastStatus.Image = Properties.Resources.switch_off;
                }
                trb_curtain.Value = 0;

            }
            else if (now >= ClassEnd && now < Sleep)
            {
                lbl_mode.Text = "智慧寝室正处于回寝模式";
                if (IsLampOopen == false)
                {
                    IsLampOopen = true;
                    DeviceCtrlHelper.adam4150Helper.OnOff(1, true);
                    lamp.OnOff(true);
                }
                if (IsBoardcastOpen == false)
                {
                    IsBoardcastOpen = true;
                    Thread playthd = new Thread(PlayMp3);
                    playthd.Start();
                }

                trb_curtain.Value = 10;

            }
            else
            {
                lbl_mode.Text = "智慧寝室正处于熄灯模式";
                if (IsLampOopen == true)
                {
                    IsLampOopen = false;
                    DeviceCtrlHelper.adam4150Helper.OnOff(1, false);
                    lamp.OnOff(false);
                }
                if (IsBoardcastOpen == true)
                {
                    IsBoardcastOpen = false;
                    pic_boardcastStatus.Image = Properties.Resources.switch_off;
                }
                trb_curtain.Value = 10;
            }

        }
        private void timer_Tick(object sender, EventArgs e)
        {

            now = DateTime.Now;
            txt_time.Text = now.ToString("HH:mm:ss");//显示时间
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();//采集数据
            //显示采集到的数据
            txt_light.Text = ResModel.lightValue;//ResModel.airPressureValue
            txt_temperature.Text = ResModel.temperatureValue;//ResModel.airQualityValue
            txt_humidity.Text = ResModel.humidityValue;//ResModel.CO2Value
            CheckMode();
        }
        private void PlayMp3()//播放mp3音乐
        {

            pic_boardcastStatus.Image = Properties.Resources.switch_on;
            axWindowsMediaPlayer1.URL = System.AppDomain.CurrentDomain.BaseDirectory + "//Resources//ring.mp3";
            axWindowsMediaPlayer1.Ctlcontrols.play();
            Thread.Sleep(4000);
            pic_boardcastStatus.Image = Properties.Resources.switch_off;

        }

    }

}
