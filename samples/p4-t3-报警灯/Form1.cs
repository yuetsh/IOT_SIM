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

namespace 报警灯
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

        private void AlarmOnOff(string Device, bool IsOpen)
        {
            //利用switch语句打开或关闭继电器模块
            switch (Device)
            {
                case "Alarm":
                    DeviceCtrlHelper.adam4150Helper.OnOff(0, IsOpen);//报警灯接入DO0
                    alarm1.OnOff(IsOpen);//更改界面报警灯状态
                    break;
                case "LED1": DeviceCtrlHelper.adam4150Helper.OnOff(1, IsOpen); break;//开启或关闭继电器1模块
                case "LED2": DeviceCtrlHelper.adam4150Helper.OnOff(2, IsOpen); break;//开启或关闭继电器2模块
                default: MessageBox.Show("没有合适的接口程序！", "错误提示！"); break;//若为其他模块，则提示错误
            }
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            IsOpen = !IsOpen;
            if (IsOpen)
            {
                DeviceCtrlHelper.adam4150Helper.Open(com_port.Text);
                btn_open.Text = "关闭";
            }
            else
            {
                DeviceCtrlHelper.adam4150Helper.Close();
                btn_open.Text = "开启";
            }
        }

        private void btn_alarmOpen_Click(object sender, EventArgs e)
        {
            AlarmOnOff("Alarm", true);
        }

        private void btn_alarmClose_Click(object sender, EventArgs e)
        {
            AlarmOnOff("Alarm", false);
        }
    }
}
