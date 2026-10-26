/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { CHART_TYPE, readChart, writeChart } from './chart'
import { controlDef } from './catalog'
import { generateDesigner, parseDesigner } from './document'
import { addControl, removeControl } from './edit'

const ROOT = resolve(import.meta.dir, '../../..')
const ENVIRONMENT = resolve(ROOT, 'samples/p8-t5-历史图片/Environment.Designer.cs')

const EMPTY_FORM = `namespace Demo
{
    partial class Form1
    {
        private System.ComponentModel.IContainer components = null;

        #region Windows 窗体设计器生成的代码

        private void InitializeComponent()
        {
            this.SuspendLayout();
            //
            // Form1
            //
            this.ClientSize = new System.Drawing.Size(400, 300);
            this.Name = "Form1";
            this.Text = "Form1";
            this.ResumeLayout(false);

        }

        #endregion
    }
}
`

describe('图表的系列和图例', () => {
  test('读出教材项目 8 的图表：两个图例、两条折线', async () => {
    const doc = parseDesigner(await Bun.file(ENVIRONMENT).text())
    expect(readChart(doc, 'chart1')).toEqual({
      areas: ['ChartArea1'],
      legends: ['MaxLegend', 'AVGLegend'],
      series: [
        {
          name: 'MaxSeries',
          chartType: 'Line',
          chartArea: 'ChartArea1',
          legend: 'MaxLegend',
          legendText: '最大值',
          isVisibleInLegend: true,
          xValueMember: '_Time',
          yValueMembers: 'MaxTemperature',
        },
        {
          name: 'AVGSeries',
          chartType: 'Line',
          chartArea: 'ChartArea1',
          legend: 'AVGLegend',
          legendText: '平均值',
          isVisibleInLegend: true,
          xValueMember: '_Time',
          yValueMembers: 'AVGTemperature',
        },
      ],
    })
  })

  test('原样写回时内容逐字节不变（对话框不管的 TitleForeColor 也保留）', async () => {
    const text = await Bun.file(ENVIRONMENT).text()
    const doc = parseDesigner(text)
    expect(generateDesigner(writeChart(doc, 'chart1', readChart(doc, 'chart1')))).toBe(text)
  })

  test('改系列：只改动相关的语句', async () => {
    const doc = parseDesigner(await Bun.file(ENVIRONMENT).text())
    const model = readChart(doc, 'chart1')
    model.series[1] = { ...model.series[1], chartType: 'Column', legendText: '' }
    const out = generateDesigner(writeChart(doc, 'chart1', model))
    expect(out).not.toContain('series4.ChartType')
    expect(out).not.toContain('series4.LegendText')
    expect(out).toContain('series4.YValueMembers = "AVGTemperature";')
    expect(readChart(parseDesigner(out), 'chart1').series[1]).toMatchObject({ chartType: 'Column', legendText: '' })
  })

  test('从工具箱拖入图表：和 VS 一样带 ChartArea1、Legend1、Series1，能删掉', () => {
    const def = controlDef(CHART_TYPE)!
    const { doc, name } = addControl(parseDesigner(EMPTY_FORM), def, '', { x: 10, y: 20 })
    expect(name).toBe('chart1')
    const out = generateDesigner(doc)
    expect(out)
      .toContain(`            System.Windows.Forms.DataVisualization.Charting.ChartArea chartArea1 = new System.Windows.Forms.DataVisualization.Charting.ChartArea();
            System.Windows.Forms.DataVisualization.Charting.Legend legend1 = new System.Windows.Forms.DataVisualization.Charting.Legend();
            System.Windows.Forms.DataVisualization.Charting.Series series1 = new System.Windows.Forms.DataVisualization.Charting.Series();
            this.chart1 = new System.Windows.Forms.DataVisualization.Charting.Chart();`)
    expect(out).toContain(`            chartArea1.Name = "ChartArea1";
            this.chart1.ChartAreas.Add(chartArea1);
            legend1.Name = "Legend1";
            this.chart1.Legends.Add(legend1);
            this.chart1.Location = new System.Drawing.Point(10, 20);
            this.chart1.Name = "chart1";
            series1.ChartArea = "ChartArea1";
            series1.Legend = "Legend1";
            series1.Name = "Series1";
            this.chart1.Series.Add(series1);
            this.chart1.Size = new System.Drawing.Size(300, 300);`)
    const removed = generateDesigner(removeControl(parseDesigner(out), 'chart1'))
    expect(removed).not.toContain('Charting')
  })
})
