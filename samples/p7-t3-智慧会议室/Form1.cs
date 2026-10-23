using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.IO;//引用系统IO库
using System.IO.Ports;//引用系统IO端口库
using DeviceCtrlLibrary;//引用自定义设备控制库
using DeviceCtrlLibrary.Model;//引用自定义设备控制模型库

namespace 会议室情景模式
{
    public partial class frm_control : Form
    {
        bool IsLightsOpen = false;//定义布尔变量记录电灯打开情况，默认为false
        bool IsmainMicrophoneOpen = false;//定义布尔变量记录主麦克风打开情况，默认为false
        bool IssubMicrophoneOpen = false;//定义布尔变量记录客麦克风打开情况，默认为false
        bool IsInitialized = false;//定义布尔变量记录情景模式是否初始化，默认为false
        ADAM4017ResModel ResModel;//创建4017接收数据模型
        DateTime now;//定义时间变量记录现在的时间
        DateTime reserve=DateTime.Now.AddDays(1) ;//定义时间变量记录预约的时间，默认为明天，防止初始值小于当前时间的假预约情况
        Image ReadImage = null;//定义图片变量记录拍摄的图片，默认为空

        public frm_control()
        {
            InitializeComponent();
        }

        private void frm_control_Load(object sender, EventArgs e)
        {
            com_import.Items.Clear();
            com_mode.Items.Clear();
            //将系统串口名依次加入下拉列表框中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_import.Items.Add(item);
            }
            com_mode.Items.Add("会议");
            com_mode.Items.Add("讨论");
            com_mode.Items.Add("展示");
            timer.Start();
            //判断拍照保存文件夹是否存在，若无则先创建
            if (!Directory.Exists(AppDomain.CurrentDomain.BaseDirectory + "Camera/"))
                Directory.CreateDirectory(AppDomain.CurrentDomain.BaseDirectory + "Camera/");

            DeviceCtrlHelper.ipCameraHelper.ImageRead += ipCameraHelper_ImageRead;
        }

        private void btn_reserve_Click(object sender, EventArgs e)
        {
            reserve = DateTime.Today.AddHours(Convert.ToInt16(txt_hour.Text));//设定预约时间
            reserve = reserve.AddMinutes(Convert.ToInt16(txt_minute.Text));
            reserve = reserve.AddSeconds(Convert.ToInt16(txt_second.Text));
        }

        void ipCameraHelper_ImageRead(ImageReadEvenArgs e)
        {
            ReadImage = e.img;
        }

        private void ChooseMode()
        {
            lbl_mode.Text = "智慧会议室已开启" + com_mode.Text + "模式";
            switch (com_mode.Text)
            {
                case "会议":
                    pic_lightsStatus.Image = Properties.Resources.switch_on;//转换灯光图片
                    lamp.OnOff(true);//开启界面灯光
                    DeviceCtrlHelper.adam4150Helper.OnOff(1,true);//打开1通道灯
                    trb_curtain.Value = 0;//打开窗帘
                    pic_mainMicrophone.Image = Properties.Resources.switch_on;//打开主麦
                    pic_subMicrophone.Image = Properties.Resources.switch_off;//关闭客麦
                    break;
                case "讨论":
                    pic_lightsStatus.Image = Properties.Resources.switch_on;//转换灯光图片
                    lamp.OnOff(true);//开启界面灯光
                    DeviceCtrlHelper.adam4150Helper.OnOff(1,true);//打开1通道灯
                    trb_curtain.Value = 0;//打开窗帘
                    pic_mainMicrophone.Image = Properties.Resources.switch_on;//打开主麦
                    pic_subMicrophone.Image = Properties.Resources.switch_on;//打开客麦
                    break;
                case "展示":
                    pic_lightsStatus.Image = Properties.Resources.switch_on;//转换灯光图片
                    lamp.OnOff(true);//开启界面灯光
                    DeviceCtrlHelper.adam4150Helper.OnOff(1, true);//打开1通道灯
                    trb_curtain.Value = 10;//关闭窗帘
                    pic_mainMicrophone.Image = Properties.Resources.switch_on;//打开主麦
                    pic_subMicrophone.Image = Properties.Resources.switch_off;//关闭主麦
                    break;
            }
        }

        private void timer_Tick(object sender, EventArgs e)
        {
            DeviceCtrlHelper.adam4017Helper.Open(com_import.Text);
            DeviceCtrlHelper.adam4150Helper.Open(com_import.Text);
            now = DateTime.Now;
            lbl_time.Text = now.ToString("HH:mm:ss");//显示时间
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();//采集数据
            //显示采集到的数据
            txt_light.Text = ResModel.lightValue;
            txt_temperature.Text = ResModel.temperatureValue;
            txt_humidity.Text = ResModel.humidityValue;
            txt_airPressure.Text = ResModel.airPressureValue;
            txt_airQuality.Text = ResModel.airQualityValue;
            //模式判断
            if (now >= reserve)
            {
                if (!IsInitialized)
                {
                    ChooseMode();//进入选择的模式
                    if (chk_record.Checked)
                    {
                        DeviceCtrlHelper.ipCameraHelper.Open(txt_camera.Text, "admin", "");//初始化视频监控参数
                        DeviceCtrlHelper.ipCameraHelper.Start();//开启视频监控
                    }
                    IsInitialized = true;
                }
                if (now.Second == 0 && now.Minute % 5 == 0)//每次分钟数被5整除，秒钟数为00拍照，实现每隔5分钟拍照存储
                {
                    if (ReadImage != null)
                    {
                        ReadImage.Save(AppDomain.CurrentDomain.BaseDirectory + "Camera/" + DateTime.Now.ToString("yyyyMMdd_HH mm ss") + ".jpg");
                    }
                }
            }

        }

        private void pic_lightsStatus_Click(object sender, EventArgs e)
        {//电灯可以手动开关
            if (IsLightsOpen)
            {
                lamp.OnOff(false);
                pic_lightsStatus.Image = Properties.Resources.switch_off;
                DeviceCtrlHelper.adam4150Helper.OnOff(1, false);//关闭1通道灯
                IsLightsOpen = false;
            }
            else
            {
                lamp.OnOff(true);
                pic_lightsStatus.Image = Properties.Resources.switch_on;
                DeviceCtrlHelper.adam4150Helper.OnOff(1, true);//关闭1通道灯
                IsLightsOpen = true;
            }
        }

        private void pic_subMicrophone_Click(object sender, EventArgs e)
        {//客麦可以手动开关
            if (IssubMicrophoneOpen)
            {
                pic_subMicrophone.Image = Properties.Resources.switch_off;
                IssubMicrophoneOpen = false;
            }
            else
            {
                pic_subMicrophone.Image = Properties.Resources.switch_on;
                IssubMicrophoneOpen = true;
            }

        }

        private void btn_exit_Click(object sender, EventArgs e)
        {
            timer.Stop();
            reserve = DateTime.Today.AddDays(1);
            chk_record.Enabled = false;
            pic_lightsStatus.Image = Properties.Resources.switch_off;//转换灯光图片
            lamp.OnOff(false);//关闭界面灯光
            DeviceCtrlHelper.adam4150Helper.OnOff(1, false);//关闭1通道灯
            trb_curtain.Value = 0;//关闭窗帘
            pic_mainMicrophone.Image = Properties.Resources.switch_off;//关闭主麦
            pic_subMicrophone.Image = Properties.Resources.switch_off;//关闭客麦
            IsInitialized = false;//初始化状态
            DeviceCtrlHelper.adam4150Helper.Close();
            DeviceCtrlHelper.adam4017Helper.Close();//关闭串口
            DeviceCtrlHelper.ipCameraHelper.Stop();//关闭视频监控
            
        }

        private void pic_mainMicrophone_Click(object sender, EventArgs e)
        {//主麦可以手动开关
            if (IsmainMicrophoneOpen)
            {
                pic_mainMicrophone.Image = Properties.Resources.switch_off;
                IsmainMicrophoneOpen = false;
            }
            else
            {
                pic_mainMicrophone.Image = Properties.Resources.switch_on;
                IsmainMicrophoneOpen = true;
            }
        }

    }
}
