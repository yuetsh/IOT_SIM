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

namespace 教室情景模式
{
    public partial class frm_control : Form
    {
        bool IsOpen = false;//定义布尔变量记录串口打开情况，默认为false
        bool IsLampOpen = false;//定义布尔变量记录电灯打开情况，默认为false
        bool IsairconditioneOpen = false;//定义布尔变量记录空调打开情况，默认为false
        ADAM4017ResModel ResModel;//创建4017接收数据模型

        public frm_control()
        {
            InitializeComponent();
        }

        private void frm_control_Load(object sender, EventArgs e)
        {
            //将系统串口名依次加入下拉列表框中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_import.Items.Add(item);
            }
        }

        private void btn_apply_Click(object sender, EventArgs e)
        {
            if (!IsOpen)//判断串口是否打开
            {
                DeviceCtrlHelper.adam4017Helper.Open(com_import.Text);//打开串口
                DeviceCtrlHelper.adam4150Helper.Open(com_import.Text);//打开串口
                btn_apply.Text = "关闭";//按钮btn_apply显示“关闭”
                lbl_mode.Text = "智慧教室已开启";//标签lbl_mode显示“智慧教室已开启”
                IsOpen = true;
                timer.Start();//通过timer_Tick实时把采集到的数据显示出来,并判断是否需要开灯、关窗帘
                
            }
            else
            {
                DeviceCtrlHelper.adam4017Helper.Close();//关闭采集
                DeviceCtrlHelper.adam4150Helper.Close();//关闭4150
                timer.Stop();//停止数据采集与自动控制
                btn_apply.Text = "启用";
                lbl_mode.Text = "智慧教室将开启";
                IsOpen = false;
            }
        }


       
        private void timer_Tick(object sender, EventArgs e)
        {
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();//采集数据
            //显示采集到的数据
            txt_light.Text = ResModel.lightValue;
            txt_temperature.Text = ResModel.temperatureValue;
            txt_humidity.Text = ResModel.humidityValue;

            if (Convert.ToInt16(ResModel.lightValue) < 400)//光照度过低则打开灯
            {
                pic_lightsStatus.Image = Properties.Resources.switch_on;
                IsLampOpen = true;
                lamp.OnOff(true);//打开界面灯
                DeviceCtrlHelper.adam4150Helper.OnOff(1,true);//打开1通道灯
            }
            else if (Convert.ToInt16(ResModel.lightValue) > 800 )
            {
                pic_lightsStatus.Image = Properties.Resources.switch_off;
                IsLampOpen = false;
                lamp.OnOff(false);//关闭界面灯
                DeviceCtrlHelper.adam4150Helper.OnOff(1, false);//关闭1通道灯
            }

            if (Convert.ToInt16(ResModel.temperatureValue) > 30 )
            {
                pic_airconditioneStatus.Image = Properties.Resources.switch_on;
                IsairconditioneOpen = true;
                trb_airconditione.Value = 26;

            }
            else if (Convert.ToInt16(ResModel.temperatureValue) < 5)
            {
                pic_airconditioneStatus.Image = Properties.Resources.switch_on;
                IsairconditioneOpen = true;
                trb_airconditione.Value = 25;
            }
            else
            {
                pic_airconditioneStatus.Image = Properties.Resources.switch_off;
                IsairconditioneOpen = false;
                trb_airconditione.Value = 18;
            }
        }

        private void pic_lightsStatus_Click(object sender, EventArgs e)
        {
            if (IsLampOpen)
            {
                pic_lightsStatus.Image = Properties.Resources.switch_off;
                IsLampOpen = false;
                lamp.OnOff(false);
                DeviceCtrlHelper.adam4150Helper.OnOff(1, false);//关闭1通道灯

            }
            else
            {
                pic_lightsStatus.Image = Properties.Resources.switch_on;
                IsLampOpen = true;
                lamp.OnOff(true);
                DeviceCtrlHelper.adam4150Helper.OnOff(1, true);//打开1通道灯
            }
        }

    }
}
