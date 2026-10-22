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

namespace LED推送模拟量
{
    public partial class frm_LED : Form
    {
        public frm_LED()
        {
            InitializeComponent();
        }

        bool IsOpen = false;
        ADAM4017ResModel ResModel;
        String LED_MSG = "";

        private void frm_LED_Load(object sender, EventArgs e)
        {
            //清空列表
            com_adamPort.Items.Clear();
            com_ledPort.Items.Clear();
            //加载所有可用的串口号到列表中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_adamPort.Items.Add(item);
                com_ledPort.Items.Add(item);
            }
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            if (!IsOpen)
            {
                //打开模拟量采集器和LED显示屏所在的串口
                DeviceCtrlHelper.adam4017Helper.Open(com_adamPort.Text);
                DeviceCtrlHelper.ledHelper.OpenLedCom(com_ledPort.Text);
                btn_open.Text = "关闭";
                IsOpen = true;
            }
            else
            {
                //关闭串口
                DeviceCtrlHelper.adam4017Helper.Close();
                DeviceCtrlHelper.ledHelper.Close();
                btn_open.Text = "开启";
                IsOpen = false;
            }
        }

        private void btn_get_Click(object sender, EventArgs e)
        {
            LED_MSG = "";
            //获取传感器数值
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();
            txt_light.Text = ResModel.lightValue;
            txt_humidity.Text = ResModel.humidityValue;
            txt_temperature.Text = ResModel.temperatureValue;
            //拼接要推送的环境信息
            LED_MSG += ("当前环境信息" + " " + "光照度:" + ResModel.lightValue + "lx温度:" + ResModel.temperatureValue + "℃湿度:" + ResModel.humidityValue + "%");
            //推送到LED显示屏
            String Res = DeviceCtrlHelper.ledHelper.SendLedString(LED_MSG);
            if (!(Res.IndexOf("Error") >= 0))
            {
                led.setLedText(Res);
            }
        }
    }
}
