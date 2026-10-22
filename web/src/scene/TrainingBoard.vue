<script setup lang="ts">
// 虚拟实训台：按教材实训台布局图（顶棚 → LED 屏 → 传感器 → 采集模块）排列。
// 传感器卡片上的滑块和开关调节环境（经服务器推给学生程序），灯和继电器的状态由学生程序控制。
import { computed, ref } from 'vue'
import { ANALOG_INFO, type AnalogKey, type BoardState, type ClientMessage, type DigitalKey } from '@iot/shared'

type BoardInput = Omit<Extract<ClientMessage, { type: 'boardInput' }>, 'type'>

const props = defineProps<{ board: BoardState | null }>()
const emit = defineEmits<{ set: [input: BoardInput]; reset: [] }>()

const MORE_SENSORS: AnalogKey[] = ['airPressure', 'airQuality', 'co2', 'wind']
const RELAYS = ['报警灯', '照明灯', '路灯', '插座 1', '插座 2']
const DIGITAL_INPUTS: { key: DigitalKey; label: string }[] = [
  { key: 'bodyInfrared', label: '人体红外' },
  { key: 'fire', label: '火焰' },
  { key: 'smoke', label: '烟雾' },
  { key: 'infrared', label: '红外对射' },
]

const showMore = ref(false)

// 收起后只留一行状态，给窗体显示区腾地方；收起与否记在浏览器本地
const COLLAPSED_KEY = 'iot-sim:board-collapsed'
const collapsed = ref(readCollapsed())

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function setCollapsed(value: boolean) {
  collapsed.value = value
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // 浏览器禁用本地存储时只是记不住，不影响使用
  }
}

// 拖动滑块时先显示本地值，避免服务器回传前滑块跳动；发送做节流
const dragging = ref<Partial<Record<AnalogKey, number>>>({})
let pending: Partial<Record<AnalogKey, number>> = {}
let flushTimer: ReturnType<typeof setTimeout> | undefined

function analog(key: AnalogKey) {
  return dragging.value[key] ?? props.board?.analog[key] ?? 0
}

function slide(key: AnalogKey, value: number) {
  dragging.value = { ...dragging.value, [key]: value }
  pending[key] = value
  flushTimer ??= setTimeout(flush, 80)
}

function flush() {
  flushTimer = undefined
  if (Object.keys(pending).length) emit('set', { analog: pending })
  pending = {}
}

function release(key: AnalogKey) {
  flush()
  const { [key]: _, ...rest } = dragging.value
  dragging.value = rest
}

function toggle(key: DigitalKey) {
  if (props.board) emit('set', { digital: { [key]: !props.board.digital[key] } })
}

const digital = computed(() => props.board?.digital ?? { bodyInfrared: false, fire: false, smoke: false, infrared: false })
const relays = computed(() => props.board?.relays ?? [])
const streetLampOn = computed(() => props.board?.zigbee[1] === true)
const alarmOn = computed(() => relays.value[0] === true)
const ledText = computed(() => props.board?.ledText ?? '')
</script>

<template>
  <!-- 收起时：一行状态，传感器开关仍然可以点 -->
  <div v-if="collapsed" class="board collapsed" :class="{ disconnected: !board }">
    <span class="board-name">虚拟实训台</span>
    <span class="io out warn" :class="{ lit: alarmOn }"><i />警示灯</span>
    <span class="io out" :class="{ lit: streetLampOn }"><i />照明灯 1</span>
    <span class="summary-readings">
      <span v-for="key in ['temperature', 'humidity', 'light'] as AnalogKey[]" :key="key">
        {{ ANALOG_INFO[key].label }} <b>{{ analog(key) }}{{ ANALOG_INFO[key].unit }}</b>
      </span>
    </span>
    <button
      v-for="input in DIGITAL_INPUTS"
      :key="input.key"
      class="io chip"
      :class="{ lit: digital[input.key] }"
      :disabled="!board"
      :title="`点击切换${input.label}`"
      @click="toggle(input.key)"
    >
      <i />{{ input.label }}
    </button>
    <span v-if="ledText" class="summary-led" :title="ledText">LED：{{ ledText }}</span>
    <button class="link expand" @click="setCollapsed(false)">展开 ▾</button>
  </div>

  <div v-else class="board" :class="{ disconnected: !board }">
    <div class="board-header">
      <span class="board-name">虚拟实训台</span>
      <button class="link" title="收起后只显示一行状态，给窗体留出更多地方" @click="setCollapsed(true)">收起 ▴</button>
    </div>

    <!-- 顶棚：红外对射、警示灯（DO0）、摄像头 -->
    <div class="ceiling">
      <button class="device beam-end" :class="{ active: digital.infrared }" title="点击遮挡/恢复光束" @click="toggle('infrared')">
        红外对射
      </button>
      <div class="beam" :class="{ broken: digital.infrared }" @click="toggle('infrared')">
        <span v-if="digital.infrared" class="beam-tag">有人闯入</span>
      </div>
      <div class="device warning-light" :class="{ on: alarmOn }" title="警示灯（ADAM-4150 DO0）">警示灯</div>
      <div class="beam" :class="{ broken: digital.infrared }" @click="toggle('infrared')" />
      <div class="device camera" title="网络摄像头（项目 4 使用）">
        <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 7h11a2 2 0 0 1 2 2v1.5l3.5-2.5v8L17 13.5V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" /></svg>
      </div>
      <button class="device beam-end" :class="{ active: digital.infrared }" title="点击遮挡/恢复光束" @click="toggle('infrared')">
        红外对射
      </button>
    </div>

    <!-- LED 显示屏 -->
    <div class="led-screen" title="LED 显示屏">
      <span v-if="ledText" :key="ledText" class="led-text">{{ ledText }}</span>
    </div>

    <!-- 传感器与执行器 -->
    <div class="sensors">
      <div class="card" title="照明灯 1：由 ZigBee 继电器节点 1 控制（教材项目 3 的路灯）">
        <div class="bulb" :class="{ on: streetLampOn }" />
        <div class="card-title">照明灯 1</div>
        <div class="card-note">ZigBee 节点 1</div>
      </div>

      <button class="card toggle" :class="{ active: digital.bodyInfrared }" title="点击切换：有人 / 无人" @click="toggle('bodyInfrared')">
        <svg viewBox="0 0 24 24" width="30" height="30" class="icon">
          <circle cx="12" cy="5" r="2.6" fill="currentColor" />
          <path fill="currentColor" d="M9 9h6l1.5 6h-2l-.8 7h-3.4l-.8-7h-2z" />
        </svg>
        <div class="card-title">人体红外</div>
        <div class="card-note">{{ digital.bodyInfrared ? '有人' : '无人' }}</div>
      </button>

      <div class="card wide">
        <div class="card-title">温湿度传感器</div>
        <label v-for="key in ['temperature', 'humidity'] as AnalogKey[]" :key="key" class="slider">
          <span>{{ ANALOG_INFO[key].label }}</span>
          <input
            type="range"
            :min="ANALOG_INFO[key].min"
            :max="ANALOG_INFO[key].max"
            :value="analog(key)"
            :disabled="!board"
            @input="slide(key, Number(($event.target as HTMLInputElement).value))"
            @change="release(key)"
          />
          <b>{{ analog(key) }}{{ ANALOG_INFO[key].unit }}</b>
        </label>
      </div>

      <div class="card wide">
        <div class="card-title">光照传感器</div>
        <label class="slider">
          <span>光照</span>
          <input
            type="range"
            :min="ANALOG_INFO.light.min"
            :max="ANALOG_INFO.light.max"
            step="10"
            :value="analog('light')"
            :disabled="!board"
            @input="slide('light', Number(($event.target as HTMLInputElement).value))"
            @change="release('light')"
          />
          <b>{{ analog('light') }}lx</b>
        </label>
      </div>

      <button class="card toggle" :class="{ active: digital.smoke }" title="点击切换：有烟雾 / 正常" @click="toggle('smoke')">
        <div class="smoke" :class="{ on: digital.smoke }"><i /><i /><i /></div>
        <div class="card-title">烟雾传感器</div>
        <div class="card-note">{{ digital.smoke ? '有烟雾' : '正常' }}</div>
      </button>

      <button class="card toggle" :class="{ active: digital.fire }" title="点击切换：有火焰 / 正常" @click="toggle('fire')">
        <svg viewBox="0 0 24 24" width="30" height="30" class="icon flame" :class="{ on: digital.fire }">
          <path fill="currentColor" d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-3 1.5-4.5 2.5-6 .5 2 1.5 3 2.5 3-1-3 0-6 0-8z" />
        </svg>
        <div class="card-title">火焰传感器</div>
        <div class="card-note">{{ digital.fire ? '有火焰' : '正常' }}</div>
      </button>
    </div>

    <!-- 采集模块与串口 -->
    <div class="modules">
      <div class="module">
        <div class="module-title">ADAM-4017+ 模拟量（地址 2）</div>
        <div class="readings">
          <span v-for="(key, i) in ['temperature', 'humidity', 'light'] as AnalogKey[]" :key="key">
            Vin{{ i }} {{ ANALOG_INFO[key].label }} <b>{{ board?.analog[key] ?? '-' }}</b>
          </span>
          <button class="link" @click="showMore = !showMore">{{ showMore ? '收起' : 'Vin3–6 更多传感器' }}</button>
        </div>
        <div v-if="showMore" class="more">
          <label v-for="key in MORE_SENSORS" :key="key" class="slider">
            <span>{{ ANALOG_INFO[key].label }}</span>
            <input
              type="range"
              :min="ANALOG_INFO[key].min"
              :max="ANALOG_INFO[key].max"
              :value="analog(key)"
              :disabled="!board"
              @input="slide(key, Number(($event.target as HTMLInputElement).value))"
              @change="release(key)"
            />
            <b>{{ analog(key) }}{{ ANALOG_INFO[key].unit }}</b>
          </label>
        </div>
      </div>

      <div class="module">
        <div class="module-title">ADAM-4150 数字量（地址 1）</div>
        <div class="io-row">
          <span v-for="(input, i) in DIGITAL_INPUTS" :key="input.key" class="io" :class="{ lit: digital[input.key] }">
            <i />DI{{ i }} {{ input.label }}
          </span>
        </div>
        <div class="io-row">
          <span v-for="(label, i) in RELAYS" :key="label" class="io out" :class="{ lit: relays[i] }">
            <i />DO{{ i }} {{ label }}
          </span>
        </div>
      </div>

      <div class="module ports">
        <div class="module-title">串口服务器</div>
        <div class="port-list">
          <span>COM2 → 4017</span><span>COM3 → 4150</span><span>COM4 → ZigBee 协调器</span><span>COM5 → LED 屏</span>
        </div>
        <button class="reset" :disabled="!board" @click="emit('reset')">实训台复位</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  --panel: #2b3340;
  --card: #364052;
  --text: #dfe5ee;
  --muted: #98a3b3;
  --accent: #4fa3ff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--panel);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  user-select: none;
  /* 布局按实训台自身宽度调整（打开设计器时右栏会变窄） */
  container-type: inline-size;
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -2px 0 -4px;
}

.board-name {
  color: var(--muted);
}

.board.collapsed {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 6px 10px;
}

.summary-readings {
  display: flex;
  gap: 10px;
}

.summary-readings b {
  color: #9fd3ff;
  font-variant-numeric: tabular-nums;
}

.chip {
  padding: 1px 6px;
  background: var(--card);
  border: 1px solid #4a566a;
  border-radius: 10px;
  cursor: pointer;
}

.chip:hover:not(:disabled) {
  border-color: var(--accent);
}

.summary-led {
  min-width: 0;
  max-width: 16em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #ff6b6b;
}

.expand {
  margin-left: auto;
}

.board.disconnected {
  opacity: 0.6;
}

button {
  font: inherit;
  color: inherit;
}

/* 顶棚 */
.ceiling {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #3a4556;
  border-radius: 4px;
}

.device {
  flex: none;
  padding: 4px 8px;
  background: var(--card);
  border: 1px solid #4a566a;
  border-radius: 4px;
}

.beam-end {
  cursor: pointer;
}

.beam-end.active {
  border-color: #ff6b6b;
}

.beam {
  flex: 1;
  height: 12px;
  position: relative;
  cursor: pointer;
  background: linear-gradient(#0000 5px, #ff4d4d88 5px, #ff4d4d88 7px, #0000 7px);
}

.beam.broken {
  background: repeating-linear-gradient(90deg, #ff4d4d 0 6px, #0000 6px 12px) center / 100% 2px no-repeat;
}

.beam-tag {
  position: absolute;
  left: 50%;
  top: -4px;
  transform: translateX(-50%);
  padding: 0 4px;
  background: #ff4d4d;
  color: #fff;
  border-radius: 3px;
  white-space: nowrap;
}

.warning-light {
  background: #6b4a2a;
  border-color: #8a5a2a;
}

.warning-light.on {
  background: #ff3b30;
  border-color: #ff8a80;
  color: #fff;
  box-shadow: 0 0 14px 4px #ff3b30aa;
  animation: blink 0.8s steps(2) infinite;
}

.camera {
  color: var(--muted);
}

/* LED 屏 */
.led-screen {
  position: relative;
  height: 48px;
  overflow: hidden;
  background:
    radial-gradient(circle, rgb(255 255 255 / 0.06) 1px, transparent 1.5px) 0 0 / 4px 4px,
    #0b0b0b;
  border: 3px solid #1a1f27;
}

.led-text {
  position: absolute;
  top: 6px;
  white-space: pre;
  color: #ff2a2a;
  text-shadow: 0 0 6px rgb(255 40 40 / 0.8);
  font-family: "SimHei", "Noto Sans CJK SC", sans-serif;
  font-size: 30px;
  line-height: 36px;
  animation: led-scroll 12s linear infinite;
}

/* 传感器：中等宽度时 4 个开关卡片一行、两个滑块卡片一行；够宽时按实训台顺序排成一行；更窄时每行 2 格 */
.sensors {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.sensors .wide {
  order: 1;
}

@container (min-width: 1100px) {
  .sensors {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }

  .sensors .wide {
    order: 0;
  }
}

@container (max-width: 560px) {
  .sensors {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 74px;
  padding: 6px;
  background: var(--card);
  border: 1px solid #4a566a;
  border-radius: 6px;
  text-align: center;
}

.card.wide {
  grid-column: span 2;
  align-items: stretch;
}

.card.toggle {
  cursor: pointer;
}

.card.toggle:hover {
  border-color: var(--accent);
}

.card.toggle.active {
  border-color: #ff9f43;
  background: #4a3d33;
}

.card-title {
  font-weight: 600;
}

.card-note {
  color: var(--muted);
}

.icon {
  color: var(--muted);
}

.active .icon {
  color: #ffb86b;
}

.flame.on {
  color: #ff5722;
  filter: drop-shadow(0 0 6px #ff5722);
  animation: flicker 0.3s alternate infinite;
}

.bulb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #555f6e;
  border: 2px solid #6d7889;
}

.bulb.on {
  background: #ffe066;
  border-color: #fff3b0;
  box-shadow: 0 0 18px 6px #ffd43b99;
}

.smoke {
  display: flex;
  gap: 3px;
  height: 30px;
  align-items: flex-end;
}

.smoke i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #6d7889;
}

.smoke.on i {
  background: #c9ced6;
  animation: rise 1.4s ease-in infinite;
}

.smoke.on i:nth-child(2) {
  animation-delay: 0.45s;
}

.smoke.on i:nth-child(3) {
  animation-delay: 0.9s;
}

.slider {
  display: grid;
  grid-template-columns: 4.5em minmax(60px, 1fr) 4.5em;
  align-items: center;
  gap: 6px;
}

.slider span {
  white-space: nowrap;
}

.slider input {
  width: 100%;
  accent-color: var(--accent);
}

.slider b {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 模块 */
.modules {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1fr;
  gap: 8px;
}

/* 窄时串口服务器单独占一行，四个串口横排 */
@container (max-width: 760px) {
  .modules {
    grid-template-columns: 1fr 1fr;
  }

  .ports {
    grid-column: 1 / -1;
  }

  .ports .port-list {
    flex-direction: row;
  }
}

.module {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #3a4556;
  border-radius: 4px;
}

.module-title {
  color: var(--muted);
}

.readings,
.io-row,
.port-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.readings b {
  color: #9fd3ff;
}

.more {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.io {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}

.io i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #56606f;
}

.io.lit {
  color: var(--text);
}

.io.lit i {
  background: #ff9f43;
  box-shadow: 0 0 6px #ff9f43;
}

.io.out.lit i {
  background: #51cf66;
  box-shadow: 0 0 6px #51cf66;
}

.io.warn.lit i {
  background: #ff3b30;
  box-shadow: 0 0 6px #ff3b30;
}

.port-list {
  flex-direction: column;
  color: var(--muted);
}

.link {
  padding: 0;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
}

.reset {
  align-self: flex-start;
  padding: 3px 10px;
  background: var(--card);
  border: 1px solid #4a566a;
  border-radius: 4px;
  cursor: pointer;
}

.reset:hover:not(:disabled) {
  border-color: var(--accent);
}

@keyframes led-scroll {
  from {
    left: 100%;
    transform: translateX(0);
  }
  to {
    left: 0;
    transform: translateX(-100%);
  }
}

@keyframes blink {
  50% {
    opacity: 0.55;
  }
}

@keyframes flicker {
  to {
    transform: scale(1.08, 0.94);
  }
}

@keyframes rise {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-18px);
    opacity: 0;
  }
}
</style>
