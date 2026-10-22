import { createApp } from 'vue'
import AccessGate from './AccessGate.vue'
import App from './App.vue'
import './winforms/winforms.css'

// 服务器设置了访问口令而浏览器还没输过时，先显示口令页
const auth = await fetch('/api/auth')
  .then((response) => response.json() as Promise<{ ok: boolean }>)
  .catch(() => ({ ok: true }))

createApp(auth.ok ? App : AccessGate).mount('#app')
