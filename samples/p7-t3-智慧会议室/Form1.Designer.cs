namespace 会议室情景模式
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
            this.grp_status = new System.Windows.Forms.GroupBox();
            this.lbl_subMicrophone = new System.Windows.Forms.Label();
            this.lbl_mainMicrophone = new System.Windows.Forms.Label();
            this.lamp = new WinFormsDeviceControlLibrary.Lamp();
            this.lbl_curtainopen = new System.Windows.Forms.Label();
            this.lbl_curtainclose = new System.Windows.Forms.Label();
            this.trb_curtain = new System.Windows.Forms.TrackBar();
            this.lbl_microphone = new System.Windows.Forms.Label();
            this.lbl_curtain = new System.Windows.Forms.Label();
            this.pic_lightsStatus = new System.Windows.Forms.PictureBox();
            this.pic_subMicrophone = new System.Windows.Forms.PictureBox();
            this.pic_mainMicrophone = new System.Windows.Forms.PictureBox();
            this.lbl_lights = new System.Windows.Forms.Label();
            this.grp_input = new System.Windows.Forms.GroupBox();
            this.lbl_camera = new System.Windows.Forms.Label();
            this.txt_camera = new System.Windows.Forms.TextBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_airQuality = new System.Windows.Forms.TextBox();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.com_import = new System.Windows.Forms.ComboBox();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.txt_airPressure = new System.Windows.Forms.TextBox();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_import = new System.Windows.Forms.Label();
            this.lbl_airQuality = new System.Windows.Forms.Label();
            this.lbl_airPressure = new System.Windows.Forms.Label();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.grp_mode = new System.Windows.Forms.GroupBox();
            this.com_mode = new System.Windows.Forms.ComboBox();
            this.lbl_second = new System.Windows.Forms.Label();
            this.lbl_minute = new System.Windows.Forms.Label();
            this.lbl_hour = new System.Windows.Forms.Label();
            this.lbl_time = new System.Windows.Forms.Label();
            this.txt_second = new System.Windows.Forms.TextBox();
            this.txt_minute = new System.Windows.Forms.TextBox();
            this.txt_hour = new System.Windows.Forms.TextBox();
            this.chk_record = new System.Windows.Forms.CheckBox();
            this.lbl_mode = new System.Windows.Forms.Label();
            this.btn_exit = new System.Windows.Forms.Button();
            this.btn_reserve = new System.Windows.Forms.Button();
            this.timer = new System.Windows.Forms.Timer(this.components);
            this.grp_status.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.trb_curtain)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lightsStatus)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_subMicrophone)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_mainMicrophone)).BeginInit();
            this.grp_input.SuspendLayout();
            this.grp_mode.SuspendLayout();
            this.SuspendLayout();
            // 
            // grp_status
            // 
            this.grp_status.Controls.Add(this.lbl_subMicrophone);
            this.grp_status.Controls.Add(this.lbl_mainMicrophone);
            this.grp_status.Controls.Add(this.lamp);
            this.grp_status.Controls.Add(this.lbl_curtainopen);
            this.grp_status.Controls.Add(this.lbl_curtainclose);
            this.grp_status.Controls.Add(this.trb_curtain);
            this.grp_status.Controls.Add(this.lbl_microphone);
            this.grp_status.Controls.Add(this.lbl_curtain);
            this.grp_status.Controls.Add(this.pic_lightsStatus);
            this.grp_status.Controls.Add(this.pic_subMicrophone);
            this.grp_status.Controls.Add(this.pic_mainMicrophone);
            this.grp_status.Controls.Add(this.lbl_lights);
            this.grp_status.Location = new System.Drawing.Point(145, 100);
            this.grp_status.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_status.Name = "grp_status";
            this.grp_status.Padding = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_status.Size = new System.Drawing.Size(294, 270);
            this.grp_status.TabIndex = 11;
            this.grp_status.TabStop = false;
            this.grp_status.Text = "状态栏";
            // 
            // lbl_subMicrophone
            // 
            this.lbl_subMicrophone.AutoSize = true;
            this.lbl_subMicrophone.Location = new System.Drawing.Point(113, 140);
            this.lbl_subMicrophone.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_subMicrophone.Name = "lbl_subMicrophone";
            this.lbl_subMicrophone.Size = new System.Drawing.Size(17, 12);
            this.lbl_subMicrophone.TabIndex = 7;
            this.lbl_subMicrophone.Text = "客";
            // 
            // lbl_mainMicrophone
            // 
            this.lbl_mainMicrophone.AutoSize = true;
            this.lbl_mainMicrophone.Location = new System.Drawing.Point(64, 140);
            this.lbl_mainMicrophone.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_mainMicrophone.Name = "lbl_mainMicrophone";
            this.lbl_mainMicrophone.Size = new System.Drawing.Size(17, 12);
            this.lbl_mainMicrophone.TabIndex = 7;
            this.lbl_mainMicrophone.Text = "主";
            // 
            // lamp
            // 
            this.lamp.BackColor = System.Drawing.Color.White;
            this.lamp.Location = new System.Drawing.Point(175, 65);
            this.lamp.Name = "lamp";
            this.lamp.Size = new System.Drawing.Size(104, 177);
            this.lamp.TabIndex = 6;
            // 
            // lbl_curtainopen
            // 
            this.lbl_curtainopen.AutoSize = true;
            this.lbl_curtainopen.Location = new System.Drawing.Point(10, 74);
            this.lbl_curtainopen.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_curtainopen.Name = "lbl_curtainopen";
            this.lbl_curtainopen.Size = new System.Drawing.Size(29, 12);
            this.lbl_curtainopen.TabIndex = 5;
            this.lbl_curtainopen.Text = "全开";
            // 
            // lbl_curtainclose
            // 
            this.lbl_curtainclose.AutoSize = true;
            this.lbl_curtainclose.Location = new System.Drawing.Point(95, 74);
            this.lbl_curtainclose.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_curtainclose.Name = "lbl_curtainclose";
            this.lbl_curtainclose.Size = new System.Drawing.Size(29, 12);
            this.lbl_curtainclose.TabIndex = 5;
            this.lbl_curtainclose.Text = "全关";
            // 
            // trb_curtain
            // 
            this.trb_curtain.Location = new System.Drawing.Point(12, 47);
            this.trb_curtain.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.trb_curtain.Name = "trb_curtain";
            this.trb_curtain.Size = new System.Drawing.Size(107, 45);
            this.trb_curtain.TabIndex = 4;
            this.trb_curtain.Value = 10;
            // 
            // lbl_microphone
            // 
            this.lbl_microphone.AutoSize = true;
            this.lbl_microphone.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_microphone.Location = new System.Drawing.Point(10, 121);
            this.lbl_microphone.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_microphone.Name = "lbl_microphone";
            this.lbl_microphone.Size = new System.Drawing.Size(31, 12);
            this.lbl_microphone.TabIndex = 2;
            this.lbl_microphone.Text = "话筒";
            // 
            // lbl_curtain
            // 
            this.lbl_curtain.AutoSize = true;
            this.lbl_curtain.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_curtain.Location = new System.Drawing.Point(10, 35);
            this.lbl_curtain.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_curtain.Name = "lbl_curtain";
            this.lbl_curtain.Size = new System.Drawing.Size(31, 12);
            this.lbl_curtain.TabIndex = 2;
            this.lbl_curtain.Text = "窗帘";
            // 
            // pic_lightsStatus
            // 
            this.pic_lightsStatus.Image = global::会议室情景模式.Properties.Resources.switch_off;
            this.pic_lightsStatus.Location = new System.Drawing.Point(211, 35);
            this.pic_lightsStatus.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.pic_lightsStatus.Name = "pic_lightsStatus";
            this.pic_lightsStatus.Size = new System.Drawing.Size(33, 17);
            this.pic_lightsStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_lightsStatus.TabIndex = 1;
            this.pic_lightsStatus.TabStop = false;
            this.pic_lightsStatus.Click += new System.EventHandler(this.pic_lightsStatus_Click);
            // 
            // pic_subMicrophone
            // 
            this.pic_subMicrophone.Image = global::会议室情景模式.Properties.Resources.switch_off;
            this.pic_subMicrophone.Location = new System.Drawing.Point(105, 118);
            this.pic_subMicrophone.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.pic_subMicrophone.Name = "pic_subMicrophone";
            this.pic_subMicrophone.Size = new System.Drawing.Size(33, 17);
            this.pic_subMicrophone.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_subMicrophone.TabIndex = 1;
            this.pic_subMicrophone.TabStop = false;
            this.pic_subMicrophone.Click += new System.EventHandler(this.pic_subMicrophone_Click);
            // 
            // pic_mainMicrophone
            // 
            this.pic_mainMicrophone.Image = global::会议室情景模式.Properties.Resources.switch_off;
            this.pic_mainMicrophone.Location = new System.Drawing.Point(57, 118);
            this.pic_mainMicrophone.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.pic_mainMicrophone.Name = "pic_mainMicrophone";
            this.pic_mainMicrophone.Size = new System.Drawing.Size(33, 17);
            this.pic_mainMicrophone.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_mainMicrophone.TabIndex = 1;
            this.pic_mainMicrophone.TabStop = false;
            this.pic_mainMicrophone.Click += new System.EventHandler(this.pic_mainMicrophone_Click);
            // 
            // lbl_lights
            // 
            this.lbl_lights.AutoSize = true;
            this.lbl_lights.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_lights.Location = new System.Drawing.Point(213, 21);
            this.lbl_lights.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_lights.Name = "lbl_lights";
            this.lbl_lights.Size = new System.Drawing.Size(31, 12);
            this.lbl_lights.TabIndex = 0;
            this.lbl_lights.Text = "灯光";
            // 
            // grp_input
            // 
            this.grp_input.Controls.Add(this.lbl_camera);
            this.grp_input.Controls.Add(this.txt_camera);
            this.grp_input.Controls.Add(this.txt_temperature);
            this.grp_input.Controls.Add(this.txt_airQuality);
            this.grp_input.Controls.Add(this.txt_humidity);
            this.grp_input.Controls.Add(this.com_import);
            this.grp_input.Controls.Add(this.lbl_temperature);
            this.grp_input.Controls.Add(this.txt_airPressure);
            this.grp_input.Controls.Add(this.txt_light);
            this.grp_input.Controls.Add(this.lbl_import);
            this.grp_input.Controls.Add(this.lbl_airQuality);
            this.grp_input.Controls.Add(this.lbl_airPressure);
            this.grp_input.Controls.Add(this.lbl_humidity);
            this.grp_input.Controls.Add(this.lbl_light);
            this.grp_input.Location = new System.Drawing.Point(8, 100);
            this.grp_input.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_input.Name = "grp_input";
            this.grp_input.Padding = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_input.Size = new System.Drawing.Size(133, 270);
            this.grp_input.TabIndex = 10;
            this.grp_input.TabStop = false;
            this.grp_input.Text = "采集量";
            // 
            // lbl_camera
            // 
            this.lbl_camera.AutoSize = true;
            this.lbl_camera.Location = new System.Drawing.Point(26, 222);
            this.lbl_camera.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_camera.Name = "lbl_camera";
            this.lbl_camera.Size = new System.Drawing.Size(77, 12);
            this.lbl_camera.TabIndex = 8;
            this.lbl_camera.Text = "摄像头IP地址";
            // 
            // txt_camera
            // 
            this.txt_camera.Location = new System.Drawing.Point(19, 244);
            this.txt_camera.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_camera.Name = "txt_camera";
            this.txt_camera.Size = new System.Drawing.Size(95, 21);
            this.txt_camera.TabIndex = 9;
            this.txt_camera.Text = "192.168.14.131";
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(62, 80);
            this.txt_temperature.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(65, 21);
            this.txt_temperature.TabIndex = 3;
            // 
            // txt_airQuality
            // 
            this.txt_airQuality.Location = new System.Drawing.Point(62, 190);
            this.txt_airQuality.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_airQuality.Name = "txt_airQuality";
            this.txt_airQuality.Size = new System.Drawing.Size(65, 21);
            this.txt_airQuality.TabIndex = 3;
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(62, 117);
            this.txt_humidity.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(65, 21);
            this.txt_humidity.TabIndex = 3;
            // 
            // com_import
            // 
            this.com_import.FormattingEnabled = true;
            this.com_import.Location = new System.Drawing.Point(57, 13);
            this.com_import.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.com_import.Name = "com_import";
            this.com_import.Size = new System.Drawing.Size(65, 20);
            this.com_import.TabIndex = 6;
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_temperature.Location = new System.Drawing.Point(30, 83);
            this.lbl_temperature.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(31, 12);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // txt_airPressure
            // 
            this.txt_airPressure.Location = new System.Drawing.Point(62, 153);
            this.txt_airPressure.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_airPressure.Name = "txt_airPressure";
            this.txt_airPressure.Size = new System.Drawing.Size(65, 21);
            this.txt_airPressure.TabIndex = 2;
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(62, 43);
            this.txt_light.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(65, 21);
            this.txt_light.TabIndex = 2;
            // 
            // lbl_import
            // 
            this.lbl_import.AutoSize = true;
            this.lbl_import.Location = new System.Drawing.Point(23, 17);
            this.lbl_import.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_import.Name = "lbl_import";
            this.lbl_import.Size = new System.Drawing.Size(29, 12);
            this.lbl_import.TabIndex = 1;
            this.lbl_import.Text = "串口";
            // 
            // lbl_airQuality
            // 
            this.lbl_airQuality.AutoSize = true;
            this.lbl_airQuality.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_airQuality.Location = new System.Drawing.Point(5, 193);
            this.lbl_airQuality.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_airQuality.Name = "lbl_airQuality";
            this.lbl_airQuality.Size = new System.Drawing.Size(57, 12);
            this.lbl_airQuality.TabIndex = 1;
            this.lbl_airQuality.Text = "空气质量";
            // 
            // lbl_airPressure
            // 
            this.lbl_airPressure.AutoSize = true;
            this.lbl_airPressure.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_airPressure.Location = new System.Drawing.Point(30, 157);
            this.lbl_airPressure.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_airPressure.Name = "lbl_airPressure";
            this.lbl_airPressure.Size = new System.Drawing.Size(31, 12);
            this.lbl_airPressure.TabIndex = 0;
            this.lbl_airPressure.Text = "气压";
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_humidity.Location = new System.Drawing.Point(30, 120);
            this.lbl_humidity.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_humidity.Name = "lbl_humidity";
            this.lbl_humidity.Size = new System.Drawing.Size(31, 12);
            this.lbl_humidity.TabIndex = 1;
            this.lbl_humidity.Text = "湿度";
            // 
            // lbl_light
            // 
            this.lbl_light.AutoSize = true;
            this.lbl_light.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_light.Location = new System.Drawing.Point(17, 47);
            this.lbl_light.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(44, 12);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // grp_mode
            // 
            this.grp_mode.Controls.Add(this.com_mode);
            this.grp_mode.Controls.Add(this.lbl_second);
            this.grp_mode.Controls.Add(this.lbl_minute);
            this.grp_mode.Controls.Add(this.lbl_hour);
            this.grp_mode.Controls.Add(this.lbl_time);
            this.grp_mode.Controls.Add(this.txt_second);
            this.grp_mode.Controls.Add(this.txt_minute);
            this.grp_mode.Controls.Add(this.txt_hour);
            this.grp_mode.Controls.Add(this.chk_record);
            this.grp_mode.Controls.Add(this.lbl_mode);
            this.grp_mode.Controls.Add(this.btn_exit);
            this.grp_mode.Controls.Add(this.btn_reserve);
            this.grp_mode.Location = new System.Drawing.Point(8, 8);
            this.grp_mode.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_mode.Name = "grp_mode";
            this.grp_mode.Padding = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.grp_mode.Size = new System.Drawing.Size(431, 88);
            this.grp_mode.TabIndex = 9;
            this.grp_mode.TabStop = false;
            this.grp_mode.Text = "模式选择";
            // 
            // com_mode
            // 
            this.com_mode.FormattingEnabled = true;
            this.com_mode.Location = new System.Drawing.Point(191, 53);
            this.com_mode.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.com_mode.Name = "com_mode";
            this.com_mode.Size = new System.Drawing.Size(61, 20);
            this.com_mode.TabIndex = 12;
            this.com_mode.Text = "会议";
            // 
            // lbl_second
            // 
            this.lbl_second.AutoSize = true;
            this.lbl_second.Location = new System.Drawing.Point(127, 57);
            this.lbl_second.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_second.Name = "lbl_second";
            this.lbl_second.Size = new System.Drawing.Size(65, 12);
            this.lbl_second.TabIndex = 11;
            this.lbl_second.Text = "秒将会有场";
            // 
            // lbl_minute
            // 
            this.lbl_minute.AutoSize = true;
            this.lbl_minute.Location = new System.Drawing.Point(91, 57);
            this.lbl_minute.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_minute.Name = "lbl_minute";
            this.lbl_minute.Size = new System.Drawing.Size(17, 12);
            this.lbl_minute.TabIndex = 11;
            this.lbl_minute.Text = "分";
            // 
            // lbl_hour
            // 
            this.lbl_hour.AutoSize = true;
            this.lbl_hour.Location = new System.Drawing.Point(56, 57);
            this.lbl_hour.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_hour.Name = "lbl_hour";
            this.lbl_hour.Size = new System.Drawing.Size(17, 12);
            this.lbl_hour.TabIndex = 11;
            this.lbl_hour.Text = "时";
            // 
            // lbl_time
            // 
            this.lbl_time.AutoSize = true;
            this.lbl_time.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_time.Location = new System.Drawing.Point(17, 27);
            this.lbl_time.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_time.Name = "lbl_time";
            this.lbl_time.Size = new System.Drawing.Size(126, 12);
            this.lbl_time.TabIndex = 9;
            this.lbl_time.Text = "当前时间：00:00:00";
            // 
            // txt_second
            // 
            this.txt_second.Location = new System.Drawing.Point(109, 53);
            this.txt_second.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_second.Name = "txt_second";
            this.txt_second.Size = new System.Drawing.Size(19, 21);
            this.txt_second.TabIndex = 10;
            this.txt_second.Text = "00";
            // 
            // txt_minute
            // 
            this.txt_minute.Location = new System.Drawing.Point(73, 53);
            this.txt_minute.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_minute.Name = "txt_minute";
            this.txt_minute.Size = new System.Drawing.Size(19, 21);
            this.txt_minute.TabIndex = 10;
            this.txt_minute.Text = "20";
            // 
            // txt_hour
            // 
            this.txt_hour.Location = new System.Drawing.Point(38, 53);
            this.txt_hour.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.txt_hour.Name = "txt_hour";
            this.txt_hour.Size = new System.Drawing.Size(19, 21);
            this.txt_hour.TabIndex = 10;
            this.txt_hour.Text = "13";
            // 
            // chk_record
            // 
            this.chk_record.AutoSize = true;
            this.chk_record.Location = new System.Drawing.Point(344, 26);
            this.chk_record.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.chk_record.Name = "chk_record";
            this.chk_record.Size = new System.Drawing.Size(72, 16);
            this.chk_record.TabIndex = 3;
            this.chk_record.Text = "拍照记录";
            this.chk_record.UseVisualStyleBackColor = true;
            // 
            // lbl_mode
            // 
            this.lbl_mode.AutoSize = true;
            this.lbl_mode.Location = new System.Drawing.Point(162, 27);
            this.lbl_mode.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_mode.Name = "lbl_mode";
            this.lbl_mode.Size = new System.Drawing.Size(149, 12);
            this.lbl_mode.TabIndex = 1;
            this.lbl_mode.Text = "智慧会议室未开启情景模式";
            // 
            // btn_exit
            // 
            this.btn_exit.Location = new System.Drawing.Point(345, 49);
            this.btn_exit.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.btn_exit.Name = "btn_exit";
            this.btn_exit.Size = new System.Drawing.Size(51, 27);
            this.btn_exit.TabIndex = 2;
            this.btn_exit.Text = "退出";
            this.btn_exit.UseVisualStyleBackColor = true;
            this.btn_exit.Click += new System.EventHandler(this.btn_exit_Click);
            // 
            // btn_reserve
            // 
            this.btn_reserve.Location = new System.Drawing.Point(277, 49);
            this.btn_reserve.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.btn_reserve.Name = "btn_reserve";
            this.btn_reserve.Size = new System.Drawing.Size(51, 27);
            this.btn_reserve.TabIndex = 2;
            this.btn_reserve.Text = "预约";
            this.btn_reserve.UseVisualStyleBackColor = true;
            this.btn_reserve.Click += new System.EventHandler(this.btn_reserve_Click);
            // 
            // timer
            // 
            this.timer.Interval = 1000;
            this.timer.Tick += new System.EventHandler(this.timer_Tick);
            // 
            // frm_control
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(447, 376);
            this.Controls.Add(this.grp_status);
            this.Controls.Add(this.grp_input);
            this.Controls.Add(this.grp_mode);
            this.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.Name = "frm_control";
            this.Text = "智慧会议室情景模式";
            this.Load += new System.EventHandler(this.frm_control_Load);
            this.grp_status.ResumeLayout(false);
            this.grp_status.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.trb_curtain)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lightsStatus)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_subMicrophone)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_mainMicrophone)).EndInit();
            this.grp_input.ResumeLayout(false);
            this.grp_input.PerformLayout();
            this.grp_mode.ResumeLayout(false);
            this.grp_mode.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox grp_status;
        private WinFormsDeviceControlLibrary.Lamp lamp;
        private System.Windows.Forms.Label lbl_curtainopen;
        private System.Windows.Forms.Label lbl_curtainclose;
        private System.Windows.Forms.TrackBar trb_curtain;
        private System.Windows.Forms.Label lbl_microphone;
        private System.Windows.Forms.Label lbl_curtain;
        private System.Windows.Forms.PictureBox pic_lightsStatus;
        private System.Windows.Forms.PictureBox pic_mainMicrophone;
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
        private System.Windows.Forms.Label lbl_time;
        private System.Windows.Forms.TextBox txt_hour;
        private System.Windows.Forms.CheckBox chk_record;
        private System.Windows.Forms.Label lbl_mode;
        private System.Windows.Forms.Button btn_reserve;
        private System.Windows.Forms.TextBox txt_airQuality;
        private System.Windows.Forms.TextBox txt_airPressure;
        private System.Windows.Forms.Label lbl_airQuality;
        private System.Windows.Forms.Label lbl_airPressure;
        private System.Windows.Forms.ComboBox com_mode;
        private System.Windows.Forms.Label lbl_second;
        private System.Windows.Forms.Label lbl_minute;
        private System.Windows.Forms.Label lbl_hour;
        private System.Windows.Forms.TextBox txt_second;
        private System.Windows.Forms.TextBox txt_minute;
        private System.Windows.Forms.Timer timer;
        private System.Windows.Forms.Button btn_exit;
        private System.Windows.Forms.Label lbl_subMicrophone;
        private System.Windows.Forms.Label lbl_mainMicrophone;
        private System.Windows.Forms.PictureBox pic_subMicrophone;
        private System.Windows.Forms.Label lbl_camera;
        private System.Windows.Forms.TextBox txt_camera;
    }
}

