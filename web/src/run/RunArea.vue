<script setup lang="ts">
// 运行区：学生程序的窗体（在一块"桌面"上）、提示框、虚拟实训台，以及编译错误和控制台输出。
// 实验页和老师的评阅页共用。
import TrainingBoard from '../scene/TrainingBoard.vue'
import FormWindow from '../winforms/FormWindow.vue'
import MessageBoxDialog from '../winforms/MessageBoxDialog.vue'
import type { RunSession } from './session'

const props = defineProps<{ session: RunSession }>()
const emit = defineEmits<{ diagnostic: [file: string, line: number, column: number] }>()

const state = props.session.state
</script>

<template>
  <section class="run-area">
    <div class="desktop">
      <FormWindow
        v-for="(form, index) in state.forms"
        :key="form.root.id"
        :form="form.root"
        :modal="form.modal"
        :offset="index"
        :act="session.act"
      />
      <MessageBoxDialog
        v-for="box in state.messageBoxes"
        :key="box.requestId"
        :box="box"
        @reply="session.replyMessageBox(box.requestId, $event)"
      />
      <div v-if="state.forms.length === 0" class="desktop-hint">点击"运行"后，学生程序的窗体会显示在这里</div>
    </div>
    <TrainingBoard :board="state.board" @set="session.setBoard" @reset="session.resetBoard" />
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
  /* 窗体比桌面区域大时可以滚动查看 */
  overflow: auto;
}

.desktop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(255 255 255 / 0.7);
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
