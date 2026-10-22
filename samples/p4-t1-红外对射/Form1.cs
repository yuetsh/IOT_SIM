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

namespace 红外对射
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
            com_port.Items.Clear();
            foreach (string item in SerialPort.GetPortNames())
            {
                com_port.Items.Add(item);
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

        private void timer1_Tick(object sender, EventArgs e)
        {
            txt_time.Text = DateTime.Now.ToString();
            //获取红外对射入侵传感器的数据：true 表示有入侵
            if (DeviceCtrlHelper.adam4150Helper.SetData().infraredValue)
                txt_even.Text = "发现入侵";
            else
                txt_even.Text = "正常";
        }
    }
}
