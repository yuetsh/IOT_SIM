using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace C_基础
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void btnCalculate_Click(object sender, EventArgs e)
        {
            if(txtNum1.Text.Trim()!=""&&txtNum2.Text.Trim()!="")
            {
                float a, b;
                a = float.Parse(txtNum1.Text);//字符串转化为float
                b = float.Parse(txtNum2.Text);//字符串转化为float
                float res = (float)Result(a, b, cmboxType.Text);//两数进行装箱，调用计算函数，返回值进行拆箱
                txtResult.Text = res.ToString();//将返回值显示到界面上
            }
        }
         public Object Result(Object a,Object b,String type)//计算结果，使用拆箱装箱方式
        {
             float result=0;
             float a1,b1;
             a1=(float)a;//拆箱
             b1=(float)b;//拆箱
             switch(type)
             {
                 case "+": result = a1 + b1; break;//计算两个数的和
                 case "-": result = a1 - b1; break;//计算两个数的差
                 case "*": result = a1 * b1; break;//计算两个数的积
                 case "/": result = a1 / b1; break;//计算两个数的商
                 default: result=0;break;//默认值
             }
             return (Object)result;//装箱
        }

         private void btnDisplay_Click(object sender, EventArgs e)
         {
             People pleTemp;//定义People临时存储变量
             Dictionary<int, string> dicName = new Dictionary<int, string>();//定义Dictionary字典类型，用于存储姓名与序号
             dicName.Add(1, "张三");//向字典中添加数据
             dicName.Add(2, "李四");
             dicName.Add(3, "Mary");
             dicName.Add(4, "Jimmy");
             List<People> peoplelist = new List<People>();//定义People的List泛型数据
             for (int i = 0; i < 2; i++)//添加两个中国人
             {
                 pleTemp = new Chinese();//实例化中国人
                 peoplelist.Add(pleTemp);
             }
             for (int i = 0; i < 2; i++)//添加两个美国人
             {
                 pleTemp = new American();//实例化美国人
                 peoplelist.Add(pleTemp);
             }
             for (int i = 0; i < peoplelist.Count; i++)//遍历List
             {
                 peoplelist[i].Speak(this.txtDispaly, dicName[i + 1]);//执行派生类重写的方法
             }
         }
    }
}
