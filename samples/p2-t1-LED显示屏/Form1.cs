using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.IO.Ports;//调用系统串口资源类所在的命名空间
using DeviceCtrlLibrary;//调用外部设备控制资源类所在的命名空间
using WinFormsDeviceControlLibrary;//引用外部窗体类所在的命名空间

namespace LED显示屏
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void btn_Open_Click(object sender, EventArgs e)
        {
            //在com_Port下拉列表中选中的项，作为当前串口
            DeviceCtrlHelper.ledHelper.OpenLedCom(com_Port.Text);
        }

        private void btn_Send_Click(object sender, EventArgs e)
        {
            // 读txt_SendText控件的内容，保存在字符串变量res中
            string res = DeviceCtrlHelper.ledHelper.SendLedString(txt_SendText.Text);
            //判断字符串res是否为空
            if (res.IndexOf("Error") >= 0)
            {
                MessageBox.Show(res);   //出错提示
            }
            else
            {
                led.setLedText(res);//发送
            }
        }

        private void com_Port_Click(object sender, EventArgs e)
        {
            //清空列表
            com_Port.Items.Clear();
            //加载所有可用的串口号到列表中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_Port.Items.Add(item);
            }
        }
    }
}
