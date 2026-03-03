<script setup lang="ts">
import { useBaseStore } from '@/stores/base'
import dayjs from 'dayjs'
import { State } from 'ts-fsrs'
import isToday from 'dayjs/plugin/isToday' // ES 2015
import utc from 'dayjs/plugin/utc' // ES 2015
dayjs.extend(isToday)
dayjs.extend(utc)

const baseStore = useBaseStore()
let type = $ref('today')

// 将 fsrsData 转换为数组
const fsrsList = computed(() => {
  return Object.entries(baseStore.fsrsData)
    .filter(([word, card]) => {
      return type === 'today' ? dayjs.utc(card.last_review).local().isToday() : true
    })
    .map(([word, card]: [string, any]) => ({
      word,
      ...card,
    }))
})
</script>

<template>
  <div class="fsrs-page">
    <h2>学习记录</h2>
    <div class="flex gap-space items-center">
      <p>共 {{ fsrsList.length }} 条记录</p>
      <BaseButton :type="type === 'today' ? 'primary' : 'info'" @click="type = 'today'">今日学习</BaseButton>
      <BaseButton :type="type === 'all' ? 'primary' : 'info'" @click="type = 'all'">所有记录</BaseButton>
    </div>

    <div class="table-container">
      <table v-if="fsrsList.length > 0">
        <thead>
          <tr>
            <th>单词</th>
            <th>最近复习日期</th>
            <th>下次复习日期</th>
            <th>状态</th>
            <th>记忆稳定性</th>
            <th>难度</th>
            <th>经过天数</th>
            <th>计划间隔</th>
            <th>学习步骤</th>
            <th>复习次数</th>
            <th>遗忘次数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in fsrsList" :key="item.word">
            <td>{{ item.word }}</td>
            <td>{{ item.last_review ? dayjs(item.last_review).format('YYYY-MM-DD HH:mm') : '-' }}</td>
            <td>{{ item.due ? dayjs(item.due).format('YYYY-MM-DD HH:mm') : '-' }}</td>
            <td>{{ State[item.state] }}</td>
            <td>{{ item.stability }}</td>
            <td>{{ item.difficulty }}</td>
            <td>{{ item.elapsed_days }}</td>
            <td>{{ item.scheduled_days }}</td>
            <td>{{ item.learning_steps }}</td>
            <td>{{ item.reps }}</td>
            <td>{{ item.lapses }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无数据</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fsrs-page {
  padding: 20px;

  h2 {
    margin-bottom: 10px;
  }

  p {
    margin-bottom: 20px;
    color: #666;
  }
}

.table-container {
  height: 80vh;
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      white-space: nowrap;
      background-color: var(--color-second);
    }

    th {
      background-color: var(--color-bg);
      font-weight: bold;
    }

    td:hover {
      background-color: var(--color-third);
    }
  }
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
