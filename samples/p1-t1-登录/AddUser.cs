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
    public partial class AddUser : Form
    {
        public AddUser()
        {
            InitializeComponent();
        }

        private void btnOk_Click(object sender, EventArgs e)
        {
            if (PublicData.intNum < 4)//确保还有足够的存储空间
            {
                if (txtPass1.Text.Equals(txtPass2.Text) && txtPass2.Text != "")//确保两次密码相同且非空
                {
                    //存储新增用户
                    PublicData.SysUserName[PublicData.intNum] = txtNewUser1.Text;
                    PublicData.SysPwd[PublicData.intNum] = txtPass1.Text;
                    PublicData.intNum++;//增加实际存储数量
                    this.Close();//关闭当前窗体
                }
                else
                {
                    MessageBox.Show("用户名或密码错误，请重新输入", "新增用户");
                }
            }
            else
            {
                MessageBox.Show("用户名已满不能增加", "新增用户");
            }
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            this.Close();
        }
    }
}
