<script setup lang="ts">
// 虚拟实训台：按教材实训台布局图（顶棚 → LED 屏 → 传感器 → 采集模块）排列。
// 传感器卡片上的滑块和开关调节环境（经服务器推给学生程序），灯和继电器的状态由学生程序控制。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  ANALOG_INFO,
  BOARD_PORTS,
  clockWall,
  DEFAULT_WIRING,
  describePortProblem,
  PORT_DEVICE_NAMES,
  portProblems,
  type AnalogKey,
  type BoardState,
  type ClientMessage,
  type DigitalKey,
  type PortDevice,
} from '@iot/shared'
import { devicesOn } from './wiring'

type BoardInput = Omit<Extract<ClientMessage, { type: 'boardInput' }>, 'type'>

/** playing：学生程序正在播放的声音（媒体播放器），广播喇叭亮起 */
const props = defineProps<{ board: BoardState | null; playing?: { name: string } | null }>()
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

// 布局按实训台自身宽度调整（打开设计器时右栏会变窄）。Chrome 94 没有容器查询，用 ResizeObserver 量宽度
const boardEl = ref<HTMLElement>()
const boardWidth = ref(0)
const boardObserver = new ResizeObserver(([entry]) => (boardWidth.value = entry.contentRect.width))
watch(boardEl, (el) => {
  boardObserver.disconnect()
  if (el) boardObserver.observe(el)
})
onBeforeUnmount(() => boardObserver.disconnect())

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

// 松开后继续显示本地值，等服务器回传了这个值再用服务器的：键盘方向键连按时每按一下都会触发 change，
// 立刻换回服务器的旧值，下一下就从旧值开始加，看起来像丢了几步。服务器没回传同样的值（比如被截到范围内）时 1 秒后放弃
const releasing = new Map<AnalogKey, ReturnType<typeof setTimeout>>()

function release(key: AnalogKey) {
  flush()
  clearTimeout(releasing.get(key))
  releasing.set(
    key,
    setTimeout(() => drop(key), 1000),
  )
}

function drop(key: AnalogKey) {
  clearTimeout(releasing.get(key))
  releasing.delete(key)
  const { [key]: _, ...rest } = dragging.value
  dragging.value = rest
}

watch(
  () => props.board?.analog,
  (values) => {
    for (const key of [...releasing.keys()]) if (values?.[key] === dragging.value[key]) drop(key)
  },
)
onBeforeUnmount(() => releasing.forEach((timer) => clearTimeout(timer)))

function toggle(key: DigitalKey) {
  if (props.board) emit('set', { digital: { [key]: !props.board.digital[key] } })
}

const digital = computed(() => props.board?.digital ?? { bodyInfrared: false, fire: false, smoke: false, infrared: false })
const relays = computed(() => props.board?.relays ?? [])
const streetLampOn = computed(() => props.board?.zigbee[1] === true)
const alarmOn = computed(() => relays.value[0] === true)
/** ADAM-4150 DO1 接的照明灯（教材项目 7 的智慧教室、寝室、会议室用它） */
const roomLampOn = computed(() => relays.value[1] === true)
const ledText = computed(() => props.board?.ledText ?? '')
const camera = computed(() => props.board?.camera ?? { on: false, x: 3, y: 1 })
// ---------- 虚拟时钟：显示学生程序看到的时间，可以拨时间、调倍速 ----------
const SPEEDS = [1, 10, 60]
const tick = ref(Date.now())
const ticker = setInterval(() => (tick.value = Date.now()), 250)
onBeforeUnmount(() => clearInterval(ticker))

const clock = computed(() => props.board?.clock ?? null)
/** 现在的墙上时间 yyyy-MM-ddTHH:mm:ss：拨过时间时按虚拟时钟算，否则是本机时间 */
const wall = computed(() => {
  if (clock.value) return clockWall(clock.value, tick.value)
  const d = new Date(tick.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})
const clockDate = ref('')
const clockTime = ref('')

function openClockEditor() {
  clockDate.value = wall.value.slice(0, 10)
  clockTime.value = wall.value.slice(11, 19)
}

function setClock() {
  if (!clockDate.value || !clockTime.value) return
  const time = clockTime.value.length === 5 ? `${clockTime.value}:00` : clockTime.value
  emit('set', { clock: { time: `${clockDate.value}T${time}` } })
}

function setSpeed(speed: number) {
  emit('set', { clock: { speed } })
}

// ---------- 接线：鼠标移到设备上，高亮它接的通道、模块和串口，并写出整条线路（只看，不能改） ----------
interface Link {
  label: string
  module: PortDevice | null
  /** 接在模块的哪个通道上 */
  channels?: string[]
  /** 没有模块通道时的线路说明 */
  route?: string
}
const LINKS: Record<string, Link> = {
  infrared: { label: '红外对射', module: 'adam4150', channels: ['DI3'] },
  alarm: { label: '警示灯', module: 'adam4150', channels: ['DO0'] },
  camera: { label: '网络摄像头', module: null, route: '网线 → 路由器（按 IP 地址访问，不经过串口）' },
  led: { label: 'LED 显示屏', module: 'led' },
  streetLamp: { label: '照明灯 1', module: 'zigbee', route: 'ZigBee 继电器节点 1 → 无线 → ZigBee 协调器' },
  bodyInfrared: { label: '人体红外', module: 'adam4150', channels: ['DI0'] },
  humiture: { label: '温湿度传感器', module: 'adam4017', channels: ['Vin0', 'Vin1'] },
  light: { label: '光照传感器', module: 'adam4017', channels: ['Vin2'] },
  speaker: { label: '广播', module: null, route: '电脑的声卡（Windows Media Player 播放）' },
  smoke: { label: '烟雾传感器', module: 'adam4150', channels: ['DI2'] },
  fire: { label: '火焰传感器', module: 'adam4150', channels: ['DI1'] },
  roomLamp: { label: '照明灯 2', module: 'adam4150', channels: ['DO1'] },
}
const hovered = ref<string | null>(null)
const wiring = computed(() => props.board?.wiring ?? DEFAULT_WIRING)
const link = computed(() => (hovered.value ? LINKS[hovered.value] : undefined))

/** 如"人体红外 → ADAM-4150 DI0 → 串口服务器 COM3" */
const linkPath = computed(() => {
  const l = link.value
  if (!l) return ''
  const steps = [l.label]
  if (l.route) steps.push(l.route)
  if (l.module && l.channels) steps.push(`${PORT_DEVICE_NAMES[l.module]} ${l.channels.join('、')}`)
  if (l.module) steps.push(`串口服务器 ${wiring.value[l.module]}`)
  return steps.join(' → ')
})

const linkedChannel = (module: PortDevice, channel: string) => link.value?.module === module && link.value.channels?.includes(channel) === true
const linkedModule = (module: PortDevice) => link.value?.module === module
const linkedPort = (port: string) => !!link.value?.module && wiring.value[link.value.module] === port

/** 学生程序打开了这个串口（不管上面接的是不是它要的设备） */
const portOpen = (port: string) => Object.values(props.board?.opened ?? {}).some((opened) => opened?.trim().toUpperCase() === port)
const portDevices = (port: string) =>
  devicesOn(wiring.value, port)
    .map((device) => PORT_DEVICE_NAMES[device])
    .join('、') || '空'
/** 串口打开错了、或没打开就读写的设备：设备没有反应，提示学生 */
const problems = computed(() => (props.board ? portProblems(props.board) : []))

const cameraTitle = computed(() =>
  camera.value.on ? `网络摄像头：正在传送画面（云台左右 ${camera.value.x + 1}/7，上下 ${camera.value.y + 1}/3）` : '网络摄像头（项目 4 使用）：未开启',
)
</script>

<template>
  <!-- 收起时：一行状态，传感器开关仍然可以点 -->
  <div v-if="collapsed" class="board collapsed" :class="{ disconnected: !board }">
    <span class="board-name">虚拟实训台</span>
    <span class="io out warn" :class="{ lit: alarmOn }"><i />警示灯</span>
    <span class="io out" :class="{ lit: streetLampOn }"><i />照明灯 1</span>
    <span class="io out" :class="{ lit: roomLampOn }"><i />照明灯 2</span>
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
    <span v-if="clock" class="summary-clock" title="虚拟时钟：学生程序里的 DateTime.Now">🕒 {{ wall.slice(11) }}（{{ clock.speed }}×）</span>
    <span v-for="p in problems" :key="p.device" class="port-warning">⚠ {{ describePortProblem(p) }}</span>
    <button class="link expand" @click="setCollapsed(false)">展开 ▾</button>
  </div>

  <div
    v-else
    ref="boardEl"
    class="board"
    :class="{ disconnected: !board, 'board-wide': boardWidth >= 1100, 'board-narrow': boardWidth <= 760, 'board-tiny': boardWidth <= 560 }"
  >
    <div class="board-header">
      <span class="board-name">虚拟实训台</span>
      <span class="wiring-path" :class="{ active: link }" :title="linkPath">{{ linkPath || '鼠标移到设备上，看它接在哪个通道、哪个串口' }}</span>
      <button class="link" title="收起后只显示一行状态，给窗体留出更多地方" @click="setCollapsed(true)">收起 ▴</button>
    </div>

    <!-- 串口问题放在最上面，不用往下滚就能看到 -->
    <div v-if="problems.length" class="port-warnings">
      <div v-for="p in problems" :key="p.device" class="port-warning">⚠ {{ describePortProblem(p) }}，设备收不到命令</div>
    </div>

    <!-- 顶棚：红外对射、警示灯（DO0）、摄像头 -->
    <div class="ceiling">
      <button
        class="device beam-end"
        :class="{ active: digital.infrared }"
        title="点击遮挡/恢复光束"
        @click="toggle('infrared')"
        @mouseenter="hovered = 'infrared'"
        @mouseleave="hovered = null"
      >
        红外对射
      </button>
      <div class="beam" :class="{ broken: digital.infrared }" @click="toggle('infrared')">
        <span v-if="digital.infrared" class="beam-tag">有人闯入</span>
      </div>
      <div class="device warning-light" :class="{ on: alarmOn }" title="警示灯（ADAM-4150 DO0）" @mouseenter="hovered = 'alarm'" @mouseleave="hovered = null">
        警示灯
      </div>
      <div class="beam" :class="{ broken: digital.infrared }" @click="toggle('infrared')" />
      <div class="device camera" :class="{ on: camera.on }" :title="cameraTitle" @mouseenter="hovered = 'camera'" @mouseleave="hovered = null">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path fill="currentColor" d="M4 7h11a2 2 0 0 1 2 2v1.5l3.5-2.5v8L17 13.5V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        </svg>
      </div>
      <button
        class="device beam-end"
        :class="{ active: digital.infrared }"
        title="点击遮挡/恢复光束"
        @click="toggle('infrared')"
        @mouseenter="hovered = 'infrared'"
        @mouseleave="hovered = null"
      >
        红外对射
      </button>
    </div>

    <!-- LED 显示屏 -->
    <div class="led-screen" title="LED 显示屏" @mouseenter="hovered = 'led'" @mouseleave="hovered = null">
      <span v-if="ledText" :key="ledText" class="led-text">{{ ledText }}</span>
    </div>

    <!-- 传感器与执行器 -->
    <div class="sensors">
      <div class="card" title="照明灯 1：由 ZigBee 继电器节点 1 控制（教材项目 3 的路灯）" @mouseenter="hovered = 'streetLamp'" @mouseleave="hovered = null">
        <div class="bulb" :class="{ on: streetLampOn }" />
        <div class="card-title">照明灯 1</div>
        <div class="card-note">ZigBee 节点 1</div>
      </div>

      <button
        class="card toggle"
        :class="{ active: digital.bodyInfrared }"
        title="点击切换：有人 / 无人"
        @click="toggle('bodyInfrared')"
        @mouseenter="hovered = 'bodyInfrared'"
        @mouseleave="hovered = null"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" class="icon">
          <circle cx="12" cy="5" r="2.6" fill="currentColor" />
          <path fill="currentColor" d="M9 9h6l1.5 6h-2l-.8 7h-3.4l-.8-7h-2z" />
        </svg>
        <div class="card-title">人体红外</div>
        <div class="card-note">{{ digital.bodyInfrared ? '有人' : '无人' }}</div>
      </button>

      <div class="card wide" @mouseenter="hovered = 'humiture'" @mouseleave="hovered = null">
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

      <div class="card wide" @mouseenter="hovered = 'light'" @mouseleave="hovered = null">
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

      <div
        class="card"
        :title="playing ? `广播正在播放 ${playing.name}` : '广播（教材项目 7 用 Windows Media Player 播放铃声）'"
        @mouseenter="hovered = 'speaker'"
        @mouseleave="hovered = null"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" class="icon speaker" :class="{ on: playing }">
          <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
          <path
            v-if="playing"
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <div class="card-title">广播</div>
        <div class="card-note">{{ playing ? `播放 ${playing.name}` : '静音' }}</div>
      </div>

      <button
        class="card toggle"
        :class="{ active: digital.smoke }"
        title="点击切换：有烟雾 / 正常"
        @click="toggle('smoke')"
        @mouseenter="hovered = 'smoke'"
        @mouseleave="hovered = null"
      >
        <div class="smoke" :class="{ on: digital.smoke }"><i /><i /><i /></div>
        <div class="card-title">烟雾传感器</div>
        <div class="card-note">{{ digital.smoke ? '有烟雾' : '正常' }}</div>
      </button>

      <button
        class="card toggle"
        :class="{ active: digital.fire }"
        title="点击切换：有火焰 / 正常"
        @click="toggle('fire')"
        @mouseenter="hovered = 'fire'"
        @mouseleave="hovered = null"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" class="icon flame" :class="{ on: digital.fire }">
          <path fill="currentColor" d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-3 1.5-4.5 2.5-6 .5 2 1.5 3 2.5 3-1-3 0-6 0-8z" />
        </svg>
        <div class="card-title">火焰传感器</div>
        <div class="card-note">{{ digital.fire ? '有火焰' : '正常' }}</div>
      </button>

      <div
        class="card"
        title="照明灯 2：由 ADAM-4150 的 DO1 控制（教材项目 7 的教室、寝室、会议室照明）"
        @mouseenter="hovered = 'roomLamp'"
        @mouseleave="hovered = null"
      >
        <div class="bulb" :class="{ on: roomLampOn }" />
        <div class="card-title">照明灯 2</div>
        <div class="card-note">ADAM-4150 DO1</div>
      </div>
    </div>

    <!-- 采集模块与串口 -->
    <div class="modules">
      <div class="module" :class="{ linked: linkedModule('adam4017') }">
        <div class="module-title">ADAM-4017+ 模拟量（地址 2）</div>
        <div class="readings">
          <span v-for="(key, i) in ['temperature', 'humidity', 'light'] as AnalogKey[]" :key="key" :class="{ linked: linkedChannel('adam4017', `Vin${i}`) }">
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

      <div class="module" :class="{ linked: linkedModule('adam4150') }">
        <div class="module-title">ADAM-4150 数字量（地址 1）</div>
        <div class="io-row">
          <span
            v-for="(input, i) in DIGITAL_INPUTS"
            :key="input.key"
            class="io"
            :class="{ lit: digital[input.key], linked: linkedChannel('adam4150', `DI${i}`) }"
          >
            <i />DI{{ i }} {{ input.label }}
          </span>
        </div>
        <div class="io-row">
          <span v-for="(label, i) in RELAYS" :key="label" class="io out" :class="{ lit: relays[i], linked: linkedChannel('adam4150', `DO${i}`) }">
            <i />DO{{ i }} {{ label }}
          </span>
        </div>
      </div>

      <div class="module ports">
        <div class="module-title">串口服务器</div>
        <div class="port-list" title="绿点：程序打开了这个串口">
          <span v-for="port in BOARD_PORTS" :key="port" class="io out" :class="{ lit: portOpen(port), linked: linkedPort(port) }">
            <i />{{ port }} → {{ portDevices(port) }}
          </span>
        </div>
        <button class="reset" :disabled="!board" @click="emit('reset')">实训台复位</button>
      </div>
    </div>

    <!-- 虚拟时钟：学生程序里的 DateTime.Now 跟着它走 -->
    <div class="clock-strip" :class="{ virtual: clock }">
      <span class="module-title">时钟</span>
      <b class="clock-time">{{ wall.slice(11) }}</b>
      <span class="clock-date">{{ wall.slice(0, 10) }}</span>
      <span class="clock-tag">{{ clock ? `虚拟时间 · ${clock.speed}×` : '真实时间' }}</span>
      <span class="spacer" />
      <input v-model="clockDate" type="date" :disabled="!board" @focus="!clockDate && openClockEditor()" />
      <input v-model="clockTime" type="time" step="1" :disabled="!board" @focus="!clockTime && openClockEditor()" />
      <button class="chip-button" :disabled="!board || !clockDate || !clockTime" title="把学生程序看到的时间拨到这个时刻" @click="setClock">拨到</button>
      <span class="speeds" title="倍速：60× 时真实的 1 秒是 1 分钟">
        <button
          v-for="speed in SPEEDS"
          :key="speed"
          class="chip-button"
          :class="{ active: (clock?.speed ?? 1) === speed && (clock !== null || speed === 1) }"
          :disabled="!board"
          @click="setSpeed(speed)"
        >
          {{ speed }}×
        </button>
      </span>
      <button v-if="clock" class="chip-button" :disabled="!board" @click="emit('set', { clock: null })">恢复真实时间</button>
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

.camera.on {
  color: #4cd964;
  border-color: #4cd96488;
  box-shadow: 0 0 10px 2px #4cd96444;
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
  font-family: 'SimHei', 'Noto Sans CJK SC', sans-serif;
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

.board-wide .sensors {
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.board-wide .sensors .wide {
  order: 0;
}

.board-tiny .sensors {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
.clock-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 6px 8px;
  background: #3a4556;
  border-radius: 4px;
}

.clock-strip.virtual {
  box-shadow: inset 0 0 0 1px #f5a623;
}

.clock-time {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.clock-date {
  color: var(--muted);
}

.clock-tag {
  color: var(--muted);
}

.virtual .clock-tag {
  color: #f5a623;
}

.clock-strip .spacer {
  flex: 1;
}

.clock-strip input {
  background: #2b3340;
  color: var(--text);
  border: 1px solid #556175;
  border-radius: 3px;
  padding: 1px 4px;
  font: inherit;
  color-scheme: dark;
}

.chip-button {
  background: #2b3340;
  color: var(--text);
  border: 1px solid #556175;
  border-radius: 3px;
  padding: 1px 8px;
  font: inherit;
  cursor: pointer;
}

.chip-button.active {
  border-color: var(--accent);
  color: #fff;
  background: #2f5f99;
}

.chip-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.speeds {
  display: inline-flex;
  gap: 4px;
}

.speaker {
  color: var(--muted);
}

.speaker.on {
  color: #4cd964;
  animation: blink 0.8s steps(2) infinite;
}

.summary-clock {
  color: #f5a623;
}

.modules {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1fr;
  gap: 8px;
}

/* 窄时串口服务器单独占一行，四个串口横排 */
.board-narrow .modules {
  grid-template-columns: 1fr 1fr;
}

.board-narrow .ports {
  grid-column: 1 / -1;
}

.board-narrow .ports .port-list {
  flex-direction: row;
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

.port-warning {
  color: #ff8a80;
}

.port-warnings {
  padding: 4px 8px;
  background: #4a2f35;
  border-radius: 4px;
}

/* 接线：鼠标所在设备接的模块、通道和串口 */
.wiring-path {
  flex: 1;
  min-width: 0;
  margin: 0 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #6c7889;
}

.wiring-path.active {
  color: #9fd3ff;
}

.module.linked {
  box-shadow: inset 0 0 0 1px var(--accent);
}

.readings .linked,
.io.linked {
  color: #9fd3ff;
  text-decoration: underline;
  text-underline-offset: 3px;
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
