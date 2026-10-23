namespace 智慧校园
{
    partial class SecurityCameraData
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
            this.panel1 = new System.Windows.Forms.Panel();
            this.pic_close = new System.Windows.Forms.PictureBox();
            this.label1 = new System.Windows.Forms.Label();
            this.panel_toolBar = new System.Windows.Forms.Panel();
            this.label2 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.dateTimePicker2 = new System.Windows.Forms.DateTimePicker();
            this.dateTimePicker1 = new System.Windows.Forms.DateTimePicker();
            this.btn_get = new System.Windows.Forms.Button();
            this.lb_noData = new System.Windows.Forms.Label();
            this.lb_time = new System.Windows.Forms.Label();
            this.pic_down = new System.Windows.Forms.PictureBox();
            this.pic_up = new System.Windows.Forms.PictureBox();
            this.pic_camera = new System.Windows.Forms.PictureBox();
            this.panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_close)).BeginInit();
            this.panel_toolBar.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_down)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_up)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_camera)).BeginInit();
            this.SuspendLayout();
            // 
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(100)))), ((int)(((byte)(116)))), ((int)(((byte)(133)))));
            this.panel1.Controls.Add(this.pic_close);
            this.panel1.Controls.Add(this.label1);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(835, 53);
            this.panel1.TabIndex = 0;
            // 
            // pic_close
            // 
            this.pic_close.BackgroundImage = global::智慧校园.Properties.Resources.windowstate_closed_hover;
            this.pic_close.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
            this.pic_close.Location = new System.Drawing.Point(789, 6);
            this.pic_close.Name = "pic_close";
            this.pic_close.Size = new System.Drawing.Size(36, 42);
            this.pic_close.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pic_close.TabIndex = 1;
            this.pic_close.TabStop = false;
            this.pic_close.Click += new System.EventHandler(this.pictureBox1_Click);
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("宋体", 15F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.label1.ForeColor = System.Drawing.Color.White;
            this.label1.Location = new System.Drawing.Point(12, 12);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(129, 20);
            this.label1.TabIndex = 0;
            this.label1.Text = "历史报警记录";
            // 
            // panel_toolBar
            // 
            this.panel_toolBar.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(229)))), ((int)(((byte)(229)))), ((int)(((byte)(229)))));
            this.panel_toolBar.Controls.Add(this.label2);
            this.panel_toolBar.Controls.Add(this.label3);
            this.panel_toolBar.Controls.Add(this.dateTimePicker2);
            this.panel_toolBar.Controls.Add(this.dateTimePicker1);
            this.panel_toolBar.Controls.Add(this.btn_get);
            this.panel_toolBar.Location = new System.Drawing.Point(0, 53);
            this.panel_toolBar.Name = "panel_toolBar";
            this.panel_toolBar.Size = new System.Drawing.Size(835, 56);
            this.panel_toolBar.TabIndex = 1;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(364, 24);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(53, 12);
            this.label2.TabIndex = 19;
            this.label2.Text = "结束时间";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(88, 24);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(53, 12);
            this.label3.TabIndex = 18;
            this.label3.Text = "开始时间";
            // 
            // dateTimePicker2
            // 
            this.dateTimePicker2.Location = new System.Drawing.Point(423, 18);
            this.dateTimePicker2.Name = "dateTimePicker2";
            this.dateTimePicker2.Size = new System.Drawing.Size(200, 21);
            this.dateTimePicker2.TabIndex = 17;
            // 
            // dateTimePicker1
            // 
            this.dateTimePicker1.Location = new System.Drawing.Point(147, 18);
            this.dateTimePicker1.Name = "dateTimePicker1";
            this.dateTimePicker1.Size = new System.Drawing.Size(200, 21);
            this.dateTimePicker1.TabIndex = 16;
            // 
            // btn_get
            // 
            this.btn_get.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(109)))), ((int)(((byte)(203)))), ((int)(((byte)(81)))));
            this.btn_get.Font = new System.Drawing.Font("微软雅黑", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.btn_get.Location = new System.Drawing.Point(660, 12);
            this.btn_get.Name = "btn_get";
            this.btn_get.Size = new System.Drawing.Size(75, 32);
            this.btn_get.TabIndex = 15;
            this.btn_get.Text = "查询";
            this.btn_get.UseVisualStyleBackColor = false;
            this.btn_get.Click += new System.EventHandler(this.btn_get_Click);
            // 
            // lb_noData
            // 
            this.lb_noData.AutoSize = true;
            this.lb_noData.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(64)))), ((int)(((byte)(64)))), ((int)(((byte)(64)))));
            this.lb_noData.Font = new System.Drawing.Font("宋体", 48F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lb_noData.ForeColor = System.Drawing.Color.Red;
            this.lb_noData.Location = new System.Drawing.Point(259, 320);
            this.lb_noData.Name = "lb_noData";
            this.lb_noData.Size = new System.Drawing.Size(252, 64);
            this.lb_noData.TabIndex = 3;
            this.lb_noData.Text = "NO DATA";
            // 
            // lb_time
            // 
            this.lb_time.AutoSize = true;
            this.lb_time.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(64)))), ((int)(((byte)(64)))), ((int)(((byte)(64)))));
            this.lb_time.Font = new System.Drawing.Font("宋体", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lb_time.ForeColor = System.Drawing.Color.Red;
            this.lb_time.Location = new System.Drawing.Point(527, 539);
            this.lb_time.Name = "lb_time";
            this.lb_time.Size = new System.Drawing.Size(40, 16);
            this.lb_time.TabIndex = 4;
            this.lb_time.Text = "TIME";
            // 
            // pic_down
            // 
            this.pic_down.Image = global::智慧校园.Properties.Resources.arrow_right_normal;
            this.pic_down.Location = new System.Drawing.Point(668, 138);
            this.pic_down.Name = "pic_down";
            this.pic_down.Size = new System.Drawing.Size(67, 479);
            this.pic_down.SizeMode = System.Windows.Forms.PictureBoxSizeMode.CenterImage;
            this.pic_down.TabIndex = 6;
            this.pic_down.TabStop = false;
            this.pic_down.Click += new System.EventHandler(this.pic_down_Click);
            // 
            // pic_up
            // 
            this.pic_up.Image = global::智慧校园.Properties.Resources.arrow_left_normal;
            this.pic_up.Location = new System.Drawing.Point(49, 138);
            this.pic_up.Name = "pic_up";
            this.pic_up.Size = new System.Drawing.Size(67, 479);
            this.pic_up.SizeMode = System.Windows.Forms.PictureBoxSizeMode.CenterImage;
            this.pic_up.TabIndex = 5;
            this.pic_up.TabStop = false;
            this.pic_up.Click += new System.EventHandler(this.pic_up_Click);
            // 
            // pic_camera
            // 
            this.pic_camera.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(64)))), ((int)(((byte)(64)))), ((int)(((byte)(64)))));
            this.pic_camera.Location = new System.Drawing.Point(49, 138);
            this.pic_camera.Name = "pic_camera";
            this.pic_camera.Size = new System.Drawing.Size(686, 479);
            this.pic_camera.TabIndex = 2;
            this.pic_camera.TabStop = false;
            // 
            // SecurityCameraData
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(835, 629);
            this.Controls.Add(this.pic_down);
            this.Controls.Add(this.pic_up);
            this.Controls.Add(this.lb_time);
            this.Controls.Add(this.lb_noData);
            this.Controls.Add(this.pic_camera);
            this.Controls.Add(this.panel_toolBar);
            this.Controls.Add(this.panel1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "SecurityCameraData";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "SecurityCameraData";
            this.Load += new System.EventHandler(this.SecurityCameraData_Load);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_close)).EndInit();
            this.panel_toolBar.ResumeLayout(false);
            this.panel_toolBar.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_down)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_up)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_camera)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.PictureBox pic_close;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Panel panel_toolBar;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.DateTimePicker dateTimePicker2;
        private System.Windows.Forms.DateTimePicker dateTimePicker1;
        private System.Windows.Forms.Button btn_get;
        private System.Windows.Forms.PictureBox pic_camera;
        private System.Windows.Forms.Label lb_noData;
        private System.Windows.Forms.Label lb_time;
        private System.Windows.Forms.PictureBox pic_up;
        private System.Windows.Forms.PictureBox pic_down;
    }
}