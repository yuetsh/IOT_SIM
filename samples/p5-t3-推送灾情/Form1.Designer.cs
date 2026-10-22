namespace 火焰烟雾
{
    partial class Form1
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
            this.led1 = new WinFormsDeviceControlLibrary.LED();
            this.lbl_time = new System.Windows.Forms.Label();
            this.txt_time = new System.Windows.Forms.TextBox();
            this.txt_fire = new System.Windows.Forms.TextBox();
            this.lbl_fire = new System.Windows.Forms.Label();
            this.txt_smoke = new System.Windows.Forms.TextBox();
            this.lbl_smoke = new System.Windows.Forms.Label();
            this.lbl_Ledport = new System.Windows.Forms.Label();
            this.com_ledPort = new System.Windows.Forms.ComboBox();
            this.com_environmentPort = new System.Windows.Forms.ComboBox();
            this.lbl_4150port = new System.Windows.Forms.Label();
            this.btn_Open = new System.Windows.Forms.Button();
            this.btn_get = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.OpenRecord = new System.Windows.Forms.Button();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.groupBox1.SuspendLayout();
            this.groupBox2.SuspendLayout();
            this.SuspendLayout();
            // 
            // led1
            // 
            this.led1.BackColor = System.Drawing.Color.Black;
            this.led1.Location = new System.Drawing.Point(19, 0);
            this.led1.Name = "led1";
            this.led1.Size = new System.Drawing.Size(800, 130);
            this.led1.TabIndex = 0;
            // 
            // lbl_time
            // 
            this.lbl_time.AutoSize = true;
            this.lbl_time.Location = new System.Drawing.Point(62, 163);
            this.lbl_time.Name = "lbl_time";
            this.lbl_time.Size = new System.Drawing.Size(29, 12);
            this.lbl_time.TabIndex = 1;
            this.lbl_time.Text = "时间";
            // 
            // txt_time
            // 
            this.txt_time.Location = new System.Drawing.Point(109, 160);
            this.txt_time.Name = "txt_time";
            this.txt_time.Size = new System.Drawing.Size(174, 21);
            this.txt_time.TabIndex = 2;
            // 
            // txt_fire
            // 
            this.txt_fire.Location = new System.Drawing.Point(109, 205);
            this.txt_fire.Name = "txt_fire";
            this.txt_fire.Size = new System.Drawing.Size(174, 21);
            this.txt_fire.TabIndex = 4;
            // 
            // lbl_fire
            // 
            this.lbl_fire.AutoSize = true;
            this.lbl_fire.Location = new System.Drawing.Point(62, 208);
            this.lbl_fire.Name = "lbl_fire";
            this.lbl_fire.Size = new System.Drawing.Size(29, 12);
            this.lbl_fire.TabIndex = 3;
            this.lbl_fire.Text = "火焰";
            // 
            // txt_smoke
            // 
            this.txt_smoke.Location = new System.Drawing.Point(109, 256);
            this.txt_smoke.Name = "txt_smoke";
            this.txt_smoke.Size = new System.Drawing.Size(174, 21);
            this.txt_smoke.TabIndex = 6;
            // 
            // lbl_smoke
            // 
            this.lbl_smoke.AutoSize = true;
            this.lbl_smoke.Location = new System.Drawing.Point(62, 259);
            this.lbl_smoke.Name = "lbl_smoke";
            this.lbl_smoke.Size = new System.Drawing.Size(29, 12);
            this.lbl_smoke.TabIndex = 5;
            this.lbl_smoke.Text = "烟雾";
            // 
            // lbl_Ledport
            // 
            this.lbl_Ledport.AutoSize = true;
            this.lbl_Ledport.Location = new System.Drawing.Point(29, 26);
            this.lbl_Ledport.Name = "lbl_Ledport";
            this.lbl_Ledport.Size = new System.Drawing.Size(47, 12);
            this.lbl_Ledport.TabIndex = 7;
            this.lbl_Ledport.Text = "L  E  D";
            // 
            // com_ledPort
            // 
            this.com_ledPort.FormattingEnabled = true;
            this.com_ledPort.Location = new System.Drawing.Point(88, 23);
            this.com_ledPort.Name = "com_ledPort";
            this.com_ledPort.Size = new System.Drawing.Size(121, 20);
            this.com_ledPort.TabIndex = 8;
            // 
            // com_environmentPort
            // 
            this.com_environmentPort.FormattingEnabled = true;
            this.com_environmentPort.Location = new System.Drawing.Point(88, 49);
            this.com_environmentPort.Name = "com_environmentPort";
            this.com_environmentPort.Size = new System.Drawing.Size(121, 20);
            this.com_environmentPort.TabIndex = 10;
            // 
            // lbl_4150port
            // 
            this.lbl_4150port.AutoSize = true;
            this.lbl_4150port.Location = new System.Drawing.Point(29, 52);
            this.lbl_4150port.Name = "lbl_4150port";
            this.lbl_4150port.Size = new System.Drawing.Size(53, 12);
            this.lbl_4150port.TabIndex = 9;
            this.lbl_4150port.Text = "环境采集";
            // 
            // btn_Open
            // 
            this.btn_Open.Location = new System.Drawing.Point(134, 85);
            this.btn_Open.Name = "btn_Open";
            this.btn_Open.Size = new System.Drawing.Size(75, 23);
            this.btn_Open.TabIndex = 11;
            this.btn_Open.Text = "开启";
            this.btn_Open.UseVisualStyleBackColor = true;
            this.btn_Open.Click += new System.EventHandler(this.btn_Open_Click);
            // 
            // btn_get
            // 
            this.btn_get.Location = new System.Drawing.Point(270, 20);
            this.btn_get.Name = "btn_get";
            this.btn_get.Size = new System.Drawing.Size(49, 117);
            this.btn_get.TabIndex = 12;
            this.btn_get.Text = "获取";
            this.btn_get.UseVisualStyleBackColor = true;
            this.btn_get.Click += new System.EventHandler(this.btn_get_Click);
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.OpenRecord);
            this.groupBox1.Controls.Add(this.lbl_Ledport);
            this.groupBox1.Controls.Add(this.btn_Open);
            this.groupBox1.Controls.Add(this.com_ledPort);
            this.groupBox1.Controls.Add(this.com_environmentPort);
            this.groupBox1.Controls.Add(this.lbl_4150port);
            this.groupBox1.Location = new System.Drawing.Point(447, 143);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(375, 150);
            this.groupBox1.TabIndex = 13;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "配置";
            // 
            // OpenRecord
            // 
            this.OpenRecord.Location = new System.Drawing.Point(256, 23);
            this.OpenRecord.Name = "OpenRecord";
            this.OpenRecord.Size = new System.Drawing.Size(99, 25);
            this.OpenRecord.TabIndex = 13;
            this.OpenRecord.Text = "历史灾情信息";
            this.OpenRecord.UseVisualStyleBackColor = true;
            this.OpenRecord.Click += new System.EventHandler(this.OpenRecord_Click);
            // 
            // groupBox2
            // 
            this.groupBox2.Controls.Add(this.btn_get);
            this.groupBox2.Location = new System.Drawing.Point(19, 136);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Size = new System.Drawing.Size(402, 157);
            this.groupBox2.TabIndex = 14;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "数据采集";
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(834, 315);
            this.Controls.Add(this.txt_smoke);
            this.Controls.Add(this.lbl_smoke);
            this.Controls.Add(this.txt_fire);
            this.Controls.Add(this.lbl_fire);
            this.Controls.Add(this.txt_time);
            this.Controls.Add(this.lbl_time);
            this.Controls.Add(this.led1);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.groupBox2);
            this.Name = "Form1";
            this.Text = "火焰烟雾";
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.groupBox2.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private WinFormsDeviceControlLibrary.LED led1;
        private System.Windows.Forms.Label lbl_time;
        private System.Windows.Forms.TextBox txt_time;
        private System.Windows.Forms.TextBox txt_fire;
        private System.Windows.Forms.Label lbl_fire;
        private System.Windows.Forms.TextBox txt_smoke;
        private System.Windows.Forms.Label lbl_smoke;
        private System.Windows.Forms.Label lbl_Ledport;
        private System.Windows.Forms.ComboBox com_ledPort;
        private System.Windows.Forms.ComboBox com_environmentPort;
        private System.Windows.Forms.Label lbl_4150port;
        private System.Windows.Forms.Button btn_Open;
        private System.Windows.Forms.Button btn_get;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.Button OpenRecord;
    }
}

