<script setup lang="ts">
// 查询结果网格（只读），和 SSMS 一样：左边是行号，NULL 显示成浅黄底的 "NULL"。
import type { ResultSet } from './sql'

defineProps<{ result: ResultSet }>()
</script>

<template>
  <div class="grid-wrap">
    <table class="grid">
      <thead>
        <tr>
          <th class="num" />
          <th v-for="(column, i) in result.columns" :key="i" :title="column.type ?? ''">{{ column.name || '(无列名)' }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in result.rows" :key="r">
          <th class="num">{{ r + 1 }}</th>
          <td v-for="(cell, c) in row" :key="c" :class="{ null: cell === null }">{{ cell === null ? 'NULL' : cell }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="result.total > result.rows.length" class="more">共 {{ result.total }} 行，只显示前 {{ result.rows.length }} 行</div>
  </div>
</template>

<style scoped>
.grid-wrap {
  overflow: auto;
  max-height: 100%;
}

.grid {
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif;
  background: #fff;
}

.grid th,
.grid td {
  border: 1px solid #d4d4d4;
  padding: 2px 6px;
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  font-weight: normal;
}

.grid thead th {
  background: #f3f3f3;
  position: sticky;
  top: 0;
}

.grid .num {
  background: #f3f3f3;
  color: #666;
  text-align: right;
  min-width: 28px;
}

.grid td.null {
  background: #ffffe1;
  color: #666;
}

.more {
  padding: 4px;
  font-size: 12px;
  color: #666;
}
</style>
