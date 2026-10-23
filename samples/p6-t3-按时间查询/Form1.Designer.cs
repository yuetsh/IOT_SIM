namespace 校园数据存储
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
            this.groupBox4 = new System.Windows.Forms.GroupBox();
            this.dataGridView1 = new System.Windows.Forms.DataGridView();
            this.btnCx = new System.Windows.Forms.Button();
            this.LblStartTime = new System.Windows.Forms.Label();
            this.LblEndTime = new System.Windows.Forms.Label();
            this.StartTime = new System.Windows.Forms.DateTimePicker();
            this.EndTime = new System.Windows.Forms.DateTimePicker();
            this.groupBox4.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridView1)).BeginInit();
            this.SuspendLayout();
            // 
            // groupBox4
            // 
            this.groupBox4.Controls.Add(this.dataGridView1);
            this.groupBox4.Location = new System.Drawing.Point(1, 52);
            this.groupBox4.Margin = new System.Windows.Forms.Padding(2);
            this.groupBox4.Name = "groupBox4";
            this.groupBox4.Padding = new System.Windows.Forms.Padding(2);
            this.groupBox4.Size = new System.Drawing.Size(642, 283);
            this.groupBox4.TabIndex = 3;
            this.groupBox4.TabStop = false;
            this.groupBox4.Text = "历史记录";
            // 
            // dataGridView1
            // 
            this.dataGridView1.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dataGridView1.Location = new System.Drawing.Point(4, 17);
            this.dataGridView1.Margin = new System.Windows.Forms.Padding(2);
            this.dataGridView1.Name = "dataGridView1";
            this.dataGridView1.RowTemplate.Height = 27;
            this.dataGridView1.Size = new System.Drawing.Size(634, 261);
            this.dataGridView1.TabIndex = 0;
            // 
            // btnCx
            // 
            this.btnCx.Location = new System.Drawing.Point(541, 19);
            this.btnCx.Name = "btnCx";
            this.btnCx.Size = new System.Drawing.Size(79, 23);
            this.btnCx.TabIndex = 4;
            this.btnCx.Text = "查询";
            this.btnCx.UseVisualStyleBackColor = true;
            this.btnCx.Click += new System.EventHandler(this.btnCx_Click);
            // 
            // LblStartTime
            // 
            this.LblStartTime.AutoSize = true;
            this.LblStartTime.Location = new System.Drawing.Point(25, 23);
            this.LblStartTime.Name = "LblStartTime";
            this.LblStartTime.Size = new System.Drawing.Size(53, 12);
            this.LblStartTime.TabIndex = 5;
            this.LblStartTime.Text = "开始日期";
            // 
            // LblEndTime
            // 
            this.LblEndTime.AutoSize = true;
            this.LblEndTime.Location = new System.Drawing.Point(272, 25);
            this.LblEndTime.Name = "LblEndTime";
            this.LblEndTime.Size = new System.Drawing.Size(53, 12);
            this.LblEndTime.TabIndex = 6;
            this.LblEndTime.Text = "结束日期";
            // 
            // StartTime
            // 
            this.StartTime.Location = new System.Drawing.Point(84, 19);
            this.StartTime.Name = "StartTime";
            this.StartTime.Size = new System.Drawing.Size(136, 21);
            this.StartTime.TabIndex = 7;
            // 
            // EndTime
            // 
            this.EndTime.Location = new System.Drawing.Point(358, 19);
            this.EndTime.Name = "EndTime";
            this.EndTime.Size = new System.Drawing.Size(148, 21);
            this.EndTime.TabIndex = 8;
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(654, 346);
            this.Controls.Add(this.EndTime);
            this.Controls.Add(this.StartTime);
            this.Controls.Add(this.LblEndTime);
            this.Controls.Add(this.LblStartTime);
            this.Controls.Add(this.btnCx);
            this.Controls.Add(this.groupBox4);
            this.Margin = new System.Windows.Forms.Padding(2);
            this.Name = "Form1";
            this.Text = "查询校园灾情数据";
            this.groupBox4.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.dataGridView1)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.GroupBox groupBox4;
        private System.Windows.Forms.DataGridView dataGridView1;
        private System.Windows.Forms.Button btnCx;
        private System.Windows.Forms.Label LblStartTime;
        private System.Windows.Forms.Label LblEndTime;
        private System.Windows.Forms.DateTimePicker StartTime;
        private System.Windows.Forms.DateTimePicker EndTime;
    }
}

