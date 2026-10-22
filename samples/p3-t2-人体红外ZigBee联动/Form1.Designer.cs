namespace 人体红外ZigBee联动
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
            this.components = new System.ComponentModel.Container();
            this.lamp1 = new WinFormsDeviceControlLibrary.Lamp();
            this.btn_lampOpen = new System.Windows.Forms.Button();
            this.btn_lampClose = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.ch_bodyInfrared = new System.Windows.Forms.CheckBox();
            this.com_environment = new System.Windows.Forms.ComboBox();
            this.lbl_environment = new System.Windows.Forms.Label();
            this.btn_open = new System.Windows.Forms.Button();
            this.com_lamp = new System.Windows.Forms.ComboBox();
            this.lbl_lamp = new System.Windows.Forms.Label();
            this.timer1 = new System.Windows.Forms.Timer(this.components);
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            // 
            // lamp1
            // 
            this.lamp1.BackColor = System.Drawing.Color.White;
            this.lamp1.Location = new System.Drawing.Point(32, 22);
            this.lamp1.Name = "lamp1";
            this.lamp1.Size = new System.Drawing.Size(105, 185);
            this.lamp1.TabIndex = 0;
            // 
            // btn_lampOpen
            // 
            this.btn_lampOpen.Location = new System.Drawing.Point(32, 213);
            this.btn_lampOpen.Name = "btn_lampOpen";
            this.btn_lampOpen.Size = new System.Drawing.Size(33, 23);
            this.btn_lampOpen.TabIndex = 1;
            this.btn_lampOpen.Text = "开";
            this.btn_lampOpen.UseVisualStyleBackColor = true;
            this.btn_lampOpen.Click += new System.EventHandler(this.btn_lampOpen_Click);
            // 
            // btn_lampClose
            // 
            this.btn_lampClose.Location = new System.Drawing.Point(104, 213);
            this.btn_lampClose.Name = "btn_lampClose";
            this.btn_lampClose.Size = new System.Drawing.Size(33, 23);
            this.btn_lampClose.TabIndex = 2;
            this.btn_lampClose.Text = "关";
            this.btn_lampClose.UseVisualStyleBackColor = true;
            this.btn_lampClose.Click += new System.EventHandler(this.btn_lampClose_Click);
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.ch_bodyInfrared);
            this.groupBox1.Controls.Add(this.com_environment);
            this.groupBox1.Controls.Add(this.lbl_environment);
            this.groupBox1.Controls.Add(this.btn_open);
            this.groupBox1.Controls.Add(this.com_lamp);
            this.groupBox1.Controls.Add(this.lbl_lamp);
            this.groupBox1.Location = new System.Drawing.Point(193, 58);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(238, 126);
            this.groupBox1.TabIndex = 3;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "配置";
            // 
            // ch_bodyInfrared
            // 
            this.ch_bodyInfrared.AutoSize = true;
            this.ch_bodyInfrared.Location = new System.Drawing.Point(25, 81);
            this.ch_bodyInfrared.Name = "ch_bodyInfrared";
            this.ch_bodyInfrared.Size = new System.Drawing.Size(72, 16);
            this.ch_bodyInfrared.TabIndex = 4;
            this.ch_bodyInfrared.Text = "人体开关";
            this.ch_bodyInfrared.UseVisualStyleBackColor = true;
            this.ch_bodyInfrared.Click += new System.EventHandler(this.ch_bodyInfrared_Click);
            // 
            // com_environment
            // 
            this.com_environment.FormattingEnabled = true;
            this.com_environment.Location = new System.Drawing.Point(90, 51);
            this.com_environment.Name = "com_environment";
            this.com_environment.Size = new System.Drawing.Size(130, 20);
            this.com_environment.TabIndex = 3;
            // 
            // lbl_environment
            // 
            this.lbl_environment.AutoSize = true;
            this.lbl_environment.Location = new System.Drawing.Point(23, 54);
            this.lbl_environment.Name = "lbl_environment";
            this.lbl_environment.Size = new System.Drawing.Size(53, 12);
            this.lbl_environment.TabIndex = 2;
            this.lbl_environment.Text = "环境采集";
            // 
            // btn_open
            // 
            this.btn_open.Location = new System.Drawing.Point(145, 77);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(75, 23);
            this.btn_open.TabIndex = 5;
            this.btn_open.Text = "打开";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            // 
            // com_lamp
            // 
            this.com_lamp.FormattingEnabled = true;
            this.com_lamp.Location = new System.Drawing.Point(90, 26);
            this.com_lamp.Name = "com_lamp";
            this.com_lamp.Size = new System.Drawing.Size(130, 20);
            this.com_lamp.TabIndex = 1;
            // 
            // lbl_lamp
            // 
            this.lbl_lamp.AutoSize = true;
            this.lbl_lamp.Location = new System.Drawing.Point(21, 29);
            this.lbl_lamp.Name = "lbl_lamp";
            this.lbl_lamp.Size = new System.Drawing.Size(29, 12);
            this.lbl_lamp.TabIndex = 0;
            this.lbl_lamp.Text = "路灯";
            // 
            // timer1
            // 
            this.timer1.Interval = 5000;
            this.timer1.Tick += new System.EventHandler(this.timer1_Tick);
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.White;
            this.ClientSize = new System.Drawing.Size(477, 249);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.btn_lampClose);
            this.Controls.Add(this.btn_lampOpen);
            this.Controls.Add(this.lamp1);
            this.Name = "Form1";
            this.Text = "人体红外ZigBee联动";
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private WinFormsDeviceControlLibrary.Lamp lamp1;
        private System.Windows.Forms.Button btn_lampOpen;
        private System.Windows.Forms.Button btn_lampClose;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.CheckBox ch_bodyInfrared;
        private System.Windows.Forms.ComboBox com_environment;
        private System.Windows.Forms.Label lbl_environment;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.ComboBox com_lamp;
        private System.Windows.Forms.Label lbl_lamp;
        private System.Windows.Forms.Timer timer1;
    }
}
