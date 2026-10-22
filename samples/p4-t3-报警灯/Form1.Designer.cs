namespace 报警灯
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
            this.alarm1 = new WinFormsDeviceControlLibrary.Alarm();
            this.btn_alarmOpen = new System.Windows.Forms.Button();
            this.btn_alarmClose = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.btn_open = new System.Windows.Forms.Button();
            this.com_port = new System.Windows.Forms.ComboBox();
            this.label1 = new System.Windows.Forms.Label();
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            // 
            // alarm1
            // 
            this.alarm1.BackColor = System.Drawing.Color.White;
            this.alarm1.Location = new System.Drawing.Point(12, 12);
            this.alarm1.Name = "alarm1";
            this.alarm1.Size = new System.Drawing.Size(150, 150);
            this.alarm1.TabIndex = 0;
            // 
            // btn_alarmOpen
            // 
            this.btn_alarmOpen.Location = new System.Drawing.Point(12, 192);
            this.btn_alarmOpen.Name = "btn_alarmOpen";
            this.btn_alarmOpen.Size = new System.Drawing.Size(35, 23);
            this.btn_alarmOpen.TabIndex = 1;
            this.btn_alarmOpen.Text = "开";
            this.btn_alarmOpen.UseVisualStyleBackColor = true;
            this.btn_alarmOpen.Click += new System.EventHandler(this.btn_alarmOpen_Click);
            // 
            // btn_alarmClose
            // 
            this.btn_alarmClose.Location = new System.Drawing.Point(127, 192);
            this.btn_alarmClose.Name = "btn_alarmClose";
            this.btn_alarmClose.Size = new System.Drawing.Size(35, 23);
            this.btn_alarmClose.TabIndex = 2;
            this.btn_alarmClose.Text = "关";
            this.btn_alarmClose.UseVisualStyleBackColor = true;
            this.btn_alarmClose.Click += new System.EventHandler(this.btn_alarmClose_Click);
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.btn_open);
            this.groupBox1.Controls.Add(this.com_port);
            this.groupBox1.Controls.Add(this.label1);
            this.groupBox1.Location = new System.Drawing.Point(195, 58);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(218, 114);
            this.groupBox1.TabIndex = 3;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "配置";
            // 
            // btn_open
            // 
            this.btn_open.Location = new System.Drawing.Point(113, 71);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(75, 23);
            this.btn_open.TabIndex = 2;
            this.btn_open.Text = "开启";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            // 
            // com_port
            // 
            this.com_port.FormattingEnabled = true;
            this.com_port.Location = new System.Drawing.Point(67, 33);
            this.com_port.Name = "com_port";
            this.com_port.Size = new System.Drawing.Size(121, 20);
            this.com_port.TabIndex = 1;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(20, 36);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(41, 12);
            this.label1.TabIndex = 0;
            this.label1.Text = "报警灯";
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.White;
            this.ClientSize = new System.Drawing.Size(425, 262);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.btn_alarmClose);
            this.Controls.Add(this.btn_alarmOpen);
            this.Controls.Add(this.alarm1);
            this.Name = "Form1";
            this.Text = "报警灯";
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private WinFormsDeviceControlLibrary.Alarm alarm1;
        private System.Windows.Forms.Button btn_alarmOpen;
        private System.Windows.Forms.Button btn_alarmClose;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.ComboBox com_port;
        private System.Windows.Forms.Label label1;
    }
}

