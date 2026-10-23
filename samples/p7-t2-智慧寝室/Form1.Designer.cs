namespace 寝室情景模式
{
    partial class frm_control
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(frm_control));
            this.grp_status = new System.Windows.Forms.GroupBox();
            this.alarm1 = new WinFormsDeviceControlLibrary.Alarm();
            this.lamp = new WinFormsDeviceControlLibrary.Lamp();
            this.lbl_windowopen = new System.Windows.Forms.Label();
            this.lbl_windowclose = new System.Windows.Forms.Label();
            this.trb_curtain = new System.Windows.Forms.TrackBar();
            this.lbl_boardcast = new System.Windows.Forms.Label();
            this.lbl_curtain = new System.Windows.Forms.Label();
            this.pic_boardcastStatus = new System.Windows.Forms.PictureBox();
            this.lbl_lights = new System.Windows.Forms.Label();
            this.grp_input = new System.Windows.Forms.GroupBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.com_import = new System.Windows.Forms.ComboBox();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_import = new System.Windows.Forms.Label();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.grp_mode = new System.Windows.Forms.GroupBox();
            this.lbl_time = new System.Windows.Forms.Label();
            this.txt_time = new System.Windows.Forms.TextBox();
            this.lbl_mode = new System.Windows.Forms.Label();
            this.btn_apply = new System.Windows.Forms.Button();
            this.timer = new System.Windows.Forms.Timer(this.components);
            this.axWindowsMediaPlayer1 = new AxWMPLib.AxWindowsMediaPlayer();
            this.grp_status.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.trb_curtain)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_boardcastStatus)).BeginInit();
            this.grp_input.SuspendLayout();
            this.grp_mode.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.axWindowsMediaPlayer1)).BeginInit();
            this.SuspendLayout();
            // 
            // grp_status
            // 
            this.grp_status.Controls.Add(this.alarm1);
            this.grp_status.Controls.Add(this.lamp);
            this.grp_status.Controls.Add(this.lbl_windowopen);
            this.grp_status.Controls.Add(this.lbl_windowclose);
            this.grp_status.Controls.Add(this.trb_curtain);
            this.grp_status.Controls.Add(this.lbl_boardcast);
            this.grp_status.Controls.Add(this.lbl_curtain);
            this.grp_status.Controls.Add(this.pic_boardcastStatus);
            this.grp_status.Controls.Add(this.lbl_lights);
            this.grp_status.Location = new System.Drawing.Point(193, 97);
            this.grp_status.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_status.Name = "grp_status";
            this.grp_status.Padding = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_status.Size = new System.Drawing.Size(328, 286);
            this.grp_status.TabIndex = 8;
            this.grp_status.TabStop = false;
            this.grp_status.Text = "状态栏";
            // 
            // alarm1
            // 
            this.alarm1.BackColor = System.Drawing.Color.White;
            this.alarm1.Location = new System.Drawing.Point(37, 130);
            this.alarm1.Margin = new System.Windows.Forms.Padding(5);
            this.alarm1.Name = "alarm1";
            this.alarm1.Size = new System.Drawing.Size(7, 6);
            this.alarm1.TabIndex = 8;
            // 
            // lamp
            // 
            this.lamp.BackColor = System.Drawing.Color.White;
            this.lamp.Location = new System.Drawing.Point(172, 48);
            this.lamp.Margin = new System.Windows.Forms.Padding(5);
            this.lamp.Name = "lamp";
            this.lamp.Size = new System.Drawing.Size(148, 232);
            this.lamp.TabIndex = 6;
            // 
            // lbl_windowopen
            // 
            this.lbl_windowopen.AutoSize = true;
            this.lbl_windowopen.Location = new System.Drawing.Point(13, 101);
            this.lbl_windowopen.Name = "lbl_windowopen";
            this.lbl_windowopen.Size = new System.Drawing.Size(37, 15);
            this.lbl_windowopen.TabIndex = 5;
            this.lbl_windowopen.Text = "全开";
            // 
            // lbl_windowclose
            // 
            this.lbl_windowclose.AutoSize = true;
            this.lbl_windowclose.Location = new System.Drawing.Point(127, 101);
            this.lbl_windowclose.Name = "lbl_windowclose";
            this.lbl_windowclose.Size = new System.Drawing.Size(37, 15);
            this.lbl_windowclose.TabIndex = 5;
            this.lbl_windowclose.Text = "全关";
            // 
            // trb_curtain
            // 
            this.trb_curtain.Location = new System.Drawing.Point(16, 59);
            this.trb_curtain.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.trb_curtain.Name = "trb_curtain";
            this.trb_curtain.Size = new System.Drawing.Size(143, 56);
            this.trb_curtain.TabIndex = 4;
            this.trb_curtain.Value = 10;
            // 
            // lbl_boardcast
            // 
            this.lbl_boardcast.AutoSize = true;
            this.lbl_boardcast.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_boardcast.Location = new System.Drawing.Point(23, 186);
            this.lbl_boardcast.Name = "lbl_boardcast";
            this.lbl_boardcast.Size = new System.Drawing.Size(39, 15);
            this.lbl_boardcast.TabIndex = 2;
            this.lbl_boardcast.Text = "广播";
            // 
            // lbl_curtain
            // 
            this.lbl_curtain.AutoSize = true;
            this.lbl_curtain.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_curtain.Location = new System.Drawing.Point(13, 34);
            this.lbl_curtain.Name = "lbl_curtain";
            this.lbl_curtain.Size = new System.Drawing.Size(39, 15);
            this.lbl_curtain.TabIndex = 2;
            this.lbl_curtain.Text = "窗帘";
            // 
            // pic_boardcastStatus
            // 
            this.pic_boardcastStatus.Enabled = false;
            this.pic_boardcastStatus.Image = global::寝室情景模式.Properties.Resources.switch_off;
            this.pic_boardcastStatus.Location = new System.Drawing.Point(105, 182);
            this.pic_boardcastStatus.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.pic_boardcastStatus.Name = "pic_boardcastStatus";
            this.pic_boardcastStatus.Size = new System.Drawing.Size(44, 21);
            this.pic_boardcastStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_boardcastStatus.TabIndex = 1;
            this.pic_boardcastStatus.TabStop = false;
            // 
            // lbl_lights
            // 
            this.lbl_lights.AutoSize = true;
            this.lbl_lights.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_lights.Location = new System.Drawing.Point(235, 25);
            this.lbl_lights.Name = "lbl_lights";
            this.lbl_lights.Size = new System.Drawing.Size(39, 15);
            this.lbl_lights.TabIndex = 0;
            this.lbl_lights.Text = "灯光";
            // 
            // grp_input
            // 
            this.grp_input.Controls.Add(this.txt_temperature);
            this.grp_input.Controls.Add(this.txt_humidity);
            this.grp_input.Controls.Add(this.com_import);
            this.grp_input.Controls.Add(this.lbl_temperature);
            this.grp_input.Controls.Add(this.txt_light);
            this.grp_input.Controls.Add(this.lbl_import);
            this.grp_input.Controls.Add(this.lbl_humidity);
            this.grp_input.Controls.Add(this.lbl_light);
            this.grp_input.Location = new System.Drawing.Point(10, 97);
            this.grp_input.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_input.Name = "grp_input";
            this.grp_input.Padding = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_input.Size = new System.Drawing.Size(177, 238);
            this.grp_input.TabIndex = 7;
            this.grp_input.TabStop = false;
            this.grp_input.Text = "采集量";
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(75, 141);
            this.txt_temperature.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(85, 25);
            this.txt_temperature.TabIndex = 3;
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(76, 200);
            this.txt_humidity.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(85, 25);
            this.txt_humidity.TabIndex = 3;
            // 
            // com_import
            // 
            this.com_import.FormattingEnabled = true;
            this.com_import.Location = new System.Drawing.Point(76, 25);
            this.com_import.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.com_import.Name = "com_import";
            this.com_import.Size = new System.Drawing.Size(85, 23);
            this.com_import.TabIndex = 6;
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_temperature.Location = new System.Drawing.Point(29, 146);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(39, 15);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(76, 84);
            this.txt_light.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(85, 25);
            this.txt_light.TabIndex = 2;
            // 
            // lbl_import
            // 
            this.lbl_import.AutoSize = true;
            this.lbl_import.Location = new System.Drawing.Point(31, 29);
            this.lbl_import.Name = "lbl_import";
            this.lbl_import.Size = new System.Drawing.Size(37, 15);
            this.lbl_import.TabIndex = 1;
            this.lbl_import.Text = "串口";
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_humidity.Location = new System.Drawing.Point(31, 204);
            this.lbl_humidity.Name = "lbl_humidity";
            this.lbl_humidity.Size = new System.Drawing.Size(39, 15);
            this.lbl_humidity.TabIndex = 1;
            this.lbl_humidity.Text = "湿度";
            // 
            // lbl_light
            // 
            this.lbl_light.AutoSize = true;
            this.lbl_light.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_light.Location = new System.Drawing.Point(15, 88);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(55, 15);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // grp_mode
            // 
            this.grp_mode.Controls.Add(this.lbl_time);
            this.grp_mode.Controls.Add(this.txt_time);
            this.grp_mode.Controls.Add(this.lbl_mode);
            this.grp_mode.Controls.Add(this.btn_apply);
            this.grp_mode.Location = new System.Drawing.Point(11, 10);
            this.grp_mode.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_mode.Name = "grp_mode";
            this.grp_mode.Padding = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.grp_mode.Size = new System.Drawing.Size(511, 83);
            this.grp_mode.TabIndex = 6;
            this.grp_mode.TabStop = false;
            this.grp_mode.Text = "模式选择";
            // 
            // lbl_time
            // 
            this.lbl_time.AutoSize = true;
            this.lbl_time.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_time.Location = new System.Drawing.Point(68, 20);
            this.lbl_time.Name = "lbl_time";
            this.lbl_time.Size = new System.Drawing.Size(71, 15);
            this.lbl_time.TabIndex = 9;
            this.lbl_time.Text = "当前时间";
            // 
            // txt_time
            // 
            this.txt_time.Location = new System.Drawing.Point(145, 16);
            this.txt_time.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.txt_time.Name = "txt_time";
            this.txt_time.Size = new System.Drawing.Size(127, 25);
            this.txt_time.TabIndex = 10;
            // 
            // lbl_mode
            // 
            this.lbl_mode.AutoSize = true;
            this.lbl_mode.Location = new System.Drawing.Point(82, 54);
            this.lbl_mode.Name = "lbl_mode";
            this.lbl_mode.Size = new System.Drawing.Size(0, 15);
            this.lbl_mode.TabIndex = 1;
            // 
            // btn_apply
            // 
            this.btn_apply.Location = new System.Drawing.Point(300, 16);
            this.btn_apply.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.btn_apply.Name = "btn_apply";
            this.btn_apply.Size = new System.Drawing.Size(129, 25);
            this.btn_apply.TabIndex = 2;
            this.btn_apply.Text = "开启情景模式";
            this.btn_apply.UseVisualStyleBackColor = true;
            this.btn_apply.Click += new System.EventHandler(this.btn_apply_Click);
            // 
            // timer
            // 
            this.timer.Interval = 1000;
            this.timer.Tick += new System.EventHandler(this.timer_Tick);
            // 
            // axWindowsMediaPlayer1
            // 
            this.axWindowsMediaPlayer1.Enabled = true;
            this.axWindowsMediaPlayer1.Location = new System.Drawing.Point(12, 345);
            this.axWindowsMediaPlayer1.Name = "axWindowsMediaPlayer1";
            this.axWindowsMediaPlayer1.OcxState = ((System.Windows.Forms.AxHost.State)(resources.GetObject("axWindowsMediaPlayer1.OcxState")));
            this.axWindowsMediaPlayer1.Size = new System.Drawing.Size(175, 38);
            this.axWindowsMediaPlayer1.TabIndex = 9;
            this.axWindowsMediaPlayer1.Visible = false;
            // 
            // frm_control
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(539, 396);
            this.Controls.Add(this.axWindowsMediaPlayer1);
            this.Controls.Add(this.grp_status);
            this.Controls.Add(this.grp_input);
            this.Controls.Add(this.grp_mode);
            this.Margin = new System.Windows.Forms.Padding(3, 2, 3, 2);
            this.Name = "frm_control";
            this.Text = "智慧寝室情景控制";
            this.Load += new System.EventHandler(this.frm_control_Load);
            this.grp_status.ResumeLayout(false);
            this.grp_status.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.trb_curtain)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_boardcastStatus)).EndInit();
            this.grp_input.ResumeLayout(false);
            this.grp_input.PerformLayout();
            this.grp_mode.ResumeLayout(false);
            this.grp_mode.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.axWindowsMediaPlayer1)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox grp_status;
        private WinFormsDeviceControlLibrary.Lamp lamp;
        private System.Windows.Forms.Label lbl_windowopen;
        private System.Windows.Forms.Label lbl_windowclose;
        private System.Windows.Forms.TrackBar trb_curtain;
        private System.Windows.Forms.Label lbl_boardcast;
        private System.Windows.Forms.Label lbl_curtain;
        private System.Windows.Forms.PictureBox pic_boardcastStatus;
        private System.Windows.Forms.Label lbl_lights;
        private System.Windows.Forms.GroupBox grp_input;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.ComboBox com_import;
        private System.Windows.Forms.Label lbl_temperature;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label lbl_import;
        private System.Windows.Forms.Label lbl_humidity;
        private System.Windows.Forms.Label lbl_light;
        private System.Windows.Forms.GroupBox grp_mode;
        private System.Windows.Forms.Label lbl_mode;
        private System.Windows.Forms.Button btn_apply;
        private System.Windows.Forms.Label lbl_time;
        private System.Windows.Forms.TextBox txt_time;
        private System.Windows.Forms.Timer timer;
        private WinFormsDeviceControlLibrary.Alarm alarm1;
        private AxWMPLib.AxWindowsMediaPlayer axWindowsMediaPlayer1;
    }
}

