using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Data.SqlClient;
using System.IO.Ports;

namespace 校园数据存储
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        string sqlConnectString = @"Data Source=.;Initial Catalog=环境数据表;User ID=sa;Password=123456";//数据库的连接字符串
        SqlConnection mySqlConnection;
        SqlCommand mySqlCmd;
        SqlDataAdapter sqldata;
        DataSet ds;

        private void btnCx_Click(object sender, EventArgs e)
        {
            mySqlConnection = new SqlConnection(sqlConnectString);//创建数据库连接对象
            mySqlConnection.Open();//打开数据库
            //查询开始日期和结束日期之间的数据
            SqlCommand sqlcmd = new SqlCommand("select ID as '编号',temperature as '温度',humidity as '湿度',light as '光照度',addtime as '时间' from CampusEnvironment where addtime BETWEEN '" + StartTime.Value.ToString() + "' AND '" + EndTime.Value.ToString() + "'", mySqlConnection);
            sqldata = new SqlDataAdapter(sqlcmd);
            ds = new DataSet();
            sqldata.Fill(ds);
            dataGridView1.DataSource = ds.Tables[0].DefaultView;
            mySqlConnection.Close();//关闭数据库
        }
    }
}
