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

namespace 火焰
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        bool IsOpen = false;

        private void Form1_Load(object sender, EventArgs e)
        {
            //用 for 循环把所有可用的串口号加入列表
            for (int i = 0; i < SerialPort.GetPortNames().Length; i++)
            {
                com_port.Items.Add(SerialPort.GetPortNames()[i].ToString());
            }
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            IsOpen = !IsOpen;
            if (IsOpen)
            {
                //打开数字量采集器所在的串口，开始定时采集
                DeviceCtrlHelper.adam4150Helper.Open(com_port.Text);
                timer1.Start();
                btn_open.Text = "关闭";
            }
            else
            {
                DeviceCtrlHelper.adam4150Helper.Close();
                timer1.Stop();
                btn_open.Text = "开启";
            }
        }

        private String GetFireInfo()
        {
            //判断火焰传感器返回bool值是否为true，若为true，则返回火情信息
            if (DeviceCtrlHelper.adam4150Helper.SetData().fireValue)
            {
                return "发现火情！";
            }
            return "正常！";//无火情返回正常信息
        }

        private void timer1_Tick(object sender, EventArgs e)
        {
            txt_time.Text = DateTime.Now.ToString();
            txt_even.Text = GetFireInfo();
        }
    }
}
