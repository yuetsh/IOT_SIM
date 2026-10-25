<script setup lang="ts">
// 运行区：学生程序的窗体（在一块"桌面"上）、提示框、虚拟实训台，以及编译错误和控制台输出。
// 实验页和老师的评阅页共用。
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import TrainingBoard from '../scene/TrainingBoard.vue'
import type { SizeValue } from '../winforms/format'
import FormWindow, { WINDOW_MARGIN, WINDOW_STEP } from '../winforms/FormWindow.vue'
import { RUN_IMAGES } from '../winforms/images'
import MessageBoxDialog from '../winforms/MessageBoxDialog.vue'
import type { RunSession } from './session'

const props = defineProps<{ session: RunSession }>()
const emit = defineEmits<{ diagnostic: [file: string, line: number, column: number] }>()

const state = props.session.state
provide(RUN_IMAGES, props.session.images)

/** 照片列表里点开看大图 */
const viewing = ref<{ path: string; url: string } | null>(null)

// ---------- 窗体比桌面大时整体缩小（项目 8 的窗体有 1000 多像素宽），"放大"后运行区占满整个网页 ----------
const maximized = ref(false)
const desktop = ref<HTMLElement>()
const desktopSize = ref({ width: 0, height: 0 })
const observer = new ResizeObserver(([entry]) => {
  desktopSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
})
onMounted(() => observer.observe(desktop.value!))
onBeforeUnmount(() => observer.disconnect())

const TITLEBAR = 30
/** 按窗体最初的层叠位置算出放下所有窗体需要多大，桌面不够时按比例缩小（不放大）；拖动窗体不影响缩放 */
const scale = computed(() => {
  let width = 0
  let height = 0
  state.forms.forEach((form, index) => {
    const p = form.root.props
    if (p.Visible === false) return
    const client = (p.ClientSize as SizeValue | undefined) ?? { width: 300, height: 300 }
    const start = WINDOW_MARGIN + index * WINDOW_STEP
    width = Math.max(width, start + client.width + 2 + WINDOW_MARGIN)
    height = Math.max(height, start + client.height + 2 + (p.FormBorderStyle === 'None' ? 0 : TITLEBAR) + WINDOW_MARGIN)
  })
  const { width: w, height: h } = desktopSize.value
  if (!width || !w || !h) return 1
  return Math.min(1, w / width, h / height)
})

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && maximized.value) maximized.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="run-area" :class="{ maximized }">
    <div ref="desktop" class="desktop">
      <div
        class="desktop-canvas"
        :style="scale < 1 ? { transform: `scale(${scale})`, width: `${100 / scale}%`, height: `${100 / scale}%` } : undefined"
      >
        <FormWindow
          v-for="(form, index) in state.forms"
          :key="form.root.id"
          :form="form.root"
          :modal="form.modal"
          :offset="index"
          :scale="scale"
          :act="session.act"
        />
      </div>
      <MessageBoxDialog
        v-for="box in state.messageBoxes"
        :key="box.requestId"
        :box="box"
        @reply="session.replyMessageBox(box.requestId, $event)"
      />
      <div v-if="state.forms.length === 0" class="desktop-hint">点击"运行"后，学生程序的窗体会显示在这里</div>
      <div class="desktop-tools">
        <span v-if="scale < 1" class="desktop-scale" title="窗体比运行区大，按比例缩小显示；点&quot;放大&quot;可以看得更清楚">
          缩放 {{ Math.round(scale * 100) }}%
        </span>
        <button type="button" :title="maximized ? '还原（Esc）' : '运行区占满整个网页'" @click="maximized = !maximized">
          {{ maximized ? '还原' : '放大' }}
        </button>
      </div>
    </div>
    <TrainingBoard :board="state.board" :playing="state.playing" @set="session.setBoard" @reset="session.resetBoard" />
    <div v-if="state.savedImages.length" class="photos">
      <div class="photos-title">程序保存的图片（{{ state.savedImages.length }}）<span>只在这次运行中保留</span></div>
      <div class="photos-list">
        <figure
          v-for="(photo, i) in state.savedImages"
          :key="i"
          :title="`${photo.path}（点击查看大图）`"
          @click="viewing = { path: photo.path, url: session.images.get(photo.image) ?? '' }"
        >
          <img :src="session.images.get(photo.image)" alt="" />
          <figcaption>{{ photo.path }}</figcaption>
        </figure>
      </div>
    </div>
    <div v-if="viewing" class="photo-viewer" @click="viewing = null">
      <figure>
        <img :src="viewing.url" alt="" />
        <figcaption>{{ viewing.path }}（点击任意处关闭）</figcaption>
      </figure>
    </div>
    <div class="output">
      <div
        v-for="(d, i) in state.diagnostics"
        :key="`d${i}`"
        :class="['diag', d.severity]"
        title="点击跳到出错的代码"
        @click="emit('diagnostic', d.file, d.line, d.column)"
      >
        {{ d.file }}({{ d.line }},{{ d.column }}) {{ d.code }}：{{ d.message }}
        <div v-if="d.hint" class="hint">提示：{{ d.hint }}</div>
      </div>
      <pre v-for="(e, i) in state.errors" :key="`e${i}`" class="error">{{ e }}</pre>
      <pre v-if="state.console" class="console">{{ state.console }}</pre>
    </div>
  </section>
</template>

<style scoped>
.run-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  min-width: 0;
  overflow: auto;
}

.desktop {
  position: relative;
  flex: 1;
  min-height: 320px;
  background: #2d6aa3;
  border-radius: 4px;
  /* 窗体被拖到桌面外面时可以滚动查看 */
  overflow: auto;
  /* 窗体、提示框的层级只在桌面里比较，不会盖住网页的抽屉和对话框 */
  isolation: isolate;
}

.desktop-canvas {
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.desktop-tools {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 100001;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.desktop-scale {
  padding: 2px 6px;
  border-radius: 3px;
  background: rgb(0 0 0 / 0.35);
  color: #fff;
}

.desktop-tools button {
  padding: 2px 10px;
  border: 1px solid rgb(255 255 255 / 0.6);
  border-radius: 3px;
  background: rgb(0 0 0 / 0.35);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.desktop-tools button:hover {
  background: rgb(0 0 0 / 0.55);
}

/* 放大：桌面在左边占满高度，实训台、图片列表和输出在右边一栏 */
.run-area.maximized {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 460px;
  grid-auto-rows: min-content;
  align-content: start;
  background: #f3f4f6;
}

.run-area.maximized .desktop {
  grid-column: 1;
  grid-row: 1 / span 20;
  height: calc(100vh - 16px);
}

.run-area.maximized > :not(.desktop) {
  grid-column: 2;
}

.desktop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(255 255 255 / 0.7);
}

.photos {
  font-size: 12px;
}

.photos-title {
  margin-bottom: 4px;
  font-weight: 600;
}

.photos-title span {
  margin-left: 8px;
  font-weight: normal;
  color: #6b7280;
}

.photos-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.photos-list figure {
  flex: none;
  width: 120px;
  margin: 0;
  cursor: zoom-in;
}

.photos-list img {
  display: block;
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid #d1d5db;
}

.photos-list figcaption {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4b5563;
}

.photo-viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.6);
  cursor: zoom-out;
}

.photo-viewer figure {
  margin: 0;
  max-width: 90vw;
  text-align: center;
  color: #fff;
}

.photo-viewer img {
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 4px;
}

.output {
  max-height: 180px;
  overflow: auto;
  font-size: 12px;
}

.diag {
  cursor: pointer;
}

.diag:hover {
  text-decoration: underline;
}

.diag.error,
.error {
  color: #b91c1c;
}

.diag.warning {
  color: #a16207;
}

.hint {
  color: #2563eb;
  padding-left: 1em;
}

.console {
  background: #111827;
  color: #e5e7eb;
  padding: 6px;
  margin: 0;
}
</style>
