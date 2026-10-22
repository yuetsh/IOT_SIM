using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace 火焰烟雾
{
    public partial class Form2 : Form
    {
        public Form2()
        {
            InitializeComponent();
        }

        private void Form2_Load(object sender, EventArgs e)
        {
            //把数组里记录的灾情信息逐条加入列表框
            for (int i = 0; i < RecordClass.recoudeindex; i++)
            {
                lstbRecored.Items.Add(RecordClass.record[i, 0] + " " + RecordClass.record[i, 1]);
            }
        }
    }
}
