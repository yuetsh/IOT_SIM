<script setup lang="ts">
// 图表（WinForms 的 Chart，教材项目 8 的 7 天温度折线图）：运行器发来各个系列的点，用 Chart.js 画。
// 图表类型按 WinForms 的 SeriesChartType 对应；配色是 WinForms 默认的 BrightPastel；图例默认在右边；不要动画。
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { ControlNode } from '@iot/shared'

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
)

interface ChartSeries {
  name: string
  type: string
  legend: string
  inLegend: boolean
  color: string | null
  width: number
  labels: boolean
  points: { x: string | number; y: number | null }[]
}

interface ChartData {
  series: ChartSeries[]
  titles: string[]
  legendDocking: string
  yMin: number | null
  yMax: number | null
}

const props = defineProps<{ node: ControlNode; style: CSSProperties }>()

/** WinForms 图表默认的 BrightPastel 配色 */
const PALETTE = [
  '#418CF0',
  '#FCB441',
  '#E0400A',
  '#056492',
  '#BFBFBF',
  '#1A3B69',
  '#FFE382',
  '#129CDD',
  '#CA6B4B',
  '#005CDB',
  '#F3D288',
  '#506381',
  '#F1B9A8',
  '#E0830A',
  '#7893BE',
]

const data = computed(() => props.node.props.Chart as ChartData | undefined)
const canvas = ref<HTMLCanvasElement>()
let chart: Chart | undefined

const kind = (type: string) => {
  if (type === 'Pie' || type === 'Funnel' || type === 'Pyramid') return 'pie'
  if (type === 'Doughnut') return 'doughnut'
  if (type === 'Radar' || type === 'Polar') return 'radar'
  if (type.includes('Column') || type.includes('Bar') || type.includes('Range')) return 'bar'
  return 'line'
}

function config(d: ChartData): ChartConfiguration {
  const first = d.series[0]
  const chartKind = first ? kind(first.type) : 'line'
  const labels = (first?.points ?? []).map((p) => String(p.x))
  const pie = chartKind === 'pie' || chartKind === 'doughnut'
  const horizontal = d.series.some((s) => s.type === 'Bar' || s.type.startsWith('StackedBar'))
  const stacked = d.series.some((s) => s.type.startsWith('Stacked'))
  const datasets = d.series.map((s, i) => {
    const color = s.color ?? PALETTE[i % PALETTE.length]
    const type = kind(s.type)
    return {
      type: pie ? chartKind : type,
      label: s.legend,
      data: s.points.map((p) => p.y),
      borderColor: pie ? '#fff' : color,
      backgroundColor: pie ? s.points.map((_, j) => PALETTE[j % PALETTE.length]) : type === 'line' && !s.type.includes('Area') ? color : `${color}cc`,
      borderWidth: Math.max(1, s.width) * (type === 'line' ? 2 : 1),
      tension: s.type.includes('Spline') ? 0.4 : 0,
      stepped: s.type === 'StepLine',
      showLine: !(s.type === 'Point' || s.type === 'FastPoint' || s.type === 'Bubble'),
      fill: s.type.includes('Area'),
      pointRadius: type === 'line' ? 3 : undefined,
    }
  })
  const position = ({ Top: 'top', Bottom: 'bottom', Left: 'left' } as Record<string, 'top' | 'bottom' | 'left'>)[d.legendDocking] ?? 'right'
  return {
    type: chartKind,
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: d.series.some((s) => s.inLegend), position, labels: { filter: (item) => d.series[item.datasetIndex ?? 0]?.inLegend ?? true } },
        title: { display: d.titles.length > 0, text: d.titles },
      },
      scales:
        pie || chartKind === 'radar'
          ? {}
          : {
              x: { stacked, grid: { color: '#d9d9d9' } },
              y: { stacked, min: d.yMin ?? undefined, max: d.yMax ?? undefined, beginAtZero: true, grid: { color: '#d9d9d9' } },
            },
    },
  } as ChartConfiguration
}

function draw() {
  chart?.destroy()
  chart = undefined
  if (!canvas.value || !data.value) return
  chart = new Chart(canvas.value, config(data.value))
}

onMounted(draw)
watch(data, draw)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="wf-control wf-chart" :style="style">
    <canvas ref="canvas" />
  </div>
</template>
