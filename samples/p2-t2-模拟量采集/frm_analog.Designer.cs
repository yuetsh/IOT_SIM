namespace 模拟量采集
{
    partial class frm_analog
    {
        /// <summary>
        /// 必需的设计器变量。
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// 清理所有正在使用的资源。
        /// </summary>
        /// <param name="disposing">如果应释放托管资源，为 true；否则为 false。</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows 窗体设计器生成的代码

        /// <summary>
        /// 设计器支持所需的方法 - 不要
        /// 使用代码编辑器修改此方法的内容。
        /// </summary>
        private void InitializeComponent()
        {
            this.grp_show = new System.Windows.Forms.GroupBox();
            this.btn_get = new System.Windows.Forms.Button();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.grp_config = new System.Windows.Forms.GroupBox();
            this.btn_Open = new System.Windows.Forms.Button();
            this.com_port = new System.Windows.Forms.ComboBox();
            this.lbl_port = new System.Windows.Forms.Label();
            this.grp_show.SuspendLayout();
            this.grp_config.SuspendLayout();
            this.SuspendLayout();
            // 
            // grp_show
            // 
            this.grp_show.Controls.Add(this.btn_get);
            this.grp_show.Controls.Add(this.txt_humidity);
            this.grp_show.Controls.Add(this.txt_temperature);
            this.grp_show.Controls.Add(this.txt_light);
            this.grp_show.Controls.Add(this.lbl_humidity);
            this.grp_show.Controls.Add(this.lbl_temperature);
            this.grp_show.Controls.Add(this.lbl_light);
            this.grp_show.Location = new System.Drawing.Point(12, 12);
            this.grp_show.Name = "grp_show";
            this.grp_show.Size = new System.Drawing.Size(260, 126);
            this.grp_show.TabIndex = 0;
            this.grp_show.TabStop = false;
            this.grp_show.Text = "数据显示";
            // 
            // btn_get
            // 
            this.btn_get.Location = new System.Drawing.Point(209, 24);
            this.btn_get.Name = "btn_get";
            this.btn_get.Size = new System.Drawing.Size(39, 83);
            this.btn_get.TabIndex = 6;
            this.btn_get.Text = "获取";
            this.btn_get.UseVisualStyleBackColor = true;
            this.btn_get.Click += new System.EventHandler(this.btn_get_Click);
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(83, 86);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(100, 21);
            this.txt_humidity.TabIndex = 5;
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(83, 54);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(100, 21);
            this.txt_temperature.TabIndex = 4;
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(83, 24);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(100, 21);
            this.txt_light.TabIndex = 3;
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Location = new System.Drawing.Point(20, 89);
            this.lbl_humidity.Name = "lbl_humidity";
            this.lbl_humidity.Size = new System.Drawing.Size(29, 12);
            this.lbl_humidity.TabIndex = 2;
            this.lbl_humidity.Text = "湿度";
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Location = new System.Drawing.Point(20, 57);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(29, 12);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // lbl_light
            // 
            this.lbl_light.AutoSize = true;
            this.lbl_light.Location = new System.Drawing.Point(20, 27);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(41, 12);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // grp_config
            // 
            this.grp_config.Controls.Add(this.btn_Open);
            this.grp_config.Controls.Add(this.com_port);
            this.grp_config.Controls.Add(this.lbl_port);
            this.grp_config.Location = new System.Drawing.Point(12, 144);
            this.grp_config.Name = "grp_config";
            this.grp_config.Size = new System.Drawing.Size(260, 100);
            this.grp_config.TabIndex = 1;
            this.grp_config.TabStop = false;
            this.grp_config.Text = "配置";
            // 
            // btn_Open
            // 
            this.btn_Open.Location = new System.Drawing.Point(149, 59);
            this.btn_Open.Name = "btn_Open";
            this.btn_Open.Size = new System.Drawing.Size(75, 23);
            this.btn_Open.TabIndex = 2;
            this.btn_Open.Text = "开启";
            this.btn_Open.UseVisualStyleBackColor = true;
            this.btn_Open.Click += new System.EventHandler(this.btn_Open_Click);
            // 
            // com_port
            // 
            this.com_port.FormattingEnabled = true;
            this.com_port.Location = new System.Drawing.Point(105, 33);
            this.com_port.Name = "com_port";
            this.com_port.Size = new System.Drawing.Size(119, 20);
            this.com_port.TabIndex = 1;
            // 
            // lbl_port
            // 
            this.lbl_port.AutoSize = true;
            this.lbl_port.Location = new System.Drawing.Point(44, 36);
            this.lbl_port.Name = "lbl_port";
            this.lbl_port.Size = new System.Drawing.Size(29, 12);
            this.lbl_port.TabIndex = 0;
            this.lbl_port.Text = "串口";
            // 
            // frm_analog
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(284, 262);
            this.Controls.Add(this.grp_config);
            this.Controls.Add(this.grp_show);
            this.Name = "frm_analog";
            this.Text = "模拟量采集";
            this.Load += new System.EventHandler(this.frm_analog_Load);
            this.grp_show.ResumeLayout(false);
            this.grp_show.PerformLayout();
            this.grp_config.ResumeLayout(false);
            this.grp_config.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox grp_show;
        private System.Windows.Forms.Button btn_get;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label lbl_humidity;
        private System.Windows.Forms.Label lbl_temperature;
        private System.Windows.Forms.Label lbl_light;
        private System.Windows.Forms.GroupBox grp_config;
        private System.Windows.Forms.Button btn_Open;
        private System.Windows.Forms.ComboBox com_port;
        private System.Windows.Forms.Label lbl_port;
    }
}
