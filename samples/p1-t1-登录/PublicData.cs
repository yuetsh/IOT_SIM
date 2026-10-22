using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace 登录
{
    public class PublicData
    {
        public static string[] SysUserName = new string[4];//存储系统用户名
        public static string[] SysPwd = new string[4];//存储系统用户密码
        public static int intNum { get; set; }//当前数据存储的用户数量
        public static int intUser { get; set; }//记录当前用户索引号
    }
}
