<script setup lang="ts">
// 一次提交的评分结果：自动评分每项通过与否、得分和不通过的原因；
// 老师评分项：老师已评阅时显示各项得分和评语，还没评阅时只列出名称和分值。
import { computed } from 'vue'
import { NSpin } from 'naive-ui'
import type { Assignment, Review, Submission } from '@iot/shared'

const props = withDefaults(defineProps<{ assignment: Assignment; submission: Submission; review?: Review | null; showManual?: boolean }>(), {
  review: null,
  showManual: true,
})

const autoTotal = computed(() => props.assignment.scoring.auto.reduce((a, b) => a + b, 0))
const manual = computed(() => props.assignment.scoring.manual)
const manualTotal = computed(() => manual.value.reduce((a, m) => a + m.points, 0))
const manualScore = computed(() => props.review?.scores.reduce<number>((a, s) => a + (s ?? 0), 0) ?? 0)
</script>

<template>
  <div class="grade">
    <div v-if="submission.status === 'pending'" class="pending">
      <NSpin size="small" />
      <span
        >评分中…<template v-if="submission.queueAhead">前面还有 {{ submission.queueAhead }} 份在排队</template></span
      >
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
    <template v-if="showManual && manual.length">
      <div v-if="review" class="reviewed">
        <div class="summary">
          老师评分 <b>{{ manualScore }}</b> / {{ manualTotal }} 分
        </div>
        <ul class="items">
          <li v-for="(m, i) in manual" :key="i">
            <span class="title"
              >{{ m.title }}<span class="points">{{ review.scores[i] ?? '未打分' }} / {{ m.points }} 分</span></span
            >
          </li>
        </ul>
        <div v-if="review.comment" class="comment">老师评语：{{ review.comment }}</div>
      </div>
      <div v-else class="manual">
        由老师评分：<span v-for="m in manual" :key="m.title">{{ m.title }}（{{ m.points }} 分）</span>
      </div>
    </template>
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

.reviewed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.comment {
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 4px;
  white-space: pre-wrap;
}

.manual {
  color: #6b7280;
}

.manual span + span::before {
  content: '、';
}
</style>
