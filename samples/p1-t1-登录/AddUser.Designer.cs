namespace 登录
{
    partial class AddUser
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
            this.LblUsername = new System.Windows.Forms.Label();
            this.txtNewUser1 = new System.Windows.Forms.TextBox();
            this.LblPwd = new System.Windows.Forms.Label();
            this.txtPass1 = new System.Windows.Forms.TextBox();
            this.LblCheckPwd = new System.Windows.Forms.Label();
            this.txtPass2 = new System.Windows.Forms.TextBox();
            this.btnOk = new System.Windows.Forms.Button();
            this.btnCancel = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // LblUsername
            // 
            this.LblUsername.AutoSize = true;
            this.LblUsername.Location = new System.Drawing.Point(25, 27);
            this.LblUsername.Name = "LblUsername";
            this.LblUsername.Size = new System.Drawing.Size(41, 12);
            this.LblUsername.TabIndex = 0;
            this.LblUsername.Text = "用户名";
            // 
            // txtNewUser1
            // 
            this.txtNewUser1.Location = new System.Drawing.Point(90, 24);
            this.txtNewUser1.Name = "txtNewUser1";
            this.txtNewUser1.Size = new System.Drawing.Size(110, 21);
            this.txtNewUser1.TabIndex = 1;
            // 
            // LblPwd
            // 
            this.LblPwd.AutoSize = true;
            this.LblPwd.Location = new System.Drawing.Point(25, 57);
            this.LblPwd.Name = "LblPwd";
            this.LblPwd.Size = new System.Drawing.Size(29, 12);
            this.LblPwd.TabIndex = 2;
            this.LblPwd.Text = "密码";
            // 
            // txtPass1
            // 
            this.txtPass1.Location = new System.Drawing.Point(90, 54);
            this.txtPass1.Name = "txtPass1";
            this.txtPass1.PasswordChar = '*';
            this.txtPass1.Size = new System.Drawing.Size(110, 21);
            this.txtPass1.TabIndex = 3;
            // 
            // LblCheckPwd
            // 
            this.LblCheckPwd.AutoSize = true;
            this.LblCheckPwd.Location = new System.Drawing.Point(25, 87);
            this.LblCheckPwd.Name = "LblCheckPwd";
            this.LblCheckPwd.Size = new System.Drawing.Size(53, 12);
            this.LblCheckPwd.TabIndex = 4;
            this.LblCheckPwd.Text = "确认密码";
            // 
            // txtPass2
            // 
            this.txtPass2.Location = new System.Drawing.Point(90, 84);
            this.txtPass2.Name = "txtPass2";
            this.txtPass2.PasswordChar = '*';
            this.txtPass2.Size = new System.Drawing.Size(110, 21);
            this.txtPass2.TabIndex = 5;
            // 
            // btnOk
            // 
            this.btnOk.Location = new System.Drawing.Point(35, 120);
            this.btnOk.Name = "btnOk";
            this.btnOk.Size = new System.Drawing.Size(75, 23);
            this.btnOk.TabIndex = 6;
            this.btnOk.Text = "确定";
            this.btnOk.UseVisualStyleBackColor = true;
            this.btnOk.Click += new System.EventHandler(this.btnOk_Click);
            // 
            // btnCancel
            // 
            this.btnCancel.Location = new System.Drawing.Point(125, 120);
            this.btnCancel.Name = "btnCancel";
            this.btnCancel.Size = new System.Drawing.Size(75, 23);
            this.btnCancel.TabIndex = 7;
            this.btnCancel.Text = "取消";
            this.btnCancel.UseVisualStyleBackColor = true;
            this.btnCancel.Click += new System.EventHandler(this.btnCancel_Click);
            // 
            // AddUser
            // 
            this.AcceptButton = this.btnOk;
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(220, 160);
            this.Controls.Add(this.btnCancel);
            this.Controls.Add(this.btnOk);
            this.Controls.Add(this.txtPass2);
            this.Controls.Add(this.LblCheckPwd);
            this.Controls.Add(this.txtPass1);
            this.Controls.Add(this.LblPwd);
            this.Controls.Add(this.txtNewUser1);
            this.Controls.Add(this.LblUsername);
            this.Name = "AddUser";
            this.Text = "增加用户";
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label LblUsername;
        private System.Windows.Forms.TextBox txtNewUser1;
        private System.Windows.Forms.Label LblPwd;
        private System.Windows.Forms.TextBox txtPass1;
        private System.Windows.Forms.Label LblCheckPwd;
        private System.Windows.Forms.TextBox txtPass2;
        private System.Windows.Forms.Button btnOk;
        private System.Windows.Forms.Button btnCancel;
    }
}
