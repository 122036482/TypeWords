<script setup lang="ts">
import { useBaseStore } from '@/stores/base.ts'
import { useRouter } from 'vue-router'
import BaseIcon from '~/components/base/BaseIcon.vue'
import {
  _getAccomplishDate,
  _getDictDataByUrl,
  _nextTick,
  isMobile,
  loadJsLib,
  resourceWrap,
  shuffle,
  useNav,
} from '@/utils'
import BasePage from '~/components/base/BasePage.vue'
import type { DictResource } from '@/types/types.ts'
import { watch } from 'vue'
import { getCurrentStudyWord } from '@/hooks/dict.ts'
import { useRuntimeStore } from '@/stores/runtime.ts'
import Book from '@/components/Book.vue'
import PopConfirm from '~/components/base/PopConfirm.vue'
import Progress from '@/components/base/Progress.vue'
import Toast from '@/components/base/toast/Toast.ts'
import BaseButton from '~/components/base/BaseButton.vue'
import { getDefaultDict } from '@/types/func.ts'
import DeleteIcon from '@/components/icon/DeleteIcon.vue'
import PracticeSettingDialog from '~/components/word/PracticeSettingDialog.vue'
import ChangeLastPracticeIndexDialog from '~/components/word/ChangeLastPracticeIndexDialog.vue'
import { useSettingStore } from '@/stores/setting.ts'
import { useFetch } from '@vueuse/core'
import {
  APP_NAME,
  AppEnv,
  DICT_LIST,
  LIB_JS_URL,
  Old_Host,
  Origin,
  TourConfig,
  WordPracticeModeNameMap,
  WordPracticeModeUrlMap,
} from '@/config/env.ts'
import { myDictList } from '@/apis'
import PracticeWordListDialog from '~/components/word/PracticeWordListDialog.vue'
import ShufflePracticeSettingDialog from '~/components/word/ShufflePracticeSettingDialog.vue'
import { deleteDict } from '@/apis/dict.ts'
import OptionButton from '@/components/base/OptionButton.vue'
import { usePracticeWordPersistence } from '@/composables/usePracticePersistence'
import { WordPracticeMode } from '@/types/enum.ts'

const store = useBaseStore()
const settingStore = useSettingStore()
const practiceStore = usePracticeStore()
const wordPersistence = usePracticeWordPersistence()
const router = useRouter()
const { nav } = useNav()
const runtimeStore = useRuntimeStore()
let loading = $ref(true)
let isSaveData = $ref(false)

const shouldShowDialogPracticeMode = $ref([WordPracticeMode.Shuffle, WordPracticeMode.ShuffleWordsTest])

useHead({
  title: APP_NAME + ' 单词',
})
let currentStudy = $ref({
  new: [],
  review: [],
})

watch(
  () => store.load,
  n => {
    if (n) {
      init()
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step1',
          text: '点击这里选择一本词典开始学习',
          attachTo: {
            element: '#step1',
            on: 'bottom',
          },
          buttons: [
            {
              text: `下一步（1/${TourConfig.total}）`,
              action() {
                tour.next()
                router.push('/dict-list')
              },
            },
          ],
        })
        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) tour.start()
      }, 500)
    }
  },
  { immediate: true }
)

async function init() {
  if (AppEnv.CAN_REQUEST) {
    let res = await myDictList({ type: 'word' })
    if (res.success) {
      store.setState(Object.assign(store.$state, res.data))
    }
  }
  if (store.word.studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.words.length) {
      store.word.bookList[store.word.studyIndex] = await _getDictDataByUrl(store.sdict)
    }
  }
  if (!currentStudy.new.length && store.sdict.words.length) {
    const d = await wordPersistence.load()
    if (d) {
      currentStudy = d.taskWords
      isSaveData = true
      if (!currentStudy.new.length && !currentStudy.review.length) {
        isSaveData = false
        wordPersistence.clear()
        init()
      }
    } else {
      currentStudy = getCurrentStudyWord()
    }
  }
  loading = false
}

function startPractice(practiceMode: WordPracticeMode, resetCache: boolean = false): void {
  if (resetCache) {
    wordPersistence.clear()
  }
  if (shouldShowDialogPracticeMode.includes(practiceMode)) {
    editingWordPracticeMode = practiceMode
    showShufflePracticeSettingDialog = true
    return
  }

  if (store.sdict.id) {
    if (!store.sdict.words.length) {
      Toast.warning('没有单词可学习！')
      return
    }

    settingStore.wordPracticeMode = practiceMode

    window.umami?.track('startStudyWord', {
      name: store.sdict.name,
      index: store.sdict.lastLearnIndex,
      perDayStudyNumber: store.sdict.perDayStudyNumber,
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      wordPracticeMode: settingStore.wordPracticeMode,
    })
    //把是否是第一次设置为false
    settingStore.first = false
    nav(WordPracticeModeUrlMap[practiceMode] + '/' + store.sdict.id, {}, { taskWords: currentStudy })
  } else {
    window.umami?.track('no-dict')
    Toast.warning('请先选择一本词典')
  }
}

function freePractice() {
  startPractice(WordPracticeMode.Free, settingStore.wordPracticeMode !== WordPracticeMode.Free)
}
function systemPractice() {
  startPractice(
    settingStore.wordPracticeMode === WordPracticeMode.Free ? WordPracticeMode.System : settingStore.wordPracticeMode,
    settingStore.wordPracticeMode === WordPracticeMode.Free
  )
}

let editingWordPracticeMode = $ref(0)

let showPracticeSettingDialog = $ref(false)
let showShufflePracticeSettingDialog = $ref(false)
let showChangeLastPracticeIndexDialog = $ref(false)
let showPracticeWordListDialog = $ref(false)

async function goDictDetail(val: DictResource) {
  if (!val.id) return nav('dict-list')
  runtimeStore.editDict = getDefaultDict(val)
  nav('/dict', {})
}

let isManageDict = $ref(false)
let selectIds = $ref([])

async function handleBatchDel() {
  if (AppEnv.CAN_REQUEST) {
    let res = await deleteDict(null, selectIds)
    if (res.success) {
      init()
    } else {
      Toast.error(res.msg)
    }
  } else {
    selectIds.forEach(id => {
      let r = store.word.bookList.findIndex(v => v.id === id)
      if (r !== -1) {
        if (store.word.studyIndex === r) {
          store.word.studyIndex = -1
        }
        if (store.word.studyIndex > r) {
          store.word.studyIndex--
        }
        store.word.bookList.splice(r, 1)
      }
    })
    selectIds = []
    Toast.success('删除成功！')
  }
}

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

const progressTextLeft = $computed(() => {
  if (store.sdict.complete) return '已学完，进入总复习阶段'
  return '当前进度：已学' + store.currentStudyProgress + '%'
})

function check(cb: Function) {
  if (!store.sdict.id) {
    Toast.warning('请先选择一本词典')
  } else {
    runtimeStore.editDict = getDefaultDict(store.sdict)
    cb()
  }
}

async function savePracticeSetting() {
  Toast.success('修改成功')
  isSaveData = false
  wordPersistence.clear()
  await store.changeDict(runtimeStore.editDict)
  currentStudy = getCurrentStudyWord()
}

async function onShufflePracticeSettingOk(total) {
  isSaveData = false
  wordPersistence.clear()
  settingStore.wordPracticeMode = editingWordPracticeMode

  window.umami?.track('startStudyWord', {
    name: store.sdict.name,
    index: store.sdict.lastLearnIndex,
    perDayStudyNumber: store.sdict.perDayStudyNumber,
    custom: store.sdict.custom,
    complete: store.sdict.complete,
    wordPracticeMode: settingStore.wordPracticeMode,
  })

  let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
  currentStudy.review = shuffle(
    store.sdict.words.slice(0, store.sdict.lastLearnIndex).filter(v => !ignoreList.includes(v.word))
  ).slice(0, total)
  nav(
    WordPracticeModeUrlMap[editingWordPracticeMode] + '/' + store.sdict.id,
    {},
    {
      taskWords: currentStudy,
      total, //用于再来一组时，随机出正确的长度，因为练习中可能会点击已掌握，导致重学一遍之后长度变少，如果再来一组，此时长度就不正确
    }
  )
}

async function saveLastPracticeIndex(e) {
  Toast.success('修改成功')
  runtimeStore.editDict.lastLearnIndex = e
  // runtimeStore.editDict.complete = e >= runtimeStore.editDict.length - 1
  showChangeLastPracticeIndexDialog = false
  isSaveData = false
  wordPersistence.clear()
  await store.changeDict(runtimeStore.editDict)
  currentStudy = getCurrentStudyWord()
}

const { data: recommendDictList, isFetching } = useFetch(resourceWrap(DICT_LIST.WORD.RECOMMENDED)).json()

const systemPracticeText = $computed(() => {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
    return '开始学习'
  } else {
    return isSaveData
      ? '继续' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
      : '开始' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
  }
})

let isOldHost = $ref(false)
onMounted(() => {
  isOldHost = window.location.host === Old_Host
})
</script>

<template>
  <BasePage>
    <div class="my-30 text-2xl text-red" v-if="isOldHost">
      已启用新域名
      <a class="mr-4" :href="`${Origin}/words?from_old_site=1`">{{ Origin }}</a
      >当前 2study.top 域名将在不久后停止使用
    </div>

    <div class="card flex flex-col md:flex-row gap-4">
      <div class="flex-1 w-full flex flex-col justify-between">
        <div class="flex gap-3">
          <div class="p-1 center rounded-full bg-white">
            <IconFluentBookNumber20Filled class="text-xl color-link" />
          </div>
          <div @click="goDictDetail(store.sdict)" class="text-2xl font-bold cursor-pointer">
            {{ store.sdict.name || $t('no_dict_selected') }}
          </div>
        </div>

        <template v-if="store.sdict.id">
          <div class="mt-4 space-y-2">
            <div class="text-sm flex justify-between">
              <span v-opacity="store.sdict.id && store.sdict.lastLearnIndex < store.sdict.length">
                {{ $t('estimated_completion') }}：{{
                  _getAccomplishDate(
                    store.sdict.words.length - store.sdict.lastLearnIndex,
                    store.sdict.perDayStudyNumber
                  )
                }}
              </span>
            </div>
            <Progress size="large" :percentage="store.currentStudyProgress" :show-text="false"></Progress>

            <div class="text-sm flex justify-between">
              <span>{{ progressTextLeft }}</span>
              <span> {{ store.sdict?.lastLearnIndex }} / {{ store.sdict.length }} 词</span>
            </div>
          </div>
          <div class="flex items-center mt-4 gap-4">
            <BaseButton type="info" size="small" @click="router.push('/dict-list')">
              <div class="center gap-1">
                <IconFluentArrowSwap20Regular />
                <span>{{ $t('select_dict') }}</span>
              </div>
            </BaseButton>
            <PopConfirm
              :disabled="!isSaveData"
              title="当前存在未完成的学习任务，修改会重新生成学习任务，是否继续？"
              @confirm="check(() => (showChangeLastPracticeIndexDialog = true))"
            >
              <BaseButton type="info" size="small" v-if="store.sdict.id">
                <div class="center gap-1">
                  <IconFluentSlideTextTitleEdit20Regular />
                  <span>{{ $t('change_progress') }}</span>
                </div>
              </BaseButton>
            </PopConfirm>

            <BaseButton v-if="settingStore.enableFSRS" type="info" size="small" @click="router.push('/fsrs')"> 学习记录 </BaseButton>
          </div>
        </template>

        <div class="flex items-center gap-4 mt-2 flex-1" v-else>
          <div class="title">{{ $t('select_dict_to_start') }}</div>
          <BaseButton id="step1" type="primary" size="large" @click="router.push('/dict-list')">
            <div class="center gap-1">
              <IconFluentAdd16Regular />
              <span>{{ $t('select_dict') }}</span>
            </div>
          </BaseButton>
        </div>
      </div>

      <div class="flex-1 w-full mt-4 md:mt-0" :class="!store.sdict.id && 'opacity-30 cursor-not-allowed'">
        <div class="flex justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 center rounded-full bg-white">
              <IconFluentStar20Filled class="text-lg color-amber" />
            </div>
            <div class="text-xl font-bold">
              {{ isSaveData ? $t('last_task') : $t('today_task') }}
            </div>
            <span class="color-link cursor-pointer" v-if="store.sdict.id" @click="showPracticeWordListDialog = true">{{
              $t('word_list')
            }}</span>
          </div>
          <div class="flex gap-1 items-center" v-if="store.sdict.id">
            {{ $t('daily_goal') }}
            <div style="color: #ac6ed1" class="bg-third px-2 h-10 flex center text-2xl rounded">
              {{ store.sdict.id ? store.sdict.perDayStudyNumber : 0 }}
            </div>
            {{ $t('words_count') }}
            <PopConfirm
              :disabled="!isSaveData"
              title="当前存在未完成的学习任务，修改会重新生成学习任务，是否继续？"
              @confirm="check(() => (showPracticeSettingDialog = true))"
            >
              <BaseButton type="info" size="small">{{ $t('change') }} </BaseButton>
            </PopConfirm>
          </div>
        </div>
        <div class="flex mt-4 justify-between">
          <div class="stat">
            <div class="num">{{ currentStudy.new.length }}</div>
            <div class="txt">{{ $t('new_words') }}</div>
          </div>
          <div class="stat">
            <div class="num">{{ currentStudy.review.length }}</div>
            <div class="txt">{{ $t('review') }}</div>
          </div>
        </div>
        <div class="flex items-end mt-4 gap-4 btn-no-margin">
          <OptionButton
            :class="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'flex-1 orange-btn' : 'primary-btn'"
          >
            <BaseButton
              size="large"
              :type="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'orange' : 'primary'"
              :disabled="!store.sdict.id"
              :loading="loading"
              @click="systemPractice"
            >
              <div class="flex items-center gap-2">
                <span class="line-height-[2]">{{ systemPracticeText }}</span>
                <IconFluentArrowCircleRight16Regular class="text-xl" />
              </div>
            </BaseButton>
            <template #options>
              <BaseButton
                class="w-full"
                v-if="
                  settingStore.wordPracticeMode !== WordPracticeMode.System &&
                  settingStore.wordPracticeMode !== WordPracticeMode.Free
                "
                @click="startPractice(WordPracticeMode.System, true)"
              >
                {{ $t('smart_learning') }}
              </BaseButton>

              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Review"
                :disabled="!currentStudy.review.length"
                @click="startPractice(WordPracticeMode.Review, true)"
              >
                {{ $t('review') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.Shuffle, true)"
              >
                {{ $t('random_review') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ReviewWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ReviewWordsTest, true)"
              >
                {{ $t('words') }}{{ $t('test') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ShuffleWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ShuffleWordsTest, true)"
              >
                {{ $t('random_words_test') }}
              </BaseButton>

              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.IdentifyOnly"-->
              <!--                @click="startPractice(WordPracticeMode.IdentifyOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.IdentifyOnly] }}-->
              <!--              </BaseButton>-->
              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ListenOnly"-->
              <!--                @click="startPractice(WordPracticeMode.ListenOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.ListenOnly] }}-->
              <!--              </BaseButton>-->
              <!--              <BaseButton-->
              <!--                class="w-full"-->
              <!--                v-if="settingStore.wordPracticeMode !== WordPracticeMode.DictationOnly"-->
              <!--                @click="startPractice(WordPracticeMode.DictationOnly, true)"-->
              <!--              >-->
              <!--                {{ WordPracticeModeNameMap[WordPracticeMode.DictationOnly] }}-->
              <!--              </BaseButton>-->
            </template>
          </OptionButton>

          <BaseButton
            :class="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'flex-1' : ''"
            :type="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'orange' : 'primary'"
            size="large"
            :loading="loading"
            @click="freePractice()"
          >
            <div class="flex items-center gap-2">
              <span class="line-height-[2]">
                {{
                  settingStore.wordPracticeMode === WordPracticeMode.Free && isSaveData
                    ? $t('continue_free_practice')
                    : $t('free_practice')
                }}
              </span>
              <IconStreamlineColorPenDrawFlat class="text-xl" />
            </div>
          </BaseButton>
        </div>
      </div>
    </div>

    <div class="card flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ $t('my_dictionaries') }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm title="确认删除所有选中词典？" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="$t('delete')">
              <DeleteIcon />
            </BaseIcon>
          </PopConfirm>

          <div
            class="color-link cursor-pointer"
            v-if="store.word.bookList.length > 3"
            @click="
              () => {
                isManageDict = !isManageDict
                selectIds = []
              }
            "
          >
            {{ isManageDict ? $t('cancel') : $t('manage_dict') }}
          </div>
          <div class="color-link cursor-pointer" @click="nav('/dict', { isAdd: true })">
            {{ $t('create_personal_dict') }}
          </div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mt-4">
        <Book
          :is-add="false"
          quantifier="词"
          :item="item"
          :checked="selectIds.includes(item.id)"
          @check="() => toggleSelect(item)"
          :show-checkbox="isManageDict && j >= 3"
          v-for="(item, j) in store.word.bookList"
          @click="goDictDetail(item)"
        />
        <Book :is-add="true" @click="router.push('/dict-list')" />
      </div>
    </div>

    <div class="card flex flex-col overflow-hidden" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ $t('recommend') }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-link cursor-pointer" @click="router.push('/dict-list')">{{ $t('more') }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap mt-4 min-h-50">
        <Book
          :is-add="false"
          quantifier="词"
          :item="item as any"
          v-for="(item, j) in recommendDictList"
          @click="goDictDetail(item as any)"
        />
      </div>
    </div>
  </BasePage>

  <PracticeSettingDialog :show-left-option="false" v-model="showPracticeSettingDialog" @ok="savePracticeSetting" />

  <ChangeLastPracticeIndexDialog v-model="showChangeLastPracticeIndexDialog" @ok="saveLastPracticeIndex" />

  <PracticeWordListDialog :data="currentStudy" v-model="showPracticeWordListDialog" />

  <ShufflePracticeSettingDialog
    v-model="showShufflePracticeSettingDialog"
    @ok="onShufflePracticeSettingOk"
    :wordPracticeMode="editingWordPracticeMode"
  />
</template>

<style scoped lang="scss">
.stat {
  @apply w-49% box-border flex flex-col items-center justify-center rounded-xl p-2 bg-[var(--bg-history)];
  border: 1px solid gainsboro;

  .num {
    @apply color-[#409eff] text-4xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}
</style>
