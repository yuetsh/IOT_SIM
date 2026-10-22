namespace ZigBee路灯
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
            this.lamp1 = new WinFormsDeviceControlLibrary.Lamp();
            this.rb_Open = new System.Windows.Forms.RadioButton();
            this.rb_Close = new System.Windows.Forms.RadioButton();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.btn_open = new System.Windows.Forms.Button();
            this.com_port = new System.Windows.Forms.ComboBox();
            this.lbl_Lamp = new System.Windows.Forms.Label();
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            //
            // lamp1
            //
            this.lamp1.BackColor = System.Drawing.Color.White;
            this.lamp1.Location = new System.Drawing.Point(29, 28);
            this.lamp1.Name = "lamp1";
            this.lamp1.Size = new System.Drawing.Size(105, 185);
            this.lamp1.TabIndex = 0;
            //
            // rb_Open
            //
            this.rb_Open.AutoSize = true;
            this.rb_Open.Location = new System.Drawing.Point(29, 222);
            this.rb_Open.Name = "rb_Open";
            this.rb_Open.Size = new System.Drawing.Size(35, 16);
            this.rb_Open.TabIndex = 1;
            this.rb_Open.Text = "开";
            this.rb_Open.UseVisualStyleBackColor = true;
            this.rb_Open.CheckedChanged += new System.EventHandler(this.rb_Open_CheckedChanged);
            //
            // rb_Close
            //
            this.rb_Close.AutoSize = true;
            this.rb_Close.Location = new System.Drawing.Point(99, 222);
            this.rb_Close.Name = "rb_Close";
            this.rb_Close.Size = new System.Drawing.Size(35, 16);
            this.rb_Close.TabIndex = 2;
            this.rb_Close.Text = "关";
            this.rb_Close.UseVisualStyleBackColor = true;
            this.rb_Close.CheckedChanged += new System.EventHandler(this.rb_Close_CheckedChanged);
            //
            // groupBox1
            //
            this.groupBox1.Controls.Add(this.btn_open);
            this.groupBox1.Controls.Add(this.com_port);
            this.groupBox1.Controls.Add(this.lbl_Lamp);
            this.groupBox1.Location = new System.Drawing.Point(184, 50);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(238, 120);
            this.groupBox1.TabIndex = 3;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "配置";
            //
            // btn_open
            //
            this.btn_open.Location = new System.Drawing.Point(145, 77);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(75, 23);
            this.btn_open.TabIndex = 2;
            this.btn_open.Text = "打开";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            //
            // com_port
            //
            this.com_port.FormattingEnabled = true;
            this.com_port.Location = new System.Drawing.Point(90, 34);
            this.com_port.Name = "com_port";
            this.com_port.Size = new System.Drawing.Size(130, 20);
            this.com_port.TabIndex = 1;
            //
            // lbl_Lamp
            //
            this.lbl_Lamp.AutoSize = true;
            this.lbl_Lamp.Location = new System.Drawing.Point(21, 37);
            this.lbl_Lamp.Name = "lbl_Lamp";
            this.lbl_Lamp.Size = new System.Drawing.Size(29, 12);
            this.lbl_Lamp.TabIndex = 0;
            this.lbl_Lamp.Text = "路灯";
            //
            // Form1
            //
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.White;
            this.ClientSize = new System.Drawing.Size(442, 254);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.rb_Close);
            this.Controls.Add(this.rb_Open);
            this.Controls.Add(this.lamp1);
            this.Name = "Form1";
            this.Text = "ZigBee路灯";
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private WinFormsDeviceControlLibrary.Lamp lamp1;
        private System.Windows.Forms.RadioButton rb_Open;
        private System.Windows.Forms.RadioButton rb_Close;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.ComboBox com_port;
        private System.Windows.Forms.Label lbl_Lamp;
    }
}
