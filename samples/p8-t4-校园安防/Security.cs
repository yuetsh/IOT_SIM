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
using System.Threading;

using DeviceCtrlLibrary;
using 智慧校园.SQLHelpers;

namespace 智慧校园
{
    public partial class Security : Form
    {   //显示图像
        Image img = null;
        //入侵标识
        bool IsInfrared = false;
        //图像文件夹路径
        string ImgDir = AppDomain.CurrentDomain.BaseDirectory + "Camera\\";
        //用于数据采集和SQL操作
        Thread thread;
        SynchronizationContext _main; 
        public Security()
        {
            InitializeComponent();
        }
        void ipCameraHelper_ImageRead(ImageReadEvenArgs e)
        {
            img = e.img;
            pic_video.Image = e.img;
        }
        void tick()
        {
            try
            {
                while (true)
                {
                    try
                    {
                        //采集入侵状态
                        IsInfrared = DeviceCtrlHelper.adam4150Helper.SetData().infraredValue;
                        //UI显示入侵状态
                        _main.Send(_ =>
                        {
                            lb_infrared.Text = IsInfrared ? "发现入侵" : "正常";
                        }, null);

                        if (IsInfrared)
                        {
                            if (img != null)
                                //上传报警信息
                                SQLBLL.SecurityUpData(img);
                        }
                    }
                    catch
                    {
                    }

                    Thread.Sleep(1000);
                }
            }
            catch
            {
            }
        }
        private void pictureBox2_Click(object sender, EventArgs e)
        {

        }

        private void panel1_Paint(object sender, PaintEventArgs e)
        {

        }

        private void panel_bg_video_Paint(object sender, PaintEventArgs e)
        {

        }

        private void Security_Load(object sender, EventArgs e)
        {
            try
            {
           

                //实例化摄像头控制类
                DeviceCtrlHelper.ipCameraHelper.Open(AppSet.Camera_Ip, AppSet.Camera_Uid, AppSet.Camera_Pwd);
                DeviceCtrlHelper.ipCameraHelper.ImageRead += ipCameraHelper_ImageRead;
                DeviceCtrlHelper.ipCameraHelper.Start();

                thread = new Thread(new ThreadStart(tick));
                _main = WindowsFormsSynchronizationContext.Current;
                thread.Start();

                if (!Directory.Exists(ImgDir))
                    //创建文件夹
                    Directory.CreateDirectory(ImgDir);
            }
            catch
            {
            }
        }

        private void Security_FormClosed(object sender, FormClosedEventArgs e)
        {
            try
            {
                DeviceCtrlHelper.ipCameraHelper.Stop();
                DeviceCtrlHelper.ipCameraHelper.Close();
                thread.Suspend();
                thread = null;
             
            }
            catch
            {
            }

        }

        private void btn_camera_Click(object sender, EventArgs e)
        {
            try
            {
                pic_video.Image.Save(ImgDir + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".jpg");
                SQLBLL.SecurityUpData(pic_video.Image);
            }
            catch
            {
            }

        }

        private void pic_up_MouseDown(object sender, MouseEventArgs e)
        {
            try
            {
                pic_up.BackgroundImage = Properties.Resources.btn_arrow_up_press;
                DeviceCtrlHelper.ipCameraHelper.PanUp();
            }
            catch
            {
            }
        }

        private void pic_up_MouseUp(object sender, MouseEventArgs e)
        {
            try
            {
                pic_up.BackgroundImage = Properties.Resources.btn_arrow_up_normal;
                DeviceCtrlHelper.ipCameraHelper.PanUp();
            }
            catch
            {
            }
        }

        private void pic_down_MouseDown(object sender, MouseEventArgs e)
        {
            try
            {
                pic_down.BackgroundImage = Properties.Resources.btn_arrow_down_press;
                DeviceCtrlHelper.ipCameraHelper.PanDown();
            }
            catch
            {
            }
        }

        private void pic_down_MouseUp(object sender, MouseEventArgs e)
        {
            try
            {
                pic_down.BackgroundImage = Properties.Resources.btn_arrow_down_normal;
                DeviceCtrlHelper.ipCameraHelper.PanDown();
            }
            catch
            {
            }
        }

        private void pic_left_MouseDown(object sender, MouseEventArgs e)
        {
            try
            {
                pic_left.BackgroundImage = Properties.Resources.btn_arrow_left_press;
                DeviceCtrlHelper.ipCameraHelper.PanLeft();
            }
            catch
            {
            }
        }

        private void pic_left_MouseUp(object sender, MouseEventArgs e)
        {
            try
            {
                pic_left.BackgroundImage = Properties.Resources.btn_arrow_left_normal;
                DeviceCtrlHelper.ipCameraHelper.PanLeft();
            }
            catch
            {
            }
        }

        private void pic_right_MouseDown(object sender, MouseEventArgs e)
        {
            try
            {
                pic_right.BackgroundImage = Properties.Resources.btn_arrow_right_press;
                DeviceCtrlHelper.ipCameraHelper.PanRight();
            }
            catch
            {
            }
        }

        private void pic_right_MouseUp(object sender, MouseEventArgs e)
        {
            try
            {
                pic_right.BackgroundImage = Properties.Resources.btn_arrow_right_normal;
                DeviceCtrlHelper.ipCameraHelper.PanRight();
            }
            catch
            {
            }
        }

        private void lb_return_Click(object sender, EventArgs e)
        {
            this.Close();
        }
    }
}
