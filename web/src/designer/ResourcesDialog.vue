<script setup lang="ts">
// 项目资源（相当于 VS 的"项目属性 → 资源 → 添加资源"）：从平台素材库里勾选图片和声音，
// 代码里用 Properties.Resources.名字，设计器里图片框的"图片"属性也可以选它们。
import { NButton, NCheckbox, NModal } from 'naive-ui'
import { ref, watch } from 'vue'
import { gallery, loadGallery } from './resources'

const props = defineProps<{ show: boolean; selected: string[] }>()
const emit = defineEmits<{ 'update:show': [show: boolean]; save: [names: string[]] }>()

const chosen = ref(new Set<string>())

watch(
  () => props.show,
  (show) => {
    if (!show) return
    void loadGallery()
    chosen.value = new Set(props.selected)
  },
  { immediate: true },
)

function toggle(name: string, on: boolean) {
  const next = new Set(chosen.value)
  if (on) next.add(name)
  else next.delete(name)
  chosen.value = next
}

let audio: HTMLAudioElement | undefined
function listen(file: string) {
  audio?.pause()
  audio = new Audio(`/resources/${file}`)
  void audio.play()
}

function save() {
  // 按素材库的顺序保存，生成的代码稳定
  emit('save', gallery.value.map((g) => g.name).filter((name) => chosen.value.has(name)))
  emit('update:show', false)
}
</script>

<template>
  <NModal :show="show" preset="card" title="项目资源" style="width: 560px; max-width: calc(100vw - 32px)" @update:show="emit('update:show', $event)">
    <p class="note">勾选要加入项目的图片和声音（平台素材库，名字和教材一致）。代码里写 <code>Properties.Resources.名字</code>，图片框的"图片"属性也可以直接选。</p>
    <div class="items">
      <!-- 点整行都能勾选；复选框和"试听"自己处理点击，不再传给这一行 -->
      <div v-for="item in gallery" :key="item.name" class="item" :class="{ on: chosen.has(item.name) }" @click="toggle(item.name, !chosen.has(item.name))">
        <NCheckbox :checked="chosen.has(item.name)" @click.stop @update:checked="toggle(item.name, $event)" />
        <img
          v-if="item.kind === 'image'"
          :src="`/resources/${item.file}`"
          :srcset="item.hidpi ? `/resources/${item.file} 1x, /resources/${item.hidpi} 2x` : undefined"
          alt=""
          class="thumb"
        />
        <NButton v-else size="tiny" class="audio" @click.stop="listen(item.file)">▶ 试听</NButton>
        <span class="name">{{ item.name }}</span>
        <span class="label">{{ item.label }}</span>
      </div>
      <div v-if="gallery.length === 0" class="note">正在加载素材库…</div>
    </div>
    <template #footer>
      <div class="buttons">
        <NButton type="primary" @click="save">确定</NButton>
        <NButton @click="emit('update:show', false)">取消</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.note {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4b5563;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
  overflow: auto;
}

.item {
  display: grid;
  grid-template-columns: auto 64px 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 10px;
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}

.item.on {
  border-color: #2563eb;
  background: #eff6ff;
}

.item > :first-child {
  grid-row: span 2;
}

.thumb,
.audio {
  grid-row: span 2;
  max-width: 64px;
  max-height: 40px;
}

/* 灰色棋盘格底：透明背景上的白色图片（如 ico_title 的白字）也看得见 */
.thumb {
  background: repeating-conic-gradient(#9ca3af 0 25%, #c4c9d0 0 50%) 0 0 / 10px 10px;
}

.audio {
  justify-self: start;
}

.name {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

.label {
  font-size: 12px;
  color: #6b7280;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
