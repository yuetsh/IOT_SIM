<script setup lang="ts">
// 各页面工具栏右上角统一的导航：只显示名字，点开下拉菜单：
// 学生（自由练习、我的作业、我的学习）/ 老师（自由练习、班级管理），分隔线，使用说明（新标签页）、退出。
// 当前所在的页面那一项加粗、前面打勾，点了不跳；页面自己的链接（实验页的“数据库”）放在默认插槽里，排在名字前面。
import { computed, h } from 'vue'
import { NButton, NDropdown, type DropdownOption } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { currentUser, logout } from './auth'

const props = defineProps<{
  /** 退出前要做的事（实验页先把没保存的代码存掉） */
  beforeSignOut?: () => Promise<unknown>
}>()

const route = useRoute()
const router = useRouter()

const pages = computed(() =>
  currentUser.value?.role === 'student'
    ? [
        { path: '/', label: '自由练习' },
        { path: '/assignments', label: '我的作业' },
        { path: '/learning', label: '我的学习' },
      ]
    : [
        { path: '/', label: '自由练习' },
        { path: '/teacher', label: '班级管理' },
      ],
)

const options = computed<DropdownOption[]>(() => [
  ...pages.value.map((p) => {
    const here = route.path === p.path
    return {
      key: p.path,
      label: here ? () => h('b', null, p.label) : p.label,
      // 只给当前页打勾，NDropdown 会给其他项留出图标位、自动对齐
      icon: here ? () => h('span', { style: 'color: #2563eb' }, '✓') : undefined,
    }
  }),
  { type: 'divider', key: 'divider' },
  { key: 'help', label: '使用说明' },
  { key: 'logout', label: '退出' },
])

async function select(key: string) {
  if (key === 'help') {
    const href = router.resolve(currentUser.value?.role === 'teacher' ? '/help#teacher' : '/help').href
    window.open(href, '_blank')
  } else if (key === 'logout') {
    await props.beforeSignOut?.()
    await logout()
    await router.push('/login')
  } else if (key !== route.path) {
    await router.push(key)
  }
}
</script>

<template>
  <nav class="top-nav">
    <template v-if="currentUser">
      <slot />
      <NDropdown trigger="click" placement="bottom-end" :options="options" @select="select">
        <NButton quaternary size="small" title="换页面、使用说明、退出">{{ currentUser.name }} ▾</NButton>
      </NDropdown>
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
</style>
