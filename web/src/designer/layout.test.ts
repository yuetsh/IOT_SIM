import { expect, test } from 'bun:test'
import { parseDesigner } from './document'
import { getPropText } from './edit'
import { dockLayout } from './layout'

/** 一个窗体：panel1（Top）、panel2（Fill，里面有 panel3 Right）；后加入 Controls 的先停靠 */
const DESIGNER = `namespace 智慧校园
{
    partial class Main
    {
        private void InitializeComponent()
        {
            this.panel1 = new System.Windows.Forms.Panel();
            this.panel2 = new System.Windows.Forms.Panel();
            this.panel3 = new System.Windows.Forms.Panel();
            this.SuspendLayout();
            // 
            // panel1
            // 
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(5, 5);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(100, 54);
            // 
            // panel2
            // 
            this.panel2.Controls.Add(this.panel3);
            this.panel2.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel2.Location = new System.Drawing.Point(0, 0);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(10, 10);
            // 
            // panel3
            // 
            this.panel3.Dock = System.Windows.Forms.DockStyle.Right;
            this.panel3.Location = new System.Drawing.Point(0, 0);
            this.panel3.Name = "panel3";
            this.panel3.Size = new System.Drawing.Size(120, 30);
            // 
            // Main
            // 
            this.ClientSize = new System.Drawing.Size(800, 600);
            this.Controls.Add(this.panel2);
            this.Controls.Add(this.panel1);
            this.Name = "Main";
            this.ResumeLayout(false);

        }

        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Panel panel3;
    }
}
`

test('停靠布局：顶部贴边拉满宽度，填充占剩下的，嵌套的右停靠贴着父面板右边', () => {
  const doc = dockLayout(parseDesigner(DESIGNER))
  expect(getPropText(doc, 'panel1', 'Location')).toBe('new System.Drawing.Point(0, 0)')
  expect(getPropText(doc, 'panel1', 'Size')).toBe('new System.Drawing.Size(800, 54)')
  expect(getPropText(doc, 'panel2', 'Location')).toBe('new System.Drawing.Point(0, 54)')
  expect(getPropText(doc, 'panel2', 'Size')).toBe('new System.Drawing.Size(800, 546)')
  expect(getPropText(doc, 'panel3', 'Location')).toBe('new System.Drawing.Point(680, 0)')
  expect(getPropText(doc, 'panel3', 'Size')).toBe('new System.Drawing.Size(120, 546)')
})

test('停靠布局：已经排好的窗体不变', () => {
  const doc = dockLayout(parseDesigner(DESIGNER))
  expect(dockLayout(doc)).toEqual(doc)
})
