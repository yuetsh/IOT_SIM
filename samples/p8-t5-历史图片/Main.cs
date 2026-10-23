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
namespace 智慧校园
{
    public partial class Main : Form
    {
        public Main()
        {
            InitializeComponent();
        }

        private void panel1_Paint(object sender, PaintEventArgs e)
        {
          
        }

        private void pic_environment_Click(object sender, EventArgs e)
        {
            try
            {
                new Environment().Show();
            
            }
            catch
            {
            }
        }

        private void panel2_Paint(object sender, PaintEventArgs e)
        {

        }

        private void Main_Load(object sender, EventArgs e)
        {
            try
            {
                //实例化工具类
                DeviceCtrlHelper.adam4017Helper.Open(AppSet.ADAM4017_COM);
                DeviceCtrlHelper.adam4150Helper.Open(AppSet.ADAM4150_COM);
                DeviceCtrlHelper.zigBeeHelper.Open(AppSet.ZigBee_COM);
                DeviceCtrlHelper.ledHelper.OpenLedCom(AppSet.LED_COM);
            }
            catch { }
        }

        private void pic_security_Click(object sender, EventArgs e)
        {
            try
            {
                new Security().Show();
            
            }
            catch
            {
            }
        }

        private void pic_exit_Click(object sender, EventArgs e)
        {
            this.Close();
        }
    }
}
