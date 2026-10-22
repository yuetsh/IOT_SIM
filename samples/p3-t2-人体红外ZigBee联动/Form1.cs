using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.IO.Ports;
using DeviceCtrlLibrary;

namespace 人体红外ZigBee联动
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            //清空列表
            com_lamp.Items.Clear();
            com_environment.Items.Clear();
            //加载所有可用的串口号到列表中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_lamp.Items.Add(item);
                com_environment.Items.Add(item);
            }
        }

        //控制开关灯
        private void LampOnOff(int RelayNum, bool IsOpen)
        {
            DeviceCtrlHelper.zigBeeHelper.OnOff(RelayNum, IsOpen);
            lamp1.OnOff(IsOpen);
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            if (btn_open.Text.Equals("打开"))
            {
                //打开ZigBee协调器所在的串口
                DeviceCtrlHelper.zigBeeHelper.Open(com_lamp.Text);
                btn_open.Text = "关闭";
            }
            else if (btn_open.Text.Equals("关闭"))
            {
                //关闭串口
                DeviceCtrlHelper.zigBeeHelper.Close();
                btn_open.Text = "打开";
            }
        }

        private void ch_bodyInfrared_Click(object sender, EventArgs e)
        {
            if (ch_bodyInfrared.Checked)
            {
                //打开数字量采集器所在的串口，启动定时检测
                DeviceCtrlHelper.adam4150Helper.Open(com_environment.Text);
                timer1.Start();
                btn_lampOpen.Enabled = false;
                btn_lampClose.Enabled = false;
            }
            else
            {
                DeviceCtrlHelper.adam4150Helper.Close();
                timer1.Stop();
                btn_lampOpen.Enabled = true;
                btn_lampClose.Enabled = true;
            }
        }

        private void btn_lampOpen_Click(object sender, EventArgs e)
        {
            LampOnOff(1, true);
        }

        private void btn_lampClose_Click(object sender, EventArgs e)
        {
            LampOnOff(1, false);
        }

        //时间控件实时判断是否感应到人，如果感应到人则开路灯，否则关闭
        private void timer1_Tick(object sender, EventArgs e)
        {
            if (DeviceCtrlHelper.adam4150Helper.SetData().bodyInfraredValue)
                LampOnOff(1, true);
            else
                LampOnOff(1, false);
        }
    }
}
