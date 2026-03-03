<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { getDefaultSettingState, useSettingStore } from '@/stores/setting'
import { getShortcutKey, useEventListener } from '@/hooks/event'
import { checkAndUpgradeSaveDict, checkAndUpgradeSaveSetting, cloneDeep, loadJsLib, sleep } from '@/utils'
import BaseButton from '~/components/base/BaseButton.vue'
import { getDefaultBaseState, useBaseStore } from '@/stores/base'
import {
  APP_NAME,
  APP_VERSION,
  DefaultShortcutKeyMap,
  IS_DEV,
  LIB_JS_URL,
  LOCAL_FILE_KEY,
  Old_Host,
  Origin,
} from '@/config/env'
import BasePage from '~/components/base/BasePage.vue'
import Toast from '@/components/base/toast/Toast'
import { set } from 'idb-keyval'
import { useRuntimeStore } from '@/stores/runtime'
import { useExport } from '@/hooks/export'
import MigrateDialog from '@/components/MigrateDialog.vue'
import Log from '@/components/setting/Log.vue'
import About from '@/components/About.vue'
import CommonSetting from '@/components/setting/CommonSetting.vue'
import ArticleSetting from '@/components/setting/ArticleSetting.vue'
import WordSetting from '@/components/setting/WordSetting.vue'
import {
  PRACTICE_ARTICLE_CACHE,
  PRACTICE_WORD_CACHE,
  setPracticeArticleCache,
  setPracticeWordCache,
} from '@/utils/cache'
import SettingItem from '~/components/setting/SettingItem.vue'
import Form, { type FormType } from '~/components/base/form/Form.vue'
import { SUPABASE_KEY, SUPABASE_URL } from '~/utils/supabase.ts'

let route = useRoute()
let title = APP_NAME + ' 设置'
useSeoMeta({
  title: title,
  description: title,
  ogTitle: title,
  ogDescription: title,
  ogUrl: Origin + route.fullPath,
  twitterTitle: title,
  twitterDescription: title,
})

const emit = defineEmits<{
  toggleDisabledDialogEscKey: [val: boolean]
}>()

const tabIndex = $ref(0)
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()

const config = useRuntimeConfig()

// console.log('runtimeConfig ',config)
//@ts-ignore
// const gitLastCommitHash = ref(LATEST_COMMIT_HASH)
const gitLastCommitHash = ref(config?.public?.latestCommitHash)

let editShortcutKey = $ref('')

const disabledDefaultKeyboardEvent = $computed(() => {
  return editShortcutKey && tabIndex === 3
})

watch(
  () => disabledDefaultKeyboardEvent,
  v => {
    emit('toggleDisabledDialogEscKey', !!v)
  }
)

// 监听编辑快捷键状态变化，自动聚焦输入框
watch(
  () => editShortcutKey,
  newVal => {
    if (newVal) {
      // 使用nextTick确保DOM已更新
      nextTick(() => {
        focusShortcutInput()
      })
    }
  }
)

useEventListener('keydown', (e: KeyboardEvent) => {
  if (!disabledDefaultKeyboardEvent) return

  // 确保阻止浏览器默认行为
  e.preventDefault()
  e.stopPropagation()

  let shortcutKey = getShortcutKey(e)
  // console.log('e', e, e.keyCode, e.ctrlKey, e.altKey, e.shiftKey)
  // console.log('key', shortcutKey)

  // if (shortcutKey[shortcutKey.length-1] === '+') {
  //   settingStore.shortcutKeyMap[editShortcutKey] = DefaultShortcutKeyMap[editShortcutKey]
  //   return ElMessage.warning('设备失败！')
  // }

  if (editShortcutKey) {
    if (shortcutKey === 'Delete') {
      settingStore.shortcutKeyMap[editShortcutKey] = ''
    } else {
      // 忽略单独的修饰键
      if (
        shortcutKey === 'Ctrl+' ||
        shortcutKey === 'Alt+' ||
        shortcutKey === 'Shift+' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Shift'
      ) {
        return
      }

      for (const [k, v] of Object.entries(settingStore.shortcutKeyMap)) {
        if (v === shortcutKey && k !== editShortcutKey) {
          settingStore.shortcutKeyMap[editShortcutKey] = DefaultShortcutKeyMap[editShortcutKey]
          return Toast.warning('快捷键重复！')
        }
      }
      settingStore.shortcutKeyMap[editShortcutKey] = shortcutKey
    }
  }
})

function handleInputBlur() {
  // 输入框失焦时结束编辑状态
  editShortcutKey = ''
}

function handleBodyClick() {
  if (editShortcutKey) {
    editShortcutKey = ''
  }
}

function focusShortcutInput() {
  // 找到当前正在编辑的快捷键输入框
  const inputElements = document.querySelectorAll('.set-key input')
  if (inputElements && inputElements.length > 0) {
    // 聚焦第一个找到的输入框
    const inputElement = inputElements[0] as HTMLInputElement
    inputElement.focus()
  }
}

// 快捷键中文名称映射
function getShortcutKeyName(key: string): string {
  const shortcutKeyNameMap = {
    ShowWord: '显示单词',
    EditArticle: '编辑文章',
    Next: '下一个',
    Previous: '上一个',
    ToggleSimple: '切换已掌握状态',
    ToggleCollect: '切换收藏状态',
    NextChapter: '下一组',
    PreviousChapter: '上一组',
    RepeatChapter: '重复本组',
    DictationChapter: '默写本组',
    PlayWordPronunciation: '播放发音',
    ToggleShowTranslate: '切换显示翻译',
    ToggleDictation: '切换默写模式',
    ToggleTheme: '切换主题',
    ToggleToolbar: '切换底部工具栏',
    TogglePanel: '切换面板',
    RandomWrite: '随机默写',
    NextRandomWrite: '继续随机默写',
    KnowWord: '认识单词',
    UnknownWord: '不认识单词',
  }

  return shortcutKeyNameMap[key] || key
}

function resetShortcutKeyMap() {
  editShortcutKey = ''
  settingStore.shortcutKeyMap = cloneDeep(DefaultShortcutKeyMap)
  Toast.success('恢复成功')
}

let importLoading = $ref(false)

const { loading: exportLoading, exportData } = useExport()

function importJson(str: string, notice: boolean = true) {
  importLoading = true
  let obj = {
    version: -1,
    val: {
      setting: {},
      dict: {},
      [PRACTICE_WORD_CACHE.key]: {},
      [PRACTICE_ARTICLE_CACHE.key]: {},
      [APP_VERSION.key]: {},
    },
  }
  try {
    obj = JSON.parse(str)
    let data = obj.val
    let settingState = checkAndUpgradeSaveSetting(data.setting)
    settingState.load = true
    settingStore.setState(settingState)
    let baseState = checkAndUpgradeSaveDict(data.dict)
    baseState.load = true
    store.setState(baseState)
    setPracticeWordCache(null)
    setPracticeArticleCache(null)
    if (obj.version >= 4) {
      try {
        let save: any = obj.val[PRACTICE_WORD_CACHE.key] || {}
        if (save.val && Object.keys(save.val).length > 0) {
          localStorage.setItem(PRACTICE_WORD_CACHE.key, JSON.stringify(obj.val[PRACTICE_WORD_CACHE.key]))
        }
      } catch (e) {
        //todo 上报
      }
      try {
        let save: any = obj.val[PRACTICE_ARTICLE_CACHE.key] || {}
        if (save.val && Object.keys(save.val).length > 0) {
          localStorage.setItem(PRACTICE_ARTICLE_CACHE.key, JSON.stringify(obj.val[PRACTICE_ARTICLE_CACHE.key]))
        }
      } catch (e) {
        //todo 上报
      }
      try {
        let r: any = obj.val[APP_VERSION.key] || -1
        set(APP_VERSION.key, r)
        runtimeStore.isNew = r ? APP_VERSION.version > Number(r) : true
      } catch (e) {
        //todo 上报
      }
    }
    notice && Toast.success('导入成功！')
  } catch (err) {
    return Toast.error('导入失败！')
  } finally {
    importLoading = false
  }
}

let timer = -1 as any
async function beforeImport() {
  if (!IS_DEV) {
    importLoading = true
    await exportData('已自动备份数据', 'TypeWords数据备份.zip')
    await sleep(1500)
  }
  let d: HTMLDivElement = document.querySelector('#import')
  d.click()
  timer = setTimeout(() => (importLoading = false), 1000)
}

async function importData(e) {
  clearTimeout(timer)
  importLoading = true
  let file = e.target.files[0]
  if (!file) return (importLoading = false)
  if (file.name.endsWith('.json')) {
    let reader = new FileReader()
    reader.onload = function (v) {
      let str: any = v.target.result
      if (str) {
        importJson(str)
      }
    }
    reader.readAsText(file)
  } else if (file.name.endsWith('.zip')) {
    try {
      const JSZip = await loadJsLib('JSZip', LIB_JS_URL.JSZIP)
      const zip = await JSZip.loadAsync(file)

      const dataFile = zip.file('data.json')
      if (!dataFile) {
        return Toast.error('缺少 data.json，导入失败')
      }

      const mp3Folder = zip.folder('mp3')
      if (mp3Folder) {
        const records: { id: string; file: Blob }[] = []
        for (const filename in zip.files) {
          if (filename.startsWith('mp3/') && filename.endsWith('.mp3')) {
            const entry = zip.file(filename)
            if (!entry) continue
            const blob = await entry.async('blob')
            const id = filename.replace(/^mp3\//, '').replace(/\.mp3$/, '')
            records.push({ id, file: blob })
          }
        }
        await set(LOCAL_FILE_KEY, records)
      }

      const str = await dataFile.async('string')
      importJson(str, false)

      Toast.success('导入成功！')
    } catch (e) {
      Toast.error(e?.message || e || '导入失败')
    } finally {
      importLoading = false
    }
  } else {
    Toast.error('不支持的文件类型')
  }
  importLoading = false
}

let isNewHost = $ref(false)
let showTransfer = $ref(false)

onMounted(() => {
  isNewHost = window.location.host !== Old_Host
})

function transferOk() {
  setTimeout(() => {
    window.location.href = '/words'
  }, 1500)
}

function clearAllData() {
  let d = getDefaultBaseState()
  d.load = true
  store.setState(d)
  let d1 = getDefaultSettingState()
  d1.load = true
  settingStore.setState(d1)
}
let sbFormRef = $ref<FormType>()
let sbForm = $ref({
  url: localStorage.getItem(SUPABASE_URL) ?? '',
  key: localStorage.getItem(SUPABASE_KEY) ?? '',
})

let sbFormRules = {
  url: [{ required: true, message: '请输入 Supbase Url', trigger: 'blur' }],
  key: [{ required: true, message: '请输入  Supbase Key', trigger: 'blur' }],
}

function saveSbConfig() {
  sbFormRef?.validate(async valid => {
    if (valid) {
      Supabase.saveConfig(sbForm?.url, sbForm?.key)

      // 重新初始化 Supabase 实例
      Supabase.instance = null
      const supabase = Supabase.getInstance()

      try {
        // 检测 data 表是否存在
        const { error: checkError } = await supabase.from('typewords_data').select('id').limit(1)

        if (checkError) {
          Toast.error('表不存在')
        } else {
          // 表已存在，检测是否需要插入默认数据
          const { data: existingData } = await supabase.from('typewords_data').select('type')
          const existingTypes = existingData?.map(d => d.type) || []

          const defaultData = [
            { type: 'word', data: {} },
            { type: 'setting', data: {} },
            { type: 'cache', data: {} },
          ]

          for (const item of defaultData) {
            if (!existingTypes.includes(item.type)) {
              await supabase.from('data').insert(item)
            }
          }
        }
        Toast.success('保存成功')
      } catch (error) {
        Toast.error('保存成功，但初始化数据表失败: ' + error.message)
      }
      // setTimeout(() => {
      //   location.href = '/words'
      // }, 1000)
    }
  })
}
function removeSbConfig() {
  sbFormRef?.validate(async valid => {
    if (valid) {
      Supabase.removeConfig()
      Toast.success('清除成功')
      setTimeout(() => {
        location.href = '/words'
      }, 1000)
    }
  })
}
</script>

<template>
  <BasePage>
    <div class="setting text-md card flex flex-col" style="height: calc(100vh - 3rem)">
      <div class="page-title text-align-center">{{ $t('setting') }}</div>
      <div class="flex flex-1 overflow-hidden gap-4">
        <div class="left">
          <div class="tabs">
            <div class="tab" :class="tabIndex === 0 && 'active'" @click="tabIndex = 0">
              <IconFluentSettings20Regular />
              <span>{{ $t('general_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 1 && 'active'" @click="tabIndex = 1">
              <IconFluentTextUnderlineDouble20Regular />
              <span>{{ $t('word_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 2 && 'active'" @click="tabIndex = 2">
              <IconFluentBookLetter20Regular />
              <span>{{ $t('article_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 4 && 'active'" @click="tabIndex = 4">
              <IconFluentDatabasePerson20Regular />
              <span>{{ $t('data_management') }}</span>
            </div>

            <div class="tab" :class="tabIndex === 3 && 'active'" @click="tabIndex = 3">
              <IconFluentKeyboardLayoutFloat20Regular />
              <span>{{ $t('shortcut_settings') }}</span>
            </div>

            <div
              class="tab"
              :class="tabIndex === 5 && 'active'"
              @click="
                () => {
                  tabIndex = 5
                  runtimeStore.isNew = false
                  set(APP_VERSION.key, APP_VERSION.version)
                }
              "
            >
              <IconFluentTextBulletListSquare20Regular />
              <span>{{ $t('update_log') }}</span>
              <div class="red-point" v-if="runtimeStore.isNew"></div>
            </div>
            <div class="tab" :class="tabIndex === 6 && 'active'" @click="tabIndex = 6">
              <IconFluentPerson20Regular />
              <span>{{ $t('about') }}</span>
            </div>
          </div>
        </div>
        <div class="col-line"></div>
        <div class="flex-1 overflow-y-auto overflow-x-hidden pr-4 content">
          <CommonSetting v-if="tabIndex === 0" />
          <WordSetting v-if="tabIndex === 1" />
          <ArticleSetting v-if="tabIndex === 2" />

          <div class="body" v-if="tabIndex === 3">
            <div class="row">
              <label class="main-title">{{ $t('function') }}</label>
              <div class="wrapper">{{ $t('shortcut_key') }}</div>
            </div>
            <div class="scroll">
              <div class="row" v-for="item of Object.entries(settingStore.shortcutKeyMap)">
                <label class="item-title">{{ getShortcutKeyName(item[0]) }}</label>
                <div class="wrapper" @click="editShortcutKey = item[0]">
                  <div class="set-key" v-if="editShortcutKey === item[0]">
                    <input
                      ref="shortcutInput"
                      :value="item[1] ? item[1] : $t('no_shortcut_set')"
                      readonly
                      type="text"
                      @blur="handleInputBlur"
                    />
                    <span @click.stop="editShortcutKey = ''"
                      >{{ $t('press_key_to_set') }}，<span class="text-red!">{{
                        $t('click_here_when_done')
                      }}</span></span
                    >
                  </div>
                  <div v-else>
                    <div v-if="item[1]">{{ item[1] }}</div>
                    <span v-else>{{ $t('no_shortcut_set') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <label class="item-title"></label>
              <div class="wrapper">
                <BaseButton @click="resetShortcutKeyMap">{{ $t('restore_default') }}</BaseButton>
              </div>
            </div>
          </div>

          <div v-if="tabIndex === 4">
            <!--            导出数据-->
            <SettingItem
              title="导出数据"
              :desc="`${$t('data_saved_locally')}。如果您需要在不同的设备、浏览器上使用 ${APP_NAME}，
              您需要手动进行数据导出和导入`"
            >
              <BaseButton :loading="exportLoading" @click="exportData()">{{ $t('export_data_backup') }}</BaseButton>
            </SettingItem>
            <div class="text-gray text-sm">💾 导出的ZIP文件包含所有学习数据，可在其他设备上导入恢复</div>
            <div class="line my-3"></div>

            <!--            导入数据-->
            <SettingItem title="导出数据">
              <div class="flex" v-if="!isIOS()">
                <BaseButton @click="beforeImport" :loading="importLoading">{{ $t('import_data_restore') }}</BaseButton>
                <input
                  type="file"
                  id="import"
                  class="w-0 h-0 opacity-0"
                  accept="application/json,.zip,application/zip"
                  @change="importData"
                />
              </div>
              <div class="inline-block relative" v-else>
                <BaseButton :loading="importLoading">{{ $t('import_data_restore') }}</BaseButton>
                <input
                  type="file"
                  id="import"
                  class="absolute left-0 top-0 w-full h-full opacity-0"
                  accept="application/json,.zip,application/zip"
                  @change="importData"
                />
              </div>
            </SettingItem>
            <div>
              请注意，导入数据将<b class="text-red"> 完全覆盖 </b
              >当前所有数据，请谨慎操作。执行导入操作时，会先自动备份当前数据到您的电脑中，供您随时恢复
            </div>

            <!--            新网站同步-->
            <template v-if="isNewHost">
              <div class="line my-3"></div>
              <SettingItem title="迁移 2study.top 网站数据">
                <BaseButton @click="showTransfer = true">迁移</BaseButton>
              </SettingItem>
              <div>
                请注意，如果本地已有使用记录，请先备份当前数据，迁移数据后将<b class="text-red"> 完全覆盖 </b
                >当前所有数据，请谨慎操作。
              </div>
            </template>

            <div class="line my-3"></div>
            <div class="mt-3">
              <SettingItem title="Supbase 设置" desc="网站不会上传您的 url 和 key，只保存在浏览器本地(Local storage)">
              </SettingItem>

              <Form ref="sbFormRef" :rules="sbFormRules" :model="sbForm">
                <FormItem label="Url" prop="url">
                  <BaseInput v-model="sbForm.url" />
                </FormItem>
                <FormItem label="Key" prop="key">
                  <BaseInput v-model="sbForm.key" />
                </FormItem>
                <FormItem label="创建表语句" >
                  <span>
                    CREATE TABLE IF NOT EXISTS typewords_data (
                                       id SERIAL PRIMARY KEY,
                                       data JSONB,
                                       type TEXT UNIQUE NOT NULL,
                                       updated_at TIMESTAMPTZ DEFAULT now()
                );
                INSERT INTO typewords_data (type, data) VALUES
                  ('word', '{}'),
                  ('setting', '{}'),
                  ('cache', '{}')
                ON CONFLICT (type) DO NOTHING;
                  </span>
                </FormItem>
              </Form>
              <div class="flex justify-end">
                <BaseButton @click="removeSbConfig">删除配置</BaseButton>
                <BaseButton @click="saveSbConfig">保存配置</BaseButton>
              </div>
            </div>

            <div class="line my-3"></div>
            <SettingItem title="其他"> </SettingItem>
            <div class="flex gap-space">
              <PopConfirm title="该操作将会清除所有数据，确认继续？" @confirm="clearAllData">
                <BaseButton>清除所有数据</BaseButton>
              </PopConfirm>
            </div>
          </div>

          <!--          日志-->
          <Log v-if="tabIndex === 5" />

          <div v-if="tabIndex === 6" class="center flex-col">
            <About />
            <div class="text-md color-gray mt-10">Build {{ gitLastCommitHash }}</div>
          </div>
        </div>
      </div>
    </div>
  </BasePage>

  <MigrateDialog v-model="showTransfer" @ok="transferOk" />
</template>

<style scoped lang="scss">
.col-line {
  border-right: 2px solid var(--color-line);
}

.setting {
  .left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;

    .tabs {
      padding: 0.6rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      .tab {
        @apply cursor-pointer flex items-center relative;
        border-radius: 0.5rem;
        @apply w-auto p-1 lg:w-40 lg:p-2;
        gap: 0.6rem;
        transition: all 0.5s;

        svg {
          @apply text-lg shrink-0;
        }

        &:hover {
          background: var(--color-fourth);
        }

        &.active {
          background: var(--color-fourth);
        }
      }
    }
  }

  .content {
    .row {
      min-height: 2.6rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--space) * 5);

      .wrapper {
        height: 2rem;
        flex: 1;
        display: flex;
        justify-content: flex-end;
        gap: var(--space);

        span {
          text-align: right;
          color: gray;
        }

        .set-key {
          align-items: center;

          input {
            width: 9rem;
            box-sizing: border-box;
            margin-right: 0.6rem;
            height: 1.8rem;
            outline: none;
            font-size: 1rem;
            border: 1px solid gray;
            border-radius: 0.2rem;
            padding: 0 0.3rem;
            background: var(--color-second);
            color: var(--color-font-1);
          }
        }
      }

      .main-title {
        font-size: 1.1rem;
        font-weight: bold;
      }

      .item-title {
        font-size: 1rem;
      }

      .sub-title {
        font-size: 0.9rem;
      }
    }

    .body {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .scroll {
      flex: 1;
      padding-right: 0.6rem;
      overflow: auto;
    }

    .line {
      border-bottom: 1px solid #c4c3c3;
    }
  }
}
</style>
