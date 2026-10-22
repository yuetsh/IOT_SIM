using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace 登录
{
    public partial class Login : Form
    {
        public Login()
        {
            InitializeComponent();
        }

        public bool IsLogin = false;//定义登录标识

        private void btnOk_Click(object sender, EventArgs e)
        {
            for (int i = 0; i < PublicData.SysUserName.Length; i++)
            {
                string usr = PublicData.SysUserName[i];
                string pwd = PublicData.SysPwd[i];
                if (txtUserName.Text == usr && txtPassword.Text == pwd && txtUserName.Text != "")//遍历用户名密码是否存在
                {
                    IsLogin = true;//变更登录标识
                    MessageBox.Show("登录成功，欢迎进入！", "登录");
                    PublicData.intUser = i;//存储当前用户在数组中的索引
                    break;//结束循环
                }
                else
                    IsLogin = false;
            }
            if (IsLogin == false)
            {
                MessageBox.Show("无效的密码或用户名，请重试", "登录");
                txtPassword.Focus();
            }
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            IsLogin = false;
            this.Close();//关闭当前窗体
        }

        private void btnAdd_Click(object sender, EventArgs e)
        {
            AddUser addfrm = new AddUser();//实例化添加用户窗体
            addfrm.Show();//显示增加用户窗体
        }
    }
}
