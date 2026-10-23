namespace 智慧校园
{
    partial class Security
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
            this.panel3 = new System.Windows.Forms.Panel();
            this.lb_return = new System.Windows.Forms.Label();
            this.panel1 = new System.Windows.Forms.Panel();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.panel_bg_video = new System.Windows.Forms.Panel();
            this.btn_history = new System.Windows.Forms.Button();
            this.btn_camera = new System.Windows.Forms.Button();
            this.panel_video_ctrl = new System.Windows.Forms.Panel();
            this.pic_left = new System.Windows.Forms.PictureBox();
            this.pic_right = new System.Windows.Forms.PictureBox();
            this.pic_down = new System.Windows.Forms.PictureBox();
            this.pic_up = new System.Windows.Forms.PictureBox();
            this.panel2 = new System.Windows.Forms.Panel();
            this.label2 = new System.Windows.Forms.Label();
            this.lb_infrared = new System.Windows.Forms.Label();
            this.pic_video = new System.Windows.Forms.PictureBox();
            this.panel3.SuspendLayout();
            this.panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.panel_bg_video.SuspendLayout();
            this.panel_video_ctrl.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_left)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_right)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_down)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_up)).BeginInit();
            this.panel2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_video)).BeginInit();
            this.SuspendLayout();
            // 
            // panel3
            // 
            this.panel3.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(229)))), ((int)(((byte)(229)))), ((int)(((byte)(229)))));
            this.panel3.Controls.Add(this.lb_return);
            this.panel3.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel3.Location = new System.Drawing.Point(0, 100);
            this.panel3.Name = "panel3";
            this.panel3.Size = new System.Drawing.Size(1081, 39);
            this.panel3.TabIndex = 1;
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
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(100)))), ((int)(((byte)(116)))), ((int)(((byte)(133)))));
            this.panel1.Controls.Add(this.pictureBox1);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(1081, 100);
            this.panel1.TabIndex = 2;
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
            // panel_bg_video
            // 
            this.panel_bg_video.BackColor = System.Drawing.Color.White;
            this.panel_bg_video.Controls.Add(this.btn_history);
            this.panel_bg_video.Controls.Add(this.btn_camera);
            this.panel_bg_video.Controls.Add(this.panel_video_ctrl);
            this.panel_bg_video.Controls.Add(this.panel2);
            this.panel_bg_video.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel_bg_video.Location = new System.Drawing.Point(0, 139);
            this.panel_bg_video.Name = "panel_bg_video";
            this.panel_bg_video.Size = new System.Drawing.Size(1081, 499);
            this.panel_bg_video.TabIndex = 3;
            this.panel_bg_video.Paint += new System.Windows.Forms.PaintEventHandler(this.panel_bg_video_Paint);
            // 
            // btn_history
            // 
            this.btn_history.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(143)))), ((int)(((byte)(213)))), ((int)(((byte)(122)))));
            this.btn_history.Font = new System.Drawing.Font("微软雅黑", 14F);
            this.btn_history.Location = new System.Drawing.Point(804, 410);
            this.btn_history.Name = "btn_history";
            this.btn_history.Size = new System.Drawing.Size(160, 49);
            this.btn_history.TabIndex = 10;
            this.btn_history.Text = "查看历史图像";
            this.btn_history.UseVisualStyleBackColor = false;
            this.btn_history.Click += new System.EventHandler(this.btn_history_Click);
            // 
            // btn_camera
            // 
            this.btn_camera.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(109)))), ((int)(((byte)(200)))), ((int)(((byte)(81)))));
            this.btn_camera.Font = new System.Drawing.Font("微软雅黑", 16F);
            this.btn_camera.Location = new System.Drawing.Point(804, 326);
            this.btn_camera.Name = "btn_camera";
            this.btn_camera.Size = new System.Drawing.Size(160, 49);
            this.btn_camera.TabIndex = 9;
            this.btn_camera.Text = "拍照";
            this.btn_camera.UseVisualStyleBackColor = false;
            this.btn_camera.Click += new System.EventHandler(this.btn_camera_Click);
            // 
            // panel_video_ctrl
            // 
            this.panel_video_ctrl.BackgroundImage = global::智慧校园.Properties.Resources.panel_video_ctrl;
            this.panel_video_ctrl.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.panel_video_ctrl.Controls.Add(this.pic_left);
            this.panel_video_ctrl.Controls.Add(this.pic_right);
            this.panel_video_ctrl.Controls.Add(this.pic_down);
            this.panel_video_ctrl.Controls.Add(this.pic_up);
            this.panel_video_ctrl.Location = new System.Drawing.Point(741, 15);
            this.panel_video_ctrl.Name = "panel_video_ctrl";
            this.panel_video_ctrl.Size = new System.Drawing.Size(328, 294);
            this.panel_video_ctrl.TabIndex = 1;
            // 
            // pic_left
            // 
            this.pic_left.BackgroundImage = global::智慧校园.Properties.Resources.btn_arrow_left_normal;
            this.pic_left.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.pic_left.Location = new System.Drawing.Point(63, 116);
            this.pic_left.Name = "pic_left";
            this.pic_left.Size = new System.Drawing.Size(39, 54);
            this.pic_left.TabIndex = 6;
            this.pic_left.TabStop = false;
            this.pic_left.MouseDown += new System.Windows.Forms.MouseEventHandler(this.pic_left_MouseDown);
            this.pic_left.MouseUp += new System.Windows.Forms.MouseEventHandler(this.pic_left_MouseUp);
            // 
            // pic_right
            // 
            this.pic_right.BackgroundImage = global::智慧校园.Properties.Resources.btn_arrow_right_normal;
            this.pic_right.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.pic_right.Location = new System.Drawing.Point(223, 116);
            this.pic_right.Name = "pic_right";
            this.pic_right.Size = new System.Drawing.Size(39, 54);
            this.pic_right.TabIndex = 5;
            this.pic_right.TabStop = false;
            this.pic_right.MouseDown += new System.Windows.Forms.MouseEventHandler(this.pic_right_MouseDown);
            this.pic_right.MouseUp += new System.Windows.Forms.MouseEventHandler(this.pic_right_MouseUp);
            // 
            // pic_down
            // 
            this.pic_down.BackgroundImage = global::智慧校园.Properties.Resources.btn_arrow_down_normal;
            this.pic_down.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.pic_down.Location = new System.Drawing.Point(143, 202);
            this.pic_down.Name = "pic_down";
            this.pic_down.Size = new System.Drawing.Size(39, 54);
            this.pic_down.TabIndex = 4;
            this.pic_down.TabStop = false;
            this.pic_down.MouseDown += new System.Windows.Forms.MouseEventHandler(this.pic_down_MouseDown);
            this.pic_down.MouseUp += new System.Windows.Forms.MouseEventHandler(this.pic_down_MouseUp);
            // 
            // pic_up
            // 
            this.pic_up.BackgroundImage = global::智慧校园.Properties.Resources.btn_arrow_up_normal;
            this.pic_up.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.pic_up.Location = new System.Drawing.Point(142, 20);
            this.pic_up.Name = "pic_up";
            this.pic_up.Size = new System.Drawing.Size(39, 54);
            this.pic_up.TabIndex = 1;
            this.pic_up.TabStop = false;
            this.pic_up.MouseDown += new System.Windows.Forms.MouseEventHandler(this.pic_up_MouseDown);
            this.pic_up.MouseUp += new System.Windows.Forms.MouseEventHandler(this.pic_up_MouseUp);
            // 
            // panel2
            // 
            this.panel2.BackColor = System.Drawing.Color.DimGray;
            this.panel2.Controls.Add(this.label2);
            this.panel2.Controls.Add(this.lb_infrared);
            this.panel2.Controls.Add(this.pic_video);
            this.panel2.Location = new System.Drawing.Point(69, 15);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(666, 472);
            this.panel2.TabIndex = 0;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.BackColor = System.Drawing.Color.Transparent;
            this.label2.Font = new System.Drawing.Font("微软雅黑", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.label2.ForeColor = System.Drawing.Color.White;
            this.label2.Location = new System.Drawing.Point(545, 91);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(46, 21);
            this.label2.TabIndex = 12;
            this.label2.Text = "入侵:";
            // 
            // lb_infrared
            // 
            this.lb_infrared.AutoSize = true;
            this.lb_infrared.Font = new System.Drawing.Font("微软雅黑", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(134)));
            this.lb_infrared.ForeColor = System.Drawing.Color.White;
            this.lb_infrared.Location = new System.Drawing.Point(597, 91);
            this.lb_infrared.Name = "lb_infrared";
            this.lb_infrared.Size = new System.Drawing.Size(41, 21);
            this.lb_infrared.TabIndex = 11;
            this.lb_infrared.Text = "N/A";
            // 
            // pic_video
            // 
            this.pic_video.BackColor = System.Drawing.Color.DarkGray;
            this.pic_video.BackgroundImage = global::智慧校园.Properties.Resources.icon_monitor;
            this.pic_video.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
            this.pic_video.Location = new System.Drawing.Point(32, 38);
            this.pic_video.Name = "pic_video";
            this.pic_video.Size = new System.Drawing.Size(478, 322);
            this.pic_video.TabIndex = 0;
            this.pic_video.TabStop = false;
            this.pic_video.Click += new System.EventHandler(this.pictureBox2_Click);
            // 
            // Security
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1081, 638);
            this.Controls.Add(this.panel_bg_video);
            this.Controls.Add(this.panel3);
            this.Controls.Add(this.panel1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "Security";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Security";
            this.FormClosed += new System.Windows.Forms.FormClosedEventHandler(this.Security_FormClosed);
            this.Load += new System.EventHandler(this.Security_Load);
            this.panel3.ResumeLayout(false);
            this.panel3.PerformLayout();
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.panel_bg_video.ResumeLayout(false);
            this.panel_video_ctrl.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.pic_left)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_right)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_down)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_up)).EndInit();
            this.panel2.ResumeLayout(false);
            this.panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_video)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Panel panel3;
        private System.Windows.Forms.Label lb_return;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.Panel panel_bg_video;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.PictureBox pic_video;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label lb_infrared;
        private System.Windows.Forms.Button btn_history;
        private System.Windows.Forms.Button btn_camera;
        private System.Windows.Forms.Panel panel_video_ctrl;
        private System.Windows.Forms.PictureBox pic_left;
        private System.Windows.Forms.PictureBox pic_right;
        private System.Windows.Forms.PictureBox pic_down;
        private System.Windows.Forms.PictureBox pic_up;
    }
}