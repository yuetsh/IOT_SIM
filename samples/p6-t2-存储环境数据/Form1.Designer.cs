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
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.btnDelete = new System.Windows.Forms.Button();
            this.btnUpdate = new System.Windows.Forms.Button();
            this.btn_save = new System.Windows.Forms.Button();
            this.btn_get = new System.Windows.Forms.Button();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.btn_Open = new System.Windows.Forms.Button();
            this.com_port = new System.Windows.Forms.ComboBox();
            this.label4 = new System.Windows.Forms.Label();
            this.groupBox3 = new System.Windows.Forms.GroupBox();
            this.dataGridView1 = new System.Windows.Forms.DataGridView();
            this.groupBox1.SuspendLayout();
            this.groupBox2.SuspendLayout();
            this.groupBox3.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridView1)).BeginInit();
            this.SuspendLayout();
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.btnDelete);
            this.groupBox1.Controls.Add(this.btnUpdate);
            this.groupBox1.Controls.Add(this.btn_save);
            this.groupBox1.Controls.Add(this.btn_get);
            this.groupBox1.Controls.Add(this.txt_humidity);
            this.groupBox1.Controls.Add(this.txt_temperature);
            this.groupBox1.Controls.Add(this.txt_light);
            this.groupBox1.Controls.Add(this.lbl_humidity);
            this.groupBox1.Controls.Add(this.lbl_temperature);
            this.groupBox1.Controls.Add(this.lbl_light);
            this.groupBox1.Location = new System.Drawing.Point(207, 11);
            this.groupBox1.Margin = new System.Windows.Forms.Padding(2);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Padding = new System.Windows.Forms.Padding(2);
            this.groupBox1.Size = new System.Drawing.Size(418, 180);
            this.groupBox1.TabIndex = 0;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "数据显示";
            // 
            // btnDelete
            // 
            this.btnDelete.Location = new System.Drawing.Point(229, 138);
            this.btnDelete.Margin = new System.Windows.Forms.Padding(2);
            this.btnDelete.Name = "btnDelete";
            this.btnDelete.Size = new System.Drawing.Size(72, 30);
            this.btnDelete.TabIndex = 9;
            this.btnDelete.Text = "删除";
            this.btnDelete.UseVisualStyleBackColor = true;
            this.btnDelete.Click += new System.EventHandler(this.btnDelete_Click);
            // 
            // btnUpdate
            // 
            this.btnUpdate.Location = new System.Drawing.Point(106, 138);
            this.btnUpdate.Margin = new System.Windows.Forms.Padding(2);
            this.btnUpdate.Name = "btnUpdate";
            this.btnUpdate.Size = new System.Drawing.Size(65, 30);
            this.btnUpdate.TabIndex = 8;
            this.btnUpdate.Text = "修改";
            this.btnUpdate.UseVisualStyleBackColor = true;
            this.btnUpdate.Click += new System.EventHandler(this.btnUpdate_Click);
            // 
            // btn_save
            // 
            this.btn_save.Location = new System.Drawing.Point(229, 88);
            this.btn_save.Margin = new System.Windows.Forms.Padding(2);
            this.btn_save.Name = "btn_save";
            this.btn_save.Size = new System.Drawing.Size(103, 26);
            this.btn_save.TabIndex = 7;
            this.btn_save.Text = "保存";
            this.btn_save.UseVisualStyleBackColor = true;
            this.btn_save.Click += new System.EventHandler(this.btn_save_Click);
            // 
            // btn_get
            // 
            this.btn_get.Location = new System.Drawing.Point(229, 35);
            this.btn_get.Margin = new System.Windows.Forms.Padding(2);
            this.btn_get.Name = "btn_get";
            this.btn_get.Size = new System.Drawing.Size(103, 26);
            this.btn_get.TabIndex = 6;
            this.btn_get.Text = "获取";
            this.btn_get.UseVisualStyleBackColor = true;
            this.btn_get.Click += new System.EventHandler(this.btn_get_Click);
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(82, 100);
            this.txt_humidity.Margin = new System.Windows.Forms.Padding(2);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(110, 21);
            this.txt_humidity.TabIndex = 5;
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(82, 70);
            this.txt_temperature.Margin = new System.Windows.Forms.Padding(2);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(110, 21);
            this.txt_temperature.TabIndex = 4;
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(82, 35);
            this.txt_light.Margin = new System.Windows.Forms.Padding(2);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(110, 21);
            this.txt_light.TabIndex = 3;
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Location = new System.Drawing.Point(40, 102);
            this.lbl_humidity.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_humidity.Name = "lbl_humidity";
            this.lbl_humidity.Size = new System.Drawing.Size(29, 12);
            this.lbl_humidity.TabIndex = 2;
            this.lbl_humidity.Text = "湿度";
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Location = new System.Drawing.Point(40, 70);
            this.lbl_temperature.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(29, 12);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // lbl_light
            // 
            this.lbl_light.AutoSize = true;
            this.lbl_light.Location = new System.Drawing.Point(40, 38);
            this.lbl_light.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(29, 12);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // groupBox2
            // 
            this.groupBox2.Controls.Add(this.btn_Open);
            this.groupBox2.Controls.Add(this.com_port);
            this.groupBox2.Controls.Add(this.label4);
            this.groupBox2.Location = new System.Drawing.Point(4, 10);
            this.groupBox2.Margin = new System.Windows.Forms.Padding(2);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Padding = new System.Windows.Forms.Padding(2);
            this.groupBox2.Size = new System.Drawing.Size(199, 181);
            this.groupBox2.TabIndex = 1;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "配置";
            // 
            // btn_Open
            // 
            this.btn_Open.Location = new System.Drawing.Point(55, 102);
            this.btn_Open.Margin = new System.Windows.Forms.Padding(2);
            this.btn_Open.Name = "btn_Open";
            this.btn_Open.Size = new System.Drawing.Size(53, 20);
            this.btn_Open.TabIndex = 4;
            this.btn_Open.Text = "开启";
            this.btn_Open.UseVisualStyleBackColor = true;
            this.btn_Open.Click += new System.EventHandler(this.btn_Open_Click);
            // 
            // com_port
            // 
            this.com_port.FormattingEnabled = true;
            this.com_port.Location = new System.Drawing.Point(68, 53);
            this.com_port.Margin = new System.Windows.Forms.Padding(2);
            this.com_port.Name = "com_port";
            this.com_port.Size = new System.Drawing.Size(115, 20);
            this.com_port.TabIndex = 3;
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(12, 56);
            this.label4.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(29, 12);
            this.label4.TabIndex = 2;
            this.label4.Text = "串口";
            // 
            // groupBox3
            // 
            this.groupBox3.Controls.Add(this.dataGridView1);
            this.groupBox3.Location = new System.Drawing.Point(4, 195);
            this.groupBox3.Margin = new System.Windows.Forms.Padding(2);
            this.groupBox3.Name = "groupBox3";
            this.groupBox3.Padding = new System.Windows.Forms.Padding(2);
            this.groupBox3.Size = new System.Drawing.Size(625, 214);
            this.groupBox3.TabIndex = 3;
            this.groupBox3.TabStop = false;
            this.groupBox3.Text = "历史记录";
            // 
            // dataGridView1
            // 
            this.dataGridView1.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dataGridView1.Location = new System.Drawing.Point(7, 19);
            this.dataGridView1.Margin = new System.Windows.Forms.Padding(2);
            this.dataGridView1.Name = "dataGridView1";
            this.dataGridView1.RowTemplate.Height = 27;
            this.dataGridView1.Size = new System.Drawing.Size(614, 191);
            this.dataGridView1.TabIndex = 0;
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(640, 412);
            this.Controls.Add(this.groupBox3);
            this.Controls.Add(this.groupBox2);
            this.Controls.Add(this.groupBox1);
            this.Margin = new System.Windows.Forms.Padding(2);
            this.Name = "Form1";
            this.Text = "校园灾情数据存储";
            this.Load += new System.EventHandler(this.Form1_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            this.groupBox2.ResumeLayout(false);
            this.groupBox2.PerformLayout();
            this.groupBox3.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.dataGridView1)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.Button btn_save;
        private System.Windows.Forms.Button btn_get;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label lbl_humidity;
        private System.Windows.Forms.Label lbl_temperature;
        private System.Windows.Forms.Label lbl_light;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.Button btn_Open;
        private System.Windows.Forms.ComboBox com_port;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Button btnDelete;
        private System.Windows.Forms.Button btnUpdate;
        private System.Windows.Forms.GroupBox groupBox3;
        private System.Windows.Forms.DataGridView dataGridView1;
    }
}

