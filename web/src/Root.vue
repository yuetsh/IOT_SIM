<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider, zhCN } from 'naive-ui'
</script>

<template>
  <NConfigProvider :locale="zhCN">
    <NMessageProvider>
      <NDialogProvider>
        <RouterView />
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
