// 页面路由：登录页、使用说明、实验页（自由练习、做作业、老师运行学生的提交共用）、学生的作业列表、数据库页面、老师的班级管理页和评阅页。
import { createRouter, createWebHistory } from 'vue-router'
import { apiHooks } from './api'
import { currentUser } from './auth'

export const router = createRouter({
  history: createWebHistory(),
  // 使用说明的 /help#teacher 打开时滚到老师部分
  scrollBehavior: (to) => (to.hash ? { el: to.hash } : { top: 0 }),
  routes: [
    { path: '/login', component: () => import('./pages/LoginPage.vue'), meta: { public: true } },
    // 使用说明：没登录也能看（学生部分）
    { path: '/help', component: () => import('./pages/HelpPage.vue'), meta: { public: true } },
    { path: '/', component: () => import('./pages/WorkbenchPage.vue') },
    { path: '/assignments', component: () => import('./pages/AssignmentsPage.vue') },
    { path: '/database', component: () => import('./pages/DatabasePage.vue') },
    { path: '/assignments/:id', component: () => import('./pages/WorkbenchPage.vue'), props: (route) => ({ assignmentId: String(route.params.id) }) },
    { path: '/teacher', component: () => import('./pages/TeacherPage.vue'), meta: { teacher: true } },
    {
      path: '/teacher/assignments/:id',
      component: () => import('./pages/ReviewPage.vue'),
      props: (route) => ({ assignmentId: String(route.params.id) }),
      meta: { teacher: true },
    },
    {
      path: '/teacher/submissions/:id/run',
      component: () => import('./pages/WorkbenchPage.vue'),
      props: (route) => ({ submissionId: String(route.params.id) }),
      meta: { teacher: true },
    },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) return currentUser.value && to.path === '/login' ? '/' : true
  if (!currentUser.value) return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  if (to.meta.teacher && currentUser.value.role !== 'teacher') return '/'
  return true
})

// 登录过期（比如老师重置了密码）：回到登录页
apiHooks.onUnauthorized = () => {
  currentUser.value = null
  if (router.currentRoute.value.path !== '/login') void router.push('/login')
}
