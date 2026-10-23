using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using DeviceCtrlLibrary;
using 智慧校园.SQLHelpers;

namespace 智慧校园
{
    public partial class SecurityCameraData : Form
    {
        public SecurityCameraData()
        {
            InitializeComponent();
        }
        //存放报警信息的集合
        Dictionary<string, Image> ImgDictionary = new Dictionary<string, Image>();
        //图片下标
        int index = -1;
        Image img;
        //KEY的列表（报警时间为KEY）
        List<string> Keys = new List<string>();

        private void SecurityCameraData_Load(object sender, EventArgs e)
        {
            try
            {
                //设置父容器
                pic_up.Parent = pic_camera;
                pic_down.Parent = pic_camera;
                //设置加载坐标
                pic_up.Location = new Point(20, 0);
                pic_down.Location = new Point(560, 0);
                GetData();
            }
            catch
            {
            }
        }
        //更新数据
        private void GetData()
        {
            try
            {
                DateTime startdt = dateTimePicker1.Value;
                DateTime enddt = dateTimePicker2.Value;
                ImgDictionary = SQLBLL.GetSecurityData(startdt, enddt);
                index = -1;
                Keys.Clear();

                if (ImgDictionary.Count != 0)
                    lb_noData.Visible = false;
                else
                {
                    lb_noData.Visible = true;
                    return;
                }
                foreach (string key in ImgDictionary.Keys)
                {
                    Keys.Add(key);
                }

                ImageChanged();
            }
            catch
            {
            }
        }
        //切换图片
        private void ImageChanged(char UpOrDown = '+')
        {
            try
            {
                if (ImgDictionary.Count == 0)
                    return;

                if (UpOrDown == '+')
                    index++;
                else if (UpOrDown == '-')
                    index--;

                if (index == ImgDictionary.Count)
                    index = 0;

                if (index == -1)
                    index = ImgDictionary.Count - 1;

                ImgDictionary.TryGetValue(Keys[index], out img);
                pic_camera.Image = img;
                lb_time.Text = Keys[index];
            }
            catch
            {
            }

        }

        private void btn_get_Click(object sender, EventArgs e)
        {
            try
            {
                GetData();
            }
            catch
            {
            }
        }

        private void pictureBox1_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        private void pic_up_Click(object sender, EventArgs e)
        {
            ImageChanged('-');
        }

        private void pic_down_Click(object sender, EventArgs e)
        {
            ImageChanged();
        }
    }
}
