namespace 智慧校园
{
    partial class Environment
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.Windows.Forms.DataVisualization.Charting.ChartArea chartArea2 = new System.Windows.Forms.DataVisualization.Charting.ChartArea();
            System.Windows.Forms.DataVisualization.Charting.Legend legend3 = new System.Windows.Forms.DataVisualization.Charting.Legend();
            System.Windows.Forms.DataVisualization.Charting.Legend legend4 = new System.Windows.Forms.DataVisualization.Charting.Legend();
            System.Windows.Forms.DataVisualization.Charting.Series series3 = new System.Windows.Forms.DataVisualization.Charting.Series();
            System.Windows.Forms.DataVisualization.Charting.Series series4 = new System.Windows.Forms.DataVisualization.Charting.Series();
            this.panel1 = new System.Windows.Forms.Panel();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.panel2 = new System.Windows.Forms.Panel();
            this.panel_bg = new System.Windows.Forms.Panel();
            this.chart1 = new System.Windows.Forms.DataVisualization.Charting.Chart();
            this.panel_form = new System.Windows.Forms.Panel();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.pic_lampOpen = new System.Windows.Forms.PictureBox();
            this.label10 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.txt_autoLight = new System.Windows.Forms.TextBox();
            this.label7 = new System.Windows.Forms.Label();
            this.ch_autoLamp = new System.Windows.Forms.CheckBox();
            this.groupBox3 = new System.Windows.Forms.GroupBox();
            this.btn_ledEnvironment2 = new System.Windows.Forms.Button();
            this.ch_autoLedFire = new System.Windows.Forms.CheckBox();
            this.btn_ledSendMsg = new System.Windows.Forms.Button();
            this.txt_ledMsg = new System.Windows.Forms.TextBox();
            this.label8 = new System.Windows.Forms.Label();
            this.panel5 = new System.Windows.Forms.Panel();
            this.btn_dataAnalyse = new System.Windows.Forms.Button();
            this.btn_ledEnvironment1 = new System.Windows.Forms.Button();
            this.label6 = new System.Windows.Forms.Label();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.label1 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.txt_fire = new System.Windows.Forms.TextBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.label2 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.txt_smoke = new System.Windows.Forms.TextBox();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.label3 = new System.Windows.Forms.Label();
            this.panel3 = new System.Windows.Forms.Panel();
            this.lb_return = new System.Windows.Forms.Label();
            this.panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.panel2.SuspendLayout();
            this.panel_bg.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.chart1)).BeginInit();
            this.panel_form.SuspendLayout();
            this.groupBox2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lampOpen)).BeginInit();
            this.groupBox3.SuspendLayout();
            this.panel5.SuspendLayout();
            this.panel3.SuspendLayout();
            this.SuspendLayout();
            // 
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(100)))), ((int)(((byte)(116)))), ((int)(((byte)(133)))));
            this.panel1.Controls.Add(this.pictureBox1);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(1043, 100);
            this.panel1.TabIndex = 0;
            this.panel1.Paint += new System.Windows.Forms.PaintEventHandler(this.panel1_Paint);
            // 
            // pictureBox1
            // 
            this.pictureBox1.Image = global::智慧校园.Properties.Resources.ico_title;
            this.pictureBox1.Location = new System.Drawing.Point(44, 12);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(226, 54);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.AutoSize;
            this.pictureBox1.TabIndex = 0;
            this.pictureBox1.TabStop = false;
            // 
            // panel2
            // 
            this.panel2.Controls.Add(this.panel_bg);
            this.panel2.Controls.Add(this.panel3);
            this.panel2.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel2.Location = new System.Drawing.Point(0, 100);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(1043, 691);
            this.panel2.TabIndex = 1;
            // 
            // panel_bg
            // 
            this.panel_bg.BackgroundImage = global::智慧校园.Properties.Resources.day_02;
            this.panel_bg.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.panel_bg.Controls.Add(this.chart1);
            this.panel_bg.Controls.Add(this.panel_form);
            this.panel_bg.Controls.Add(this.panel5);
            this.panel_bg.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel_bg.Location = new System.Drawing.Point(0, 39);
            this.panel_bg.Name = "panel_bg";
            this.panel_bg.Size = new System.Drawing.Size(1043, 652);
            this.panel_bg.TabIndex = 1;
            // 
            // chart1
            // 
            chartArea2.Name = "ChartArea1";
            this.chart1.ChartAreas.Add(chartArea2);
            legend3.Name = "MaxLegend";
            legend3.TitleForeColor = System.Drawing.Color.DimGray;
            legend4.Name = "AVGLegend";
            legend4.TitleForeColor = System.Drawing.Color.DimGray;
            this.chart1.Legends.Add(legend3);
            this.chart1.Legends.Add(legend4);
            this.chart1.Location = new System.Drawing.Point(44, 172);
            this.chart1.Name = "chart1";
            series3.ChartArea = "ChartArea1";
            series3.ChartType = System.Windows.Forms.DataVisualization.Charting.SeriesChartType.Line;
            series3.Legend = "MaxLegend";
            series3.LegendText = "最大值";
            series3.Name = "MaxSeries";
            series3.XValueMember = "_Time";
            series3.YValueMembers = "MaxTemperature";
            series4.ChartArea = "ChartArea1";
            series4.ChartType = System.Windows.Forms.DataVisualization.Charting.SeriesChartType.Line;
            series4.Legend = "AVGLegend";
            series4.LegendText = "平均值";
            series4.Name = "AVGSeries";
            series4.XValueMember = "_Time";
            series4.YValueMembers = "AVGTemperature";
            this.chart1.Series.Add(series3);
            this.chart1.Series.Add(series4);
            this.chart1.Size = new System.Drawing.Size(455, 327);
            this.chart1.TabIndex = 3;
            this.chart1.Text = "chart1";
            // 
            // panel_form
            // 
            this.panel_form.BackColor = System.Drawing.Color.Transparent;
            this.panel_form.BackgroundImage = global::智慧校园.Properties.Resources.bg_from2;
            this.panel_form.Controls.Add(this.groupBox2);
            this.panel_form.Controls.Add(this.groupBox3);
            this.panel_form.Dock = System.Windows.Forms.DockStyle.Right;
            this.panel_form.Location = new System.Drawing.Point(617, 0);
            this.panel_form.Name = "panel_form";
            this.panel_form.Size = new System.Drawing.Size(426, 552);
            this.panel_form.TabIndex = 2;
            // 
            // groupBox2
            // 
            this.groupBox2.Controls.Add(this.pic_lampOpen);
            this.groupBox2.Controls.Add(this.label10);
            this.groupBox2.Controls.Add(this.label9);
            this.groupBox2.Controls.Add(this.txt_autoLight);
            this.groupBox2.Controls.Add(this.label7);
            this.groupBox2.Controls.Add(this.ch_autoLamp);
            this.groupBox2.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.groupBox2.ForeColor = System.Drawing.Color.White;
            this.groupBox2.Location = new System.Drawing.Point(22, 21);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Size = new System.Drawing.Size(392, 150);
            this.groupBox2.TabIndex = 3;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "路灯控制";
            // 
            // pic_lampOpen
            // 
            this.pic_lampOpen.BackgroundImage = global::智慧校园.Properties.Resources.switch_off;
            this.pic_lampOpen.Location = new System.Drawing.Point(103, 103);
            this.pic_lampOpen.Name = "pic_lampOpen";
            this.pic_lampOpen.Size = new System.Drawing.Size(48, 24);
            this.pic_lampOpen.TabIndex = 5;
            this.pic_lampOpen.TabStop = false;
            this.pic_lampOpen.Click += new System.EventHandler(this.pic_lampOpen_Click);
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.Location = new System.Drawing.Point(33, 105);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(59, 17);
            this.label10.TabIndex = 4;
            this.label10.Text = "灯光控制:";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Location = new System.Drawing.Point(278, 58);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(17, 17);
            this.label9.TabIndex = 3;
            this.label9.Text = "lx";
            // 
            // txt_autoLight
            // 
            this.txt_autoLight.Location = new System.Drawing.Point(128, 55);
            this.txt_autoLight.Name = "txt_autoLight";
            this.txt_autoLight.Size = new System.Drawing.Size(144, 23);
            this.txt_autoLight.TabIndex = 2;
            this.txt_autoLight.TextChanged += new System.EventHandler(this.txt_autoLight_TextChanged);
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(33, 58);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(92, 17);
            this.label7.TabIndex = 1;
            this.label7.Text = "设定开灯光照值";
            // 
            // ch_autoLamp
            // 
            this.ch_autoLamp.AutoSize = true;
            this.ch_autoLamp.Location = new System.Drawing.Point(35, 30);
            this.ch_autoLamp.Name = "ch_autoLamp";
            this.ch_autoLamp.Size = new System.Drawing.Size(75, 21);
            this.ch_autoLamp.TabIndex = 0;
            this.ch_autoLamp.Text = "自动控制";
            this.ch_autoLamp.UseVisualStyleBackColor = true;
            this.ch_autoLamp.CheckedChanged += new System.EventHandler(this.ch_autoLamp_CheckedChanged);
            // 
            // groupBox3
            // 
            this.groupBox3.Controls.Add(this.btn_ledEnvironment2);
            this.groupBox3.Controls.Add(this.ch_autoLedFire);
            this.groupBox3.Controls.Add(this.btn_ledSendMsg);
            this.groupBox3.Controls.Add(this.txt_ledMsg);
            this.groupBox3.Controls.Add(this.label8);
            this.groupBox3.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.groupBox3.ForeColor = System.Drawing.Color.White;
            this.groupBox3.Location = new System.Drawing.Point(22, 209);
            this.groupBox3.Name = "groupBox3";
            this.groupBox3.Size = new System.Drawing.Size(392, 316);
            this.groupBox3.TabIndex = 4;
            this.groupBox3.TabStop = false;
            this.groupBox3.Text = "LED推送";
            // 
            // btn_ledEnvironment2
            // 
            this.btn_ledEnvironment2.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(86)))), ((int)(((byte)(149)))), ((int)(((byte)(212)))));
            this.btn_ledEnvironment2.Font = new System.Drawing.Font("微软雅黑", 12F);
            this.btn_ledEnvironment2.Location = new System.Drawing.Point(234, 217);
            this.btn_ledEnvironment2.Name = "btn_ledEnvironment2";
            this.btn_ledEnvironment2.Size = new System.Drawing.Size(145, 32);
            this.btn_ledEnvironment2.TabIndex = 11;
            this.btn_ledEnvironment2.Text = "推送天气信息";
            this.btn_ledEnvironment2.UseVisualStyleBackColor = false;
            this.btn_ledEnvironment2.Click += new System.EventHandler(this.btn_ledEnvironment2_Click);
            // 
            // ch_autoLedFire
            // 
            this.ch_autoLedFire.AutoSize = true;
            this.ch_autoLedFire.Location = new System.Drawing.Point(265, 35);
            this.ch_autoLedFire.Name = "ch_autoLedFire";
            this.ch_autoLedFire.Size = new System.Drawing.Size(99, 21);
            this.ch_autoLedFire.TabIndex = 4;
            this.ch_autoLedFire.Text = "自动推送火情";
            this.ch_autoLedFire.UseVisualStyleBackColor = true;
            this.ch_autoLedFire.CheckedChanged += new System.EventHandler(this.ch_autoLedFire_CheckedChanged);
            // 
            // btn_ledSendMsg
            // 
            this.btn_ledSendMsg.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(80)))), ((int)(((byte)(168)))), ((int)(((byte)(255)))));
            this.btn_ledSendMsg.Font = new System.Drawing.Font("微软雅黑", 12F);
            this.btn_ledSendMsg.Location = new System.Drawing.Point(26, 217);
            this.btn_ledSendMsg.Name = "btn_ledSendMsg";
            this.btn_ledSendMsg.Size = new System.Drawing.Size(145, 32);
            this.btn_ledSendMsg.TabIndex = 2;
            this.btn_ledSendMsg.Text = "推送LED信息";
            this.btn_ledSendMsg.UseVisualStyleBackColor = false;
            this.btn_ledSendMsg.Click += new System.EventHandler(this.btn_ledSendMsg_Click);
            // 
            // txt_ledMsg
            // 
            this.txt_ledMsg.Location = new System.Drawing.Point(23, 62);
            this.txt_ledMsg.Multiline = true;
            this.txt_ledMsg.Name = "txt_ledMsg";
            this.txt_ledMsg.Size = new System.Drawing.Size(356, 130);
            this.txt_ledMsg.TabIndex = 1;
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Location = new System.Drawing.Point(20, 36);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(54, 17);
            this.label8.TabIndex = 0;
            this.label8.Text = "LED信息";
            // 
            // panel5
            // 
            this.panel5.Controls.Add(this.btn_dataAnalyse);
            this.panel5.Controls.Add(this.btn_ledEnvironment1);
            this.panel5.Controls.Add(this.label6);
            this.panel5.Controls.Add(this.txt_humidity);
            this.panel5.Controls.Add(this.label1);
            this.panel5.Controls.Add(this.label5);
            this.panel5.Controls.Add(this.txt_fire);
            this.panel5.Controls.Add(this.txt_temperature);
            this.panel5.Controls.Add(this.label2);
            this.panel5.Controls.Add(this.label4);
            this.panel5.Controls.Add(this.txt_smoke);
            this.panel5.Controls.Add(this.txt_light);
            this.panel5.Controls.Add(this.label3);
            this.panel5.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panel5.Location = new System.Drawing.Point(0, 552);
            this.panel5.Name = "panel5";
            this.panel5.Size = new System.Drawing.Size(1043, 100);
            this.panel5.TabIndex = 1;
            // 
            // btn_dataAnalyse
            // 
            this.btn_dataAnalyse.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(80)))), ((int)(((byte)(168)))), ((int)(((byte)(255)))));
            this.btn_dataAnalyse.Font = new System.Drawing.Font("微软雅黑", 12F);
            this.btn_dataAnalyse.Location = new System.Drawing.Point(792, 35);
            this.btn_dataAnalyse.Name = "btn_dataAnalyse";
            this.btn_dataAnalyse.Size = new System.Drawing.Size(119, 32);
            this.btn_dataAnalyse.TabIndex = 23;
            this.btn_dataAnalyse.Text = "数据分析";
            this.btn_dataAnalyse.UseVisualStyleBackColor = false;
            this.btn_dataAnalyse.Click += new System.EventHandler(this.btn_dataAnalyse_Click);
            // 
            // btn_ledEnvironment1
            // 
            this.btn_ledEnvironment1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(86)))), ((int)(((byte)(149)))), ((int)(((byte)(212)))));
            this.btn_ledEnvironment1.Font = new System.Drawing.Font("微软雅黑", 12F);
            this.btn_ledEnvironment1.Location = new System.Drawing.Point(910, 35);
            this.btn_ledEnvironment1.Name = "btn_ledEnvironment1";
            this.btn_ledEnvironment1.Size = new System.Drawing.Size(121, 32);
            this.btn_ledEnvironment1.TabIndex = 15;
            this.btn_ledEnvironment1.Text = "推送天气信息";
            this.btn_ledEnvironment1.UseVisualStyleBackColor = false;
            this.btn_ledEnvironment1.Click += new System.EventHandler(this.btn_ledEnvironment1_Click);
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Font = new System.Drawing.Font("微软雅黑", 18F);
            this.label6.Location = new System.Drawing.Point(12, 31);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(110, 31);
            this.label6.TabIndex = 11;
            this.label6.Text = "环境数据";
            // 
            // txt_humidity
            // 
            this.txt_humidity.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(206)))), ((int)(((byte)(206)))), ((int)(((byte)(206)))));
            this.txt_humidity.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.txt_humidity.Location = new System.Drawing.Point(716, 36);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(70, 32);
            this.txt_humidity.TabIndex = 22;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.label1.Location = new System.Drawing.Point(132, 38);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(50, 25);
            this.label1.TabIndex = 12;
            this.label1.Text = "火焰";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.label5.Location = new System.Drawing.Point(660, 39);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(50, 25);
            this.label5.TabIndex = 21;
            this.label5.Text = "湿度";
            // 
            // txt_fire
            // 
            this.txt_fire.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(206)))), ((int)(((byte)(206)))), ((int)(((byte)(206)))));
            this.txt_fire.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.txt_fire.Location = new System.Drawing.Point(188, 35);
            this.txt_fire.Name = "txt_fire";
            this.txt_fire.Size = new System.Drawing.Size(70, 32);
            this.txt_fire.TabIndex = 13;
            // 
            // txt_temperature
            // 
            this.txt_temperature.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(206)))), ((int)(((byte)(206)))), ((int)(((byte)(206)))));
            this.txt_temperature.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.txt_temperature.Location = new System.Drawing.Point(584, 35);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(70, 32);
            this.txt_temperature.TabIndex = 20;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.label2.Location = new System.Drawing.Point(264, 36);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(50, 25);
            this.label2.TabIndex = 14;
            this.label2.Text = "烟雾";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.label4.Location = new System.Drawing.Point(528, 38);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(50, 25);
            this.label4.TabIndex = 19;
            this.label4.Text = "温度";
            // 
            // txt_smoke
            // 
            this.txt_smoke.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(206)))), ((int)(((byte)(206)))), ((int)(((byte)(206)))));
            this.txt_smoke.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.txt_smoke.Location = new System.Drawing.Point(320, 33);
            this.txt_smoke.Name = "txt_smoke";
            this.txt_smoke.Size = new System.Drawing.Size(70, 32);
            this.txt_smoke.TabIndex = 16;
            // 
            // txt_light
            // 
            this.txt_light.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(206)))), ((int)(((byte)(206)))), ((int)(((byte)(206)))));
            this.txt_light.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.txt_light.Location = new System.Drawing.Point(452, 32);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(70, 32);
            this.txt_light.TabIndex = 18;
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.label3.Location = new System.Drawing.Point(396, 35);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(50, 25);
            this.label3.TabIndex = 17;
            this.label3.Text = "光照";
            // 
            // panel3
            // 
            this.panel3.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(229)))), ((int)(((byte)(229)))), ((int)(((byte)(229)))));
            this.panel3.Controls.Add(this.lb_return);
            this.panel3.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel3.Location = new System.Drawing.Point(0, 0);
            this.panel3.Name = "panel3";
            this.panel3.Size = new System.Drawing.Size(1043, 39);
            this.panel3.TabIndex = 0;
            this.panel3.Paint += new System.Windows.Forms.PaintEventHandler(this.panel3_Paint);
            // 
            // lb_return
            // 
            this.lb_return.AutoSize = true;
            this.lb_return.Location = new System.Drawing.Point(25, 12);
            this.lb_return.Name = "lb_return";
            this.lb_return.Size = new System.Drawing.Size(83, 12);
            this.lb_return.TabIndex = 0;
            this.lb_return.Text = "<  返回主窗体";
            this.lb_return.Click += new System.EventHandler(this.lb_return_Click);
            // 
            // Environment
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1043, 791);
            this.Controls.Add(this.panel2);
            this.Controls.Add(this.panel1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "Environment";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Environment";
            this.FormClosed += new System.Windows.Forms.FormClosedEventHandler(this.Environment_FormClosed);
            this.Load += new System.EventHandler(this.Environment_Load);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.panel2.ResumeLayout(false);
            this.panel_bg.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.chart1)).EndInit();
            this.panel_form.ResumeLayout(false);
            this.groupBox2.ResumeLayout(false);
            this.groupBox2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lampOpen)).EndInit();
            this.groupBox3.ResumeLayout(false);
            this.groupBox3.PerformLayout();
            this.panel5.ResumeLayout(false);
            this.panel5.PerformLayout();
            this.panel3.ResumeLayout(false);
            this.panel3.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Panel panel3;
        private System.Windows.Forms.Label lb_return;
        private System.Windows.Forms.Panel panel_bg;
        private System.Windows.Forms.Panel panel5;
        private System.Windows.Forms.Panel panel_form;
        private System.Windows.Forms.Button btn_dataAnalyse;
        private System.Windows.Forms.Button btn_ledEnvironment1;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.TextBox txt_fire;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.TextBox txt_smoke;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.PictureBox pic_lampOpen;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.TextBox txt_autoLight;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.CheckBox ch_autoLamp;
        private System.Windows.Forms.GroupBox groupBox3;
        private System.Windows.Forms.Button btn_ledEnvironment2;
        private System.Windows.Forms.CheckBox ch_autoLedFire;
        private System.Windows.Forms.Button btn_ledSendMsg;
        private System.Windows.Forms.TextBox txt_ledMsg;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.DataVisualization.Charting.Chart chart1;
    }
}