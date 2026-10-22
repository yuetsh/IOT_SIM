namespace 烟雾
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
            this.lbl_port = new System.Windows.Forms.Label();
            this.com_port = new System.Windows.Forms.ComboBox();
            this.btn_open = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.txt_even = new System.Windows.Forms.TextBox();
            this.lbl_even = new System.Windows.Forms.Label();
            this.txt_time = new System.Windows.Forms.TextBox();
            this.lbl_time = new System.Windows.Forms.Label();
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            // 
            // lbl_port
            // 
            this.lbl_port.AutoSize = true;
            this.lbl_port.Location = new System.Drawing.Point(53, 21);
            this.lbl_port.Name = "lbl_port";
            this.lbl_port.Size = new System.Drawing.Size(29, 12);
            this.lbl_port.TabIndex = 0;
            this.lbl_port.Text = "串口";
            // 
            // com_port
            // 
            this.com_port.FormattingEnabled = true;
            this.com_port.Location = new System.Drawing.Point(100, 18);
            this.com_port.Name = "com_port";
            this.com_port.Size = new System.Drawing.Size(121, 20);
            this.com_port.TabIndex = 1;
            // 
            // btn_open
            // 
            this.btn_open.Location = new System.Drawing.Point(227, 16);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(75, 23);
            this.btn_open.TabIndex = 2;
            this.btn_open.Text = "开启";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.txt_even);
            this.groupBox1.Controls.Add(this.lbl_even);
            this.groupBox1.Controls.Add(this.txt_time);
            this.groupBox1.Controls.Add(this.lbl_time);
            this.groupBox1.Location = new System.Drawing.Point(30, 63);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(286, 110);
            this.groupBox1.TabIndex = 3;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "数据显示";
            // 
            // txt_even
            // 
            this.txt_even.Location = new System.Drawing.Point(70, 70);
            this.txt_even.Name = "txt_even";
            this.txt_even.Size = new System.Drawing.Size(133, 21);
            this.txt_even.TabIndex = 3;
            // 
            // lbl_even
            // 
            this.lbl_even.AutoSize = true;
            this.lbl_even.Location = new System.Drawing.Point(23, 73);
            this.lbl_even.Name = "lbl_even";
            this.lbl_even.Size = new System.Drawing.Size(29, 12);
            this.lbl_even.TabIndex = 2;
            this.lbl_even.Text = "事件";
            // 
            // txt_time
            // 
            this.txt_time.Location = new System.Drawing.Point(70, 34);
            this.txt_time.Name = "txt_time";
            this.txt_time.Size = new System.Drawing.Size(133, 21);
            this.txt_time.TabIndex = 1;
            // 
            // lbl_time
            // 
            this.lbl_time.AutoSize = true;
            this.lbl_time.Location = new System.Drawing.Point(23, 37);
            this.lbl_time.Name = "lbl_time";
            this.lbl_time.Size = new System.Drawing.Size(29, 12);
            this.lbl_time.TabIndex = 0;
            this.lbl_time.Text = "时间";
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(342, 193);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.btn_open);
            this.Controls.Add(this.com_port);
            this.Controls.Add(this.lbl_port);
            this.Name = "Form1";
            this.Text = "烟雾";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.Form1_FormClosing);
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label lbl_port;
        private System.Windows.Forms.ComboBox com_port;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.TextBox txt_even;
        private System.Windows.Forms.Label lbl_even;
        private System.Windows.Forms.TextBox txt_time;
        private System.Windows.Forms.Label lbl_time;
    }
}

