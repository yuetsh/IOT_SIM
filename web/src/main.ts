import { createApp } from 'vue'
import { loadCurrentUser } from './auth'
import Root from './Root.vue'
import { router } from './router'
import './winforms/winforms.css'

// 先确认是否已登录，路由守卫据此决定进登录页还是实验页
await loadCurrentUser()

createApp(Root).use(router).mount('#app')
