namespace 智慧校园
{
    partial class Main
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
            this.panel1 = new System.Windows.Forms.Panel();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.panel2 = new System.Windows.Forms.Panel();
            this.pic_exit = new System.Windows.Forms.PictureBox();
            this.pic_security = new System.Windows.Forms.PictureBox();
            this.pic_environment = new System.Windows.Forms.PictureBox();
            this.panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.panel2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pic_exit)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_security)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_environment)).BeginInit();
            this.SuspendLayout();
            // 
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(53)))), ((int)(((byte)(147)))), ((int)(((byte)(237)))));
            this.panel1.Controls.Add(this.pictureBox1);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(1018, 100);
            this.panel1.TabIndex = 0;
            this.panel1.Paint += new System.Windows.Forms.PaintEventHandler(this.panel1_Paint);
            // 
            // pictureBox1
            // 
            this.pictureBox1.Image = global::智慧校园.Properties.Resources.ico_title;
            this.pictureBox1.Location = new System.Drawing.Point(57, 23);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(197, 54);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox1.TabIndex = 0;
            this.pictureBox1.TabStop = false;
            // 
            // panel2
            // 
            this.panel2.BackgroundImage = global::智慧校园.Properties.Resources.bg_home;
            this.panel2.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.panel2.Controls.Add(this.pic_exit);
            this.panel2.Controls.Add(this.pic_security);
            this.panel2.Controls.Add(this.pic_environment);
            this.panel2.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel2.Location = new System.Drawing.Point(0, 100);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(1018, 516);
            this.panel2.TabIndex = 1;
            this.panel2.Paint += new System.Windows.Forms.PaintEventHandler(this.panel2_Paint);
            // 
            // pic_exit
            // 
            this.pic_exit.BackColor = System.Drawing.Color.Transparent;
            this.pic_exit.Image = global::智慧校园.Properties.Resources.icon_04;
            this.pic_exit.Location = new System.Drawing.Point(660, 124);
            this.pic_exit.Name = "pic_exit";
            this.pic_exit.Size = new System.Drawing.Size(180, 210);
            this.pic_exit.TabIndex = 6;
            this.pic_exit.TabStop = false;
            this.pic_exit.Click += new System.EventHandler(this.pic_exit_Click);
            // 
            // pic_security
            // 
            this.pic_security.BackColor = System.Drawing.Color.Transparent;
            this.pic_security.Image = global::智慧校园.Properties.Resources.icon_03;
            this.pic_security.Location = new System.Drawing.Point(404, 124);
            this.pic_security.Name = "pic_security";
            this.pic_security.Size = new System.Drawing.Size(180, 210);
            this.pic_security.TabIndex = 5;
            this.pic_security.TabStop = false;
            // 
            // pic_environment
            // 
            this.pic_environment.BackColor = System.Drawing.Color.Transparent;
            this.pic_environment.Image = global::智慧校园.Properties.Resources.icon_02;
            this.pic_environment.Location = new System.Drawing.Point(133, 124);
            this.pic_environment.Name = "pic_environment";
            this.pic_environment.Size = new System.Drawing.Size(180, 210);
            this.pic_environment.TabIndex = 4;
            this.pic_environment.TabStop = false;
            this.pic_environment.Click += new System.EventHandler(this.pic_environment_Click);
            // 
            // Main
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1018, 616);
            this.Controls.Add(this.panel2);
            this.Controls.Add(this.panel1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "Main";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Form1";
            this.panel1.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.panel2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.pic_exit)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_security)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pic_environment)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.PictureBox pic_exit;
        private System.Windows.Forms.PictureBox pic_security;
        private System.Windows.Forms.PictureBox pic_environment;
    }
}

