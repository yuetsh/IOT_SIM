using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Data.SqlClient;//引用数据库操作库
using System.IO.Ports;
using DeviceCtrlLibrary;
using DeviceCtrlLibrary.Model;//引用ADAM4017ResModel

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
        bool IsOpen = false;
        ADAM4017ResModel ResModel;
        DataSet ds;

        private void Form1_Load(object sender, EventArgs e)
        {
            mySqlConnection = new SqlConnection(sqlConnectString);
            mySqlConnection.Open();
            //将系统串口名依次加入下拉列表框中
            foreach (string item in SerialPort.GetPortNames())
            {
                com_port.Items.Add(item);
            }
        }

        private void btn_Open_Click(object sender, EventArgs e)
        {
            if (!IsOpen)
            {
                DeviceCtrlHelper.adam4017Helper.Open(com_port.Text);
                btn_Open.Text = "关闭";
                IsOpen = true;
            }
            else
            {
                DeviceCtrlHelper.adam4017Helper.Close();
                btn_Open.Text = "开启";
                IsOpen = false;
            }
        }

        private void btn_get_Click(object sender, EventArgs e)
        {
            ResModel = DeviceCtrlHelper.adam4017Helper.SetData();
            txt_light.Text = ResModel.lightValue;
            txt_humidity.Text = ResModel.humidityValue;
            txt_temperature.Text = ResModel.temperatureValue;
        }

        //数据绑定：查询表中全部数据，显示在表格中
        private void Databind()
        {
            mySqlConnection = new SqlConnection(sqlConnectString);
            mySqlConnection.Open();
            SqlCommand sqlcmd = new SqlCommand("select ID as '编号',temperature as '温度',humidity as '湿度',light as '光照度', addtime as '时间' from CampusEnvironment", mySqlConnection);
            sqldata = new SqlDataAdapter(sqlcmd);
            ds = new DataSet();
            sqldata.Fill(ds);
            dataGridView1.DataSource = ds.Tables[0].DefaultView;
        }

        private void btn_save_Click(object sender, EventArgs e)
        {
            string light = txt_light.Text;
            string temperature = txt_temperature.Text;
            string humidity = txt_humidity.Text;
            try
            {
                //写明列名，值按列名的顺序存入对应的列
                mySqlCmd = new SqlCommand("insert into CampusEnvironment (temperature, humidity, light, addtime) values (" + temperature + "," + humidity + "," + light + ", '" + DateTime.Now.ToString() + "')", mySqlConnection);
                mySqlCmd.ExecuteNonQuery();
                MessageBox.Show("保存成功！");
                Databind();
            }
            catch (Exception ex)
            {
                MessageBox.Show("保存失败：" + ex.ToString());
            }
        }

        private void btnUpdate_Click(object sender, EventArgs e)
        {
            //根据查询语句自动生成更新语句，把表格中修改过的数据写回数据库
            SqlCommandBuilder cmdb = new SqlCommandBuilder(sqldata);
            sqldata.UpdateCommand = cmdb.GetUpdateCommand();
            if (sqldata.Update(ds.Tables[0]) == 1)
            {
                MessageBox.Show("修改成功！");
                Databind();
            }
            else
            {
                MessageBox.Show("修改失败！");
            }
        }

        private void btnDelete_Click(object sender, EventArgs e)
        {
            try
            {
                mySqlCmd = new SqlCommand("delete from CampusEnvironment where id=" + dataGridView1.CurrentRow.Cells[0].Value.ToString(), mySqlConnection);
                mySqlCmd.ExecuteNonQuery();
                MessageBox.Show("删除成功！");
                Databind();
            }
            catch (Exception ex) //捕获数据库操作异常信息
            {
                MessageBox.Show("删除失败：" + ex.ToString());
            }
        }
    }
}
