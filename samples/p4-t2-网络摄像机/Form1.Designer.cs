namespace 网络摄像机
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
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.btn_up = new System.Windows.Forms.Button();
            this.btn_left = new System.Windows.Forms.Button();
            this.btn_right = new System.Windows.Forms.Button();
            this.btn_down = new System.Windows.Forms.Button();
            this.btn_camera = new System.Windows.Forms.Button();
            this.btn_open = new System.Windows.Forms.Button();
            this.label1 = new System.Windows.Forms.Label();
            this.txt_ip = new System.Windows.Forms.TextBox();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.SuspendLayout();
            // 
            // pictureBox1
            // 
            this.pictureBox1.BackColor = System.Drawing.Color.Black;
            this.pictureBox1.Location = new System.Drawing.Point(25, 41);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(640, 480);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox1.TabIndex = 0;
            this.pictureBox1.TabStop = false;
            // 
            // btn_up
            // 
            this.btn_up.Location = new System.Drawing.Point(763, 166);
            this.btn_up.Name = "btn_up";
            this.btn_up.Size = new System.Drawing.Size(33, 33);
            this.btn_up.TabIndex = 1;
            this.btn_up.Text = "↑";
            this.btn_up.UseVisualStyleBackColor = true;
            this.btn_up.Click += new System.EventHandler(this.btn_up_Click);
            // 
            // btn_left
            // 
            this.btn_left.Location = new System.Drawing.Point(707, 219);
            this.btn_left.Name = "btn_left";
            this.btn_left.Size = new System.Drawing.Size(33, 33);
            this.btn_left.TabIndex = 2;
            this.btn_left.Text = "←";
            this.btn_left.UseVisualStyleBackColor = true;
            this.btn_left.Click += new System.EventHandler(this.btn_left_Click);
            // 
            // btn_right
            // 
            this.btn_right.Location = new System.Drawing.Point(820, 219);
            this.btn_right.Name = "btn_right";
            this.btn_right.Size = new System.Drawing.Size(33, 33);
            this.btn_right.TabIndex = 3;
            this.btn_right.Text = "→";
            this.btn_right.UseVisualStyleBackColor = true;
            this.btn_right.Click += new System.EventHandler(this.btn_right_Click);
            // 
            // btn_down
            // 
            this.btn_down.Location = new System.Drawing.Point(763, 268);
            this.btn_down.Name = "btn_down";
            this.btn_down.Size = new System.Drawing.Size(33, 33);
            this.btn_down.TabIndex = 4;
            this.btn_down.Text = "↓";
            this.btn_down.UseVisualStyleBackColor = true;
            this.btn_down.Click += new System.EventHandler(this.btn_down_Click);
            // 
            // btn_camera
            // 
            this.btn_camera.Location = new System.Drawing.Point(743, 347);
            this.btn_camera.Name = "btn_camera";
            this.btn_camera.Size = new System.Drawing.Size(75, 33);
            this.btn_camera.TabIndex = 7;
            this.btn_camera.Text = "拍照";
            this.btn_camera.UseVisualStyleBackColor = true;
            this.btn_camera.Click += new System.EventHandler(this.btn_camera_Click);
            // 
            // btn_open
            // 
            this.btn_open.Location = new System.Drawing.Point(763, 219);
            this.btn_open.Name = "btn_open";
            this.btn_open.Size = new System.Drawing.Size(33, 33);
            this.btn_open.TabIndex = 9;
            this.btn_open.Text = "开";
            this.btn_open.UseVisualStyleBackColor = true;
            this.btn_open.Click += new System.EventHandler(this.btn_open_Click);
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(685, 69);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(53, 12);
            this.label1.TabIndex = 10;
            this.label1.Text = "摄像机IP";
            // 
            // txt_ip
            // 
            this.txt_ip.Location = new System.Drawing.Point(744, 66);
            this.txt_ip.Name = "txt_ip";
            this.txt_ip.Size = new System.Drawing.Size(111, 21);
            this.txt_ip.TabIndex = 11;
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(884, 562);
            this.Controls.Add(this.txt_ip);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.btn_open);
            this.Controls.Add(this.btn_camera);
            this.Controls.Add(this.btn_down);
            this.Controls.Add(this.btn_right);
            this.Controls.Add(this.btn_left);
            this.Controls.Add(this.btn_up);
            this.Controls.Add(this.pictureBox1);
            this.Name = "Form1";
            this.Text = "网络摄像机";
            this.Load += new System.EventHandler(this.Form1_Load);
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.Button btn_up;
        private System.Windows.Forms.Button btn_left;
        private System.Windows.Forms.Button btn_right;
        private System.Windows.Forms.Button btn_down;
        private System.Windows.Forms.Button btn_camera;
        private System.Windows.Forms.Button btn_open;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.TextBox txt_ip;

    }
}

