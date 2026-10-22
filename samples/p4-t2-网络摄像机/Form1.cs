using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.IO;
using DeviceCtrlLibrary;

namespace 网络摄像机
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        static string CameraPath = AppDomain.CurrentDomain.BaseDirectory + "Camera/";//拍照保存路径
        static string IpCameraIPAddress = "192.168.14.131";//网络摄像机IP
        bool IsOpen = false;
        Image ReadImage = null;//存储摄像机图片

        private void Form1_Load(object sender, EventArgs e)
        {
            //判断拍照保存文件夹是否存在，若不存在则先创建
            if (!Directory.Exists(CameraPath))
                Directory.CreateDirectory(CameraPath);
            DeviceCtrlHelper.ipCameraHelper.ImageRead += ipCameraHelper_ImageRead;//绑定图片显示事件
        }

        void ipCameraHelper_ImageRead(ImageReadEvenArgs e)
        {
            ReadImage = e.img;//保存摄像机拍到的图片
            pictureBox1.Image = ReadImage;//显示在图片框上
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            IsOpen = !IsOpen;
            if (IsOpen)
            {
                IpCameraIPAddress = txt_ip.Text;
                DeviceCtrlHelper.ipCameraHelper.Open(IpCameraIPAddress, "admin", "");//用户名admin，密码为空
                DeviceCtrlHelper.ipCameraHelper.Start();//开始传送图像
                btn_open.Text = "关";
            }
            else
            {
                DeviceCtrlHelper.ipCameraHelper.Stop();//停止传送图像
                btn_open.Text = "开";
            }
        }

        private void btn_up_Click(object sender, EventArgs e)
        {
            DeviceCtrlHelper.ipCameraHelper.PanUp();//向上转
        }

        private void btn_down_Click(object sender, EventArgs e)
        {
            DeviceCtrlHelper.ipCameraHelper.PanDown();//向下转
        }

        private void btn_left_Click(object sender, EventArgs e)
        {
            DeviceCtrlHelper.ipCameraHelper.PanLeft();//向左转
        }

        private void btn_right_Click(object sender, EventArgs e)
        {
            DeviceCtrlHelper.ipCameraHelper.PanRight();//向右转
        }

        private void btn_camera_Click(object sender, EventArgs e)
        {
            //拍照：把当前图像以时间命名保存到Camera文件夹
            if (ReadImage != null)
                ReadImage.Save(CameraPath + DateTime.Now.ToString("yyyyMMdd_HH mm ss") + ".jpg");
        }
    }
}
