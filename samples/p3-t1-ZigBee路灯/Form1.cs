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

namespace ZigBee路灯
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        //控制开关灯
        private void LampOnOff(int RelayNum, bool IsOpen)
        {
            DeviceCtrlHelper.zigBeeHelper.OnOff(RelayNum, IsOpen);
            lamp1.OnOff(IsOpen);
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            //清空列表
            com_port.Items.Clear();
            //加载所有可用的串口号到列表中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_port.Items.Add(item);
            }
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            if (btn_open.Text.Equals("打开"))
            {
                //打开ZigBee协调器所在的串口
                DeviceCtrlHelper.zigBeeHelper.Open(com_port.Text);
                btn_open.Text = "关闭";
            }
            else if (btn_open.Text.Equals("关闭"))
            {
                //关闭串口
                DeviceCtrlHelper.zigBeeHelper.Close();
                btn_open.Text = "打开";
            }
        }

        private void rb_Open_CheckedChanged(object sender, EventArgs e)
        {
            //开灯
            LampOnOff(1, true);
        }

        private void rb_Close_CheckedChanged(object sender, EventArgs e)
        {
            //关灯
            LampOnOff(1, false);
        }
    }
}
