<script setup lang="ts">
// 访问口令页：输对后刷新页面进入平台（口令由服务器记在 cookie 里，之后不用再输）。
import { ref } from 'vue'
import { NButton, NConfigProvider, NInput, zhCN } from 'naive-ui'

const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    })
    if (response.ok) {
      location.reload()
      return
    }
    error.value = ((await response.json().catch(() => ({}))) as { message?: string }).message ?? '登录失败'
  } catch {
    error.value = '连不上服务器，请稍后再试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <NConfigProvider :locale="zhCN">
    <div class="gate">
      <form class="card" @submit.prevent="submit">
        <h1>物联网编程仿真平台</h1>
        <p>请输入老师给的访问口令</p>
        <NInput v-model:value="password" type="password" show-password-on="click" placeholder="访问口令" autofocus />
        <div v-if="error" class="error">{{ error }}</div>
        <NButton type="primary" attr-type="submit" block :loading="busy" :disabled="!password">进入</NButton>
      </form>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  background: #f3f4f6;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 320px;
  padding: 28px 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

h1 {
  margin: 0;
  font-size: 18px;
}

p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.error {
  color: #dc2626;
  font-size: 13px;
}
</style>
