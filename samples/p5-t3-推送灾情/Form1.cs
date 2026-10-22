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
using DeviceCtrlLibrary.Model;//引用设备控制库下的Model命名空间

namespace 火焰烟雾
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        ADAM4150ResModel ResModel;
        bool IsOpen = false;
        string LED_MSG = "";//存储LED显示屏所需发送的文字信息

        private void Form1_Load(object sender, EventArgs e)
        {
            com_environmentPort.Items.Clear();
            com_ledPort.Items.Clear();
            //将系统串口名依次加入下拉列表框中，由于本题使用串口服务器，所以COM1计算机串口可不加入串口列表
            for (int i = 0; i < SerialPort.GetPortNames().Length; i++)
            {
                //判断计算机的默认串口，将其排除
                if (SerialPort.GetPortNames()[i].ToUpper() == "COM1")
                {
                    continue;//跳出此次循环
                }
                com_environmentPort.Items.Add(SerialPort.GetPortNames()[i].ToString());
                com_ledPort.Items.Add(SerialPort.GetPortNames()[i].ToString());
            }
        }

        private void btn_Open_Click(object sender, EventArgs e)
        {
            IsOpen = !IsOpen;
            if (IsOpen)
            {
                DeviceCtrlHelper.adam4150Helper.Open(com_environmentPort.Text);
                DeviceCtrlHelper.ledHelper.OpenLedCom(com_ledPort.Text);
                btn_Open.Text = "关闭";
            }
            else
            {
                DeviceCtrlHelper.adam4150Helper.Close();
                btn_Open.Text = "开启";
            }
        }

        private void btn_get_Click(object sender, EventArgs e)
        {
            ResModel = DeviceCtrlHelper.adam4150Helper.SetData();//获取数字量采集器ADAM 4150的最新数据
            LED_MSG = "";
            txt_time.Text = DateTime.Now.ToString();
            txt_fire.Text = "正常";
            txt_smoke.Text = "正常";
            if (ResModel.fireValue)
            {
                txt_fire.Text = "发现火情";
                LED_MSG += "发现火情";
                RecordClass.record[RecordClass.recoudeindex, 0] = txt_time.Text;//记录灾情时间至数组
                RecordClass.record[RecordClass.recoudeindex, 1] = " 发现火情";//记录灾情内容至数组
                RecordClass.recoudeindex++;
            }
            if (ResModel.smokeValue)
            {
                txt_smoke.Text = "发现烟情";
                LED_MSG += "发现烟情";
                RecordClass.record[RecordClass.recoudeindex, 0] = txt_time.Text;//记录灾情时间至数组
                RecordClass.record[RecordClass.recoudeindex, 1] = " 发现烟情";//记录灾情内容至数组
                RecordClass.recoudeindex++;
            }
            string ResStr = DeviceCtrlHelper.ledHelper.SendLedString(LED_MSG);
            if (!(ResStr.IndexOf("Error") >= 0))
                led1.setLedText(ResStr);//推送灾情信息至LED显示屏
        }

        private void OpenRecord_Click(object sender, EventArgs e)
        {
            Form2 fr2 = new Form2();
            fr2.Show();
        }
    }
}
