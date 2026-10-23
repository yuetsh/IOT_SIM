using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace 智慧校园.SQLHelpers
{
    class SQLHelper
    {
        public static string strConn = AppSet.SqlConn;

        public static bool SaveData(string sql, DataTable dt)
        {
            try
            {
                SqlConnection conn = new SqlConnection(strConn);
                conn.Open();
                SqlDataAdapter sda = new SqlDataAdapter(sql, conn);
                SqlCommandBuilder objCommandBuilder = new SqlCommandBuilder(sda);
                sda.Update(dt);
                conn.Close();
                return true;
            }
            catch (Exception e)
            {
                string Error = e.Message;
                return false;
            }
        }

        public static DataSet getData(string sql, params SqlParameter[] para)
        {
            DataSet ds = new DataSet();

            try
            {
                SqlConnection conn = new SqlConnection(strConn);
                conn.Open();
                SqlCommand cmd = new SqlCommand(sql, conn);
                if (para != null)
                {
                    foreach (SqlParameter item in para)
                    {
                        cmd.Parameters.Add(item);
                    }
                }
                SqlDataAdapter sda = new SqlDataAdapter(cmd);
                sda.Fill(ds);
                cmd.Parameters.Clear();
                conn.Close();
            }
            catch(Exception e)
            {
                string Error =  e.Message;
            }

            return ds;
        }

        public static DataSet getData(SqlCommand cmd)
        {
            DataSet ds = new DataSet();

            try
            {
                SqlConnection conn = new SqlConnection(strConn);
                conn.Open();
                cmd.Connection = conn;

                SqlDataAdapter sda = new SqlDataAdapter(cmd);
                sda.Fill(ds);
                cmd.Parameters.Clear();
                conn.Close();
            }
            catch (Exception e)
            {
                string Error = e.Message;
            }

            return ds;
        }

        public static int Exec(string sql, params SqlParameter[] para)
        {
            try
            {
                SqlConnection conn = new SqlConnection(strConn);
                conn.Open();
                SqlCommand cmd = new SqlCommand(sql, conn);
                if (para != null)
                {
                    foreach (SqlParameter item in para)
                    {
                        cmd.Parameters.Add(item);
                    }
                }
                int iRsult = cmd.ExecuteNonQuery();
                conn.Close();
                return iRsult;
            }
            catch (Exception e)
            {
                string Error = e.Message;
                return -1;
            }
        }
    }
    }

