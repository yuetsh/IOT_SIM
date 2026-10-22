<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider, zhCN } from 'naive-ui'
</script>

<template>
  <NConfigProvider :locale="zhCN">
    <NMessageProvider>
      <NDialogProvider>
        <!-- 换一个作业时重新创建页面（同一页面里只换参数时 Vue 默认会复用组件） -->
        <RouterView :key="$route.path" />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
}
</style>
