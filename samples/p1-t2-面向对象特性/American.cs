using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace C_基础
{
    class American : People//继承People类
    {
        public override void Speak(System.Windows.Forms.TextBox Txtbox, string name)//重写父类中的虚方法
        {
            base.Speak(Txtbox, name+"说的是英语！\r\n");
        }
    }
}
