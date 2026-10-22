<script setup lang="ts">
// 虚拟实训台。第 0 阶段只有 LED 显示屏，其余设备按布局图逐步加入。
defineProps<{ ledText: string }>()
</script>

<template>
  <div class="board">
    <div class="board-label">LED 显示屏（COM5）</div>
    <div class="led-screen">
      <span v-if="ledText" :key="ledText" class="led-screen-text">{{ ledText }}</span>
    </div>
  </div>
</template>

<style scoped>
.board {
  padding: 12px;
  background: #3b4252;
  border-radius: 6px;
}

.board-label {
  margin-bottom: 6px;
  color: #d8dee9;
  font-size: 12px;
}

.led-screen {
  position: relative;
  height: 56px;
  overflow: hidden;
  background:
    radial-gradient(circle, rgb(255 255 255 / 0.06) 1px, transparent 1.5px) 0 0 / 4px 4px,
    #0b0b0b;
  border: 3px solid #222;
}

.led-screen-text {
  position: absolute;
  top: 8px;
  white-space: pre;
  color: #ff2a2a;
  text-shadow: 0 0 6px rgb(255 40 40 / 0.8);
  font-family: "SimHei", "Noto Sans CJK SC", sans-serif;
  font-size: 34px;
  line-height: 40px;
  animation: led-scroll 12s linear infinite;
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
</style>
