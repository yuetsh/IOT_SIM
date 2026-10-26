<script setup lang="ts">
// 登录页：学生用老师发的账号密码登录，老师用自己的账号登录。
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NButton, NInput } from 'naive-ui'
import { login } from '../auth'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!username.value || !password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="gate">
    <form class="card" @submit.prevent="submit">
      <h1>物联网编程仿真平台</h1>
      <p>用老师发给你的账号和密码登录</p>
      <NInput v-model:value="username" placeholder="账号" autofocus :input-props="{ autocomplete: 'username' }" />
      <NInput v-model:value="password" type="password" show-password-on="click" placeholder="密码" :input-props="{ autocomplete: 'current-password' }" />
      <div v-if="error" class="error">{{ error }}</div>
      <NButton type="primary" attr-type="submit" block :loading="busy" :disabled="!username || !password">登录</NButton>
      <RouterLink to="/help" target="_blank" class="help">第一次使用？看使用说明</RouterLink>
    </form>
  </div>
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

.help {
  align-self: center;
  color: #2563eb;
  font-size: 13px;
  text-decoration: none;
}
</style>
