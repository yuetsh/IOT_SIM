// 页面路由：登录页、实验页（学生和老师都用）、老师的班级管理页。
import { createRouter, createWebHistory } from 'vue-router'
import { apiHooks } from './api'
import { currentUser } from './auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./pages/LoginPage.vue'), meta: { public: true } },
    { path: '/', component: () => import('./pages/WorkbenchPage.vue') },
    { path: '/teacher', component: () => import('./pages/TeacherPage.vue'), meta: { teacher: true } },
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
