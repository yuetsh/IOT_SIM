<script setup lang="ts">
// 图表的"系列和图例"（相当于 VS 里图表属性 Series、Legends 的集合编辑器）：
// 左边是系列列表，右边编辑选中系列的属性；下面编辑图例。教材项目 8 的折线图在这里设置：
// 两个图例 MaxLegend、AVGLegend，两条折线 MaxSeries、AVGSeries，X 值字段 _Time，Y 值字段 MaxTemperature / AVGTemperature。
import { NButton, NModal } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { CHART_TYPES, type ChartModel, type ChartSeries } from './chart'

const props = defineProps<{ show: boolean; model: ChartModel }>()
const emit = defineEmits<{ 'update:show': [show: boolean]; save: [model: ChartModel] }>()

const draft = ref<ChartModel>({ areas: [], legends: [], series: [] })
const current = ref(0)
const error = ref('')

watch(
  () => props.show,
  (show) => {
    if (!show) return
    draft.value = structuredClone(props.model)
    current.value = 0
    error.value = ''
  },
  { immediate: true },
)

const series = computed<ChartSeries | undefined>(() => draft.value.series[current.value])

function nextName(prefix: string, taken: string[]) {
  for (let i = 1; ; i++) if (!taken.includes(`${prefix}${i}`)) return `${prefix}${i}`
}

function addSeries() {
  const d = draft.value
  d.series.push({
    name: nextName('Series', d.series.map((s) => s.name)),
    chartType: 'Column',
    chartArea: d.areas[0] ?? '',
    legend: d.legends[0] ?? '',
    legendText: '',
    isVisibleInLegend: true,
    xValueMember: '',
    yValueMembers: '',
  })
  current.value = d.series.length - 1
}

function removeSeries() {
  draft.value.series.splice(current.value, 1)
  current.value = Math.max(0, current.value - 1)
}

function addLegend() {
  draft.value.legends.push(nextName('Legend', draft.value.legends))
}

function renameLegend(index: number, name: string) {
  const old = draft.value.legends[index]
  draft.value.legends[index] = name
  // 用到这个图例的系列跟着改名
  for (const s of draft.value.series) if (s.legend === old) s.legend = name
}

function removeLegend(index: number) {
  const [old] = draft.value.legends.splice(index, 1)
  for (const s of draft.value.series) if (s.legend === old) s.legend = draft.value.legends[0] ?? ''
}

function save() {
  const d = draft.value
  const names = d.series.map((s) => s.name.trim())
  const legends = d.legends.map((l) => l.trim())
  if (names.some((n) => !n) || legends.some((n) => !n)) return void (error.value = '系列和图例的名称不能为空')
  if (new Set(names).size !== names.length) return void (error.value = '系列的名称不能重复')
  if (new Set(legends).size !== legends.length) return void (error.value = '图例的名称不能重复')
  emit('save', { areas: d.areas, legends, series: d.series.map((s, i) => ({ ...s, name: names[i] })) })
  emit('update:show', false)
}
</script>

<template>
  <NModal :show="show" preset="card" title="系列和图例" style="width: 640px; max-width: calc(100vw - 32px)" @update:show="emit('update:show', $event)">
    <div class="layout">
      <section class="list">
        <div class="caption">系列（Series）</div>
        <ul>
          <li v-for="(s, i) in draft.series" :key="i" :class="{ on: i === current }" @click="current = i">{{ s.name || '（未命名）' }}</li>
        </ul>
        <div class="list-buttons">
          <NButton size="small" @click="addSeries">添加</NButton>
          <NButton size="small" :disabled="!series" @click="removeSeries">移除</NButton>
        </div>
      </section>

      <section v-if="series" class="fields">
        <label title="Name：代码里用 chart1.Series[&quot;名称&quot;] 访问这个系列">名称</label>
        <input v-model="series.name" />
        <label title="ChartType：画成折线、柱形还是饼图">图表类型</label>
        <select v-model="series.chartType">
          <option v-for="(label, type) in CHART_TYPES" :key="type" :value="type">{{ label }}（{{ type }}）</option>
          <option v-if="!(series.chartType in CHART_TYPES)" :value="series.chartType">{{ series.chartType }}</option>
        </select>
        <label title="Legend：这个系列显示在哪个图例里">图例</label>
        <select v-model="series.legend">
          <option value="">（不显示在图例里）</option>
          <option v-for="legend in draft.legends" :key="legend" :value="legend">{{ legend }}</option>
        </select>
        <label title="LegendText：图例里显示的文字，不填时显示系列的名称">图例文字</label>
        <input v-model="series.legendText" :placeholder="series.name" />
        <label title="IsVisibleInLegend：是否显示在图例里">显示在图例里</label>
        <input v-model="series.isVisibleInLegend" type="checkbox" class="check" />
        <label title="XValueMember：绑定数据源（DataSource）后，X 值取哪一列">X 值字段</label>
        <input v-model="series.xValueMember" placeholder="如 _Time" />
        <label title="YValueMembers：绑定数据源（DataSource）后，Y 值取哪一列">Y 值字段</label>
        <input v-model="series.yValueMembers" placeholder="如 MaxTemperature" />
      </section>
      <section v-else class="fields empty">点"添加"加一个系列</section>
    </div>

    <section class="legends">
      <div class="caption">图例（Legends）</div>
      <div v-for="(legend, i) in draft.legends" :key="i" class="legend">
        <input :value="legend" @change="renameLegend(i, ($event.target as HTMLInputElement).value.trim())" />
        <NButton size="tiny" @click="removeLegend(i)">移除</NButton>
      </div>
      <NButton size="small" @click="addLegend">添加图例</NButton>
    </section>

    <template #footer>
      <div class="buttons">
        <span class="error">{{ error }}</span>
        <NButton type="primary" @click="save">确定</NButton>
        <NButton @click="emit('update:show', false)">取消</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
}

.caption {
  margin-bottom: 4px;
  font-weight: 600;
  font-size: 13px;
}

.list ul {
  margin: 0;
  padding: 0;
  list-style: none;
  height: 200px;
  overflow: auto;
  border: 1px solid #d1d5db;
  border-radius: 3px;
}

.list li {
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
}

.list li.on {
  background: #dbeafe;
}

.list-buttons {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.fields {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 6px 8px;
  align-content: start;
  font-size: 13px;
}

.fields label {
  align-self: center;
  color: #374151;
}

.fields input:not(.check),
.fields select,
.legend input {
  padding: 3px 6px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font: inherit;
}

.fields .check {
  justify-self: start;
}

.fields.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.legends {
  margin-top: 14px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.error {
  margin-right: auto;
  color: #b91c1c;
  font-size: 13px;
}
</style>
