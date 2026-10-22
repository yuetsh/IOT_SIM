<script setup lang="ts">
// 教材控件库里的 LED 控件：黑底红字，文字从右向左滚动。
// 教材原控件每 40ms 左移 2px（约 50px/s），这里用 CSS 动画按相同速度滚动。
import { computed, nextTick, ref, watch } from 'vue'
import type { ControlNode } from '@iot/shared'

const props = defineProps<{ node: ControlNode }>()

const SPEED_PX_PER_SEC = 50

const text = computed(() => String(props.node.props.LedText ?? ''))
const textEl = ref<HTMLElement>()
const containerEl = ref<HTMLElement>()
const scroll = ref({ from: 0, to: 0, seconds: 1 })
const runKey = ref(0)

watch(
  text,
  async () => {
    await nextTick()
    const from = containerEl.value?.clientWidth ?? 800
    const to = -(textEl.value?.scrollWidth ?? 0)
    scroll.value = { from, to, seconds: Math.max((from - to) / SPEED_PX_PER_SEC, 1) }
    runKey.value++ // 文字变化时从右侧重新开始滚动
  },
  { immediate: true },
)
</script>

<template>
  <div ref="containerEl" class="wf-control wf-led">
    <span
      v-if="text"
      ref="textEl"
      :key="runKey"
      class="wf-led-text"
      :style="{
        '--wf-led-from': `${scroll.from}px`,
        '--wf-led-to': `${scroll.to}px`,
        animationDuration: `${scroll.seconds}s`,
      }"
      >{{ text }}</span
    >
  </div>
</template>
