namespace LED显示屏
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
            this.led = new WinFormsDeviceControlLibrary.LED();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.com_Port = new System.Windows.Forms.ComboBox();
            this.btn_Send = new System.Windows.Forms.Button();
            this.label2 = new System.Windows.Forms.Label();
            this.txt_SendText = new System.Windows.Forms.TextBox();
            this.btn_Open = new System.Windows.Forms.Button();
            this.label1 = new System.Windows.Forms.Label();
            this.groupBox1.SuspendLayout();
            this.SuspendLayout();
            //
            // led
            //
            this.led.Location = new System.Drawing.Point(12, 12);
            this.led.Name = "led";
            this.led.Size = new System.Drawing.Size(750, 121);
            this.led.TabIndex = 0;
            //
            // groupBox1
            //
            this.groupBox1.Controls.Add(this.com_Port);
            this.groupBox1.Controls.Add(this.btn_Send);
            this.groupBox1.Controls.Add(this.label2);
            this.groupBox1.Controls.Add(this.txt_SendText);
            this.groupBox1.Controls.Add(this.btn_Open);
            this.groupBox1.Controls.Add(this.label1);
            this.groupBox1.Location = new System.Drawing.Point(347, 154);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(415, 142);
            this.groupBox1.TabIndex = 1;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "LED控制";
            //
            // com_Port
            //
            this.com_Port.FormattingEnabled = true;
            this.com_Port.Location = new System.Drawing.Point(101, 24);
            this.com_Port.Name = "com_Port";
            this.com_Port.Size = new System.Drawing.Size(173, 20);
            this.com_Port.TabIndex = 6;
            this.com_Port.Click += new System.EventHandler(this.com_Port_Click);
            //
            // btn_Send
            //
            this.btn_Send.Location = new System.Drawing.Point(301, 91);
            this.btn_Send.Name = "btn_Send";
            this.btn_Send.Size = new System.Drawing.Size(75, 23);
            this.btn_Send.TabIndex = 5;
            this.btn_Send.Text = "推  送";
            this.btn_Send.UseVisualStyleBackColor = true;
            this.btn_Send.Click += new System.EventHandler(this.btn_Send_Click);
            //
            // label2
            //
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(16, 67);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(71, 12);
            this.label2.TabIndex = 4;
            this.label2.Text = "推送LED信息";
            //
            // txt_SendText
            //
            this.txt_SendText.Location = new System.Drawing.Point(101, 64);
            this.txt_SendText.Name = "txt_SendText";
            this.txt_SendText.Size = new System.Drawing.Size(286, 21);
            this.txt_SendText.TabIndex = 3;
            //
            // btn_Open
            //
            this.btn_Open.Location = new System.Drawing.Point(301, 20);
            this.btn_Open.Name = "btn_Open";
            this.btn_Open.Size = new System.Drawing.Size(86, 23);
            this.btn_Open.TabIndex = 2;
            this.btn_Open.Text = "打　开";
            this.btn_Open.UseVisualStyleBackColor = true;
            this.btn_Open.Click += new System.EventHandler(this.btn_Open_Click);
            //
            // label1
            //
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(16, 23);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(71, 12);
            this.label1.TabIndex = 0;
            this.label1.Text = "串       口";
            //
            // Form1
            //
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(774, 308);
            this.Controls.Add(this.groupBox1);
            this.Controls.Add(this.led);
            this.Name = "Form1";
            this.Text = "LED显示屏";
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private WinFormsDeviceControlLibrary.LED led;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.Button btn_Send;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.TextBox txt_SendText;
        private System.Windows.Forms.Button btn_Open;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.ComboBox com_Port;
    }
}
