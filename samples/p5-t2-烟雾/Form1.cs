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
using System.Threading;//引用线程命名空间

namespace 烟雾
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        bool IsOpen = false;
        bool IsFirst = true;//记录线程是否第一次打开
        Thread thd;//定义Thread线程

        private void Form1_Load(object sender, EventArgs e)
        {
            //用 foreach 循环把所有可用的串口号加入列表
            foreach (string item in SerialPort.GetPortNames())
            {
                com_port.Items.Add(item);
            }
            thd = new Thread(GetData);//实例化线程，绑定线程运行方法
            Control.CheckForIllegalCrossThreadCalls = false;//允许跨线程调用
        }

        private void GetData()
        {
            //线程运行方法，不断循环运行
            while (true)
            {
                if (DeviceCtrlHelper.adam4150Helper.SetData().smokeValue)//判断烟雾状态，true为发现烟雾灾情，false为正常状态
                {
                    txt_time.Text = DateTime.Now.ToString();
                    txt_even.Text = "发现烟情";
                }
                else
                {
                    txt_time.Text = DateTime.Now.ToString();
                    txt_even.Text = "正常";
                }
                Thread.Sleep(2000);//线程休眠2s
            }
        }

        private void btn_open_Click(object sender, EventArgs e)
        {
            IsOpen = !IsOpen;
            if (IsOpen)
            {
                DeviceCtrlHelper.adam4150Helper.Open(com_port.Text);
                btn_open.Text = "关闭";
                if (IsFirst)
                {
                    IsFirst = false;
                    thd.Start();//第一次打开时启动线程
                }
                else
                {
                    thd.Resume();//继续已挂起的线程
                }
            }
            else
            {
                DeviceCtrlHelper.adam4150Helper.Close();
                btn_open.Text = "开启";
                thd.Suspend();//挂起线程
            }
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            //挂起的线程不能直接终止，要先让它继续
            if (thd.ThreadState == ThreadState.Suspended)
            {
                thd.Resume();
            }
            thd.Abort();//终止线程
        }
    }
}
