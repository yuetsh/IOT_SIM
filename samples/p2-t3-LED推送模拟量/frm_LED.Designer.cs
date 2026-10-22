namespace LED推送模拟量
{
    partial class frm_LED
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
            this.led = new WinFormsDeviceControlLibrary.LED();
            this.grp_show = new System.Windows.Forms.GroupBox();
            this.btn_get = new System.Windows.Forms.Button();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.grp_config = new System.Windows.Forms.GroupBox();
            this.com_ledPort = new System.Windows.Forms.ComboBox();
            this.lbl_ledPort = new System.Windows.Forms.Label();
            this.btn_open = new System.Windows.Forms.Button();
            this.com_adamPort = new System.Windows.Forms.ComboBox();
            this.lbl_adamPort = new System.Windows.Forms.Label();
            this.grp_show.SuspendLayout();
            this.grp_config.SuspendLayout();
            this.SuspendLayout();
            // 
            // led
            // 
            this.led.BackColor = System.Drawing.Color.Black;
            this.led.Location = new System.Drawing.Point(19, 0);
            this.led.Name = "led";
            this.led.Size = new System.Drawing.Size(800, 130);
            this.led.TabIndex = 0;
            // 
            // grp_show
            // 
            this.grp_show.Controls.Add(this.btn_get);
            this.grp_show.Controls.Add(this.txt_temperature);
            this.grp_show.Controls.Add(this.txt_humidity);
            this.grp_show.Controls.Add(this.txt_light);
            this.grp_show.Controls.Add(this.lbl_humidity);
            this.grp_show.Controls.Add(this.lbl_temperature);
            this.grp_show.Controls.Add(this.lbl_light);
            this.grp_show.Location = new System.Drawing.Point(19, 156);
            this.grp_show.Name = "grp_show";
            this.grp_show.Size = new System.Drawing.Size(370, 200);
            this.grp_show.TabIndex = 1;
            this.grp_show.TabStop = false;
            this.grp_show.Text = "数据显示";
            // 
            // btn_get
            // 
            this.btn_get.Location = new System.Drawing.Point(287, 47);
            this.btn_get.Name = "btn_get";
            this.btn_get.Size = new System.Drawing.Size(51, 103);
            this.btn_get.TabIndex = 6;
            this.btn_get.Text = "获取";
            this.btn_get.UseVisualStyleBackColor = true;
            this.btn_get.Click += new System.EventHandler(this.btn_get_Click);
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(105, 85);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(147, 21);
            this.txt_temperature.TabIndex = 4;
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(105, 129);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(147, 21);
            this.txt_humidity.TabIndex = 5;
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(105, 47);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(147, 21);
            this.txt_light.TabIndex = 3;
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Location = new System.Drawing.Point(43, 132);
            this.lbl_humidity.Name = "lbl_humidity";
            this.lbl_humidity.Size = new System.Drawing.Size(29, 12);
            this.lbl_humidity.TabIndex = 2;
            this.lbl_humidity.Text = "湿度";
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Location = new System.Drawing.Point(43, 88);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(29, 12);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // lbl_light
            // 
            this.lbl_light.AutoSize = true;
            this.lbl_light.Location = new System.Drawing.Point(43, 50);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(41, 12);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // grp_config
            // 
            this.grp_config.Controls.Add(this.com_ledPort);
            this.grp_config.Controls.Add(this.lbl_ledPort);
            this.grp_config.Controls.Add(this.btn_open);
            this.grp_config.Controls.Add(this.com_adamPort);
            this.grp_config.Controls.Add(this.lbl_adamPort);
            this.grp_config.Location = new System.Drawing.Point(449, 156);
            this.grp_config.Name = "grp_config";
            this.grp_config.Size = new System.Drawing.Size(370, 200);
            this.grp_config.TabIndex = 2;
            this.grp_config.TabStop = false;
            this.grp_config.Text = "配置";
            // 
            // com_ledPort
            // 
            this.com_ledPort.FormattingEnabled = true;
            this.com_ledPort.Location = new System.Drawing.Point(127, 84);
            this.com_ledPort.Name = "com_ledPort";
            this.com_ledPort.Size = new System.Drawing.Size(121, 20);
            this.com_ledPort.TabIndex = 3;
            // 
            // lbl_ledPort
            // 
            this.lbl_ledPort.AutoSize = true;
            this.lbl_ledPort.Location = new System.Drawing.Point(48, 87);
            this.lbl_ledPort.Name = "lbl_ledPort";
            this.lbl_ledPort.Size = new System.Drawing.Size(47, 12);
            this.lbl_ledPort.TabIndex = 2;
            this.lbl_ledPort.Text = "LED串口";
            // 
            // btn_open
            // 
            this.btn_open.Location = new System.Drawing.Point(173, 121);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(75, 23);
            this.btn_open.TabIndex = 4;
            this.btn_open.Text = "开启";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            // 
            // com_adamPort
            // 
            this.com_adamPort.FormattingEnabled = true;
            this.com_adamPort.Location = new System.Drawing.Point(127, 41);
            this.com_adamPort.Name = "com_adamPort";
            this.com_adamPort.Size = new System.Drawing.Size(121, 20);
            this.com_adamPort.TabIndex = 1;
            // 
            // lbl_adamPort
            // 
            this.lbl_adamPort.AutoSize = true;
            this.lbl_adamPort.Location = new System.Drawing.Point(46, 44);
            this.lbl_adamPort.Name = "lbl_adamPort";
            this.lbl_adamPort.Size = new System.Drawing.Size(65, 12);
            this.lbl_adamPort.TabIndex = 0;
            this.lbl_adamPort.Text = "模拟量串口";
            // 
            // frm_LED
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(834, 380);
            this.Controls.Add(this.grp_config);
            this.Controls.Add(this.grp_show);
            this.Controls.Add(this.led);
            this.Name = "frm_LED";
            this.Text = "LED推送模拟量";
            this.Load += new System.EventHandler(this.frm_LED_Load);
            this.grp_show.ResumeLayout(false);
            this.grp_show.PerformLayout();
            this.grp_config.ResumeLayout(false);
            this.grp_config.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private WinFormsDeviceControlLibrary.LED led;
        private System.Windows.Forms.GroupBox grp_show;
        private System.Windows.Forms.Button btn_get;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label lbl_humidity;
        private System.Windows.Forms.Label lbl_temperature;
        private System.Windows.Forms.Label lbl_light;
        private System.Windows.Forms.GroupBox grp_config;
        private System.Windows.Forms.ComboBox com_ledPort;
        private System.Windows.Forms.Label lbl_ledPort;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.ComboBox com_adamPort;
        private System.Windows.Forms.Label lbl_adamPort;
    }
}
