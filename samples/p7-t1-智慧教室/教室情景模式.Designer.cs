namespace 教室情景模式
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
            this.lbl_mode = new System.Windows.Forms.Label();
            this.btn_apply = new System.Windows.Forms.Button();
            this.grp_mode = new System.Windows.Forms.GroupBox();
            this.grp_input = new System.Windows.Forms.GroupBox();
            this.txt_temperature = new System.Windows.Forms.TextBox();
            this.txt_humidity = new System.Windows.Forms.TextBox();
            this.com_import = new System.Windows.Forms.ComboBox();
            this.lbl_temperature = new System.Windows.Forms.Label();
            this.txt_light = new System.Windows.Forms.TextBox();
            this.lbl_import = new System.Windows.Forms.Label();
            this.lbl_humidity = new System.Windows.Forms.Label();
            this.lbl_light = new System.Windows.Forms.Label();
            this.grp_status = new System.Windows.Forms.GroupBox();
            this.pic_airconditioneStatus = new System.Windows.Forms.PictureBox();
            this.lbl_airconditionmin = new System.Windows.Forms.Label();
            this.lbl_airconditionmax = new System.Windows.Forms.Label();
            this.trb_airconditione = new System.Windows.Forms.TrackBar();
            this.lamp = new WinFormsDeviceControlLibrary.Lamp();
            this.lbl_airconditione = new System.Windows.Forms.Label();
            this.pic_lightsStatus = new System.Windows.Forms.PictureBox();
            this.lbl_lights = new System.Windows.Forms.Label();
            this.timer = new System.Windows.Forms.Timer(this.components);
            this.grp_mode.SuspendLayout();
            this.grp_input.SuspendLayout();
            this.grp_status.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_airconditioneStatus)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.trb_airconditione)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lightsStatus)).BeginInit();
            this.SuspendLayout();
            // 
            // lbl_mode
            // 
            this.lbl_mode.AutoSize = true;
            this.lbl_mode.Location = new System.Drawing.Point(109, 30);
            this.lbl_mode.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_mode.Name = "lbl_mode";
            this.lbl_mode.Size = new System.Drawing.Size(89, 12);
            this.lbl_mode.TabIndex = 1;
            this.lbl_mode.Text = "智慧教室将开启";
            // 
            // btn_apply
            // 
            this.btn_apply.Location = new System.Drawing.Point(285, 22);
            this.btn_apply.Margin = new System.Windows.Forms.Padding(2);
            this.btn_apply.Name = "btn_apply";
            this.btn_apply.Size = new System.Drawing.Size(55, 28);
            this.btn_apply.TabIndex = 2;
            this.btn_apply.Text = "启用";
            this.btn_apply.UseVisualStyleBackColor = true;
            this.btn_apply.Click += new System.EventHandler(this.btn_apply_Click);
            // 
            // grp_mode
            // 
            this.grp_mode.Controls.Add(this.lbl_mode);
            this.grp_mode.Controls.Add(this.btn_apply);
            this.grp_mode.Location = new System.Drawing.Point(8, 8);
            this.grp_mode.Margin = new System.Windows.Forms.Padding(2);
            this.grp_mode.Name = "grp_mode";
            this.grp_mode.Padding = new System.Windows.Forms.Padding(2);
            this.grp_mode.Size = new System.Drawing.Size(396, 59);
            this.grp_mode.TabIndex = 3;
            this.grp_mode.TabStop = false;
            this.grp_mode.Text = "模式选择";
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
            this.grp_input.Location = new System.Drawing.Point(8, 71);
            this.grp_input.Margin = new System.Windows.Forms.Padding(2);
            this.grp_input.Name = "grp_input";
            this.grp_input.Padding = new System.Windows.Forms.Padding(2);
            this.grp_input.Size = new System.Drawing.Size(133, 236);
            this.grp_input.TabIndex = 4;
            this.grp_input.TabStop = false;
            this.grp_input.Text = "采集量";
            // 
            // txt_temperature
            // 
            this.txt_temperature.Location = new System.Drawing.Point(56, 113);
            this.txt_temperature.Margin = new System.Windows.Forms.Padding(2);
            this.txt_temperature.Name = "txt_temperature";
            this.txt_temperature.Size = new System.Drawing.Size(65, 21);
            this.txt_temperature.TabIndex = 3;
            // 
            // txt_humidity
            // 
            this.txt_humidity.Location = new System.Drawing.Point(57, 160);
            this.txt_humidity.Margin = new System.Windows.Forms.Padding(2);
            this.txt_humidity.Name = "txt_humidity";
            this.txt_humidity.Size = new System.Drawing.Size(65, 21);
            this.txt_humidity.TabIndex = 3;
            // 
            // com_import
            // 
            this.com_import.FormattingEnabled = true;
            this.com_import.Location = new System.Drawing.Point(57, 20);
            this.com_import.Margin = new System.Windows.Forms.Padding(2);
            this.com_import.Name = "com_import";
            this.com_import.Size = new System.Drawing.Size(65, 20);
            this.com_import.TabIndex = 6;
            // 
            // lbl_temperature
            // 
            this.lbl_temperature.AutoSize = true;
            this.lbl_temperature.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_temperature.Location = new System.Drawing.Point(22, 117);
            this.lbl_temperature.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_temperature.Name = "lbl_temperature";
            this.lbl_temperature.Size = new System.Drawing.Size(31, 12);
            this.lbl_temperature.TabIndex = 1;
            this.lbl_temperature.Text = "温度";
            // 
            // txt_light
            // 
            this.txt_light.Location = new System.Drawing.Point(57, 67);
            this.txt_light.Margin = new System.Windows.Forms.Padding(2);
            this.txt_light.Name = "txt_light";
            this.txt_light.Size = new System.Drawing.Size(65, 21);
            this.txt_light.TabIndex = 2;
            // 
            // lbl_import
            // 
            this.lbl_import.AutoSize = true;
            this.lbl_import.Location = new System.Drawing.Point(23, 23);
            this.lbl_import.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_import.Name = "lbl_import";
            this.lbl_import.Size = new System.Drawing.Size(29, 12);
            this.lbl_import.TabIndex = 1;
            this.lbl_import.Text = "串口";
            // 
            // lbl_humidity
            // 
            this.lbl_humidity.AutoSize = true;
            this.lbl_humidity.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_humidity.Location = new System.Drawing.Point(23, 163);
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
            this.lbl_light.Location = new System.Drawing.Point(11, 70);
            this.lbl_light.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_light.Name = "lbl_light";
            this.lbl_light.Size = new System.Drawing.Size(44, 12);
            this.lbl_light.TabIndex = 0;
            this.lbl_light.Text = "光照度";
            // 
            // grp_status
            // 
            this.grp_status.Controls.Add(this.pic_airconditioneStatus);
            this.grp_status.Controls.Add(this.lbl_airconditionmin);
            this.grp_status.Controls.Add(this.lbl_airconditionmax);
            this.grp_status.Controls.Add(this.trb_airconditione);
            this.grp_status.Controls.Add(this.lamp);
            this.grp_status.Controls.Add(this.lbl_airconditione);
            this.grp_status.Controls.Add(this.pic_lightsStatus);
            this.grp_status.Controls.Add(this.lbl_lights);
            this.grp_status.Location = new System.Drawing.Point(145, 71);
            this.grp_status.Margin = new System.Windows.Forms.Padding(2);
            this.grp_status.Name = "grp_status";
            this.grp_status.Padding = new System.Windows.Forms.Padding(2);
            this.grp_status.Size = new System.Drawing.Size(259, 236);
            this.grp_status.TabIndex = 5;
            this.grp_status.TabStop = false;
            this.grp_status.Text = "状态栏";
            // 
            // pic_airconditioneStatus
            // 
            this.pic_airconditioneStatus.Image = global::教室情景模式.Properties.Resources.switch_off;
            this.pic_airconditioneStatus.Location = new System.Drawing.Point(58, 27);
            this.pic_airconditioneStatus.Margin = new System.Windows.Forms.Padding(2);
            this.pic_airconditioneStatus.Name = "pic_airconditioneStatus";
            this.pic_airconditioneStatus.Size = new System.Drawing.Size(33, 17);
            this.pic_airconditioneStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_airconditioneStatus.TabIndex = 6;
            this.pic_airconditioneStatus.TabStop = false;
            // 
            // lbl_airconditionmin
            // 
            this.lbl_airconditionmin.AutoSize = true;
            this.lbl_airconditionmin.Location = new System.Drawing.Point(10, 87);
            this.lbl_airconditionmin.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_airconditionmin.Name = "lbl_airconditionmin";
            this.lbl_airconditionmin.Size = new System.Drawing.Size(29, 12);
            this.lbl_airconditionmin.TabIndex = 5;
            this.lbl_airconditionmin.Text = "18℃";
            // 
            // lbl_airconditionmax
            // 
            this.lbl_airconditionmax.AutoSize = true;
            this.lbl_airconditionmax.Location = new System.Drawing.Point(95, 87);
            this.lbl_airconditionmax.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_airconditionmax.Name = "lbl_airconditionmax";
            this.lbl_airconditionmax.Size = new System.Drawing.Size(29, 12);
            this.lbl_airconditionmax.TabIndex = 5;
            this.lbl_airconditionmax.Text = "32℃";
            // 
            // trb_airconditione
            // 
            this.trb_airconditione.Location = new System.Drawing.Point(12, 53);
            this.trb_airconditione.Margin = new System.Windows.Forms.Padding(2);
            this.trb_airconditione.Maximum = 32;
            this.trb_airconditione.Minimum = 18;
            this.trb_airconditione.Name = "trb_airconditione";
            this.trb_airconditione.Size = new System.Drawing.Size(107, 45);
            this.trb_airconditione.TabIndex = 4;
            this.trb_airconditione.Value = 18;
            // 
            // lamp
            // 
            this.lamp.BackColor = System.Drawing.Color.Transparent;
            this.lamp.Location = new System.Drawing.Point(139, 40);
            this.lamp.Name = "lamp";
            this.lamp.Size = new System.Drawing.Size(105, 180);
            this.lamp.TabIndex = 3;
            // 
            // lbl_airconditione
            // 
            this.lbl_airconditione.AutoSize = true;
            this.lbl_airconditione.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_airconditione.Location = new System.Drawing.Point(10, 27);
            this.lbl_airconditione.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_airconditione.Name = "lbl_airconditione";
            this.lbl_airconditione.Size = new System.Drawing.Size(31, 12);
            this.lbl_airconditione.TabIndex = 2;
            this.lbl_airconditione.Text = "空调";
            // 
            // pic_lightsStatus
            // 
            this.pic_lightsStatus.Image = global::教室情景模式.Properties.Resources.switch_off;
            this.pic_lightsStatus.Location = new System.Drawing.Point(204, 19);
            this.pic_lightsStatus.Margin = new System.Windows.Forms.Padding(2);
            this.pic_lightsStatus.Name = "pic_lightsStatus";
            this.pic_lightsStatus.Size = new System.Drawing.Size(33, 17);
            this.pic_lightsStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_lightsStatus.TabIndex = 1;
            this.pic_lightsStatus.TabStop = false;
            this.pic_lightsStatus.Click += new System.EventHandler(this.pic_lightsStatus_Click);
            // 
            // lbl_lights
            // 
            this.lbl_lights.AutoSize = true;
            this.lbl_lights.Font = new System.Drawing.Font("宋体", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lbl_lights.Location = new System.Drawing.Point(161, 19);
            this.lbl_lights.Margin = new System.Windows.Forms.Padding(2, 0, 2, 0);
            this.lbl_lights.Name = "lbl_lights";
            this.lbl_lights.Size = new System.Drawing.Size(31, 12);
            this.lbl_lights.TabIndex = 0;
            this.lbl_lights.Text = "灯光";
            // 
            // timer
            // 
            this.timer.Interval = 2000;
            this.timer.Tick += new System.EventHandler(this.timer_Tick);
            // 
            // frm_control
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(417, 315);
            this.Controls.Add(this.grp_status);
            this.Controls.Add(this.grp_input);
            this.Controls.Add(this.grp_mode);
            this.Margin = new System.Windows.Forms.Padding(2);
            this.Name = "frm_control";
            this.Text = "智慧教室情景控制";
            this.Load += new System.EventHandler(this.frm_control_Load);
            this.grp_mode.ResumeLayout(false);
            this.grp_mode.PerformLayout();
            this.grp_input.ResumeLayout(false);
            this.grp_input.PerformLayout();
            this.grp_status.ResumeLayout(false);
            this.grp_status.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_airconditioneStatus)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.trb_airconditione)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_lightsStatus)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Label lbl_mode;
        private System.Windows.Forms.Button btn_apply;
        private System.Windows.Forms.GroupBox grp_mode;
        private System.Windows.Forms.GroupBox grp_input;
        private System.Windows.Forms.TextBox txt_humidity;
        private System.Windows.Forms.TextBox txt_light;
        private System.Windows.Forms.Label lbl_humidity;
        private System.Windows.Forms.Label lbl_light;
        private System.Windows.Forms.GroupBox grp_status;
        private System.Windows.Forms.Label lbl_lights;
        private System.Windows.Forms.TextBox txt_temperature;
        private System.Windows.Forms.Label lbl_temperature;
        private System.Windows.Forms.ComboBox com_import;
        private System.Windows.Forms.Label lbl_import;
        private System.Windows.Forms.Timer timer;
        private System.Windows.Forms.PictureBox pic_lightsStatus;
        private WinFormsDeviceControlLibrary.Lamp lamp;
        private System.Windows.Forms.Label lbl_airconditionmin;
        private System.Windows.Forms.Label lbl_airconditionmax;
        private System.Windows.Forms.TrackBar trb_airconditione;
        private System.Windows.Forms.Label lbl_airconditione;
        private System.Windows.Forms.PictureBox pic_airconditioneStatus;
    }
}

