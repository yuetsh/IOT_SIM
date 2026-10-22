using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace C_基础
{
    class People//定义一个父类People
    {
        public virtual void Speak(TextBox Txtbox,string name)//定义一个虚方法，用来表示人类的说话语言
        {
            Txtbox.Text += name;//向控件中输出名字
        }
    }
}
