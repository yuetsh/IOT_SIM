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
using DeviceCtrlLibrary.Model;

namespace 模拟量采集
{
    public partial class frm_analog : Form
    {
        public frm_analog()
        {
            InitializeComponent();
        }

        bool IsOpen = false;
        ADAM4017ResModel ResModel;

        private void frm_analog_Load(object sender, EventArgs e)
        {
            //清空列表
            com_port.Items.Clear();
            //加载所有可用的串口号到列表中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_port.Items.Add(item);
            }
        }

        private void btn_Open_Click(object sender, EventArgs e)
        {
            if (!IsOpen)
            {
                //打开模拟量采集器所在的串口
                DeviceCtrlHelper.adam4017Helper.Open(com_port.Text);
                btn_Open.Text = "关闭";
                IsOpen = true;
            }
            else
            {
                //关闭串口
                DeviceCtrlHelper.adam4017Helper.Close();
                btn_Open.Text = "开启";
                IsOpen = false;
            }
        }

        private void btn_get_Click(object sender, EventArgs e)
        {
            //获取传感器数值
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();
            txt_light.Text = ResModel.lightValue;
            txt_humidity.Text = ResModel.humidityValue;
            txt_temperature.Text = ResModel.temperatureValue;
        }
    }
}
