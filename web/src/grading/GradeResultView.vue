<script setup lang="ts">
// 一次提交的自动评分结果：每项通过与否、得分和不通过的原因；老师评分项只列出名称和分值。
import { computed } from 'vue'
import { NSpin } from 'naive-ui'
import type { Assignment, Submission } from '@iot/shared'

const props = defineProps<{ assignment: Assignment; submission: Submission }>()

const autoTotal = computed(() => props.assignment.scoring.auto.reduce((a, b) => a + b, 0))
const manual = computed(() => props.assignment.scoring.manual)
</script>

<template>
  <div class="grade">
    <div v-if="submission.status === 'pending'" class="pending">
      <NSpin size="small" />
      <span>评分中…<template v-if="submission.queueAhead">前面还有 {{ submission.queueAhead }} 份在排队</template></span>
    </div>
    <div v-else-if="submission.status === 'error'" class="error">评分时服务器出错了，请重新提交；还是不行请告诉老师。</div>
    <template v-else-if="submission.result">
      <div class="summary">
        自动评分 <b>{{ submission.autoScore }}</b> / {{ autoTotal }} 分
        <span v-if="!submission.result.compiled" class="error">（编译没有通过，先改正编译错误）</span>
      </div>
      <ul class="items">
        <li v-for="(r, i) in submission.result.results" :key="i" :class="r.passed ? 'passed' : 'failed'">
          <span class="mark">{{ r.passed ? '✓' : '✗' }}</span>
          <div>
            <div class="title">
              {{ r.title }}<span class="points">{{ r.passed ? assignment.scoring.auto[i] : 0 }} / {{ assignment.scoring.auto[i] }} 分</span>
            </div>
            <div v-if="r.message" class="message">{{ r.message }}</div>
          </div>
        </li>
      </ul>
    </template>
    <div v-if="manual.length" class="manual">
      由老师评分：<span v-for="m in manual" :key="m.title">{{ m.title }}（{{ m.points }} 分）</span>
    </div>
  </div>
</template>

<style scoped>
.grade {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}

.pending {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary b {
  font-size: 18px;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.items li {
  display: flex;
  gap: 8px;
}

.mark {
  font-weight: bold;
}

.passed .mark {
  color: #16a34a;
}

.failed .mark,
.error {
  color: #dc2626;
}

.title {
  display: flex;
  gap: 12px;
}

.points {
  color: #6b7280;
}

.message {
  margin-top: 2px;
  color: #b91c1c;
}

.manual {
  color: #6b7280;
}

.manual span + span::before {
  content: "、";
}
</style>
