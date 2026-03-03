<script setup lang="tsx">
import { _getDictDataByUrl, resourceWrap, reverse, shuffle, useNav } from '@/utils'
import BasePage from '~/components/base/BasePage.vue'
import type { DictResource } from '@/types/types'
import { useRuntimeStore } from '@/stores/runtime'
import BaseIcon from '~/components/base/BaseIcon.vue'
import Empty from '@/components/Empty.vue'
import BaseButton from '~/components/base/BaseButton.vue'
import DictList from '@/components/list/DictList.vue'
import BackIcon from '~/components/icon/BackIcon.vue'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { getDefaultDict } from '@/types/func'
import BaseInput from '@/components/base/BaseInput.vue'
import axios from 'axios'
import DeleteIcon from '~/components/icon/DeleteIcon.vue'
import PopConfirm from '~/components/base/PopConfirm.vue'
import BaseTable from '~/components/base/BaseTable.vue'
import WordItem from '~/components/word/WordItem.vue'
import { AppEnv, DictId } from '~/config/env.ts'
import { detail } from '~/apis'
import { Sort } from '~/types/enum.ts'
import Toast from '~/components/base/toast/Toast.ts'

let list = $ref([])
let selectedFile = $ref(null)
let fileContent = $ref([])
let loading = $ref(false)
let showPanel = $ref(false)
let tableRef = ref()

const handleFileClick = async item => {
  selectedFile = item
  showPanel = true
  loading = true
  try {
    const response = await axios.get('http://jl.cc/' + item.url)
    fileContent = response.data
    tableRef.value.getData()
  } catch (error) {
    fileContent = '加载失败: ' + error.message
  } finally {
    loading = false
  }
}

const closePanel = () => {
  showPanel = false
}


onMounted(() => {
  axios.get('http://jl.cc/').then(response => {
    const regex = /<a href="([^"]+)">([^<]+)<\/a>/g
    let match
    while ((match = regex.exec(response.data)) !== null) {
      // match[1] 是文件链接，match[2] 是文件名
      list.push({ url: match[1], filename: match[2] })
    }
  })
})

async function requestList({ pageNo, pageSize, searchKey }) {
  return { pageNo, pageSize, searchKey, list: fileContent, total: fileContent.length }
}

defineRender(() => {
  return (
    <BasePage class="h-screen">
      <div class="card h-9/10 ">
        <div class="flex  overflow-hidden">
          <div class="left shrink-0 overflow-auto">
            {list.map(item => {
              return (
                <div
                  key={item.filename}
                  class="file-item cursor-pointer hover:bg-gray-100 p-2"
                  onClick={() => handleFileClick(item)}
                >
                  {item.filename}
                </div>
              )
            })}
          </div>

          <div class="right">
            <div v-if="showPanel" class="panel  ">
              <div class="panel-header flex justify-between items-center py-3 px-4 border-b">
                <span class="font-bold">{selectedFile?.filename}</span>
                <button click="closePanel" class="close-btn">
                  &times;
                </button>
              </div>
              <div class="panel-content  ">
                <BaseTable ref={tableRef} class="h-full w-100" request={requestList}>
                  {val => (
                    <WordItem
                      showTransPop={false}
                      onClick={() => editWord(val.item)}
                      index={val.index}
                      showCollectIcon={false}
                      showMarkIcon={false}
                      item={val.item}
                    >
                      {{
                        prefix: () => val.checkbox(val.item),
                        suffix: () => (
                          <div class="flex flex-col">
                            <BaseIcon class="option-icon" onClick={() => editWord(val.item)} title="编辑">
                              <IconFluentTextEditStyle20Regular />
                            </BaseIcon>
                            <PopConfirm title="确认删除？" onConfirm={() => batchDel([val.item.id])}>
                              <BaseIcon class="option-icon" title="删除">
                                <DeleteIcon />
                              </BaseIcon>
                            </PopConfirm>
                          </div>
                        ),
                      }}
                    </WordItem>
                  )}
                </BaseTable>

              </div>
            </div>
          </div>
        </div>
      </div>
    </BasePage>
  )
})
</script>

<template></template>

<style scoped lang="scss"></style>
