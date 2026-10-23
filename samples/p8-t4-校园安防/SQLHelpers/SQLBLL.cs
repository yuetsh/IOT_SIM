using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace 智慧校园.SQLHelpers
{
    class SQLBLL
    {
        
        public static SQLRes SecurityUpData(Image img)//把图片保存到数据库
        {
            SQLRes sqlRes = new SQLRes();
            byte[] imgByte = null;

            using (MemoryStream ms = new MemoryStream())//图片转换为二进制数组
            {
                img.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);
                imgByte = new byte[ms.Length];
                imgByte = ms.ToArray();
            }

            string sqlStr = "INSERT INTO SecurityData (EvenTime,EvenImage) VALUES (@time,@img)";
            SqlParameter[] sqlParameter = new SqlParameter[] { new SqlParameter("time", DateTime.Now.ToString()), new SqlParameter("img", imgByte) };

            if (SQLHelper.Exec(sqlStr, sqlParameter) >= 1)
            {
                sqlRes.Result = true;
                sqlRes.Msg = "成功!";
            }
            else
            {
                sqlRes.Result = false;
                sqlRes.Msg = "失败!";
            }

            return sqlRes;
        }

        public static Dictionary<string, Image> GetSecurityData(DateTime startDate, DateTime endDate)
        {
            Dictionary<string, Image> ImgDictionary = new Dictionary<string, Image>();

            if (string.IsNullOrWhiteSpace(startDate.Month.ToString()) && string.IsNullOrWhiteSpace(endDate.Month .ToString()))
            {
                return ImgDictionary;
            }
            //选择查询日期日期
            string sql = "SELECT * FROM SecurityData WHERE EvenTime between @time_start and @time_end";
            SqlParameter[] sqlParameter = new SqlParameter[] { new SqlParameter("time_start", startDate.Year + "/" + startDate.Month + "/" + startDate.Day), new SqlParameter("time_end", endDate.Year  + "/" + endDate.Month + "/" + endDate.Day+"  23:59:59" )};

            DataSet ds = SQLHelper.getData(sql, sqlParameter);

            for (int i = 0; i < ds.Tables[0].Rows.Count; i++)
            {
                ImgDictionary.Add(ds.Tables[0].Rows[i]["EvenTime"].ToString(), Image.FromStream(new MemoryStream((byte[])ds.Tables[0].Rows[i]["EvenImage"])));
            }

            return ImgDictionary;
        }

        public static SQLRes EnvironmentUpData(bool fire, bool smoke, string light, string temperature, string humidity)
        {
            
                SQLRes sqlRes = new SQLRes();

                string sqlStr = "INSERT INTO EnvironmentData (Fire ,Smoke ,Temperature  ,Humidity , Light, _Time)  VALUES (@fire,@smoke,@temperature,@humidity,@light,@time)";
                SqlParameter[] sqlParameter = new SqlParameter[] { new SqlParameter("time", DateTime.Now.ToString()), new SqlParameter("fire", fire), new SqlParameter("smoke", smoke), new SqlParameter("temperature", temperature), new SqlParameter("humidity", humidity), new SqlParameter("light", light) };

                if (SQLHelper.Exec(sqlStr, sqlParameter) >= 1)
                {
                    sqlRes.Result = true;
                    sqlRes.Msg = "成功!";
                }
                else
                {
                    sqlRes.Result = false;
                    sqlRes.Msg = "失败!";
                }

                return sqlRes;
            
        }

        public static DataTable GetEnvironmentGraphData()
        {
            string sqlStr = "SELECT TOP 7 CONVERT(varchar(10),_Time,120) AS _Time, ROUND(Max(Temperature),2) AS MaxTemperature, ROUND(AVG(Temperature),2) AS AVGTemperature  FROM EnvironmentData   GROUP BY CONVERT(varchar(10),_Time,120) ORDER BY CONVERT(varchar(10),_Time,120) DESC ";
            return SQLHelper.getData(sqlStr, null).Tables[0];
        }


    }

    class SQLRes
    {
        public string Msg { get; set; }
        public bool Result { get; set; }
    }

    }

