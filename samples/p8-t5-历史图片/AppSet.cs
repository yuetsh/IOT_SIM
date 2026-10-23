using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace 智慧校园
{
    class AppSet
    {
        //串口设置
        public static string ADAM4017_COM = "COM2";
        public static string ADAM4150_COM = "COM3";
        public static string LED_COM = "COM5";
        public static string ZigBee_COM = "COM4";

        //摄像机参数
        public static string Camera_Ip = "192.168.1.100";
        public static string Camera_Uid = "admin";
        public static string Camera_Pwd = "";

        //数据库连接字符串
        public static string SqlConn = "Data Source=.;Initial Catalog=WisdomCampus;User ID=sa;Password=123";
    }
}
