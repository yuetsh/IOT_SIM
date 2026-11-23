<script setup lang="ts">
// 各页面工具栏右上角统一的导航：学生（自由练习、我的作业、我的学习）/ 老师（自由练习、班级管理），使用说明、名字、退出。
// 当前所在的页面那一项显示成黑字、不能点，位置不变；页面自己的链接（实验页的“数据库”）放在默认插槽里，排在最前面。
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import { currentUser, logout } from './auth'

const props = defineProps<{
  /** 退出前要做的事（实验页先把没保存的代码存掉） */
  beforeSignOut?: () => Promise<unknown>
}>()

const router = useRouter()

async function signOut() {
  await props.beforeSignOut?.()
  await logout()
  await router.push('/login')
}
</script>

<template>
  <nav class="top-nav">
    <template v-if="currentUser">
      <slot />
      <RouterLink to="/" class="nav-link">自由练习</RouterLink>
      <template v-if="currentUser.role === 'student'">
        <RouterLink to="/assignments" class="nav-link">我的作业</RouterLink>
        <RouterLink to="/learning" class="nav-link" title="作业得分、用时、常犯的错误">我的学习</RouterLink>
      </template>
      <RouterLink v-else to="/teacher" class="nav-link">班级管理</RouterLink>
      <RouterLink :to="currentUser.role === 'teacher' ? '/help#teacher' : '/help'" target="_blank" class="nav-link" title="在新标签页打开使用说明">
        使用说明
      </RouterLink>
      <span class="user">
        {{ currentUser.name }}<template v-if="currentUser.className">（{{ currentUser.className }}）</template>
      </span>
      <NButton quaternary size="small" @click="signOut">退出</NButton>
    </template>
    <RouterLink v-else to="/login" class="nav-link">登录</RouterLink>
  </nav>
</template>

<style scoped>
.top-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.nav-link,
.top-nav :slotted(.nav-link) {
  color: #2563eb;
  font-size: 13px;
  white-space: nowrap;
  text-decoration: none;
}

/* 当前页面：黑字、不能点 */
.nav-link.router-link-exact-active {
  color: #111827;
  font-weight: 600;
  pointer-events: none;
}

.user {
  font-size: 13px;
  white-space: nowrap;
}
</style>
