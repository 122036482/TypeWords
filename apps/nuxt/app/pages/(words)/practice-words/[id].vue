<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue'
import Statistics from '~/components/word/Statistics.vue'
import { emitter, EventKey, useEvents } from '@/utils/eventBus.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useRuntimeStore } from '@/stores/runtime.ts'
import type { Dict, PracticeData, TaskWords, Word } from '@/types/types.ts'
import { useDisableEventListener, useOnKeyboardEventListener, useStartKeyboardEventListener } from '@/hooks/event.ts'
import useTheme from '@/hooks/theme.ts'
import { getCurrentStudyWord, useWordOptions } from '@/hooks/dict.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  cloneDeep,
  getGradeByWrongTimes,
  isMobile,
  loadJsLib,
  resourceWrap,
  shuffle,
} from '@/utils'
import { useRoute, useRouter } from 'vue-router'
import Footer from '~/components/word/Footer.vue'
import Panel from '@/components/Panel.vue'
import BaseIcon from '~/components/base/BaseIcon.vue'
import Tooltip from '@/components/base/Tooltip.vue'
import WordList from '@/components/list/WordList.vue'
import TypeWord from '~/components/word/TypeWord.vue'
import Empty from '@/components/Empty.vue'
import { useBaseStore } from '@/stores/base.ts'
import { usePracticeStore } from '@/stores/practice.ts'
import Toast from '@/components/base/toast/Toast.ts'
import { getDefaultDict, getDefaultWord } from '@/types/func.ts'
import ConflictNotice from '~/components/dialog/ConflictNotice.vue'
import PracticeLayout from '@/components/PracticeLayout.vue'

import { AppEnv, DICT_LIST, IS_DEV, LIB_JS_URL, TourConfig, WordPracticeModeStageMap } from '@/config/env.ts'
import { watchOnce } from '@vueuse/core'
import { setUserDictProp } from '@/apis'
import GroupList from '~/components/word/GroupList.vue'
import { getPracticeWordCache, setPracticeWordCache } from '@/utils/cache.ts'
import { ShortcutKey, WordPracticeMode, WordPracticeStage, WordPracticeType } from '@/types/enum.ts'
import ConflictNotice2 from '~/components/dialog/ConflictNotice2.vue'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'

const { toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const { toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const typingRef: any = $ref()
let showConflictNotice = $ref(false)
let showConflictNotice2 = $ref(false)
let allWrongWords = new Set()
let showStatDialog = $ref(false)
let loading = $ref(false)
let timer = $ref<any>(-1)
let isFocus = true
let fsrs = new FSRS({})
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

let data = $ref<PracticeData>({
  index: 0,
  words: [],
  wrongWords: [],
  excludeWords: [],
  wrongTimesMap: {},
  wrongTimes: 0,
  isTypingWrongWord: false,
})

provide('practiceData', data)
provide('practiceTaskWords', taskWords)

async function loadDict() {
  // console.log('load好了开始加载')
  let dict = getDefaultDict()
  let dictId = route.params.id
  if (dictId) {
    //先在自己的词典列表里面找，如果没有再在资源列表里面找
    dict = store.word.bookList.find(v => v.id === dictId)
    let r = await fetch(resourceWrap(DICT_LIST.WORD.ALL))
    let dict_list = await r.json()
    if (!dict) dict = dict_list.flat().find(v => v.id === dictId) as Dict
    if (dict && dict.id) {
      //如果是不是自定义词典，就请求数据
      if (!dict.custom) dict = await _getDictDataByUrl(dict)
      if (!dict.words.length) {
        router.push('/words')
        return Toast.warning('没有单词可学习！')
      }
      store.changeDict(dict)
      initData(getCurrentStudyWord(), true)
      loading = false
    } else {
      router.push('/words')
    }
  } else {
    router.push('/words')
  }
}

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) loadDict()
  },
  { immediate: true }
)

onMounted(() => {
  //如果是从单词学习主页过来的，就直接使用；否则等待加载
  if (runtimeStore.routeData) {
    initData(runtimeStore.routeData.taskWords, true)
  } else {
    loading = true
  }
  if (route.query.guide) {
    showConflictNotice = false
  } else {
    showConflictNotice = true
  }
  document.addEventListener('visibilitychange', () => {
    isFocus = !document.hidden
  })
})

onUnmounted(() => {
  let cache = getPracticeWordCache()
  if (cache) {
    savePracticeData()
  }
  timer && clearInterval(timer)
})

watchOnce(
  () => data.words.length,
  (newVal, oldVal) => {
    //如果是从无值变有值，代表是开始
    if (!oldVal && newVal) {
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step5',
          text: '这里可以练习拼写单词，只需要按下键盘上对应的按键即可，没有输入框！',
          attachTo: { element: '#word', on: 'bottom' },
          buttons: [
            {
              text: `关闭`,
              action() {
                settingStore.first = false
                tour.next()
                setTimeout(() => {
                  showConflictNotice = true
                }, 1500)
              },
            },
          ],
        })

        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) {
          tour.start()
        }
      }, 500)
    }
  }
)

useStartKeyboardEventListener()
useDisableEventListener(() => loading)

let isIniting = ref(true)
function initData(initVal: TaskWords, init: boolean = false) {
  isIniting.value = true
  debugger
  let d = getPracticeWordCache()
  //只有初始化时，才读取缓存
  if (d && init) {
    taskWords = Object.assign(taskWords, d.taskWords)
    //这里直接赋值的话，provide后的inject获取不到最新值
    data = Object.assign(data, d.practiceData)
    statStore.$patch(d.statStoreData)
  } else {
    // taskWords = initVal
    //不能直接赋值，会导致 inject 的数据为默认值
    taskWords = Object.assign(taskWords, initVal)

    if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
      settingStore.wordPracticeType = WordPracticeType.Dictation
      data.words = taskWords.review
      statStore.stage = WordPracticeStage.Shuffle
      statStore.total = taskWords.review.length
      statStore.newWordNumber = 0
      statStore.reviewWordNumber = 0
    } else if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
      if (taskWords.review.length) {
        data.words = taskWords.review
        statStore.stage = WordPracticeStage.IdentifyReview
      }
      statStore.total = taskWords.review.length
      statStore.newWordNumber = 0
      statStore.reviewWordNumber = taskWords.review.length
    } else {
      if (taskWords.new.length === 0) {
        if (taskWords.review.length) {
          data.words = taskWords.review
          if (settingStore.wordPracticeMode === WordPracticeMode.System) {
            statStore.stage = WordPracticeStage.IdentifyReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
            statStore.stage = WordPracticeModeStageMap[settingStore.wordPracticeMode][0]
          } else if (settingStore.wordPracticeMode === WordPracticeMode.IdentifyOnly) {
            statStore.stage = WordPracticeStage.IdentifyReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.DictationOnly) {
            statStore.stage = WordPracticeStage.DictationReview
          } else if (settingStore.wordPracticeMode === WordPracticeMode.ListenOnly) {
            statStore.stage = WordPracticeStage.ListenReview
          }
        } else {
          Toast.warning('没有可学习的单词！')
          router.push('/words')
        }
      } else {
        data.words = taskWords.new
        statStore.stage = WordPracticeModeStageMap[settingStore.wordPracticeMode][0]
      }
      statStore.total = taskWords.review.length + taskWords.new.length
      statStore.newWordNumber = taskWords.new.length
      statStore.reviewWordNumber = taskWords.review.length
    }

    data.index = 0
    data.wrongWords = []
    data.excludeWords = []
    allWrongWords.clear()
    statStore.startDate = Date.now()
    statStore.inputWordNumber = 0
    statStore.wrong = 0
    statStore.spend = 0
    data.isTypingWrongWord = false

    watchStage(statStore.stage)
    watchPracticeType(settingStore.wordPracticeType)
  }
  clearInterval(timer)
  timer = setInterval(() => {
    if (isFocus) {
      statStore.spend += 1000
    }
  }, 1000)
  isIniting.value = false
}

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word = $computed(() => {
  return data.words?.[data.index - 1] ?? undefined
})
const nextWord: Word = $computed(() => {
  return data.words?.[data.index + 1] ?? undefined
})

//因为有时要从缓存里面读数据，这时的状态、进度保持原样，所以只能惰性监听，所以没缓存时主动调用一个，以更新为符合当前进度的状态、模式
//比如，每个阶段都有错误复习这个流程，当正在错词复习时，如果执行state监听，就可能恢复成stage默认的配置项（模式、dictation、translate）
function watchStage(n: WordPracticeStage) {
  switch (n) {
    case WordPracticeStage.DictationNewWord:
    case WordPracticeStage.DictationReview:
    case WordPracticeStage.Shuffle:
      settingStore.wordPracticeType = WordPracticeType.Dictation
      break
    case WordPracticeStage.ListenNewWord:
    case WordPracticeStage.ListenReview:
      settingStore.wordPracticeType = WordPracticeType.Listen
      break
    case WordPracticeStage.FollowWriteNewWord:
    case WordPracticeStage.FollowWriteReview:
      settingStore.wordPracticeType = WordPracticeType.FollowWrite
      break
    case WordPracticeStage.IdentifyNewWord:
    case WordPracticeStage.IdentifyReview:
      settingStore.wordPracticeType = WordPracticeType.Identify
      break
  }
}

function watchPracticeType(n: WordPracticeType) {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) return
  switch (n) {
    case WordPracticeType.Spell:
    case WordPracticeType.Dictation:
      settingStore.dictation = true
      settingStore.translate = true
      break
    case WordPracticeType.Listen:
      settingStore.dictation = true
      settingStore.translate = false
      break
    case WordPracticeType.FollowWrite:
      settingStore.dictation = false
      settingStore.translate = true
      break
    case WordPracticeType.Identify:
      settingStore.dictation = false
      settingStore.translate = false
      break
  }
}

watch(isIniting, n => {
  if (!n) {
    watch(() => statStore.stage, watchStage)
    watch(() => settingStore.wordPracticeType, watchPracticeType)
  }
})

const groupSize = 7

function wordLoop() {
  // 学习模式
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
    data.index++
    // 到达一个组末尾，就切换到拼写模式
    if (data.index % groupSize === 0) {
      settingStore.wordPracticeType = WordPracticeType.Spell
      data.index -= groupSize // 回到刚学单词开头
    }
  } else {
    // 拼写模式
    data.index++
    // 拼写走完一组，切回跟写模式
    if (data.index % groupSize === 0) {
      settingStore.wordPracticeType = WordPracticeType.FollowWrite
    }
  }
}

function nextStage(originList: Word[], log: string = '', toast: boolean = false) {
  //每次都判断，因为每次都可能新增已掌握的单词
  let list = originList.filter(v => !checkWordIsNeedNext(v))
  console.log(log)
  statStore.stage = statStore.nextStage
  if (list.length) {
    data.words = list
    data.index = 0
  } else {
    console.log(log + ':无单词略过')
    next(false)
  }
}

function complete() {
  if (!showStatDialog) {
    console.log('全完学完了')
    //如果 shuffle 数组不为空，就说明是复习，不用修改 lastLearnIndex
    if (settingStore.wordPracticeMode !== WordPracticeMode.Shuffle) {
      store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
      // 检查已忽略的单词数量，是否全部完成
      let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
      // 忽略单词数
      const ignoreCount = ignoreList.filter(word =>
        store.sdict.words.slice(store.sdict.lastLearnIndex).some(w => w.word.toLowerCase() === word)
      ).length
      // 如果lastLearnIndex已经超过可学单词数，则判定完成
      if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
        store.sdict.complete = true
        store.sdict.lastLearnIndex = store.sdict.length
      }
    }

    showStatDialog = true
    clearInterval(timer)
    setTimeout(() => setPracticeWordCache(null), 300)
  }
}

function next(isTyping: boolean = true) {
  let temp = word.word.toLowerCase()
  if (data.wrongTimes) {
    data.wrongTimesMap[temp] = (data.wrongTimesMap[temp] ?? 0) + data.wrongTimes
    data.wrongTimes = 0
  }
  // debugger
  if (isTyping) statStore.inputWordNumber++
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
    if (data.index === data.words.length - 1) {
      data.wrongWords = data.wrongWords.filter(v => !data.excludeWords.includes(v.word))
      if (data.wrongWords.length) {
        data.isTypingWrongWord = true
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
        console.log('当前学完了，但还有错词')
        data.words = shuffle(cloneDeep(data.wrongWords))
        data.index = 0
        data.wrongWords = []
      } else {
        data.isTypingWrongWord = false
        complete()
      }
    } else {
      data.index++
    }
  } else {
    if (data.index === data.words.length - 1) {
      //如果开发模式并且不是手动敲的，不轮询
      if (
        (statStore.stage === WordPracticeStage.FollowWriteNewWord || data.isTypingWrongWord) &&
        !(IS_DEV && !isTyping)
      ) {
        if (settingStore.wordPracticeType !== WordPracticeType.Spell) {
          //回到最后一组的开始位置
          data.index = Math.floor(data.index / groupSize) * groupSize
          emitter.emit(EventKey.resetWord)
          settingStore.wordPracticeType = WordPracticeType.Spell
          if (checkWordIsNeedNext(word)) next(false)
          return
        }
      }
      data.wrongWords = data.wrongWords.filter(v => !checkWordIsNeedNext(v))
      if (data.wrongWords.length) {
        data.isTypingWrongWord = true
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
        console.log('当前学完了，但还有错词')
        data.words = shuffle(cloneDeep(data.wrongWords))
        data.index = 0
        data.wrongWords = []
      } else {
        data.isTypingWrongWord = false
        console.log('当前学完了，没错词', statStore.total, statStore.stage, data.index)

        if (settingStore.wordPracticeMode === WordPracticeMode.System) {
          if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
            nextStage(shuffle(taskWords.new), '开始听写新词', true)
          } else if (statStore.stage === WordPracticeStage.ListenNewWord) {
            nextStage(shuffle(taskWords.new), '开始默写新词')
          } else if (statStore.stage === WordPracticeStage.DictationNewWord) {
            console.log('新词学习完成')
            setTimeout(() => {
              let easyCount = 0
              let maxCount = Math.floor(taskWords.new.length * 0.2)
              taskWords.new.map((w, _, arr) => {
                //如果没有打错过/或者主动跳过的单词，设为 Easy，但不超过总新词数的 20%
                if ((!allWrongWords.has(w.word) || checkWordIsNeedNext(word)) && easyCount < maxCount) {
                  easyCount++
                  setWordCard(Rating.Easy, w.word)
                } else {
                  //其他词，则根据错误次数生成评级
                  setWordCard(getGradeByWrongTimes(data.wrongTimesMap[w.word]), w.word, data.wrongTimesMap[w.word])
                }
              })
            })
            nextStage(taskWords.review, '开始自测旧词')
          } else if (statStore.stage === WordPracticeStage.IdentifyReview) {
            nextStage(shuffle(taskWords.review), '开始听写旧词', true)
          } else if (statStore.stage === WordPracticeStage.ListenReview) {
            nextStage(shuffle(taskWords.review), '开始默写旧词')
          } else if (statStore.stage === WordPracticeStage.DictationReview) {
            setTimeout(() => {
              taskWords.review.map(w => {
                //根据错误次数生成评级
                setWordCard(getGradeByWrongTimes(data.wrongTimesMap[w.word]), w.word, data.wrongTimesMap[w.word])
              })
            })
            complete()
          }
        } else if (settingStore.wordPracticeMode === WordPracticeMode.ListenOnly) {
          if (statStore.stage === WordPracticeStage.ListenNewWord) {
            nextStage(taskWords.review, '开始听写旧词', true)
          } else if (statStore.stage === WordPracticeStage.ListenReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.DictationOnly) {
          if (statStore.stage === WordPracticeStage.DictationNewWord) {
            nextStage(taskWords.review, '开始默写旧词', true)
          } else if (statStore.stage === WordPracticeStage.DictationReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.IdentifyOnly) {
          if (statStore.stage === WordPracticeStage.IdentifyNewWord) {
            nextStage(taskWords.review, '开始自测旧词')
          } else if (statStore.stage === WordPracticeStage.IdentifyReview) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
          if (statStore.stage === WordPracticeStage.Shuffle) complete()
        } else if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
          if (statStore.stage === WordPracticeStage.IdentifyReview) {
            nextStage(shuffle(taskWords.review), '开始听写旧词', true)
          } else if (statStore.stage === WordPracticeStage.ListenReview) {
            nextStage(shuffle(taskWords.review), '开始默写旧词')
          } else if (statStore.stage === WordPracticeStage.DictationReview) complete()
        }
      }
    } else {
      if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
        wordLoop()
      } else {
        if (data.isTypingWrongWord) wordLoop()
        else data.index++
      }
    }
  }

  if (checkWordIsNeedNext(word)) next(false)
}

//检查单词是否跳过
//如果单词是已掌握的/或者主动跳过的，则略过
function checkWordIsNeedNext(word: Word) {
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  return isWordSimple(word) || rIndex > -1
}

function skipStep() {
  data.index = data.words.length - 1
  data.wrongWords = []
  next(false)
}

function addExcludeWord() {
  //标记模式时，用户认识的单词加入到排除里面，后续不再复习
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex < 0) {
    data.excludeWords.push(word.word)
  }
}

function onWordMastered() {
  setWordCard(Rating.Easy)
  skip()
}

function onWordKnow() {
  setWordCard(Rating.Good)
  addExcludeWord()
}

function onTypeWrong() {
  data.wrongTimes++
  //这里的代码暂时不能移动，因为要实时把错词加入到列表里面，从而更新toolbar里面的错词数
  //todo 后续可以优化
  let temp = word.word.toLowerCase()
  if (!allWrongWords.has(word.word.toLowerCase())) {
    allWrongWords.add(word.word.toLowerCase())
    statStore.wrong++
  }
  if (!store.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
    store.wrong.words.push(word)
    store.wrong.length = store.wrong.words.length
  }
  if (!data.wrongWords.find((v: Word) => v.word.toLowerCase() === temp)) {
    data.wrongWords.push(word)
  }
  savePracticeData()

  if (settingStore.wordPracticeType === WordPracticeType.Identify) {
    setWordCard(Rating.Again)
  }
}

//设置单词卡片
function setWordCard(rating: number, wordStr = word.word, times?: number) {
  let card = store.fsrsData[wordStr]
  if (!card) {
    card = createEmptyCard()
  }
  card = fsrs.next(card, Date.now(), rating).card
  store.fsrsData[wordStr] = card
  console.log(
    `更新卡片: 单词：${wordStr}, 模式：${WordPracticeType[settingStore.wordPracticeType]}, 评分: ${Rating[rating]}, 次数：${times}, 卡片: `,
    card,
    cloneDeep(store.fsrsData)
  )
}

const savePracticeData = throttle(() => {
  setPracticeWordCache({
    taskWords,
    practiceData: data,
    statStoreData: statStore.$state,
  })
}, 300)

watch(() => data.index, savePracticeData)

function onKeyUp(e: KeyboardEvent) {
  // console.log('onKeyUp', e)
  typingRef.hideWord()
}

function onKeyDown(e: KeyboardEvent) {
  // console.log('onKeyDown', e)
  switch (e.key) {
    case 'Backspace':
      typingRef.del()
      break
  }
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

function repeat() {
  console.log('重学一遍')
  setPracticeWordCache(null)
  let temp = cloneDeep(taskWords)
  let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    temp.review = shuffle(temp.review.filter(v => !ignoreSet.has(v.word)))
  } else {
    //将学习进度减回去
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex - statStore.newWordNumber
    //排除已掌握单词
    temp.new = temp.new.filter(v => !ignoreSet.has(v.word))
    temp.review = temp.review.filter(v => !ignoreSet.has(v.word))
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)
}

function prev() {
  if (data.index === 0) {
    Toast.warning('已经是第一个了~')
  } else {
    data.index--
  }
}

function skip() {
  if (settingStore.wordPracticeType === WordPracticeType.Identify) {
    setWordCard(Rating.Easy)
  }
  addExcludeWord()
  next(false)
}

function show(e: KeyboardEvent) {
  typingRef.showWord()
}

function collect(e: KeyboardEvent) {
  toggleWordCollect(word)
}

function play() {
  typingRef.play()
}

function toggleWordSimpleWrapper() {
  if (!isWordSimple(word)) {
    setTimeout(() => next(false))
  }
  toggleWordSimple(word)
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  } else {
    data.excludeWords.push(word.word)
  }
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

async function continueStudy() {
  setPracticeWordCache(null)
  let temp = cloneDeep(taskWords)
  let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    temp.review = shuffle(store.sdict.words.filter(v => !ignoreList.includes(v.word))).slice(
      0,
      runtimeStore.routeData.total ?? temp.review.length
    )
    if (showStatDialog) showStatDialog = false
  } else {
    //这里判断是否显示结算弹框，如果显示了结算弹框的话，就不用加进度了
    if (!showStatDialog) {
      console.log('没学完，强行跳过')
      store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
      // 忽略单词数
      const ignoreCount = ignoreList.filter(word => store.sdict.words.some(w => w.word.toLowerCase() === word)).length
      // 如果lastLearnIndex已经超过可学单词数，则判定完成
      if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
        store.sdict.complete = true
        store.sdict.lastLearnIndex = store.sdict.length
      }
    } else {
      console.log('学完了，正常下一组')
      showStatDialog = false
    }

    temp = getCurrentStudyWord()
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)

  if (AppEnv.CAN_REQUEST) {
    let res = await setUserDictProp(null, { ...store.sdict, type: 'word' })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }
}

async function jumpToGroup(group: number) {
  window?.umami?.track('jumpToGroup')
  setPracticeWordCache(null)
  console.log('没学完，强行跳过', group)
  store.sdict.lastLearnIndex = (group - 1) * store.sdict.perDayStudyNumber
  emitter.emit(EventKey.resetWord)
  initData(getCurrentStudyWord())
  if (AppEnv.CAN_REQUEST) {
    let res = await setUserDictProp(null, { ...store.sdict, type: 'word' })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }
}

function randomWrite() {
  window?.umami?.track('randomWrite')
  console.log('随机默写')
  data.words = shuffle(data.words)
  data.index = 0
  settingStore.dictation = true
}

useEvents([
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  //当默写时，执行 show 会标记为错误，并更新卡片
  [ShortcutKey.ShowWord, throttle(show, 300)],
  [ShortcutKey.Previous, prev],
  [ShortcutKey.Next, skip],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.ToggleSimple, toggleWordSimpleWrapper],
  [ShortcutKey.PlayWordPronunciation, play],

  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.ToggleShowTranslate, () => (settingStore.translate = !settingStore.translate)],
  [ShortcutKey.ToggleDictation, () => (settingStore.dictation = !settingStore.dictation)],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.TogglePanel, () => (settingStore.showPanel = !settingStore.showPanel)],
  [ShortcutKey.RandomWrite, randomWrite],
])
</script>

<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <div class="practice-word mb-50">
        <!--        前后单词-->
        <div
          class="fixed z-1 top-4 w-full"
          style="left: calc(50vw + var(--aside-width) / 2 - var(--toolbar-width) / 2); width: var(--toolbar-width)"
          v-if="settingStore.showNearWord"
        >
          <div class="relative z-2 center gap-2 cp float-left" @click="prev" v-if="prevWord">
            <IconFluentArrowLeft16Regular class="arrow" width="22" />
            <Tooltip :title="`上一个(${settingStore.shortcutKeyMap[ShortcutKey.Previous]})`">
              <div class="word">{{ prevWord.word }}</div>
            </Tooltip>
          </div>

          <div
            class="center gap-1 absolute w-full cp"
            v-if="settingStore.showConflictNotice2"
            @click="showConflictNotice2 = true"
          >
            <IconFluentQuestionCircle20Regular />
            <span class="">无法输入？</span>
          </div>

          <div class="relative center gap-2 cp float-right mr-3" @click="next(false)" v-if="nextWord">
            <Tooltip :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
              <div class="word" :class="settingStore.dictation && 'word-shadow'">
                {{ nextWord.word }}
              </div>
            </Tooltip>
            <IconFluentArrowRight16Regular class="arrow" width="22" />
          </div>
        </div>

        <TypeWord
          ref="typingRef"
          :word="word"
          @wrong="onTypeWrong"
          @complete="next"
          @mastered="onWordMastered"
          @know="onWordKnow"
          @skip="skip"
          @toggle-simple="toggleWordSimpleWrapper"
        />
      </div>
    </template>
    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <div class="center gap-1">
            <span>{{ store.sdict.name }}</span>

            <GroupList
              @click="jumpToGroup"
              v-if="taskWords.new.length && settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
            />
            <BaseIcon
              v-if="
                taskWords.new.length &&
                ![WordPracticeMode.Review, WordPracticeMode.Shuffle].includes(settingStore.wordPracticeMode)
              "
              @click="continueStudy"
              :title="`下一组(${settingStore.shortcutKeyMap[ShortcutKey.NextChapter]})`"
            >
              <IconFluentArrowRight16Regular class="arrow" width="22" />
            </BaseIcon>

            <BaseIcon @click="randomWrite" :title="`随机默写(${settingStore.shortcutKeyMap[ShortcutKey.RandomWrite]})`">
              <IconFluentArrowShuffle16Regular class="arrow" width="22" />
            </BaseIcon>
          </div>
        </template>
        <div class="panel-page-item pl-4">
          <WordList
            v-if="data.words.length"
            :is-active="settingStore.showPanel"
            :static="false"
            :show-word="!settingStore.dictation"
            :show-translate="settingStore.translate"
            :list="data.words"
            :activeIndex="data.index"
            :excludeWords="data.excludeWords"
            @click="(val: any) => (data.index = val.index)"
          >
          </WordList>
          <Empty v-else />
        </div>
      </Panel>
    </template>
    <template v-slot:footer>
      <Footer @skipStep="skipStep" />
    </template>
  </PracticeLayout>
  <Statistics v-model="showStatDialog" />
  <ConflictNotice v-if="showConflictNotice" />
  <ConflictNotice2 v-model="showConflictNotice2" />
</template>

<style scoped lang="scss">
.practice-wrapper {
  @apply w-full h-full flex justify-center overflow-hidden;
}

.practice-word {
  @apply h-full flex flex-col justify-between items-center relative;
  width: var(--toolbar-width);
}

// 移动端适配
@media (max-width: 768px) {
  .practice-word {
    width: 100%;

    .absolute.z-1.top-4 {
      z-index: 100; // 提高层级，确保不被遮挡

      .center.gap-2.cursor-pointer {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        .word {
          pointer-events: none; // 文字不拦截点击
        }

        .arrow {
          pointer-events: none; // 箭头图标不拦截点击
        }
      }
    }
  }
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  //left: 0;
  top: 0.8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>
