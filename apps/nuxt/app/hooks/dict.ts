import type { Article, Dict, TaskWords, Word } from '@/types/types.ts'
import { useBaseStore } from '@/stores/base.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { getDefaultDict, getDefaultWord } from '@/types/func.ts'
import { _getDictDataByUrl, cloneDeep, getRandomN, resourceWrap, shuffle, sleep, splitIntoN } from '@/utils'
import { onMounted, ref, watch } from 'vue'
import { AppEnv, DICT_LIST, DictId } from '@/config/env.ts'
import { detail } from '@/apis'
import { useRuntimeStore } from '@/stores/runtime.ts'
import { useRoute, useRouter } from 'vue-router'
import { DictType } from '@/types/enum.ts'
import dayjs from 'dayjs'
import { type Card, createEmptyCard, FSRS } from 'ts-fsrs'

export function useWordOptions() {
  const store = useBaseStore()

  function isWordCollect(val: Word) {
    return !!store.collectWord.words.find(v => v.word.toLowerCase() === val.word.toLowerCase())
  }

  function toggleWordCollect(val: Word) {
    let rIndex = store.collectWord.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.collectWord.words.splice(rIndex, 1)
    } else {
      store.collectWord.words.push(val)
    }
    store.collectWord.length = store.collectWord.words.length
  }

  function isWordSimple(val: Word) {
    return !!store.knownWordsSet.has(val.word.toLowerCase())
  }

  function toggleWordSimple(val: Word) {
    let rIndex = store.knownWords.findIndex(v => v === val.word.toLowerCase())
    if (rIndex > -1) {
      store.known.words.splice(rIndex, 1)
    } else {
      store.known.words.push(val)
    }
    store.known.length = store.known.words.length
  }

  function delWrongWord(val: Word) {
    let rIndex = store.wrong.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.wrong.words.splice(rIndex, 1)
    }
    store.wrong.length = store.wrong.words.length
  }

  function delSimpleWord(val: Word) {
    let rIndex = store.known.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.known.words.splice(rIndex, 1)
    }
    store.known.length = store.known.words.length
  }

  return {
    isWordCollect,
    toggleWordCollect,
    isWordSimple,
    toggleWordSimple,
    delWrongWord,
    delSimpleWord,
  }
}

export function useArticleOptions() {
  const store = useBaseStore()

  function isArticleCollect(val: Article) {
    return !!store.collectArticle?.articles?.find(v => v.id === val.id)
  }

  //todo 这里先收藏，再修改。收藏里面的未同步。单词也是一样的
  function toggleArticleCollect(val: Article) {
    let rIndex = store.collectArticle.articles.findIndex(v => v.id === val.id)
    if (rIndex > -1) {
      store.collectArticle.articles.splice(rIndex, 1)
    } else {
      store.collectArticle.articles.push(val)
    }
    store.collectArticle.length = store.collectArticle.articles.length
  }

  return {
    isArticleCollect,
    toggleArticleCollect,
  }
}

export function getCurrentStudyWord(): TaskWords {
  const store = useBaseStore()
  let data: TaskWords = { new: [], review: [] }
  let dict = store.sdict
  let isTest = false
  let words = dict.words.slice()
  let list = []
  if (isTest) {
    words = Array.from({ length: 10 }).map((v, i) => {
      return getDefaultWord({ word: String(i) })
    })
  }
  if (words?.length) {
    const settingStore = useSettingStore()
    //忽略列表：简单词或已掌握
    let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
    const perDay = dict.perDayStudyNumber
    let start = dict.lastLearnIndex
    let end = start
    let complete = dict.complete
    let isEnd = start >= dict.length - 1
    if (isTest) {
      start = 1
      complete = true
    }
    if (!isEnd) {
      list = words.slice(start)
      //从start往后取perDay个单词，作为新词
      for (let item of list) {
        if (data.new.length >= perDay) break
        if (!ignoreSet.has(item.word)) {
          data.new.push(item)
        }
        end++
      }
    }

    //如果复习比大于等于1，或者已完成，才生成复习词
    if (settingStore.wordReviewRatio >= 1 || complete || isEnd) {
      //Map建立索引，用于查找、包含
      const wordMap = new Map(words.map(s => [s.word, s]))
      //复习总数量;如果已结束那么复习比最小是1
      const totalNeed = perDay * (isEnd ? settingStore.wordReviewRatio || 1 : settingStore.wordReviewRatio)
      const now = Date.now()
      let reviewWords = []

      if (settingStore.enableFSRS){
        //取 due 到期的单词
        reviewWords = Object.entries(store.fsrsData)
          .filter(([word, card]) => {
            //1、这里的due字段被json序列化之后又恢复是字符串了，所以要用dayjs比较
            //2、要在当前学习这本词典里面
            // console.log(`单词：${word},到期时间：${dayjs(card.due).format('YYYY-MM-DD HH:mm:ss')}`)
            return dayjs(card.due).valueOf() <= now && wordMap.has(word)
          })
          .map(([word]) => word)

        console.log('fsrs 里 due 到期单词', reviewWords)

        //有生成的复习词，就用生成的
        if (reviewWords.length !== 0) {
          data.review = reviewWords
            //截取，不能无限制的复习，一下复习几千个太吓人了
            .slice(0, totalNeed)
            .map(word => wordMap.get(word))
            .filter(obj => obj)
          return data
        }
      }

      //todo 待优化
      // 未添加srs功能之前，没有记忆数据来生成复习词，所以采用原来的固定填充逻辑
      // 复习单词不够，需要补充，先填充上次学习的，即perDay
      const selected = new Set(reviewWords)
      const result = reviewWords.map(word => wordMap.get(word))

      let index = 0
      if (isEnd) {
        // 如果已结束，则将词表全部随机，直接随机取复习词
        list = shuffle(cloneDeep(words))
      } else {
        //从start往前取perDay个单词，作为当前复习单词，取到0为止
        list = words.slice(0, start).reverse()
        //但如果已完成，则滚动取值
        if (complete) list = list.concat(words.slice(end).reverse())
      }
      //第一次取值，最大只取perDay个，并且顺序取值：即取上次学习的
      let maxLength = Math.min(selected.size + perDay, totalNeed)
      while (result.length < maxLength && index < list.length) {
        const word = list[index]
        //判断：1、不在已有的数组里面，2、不在忽略列表里面
        let wordStr = word.word
        if (!selected.has(wordStr) && !ignoreSet.has(wordStr)) {
          selected.add(wordStr)
          result.push(word)
        }
        index++
      }

      //如果单词还不够，则继续填充直接totalNeed为止
      if (result.length < totalNeed) {
        //如果单词不够，说明已取到0了
        if (index >= list.length) {
          //1、如果没学完，那真没单词可取了，直接返回
          //2、已学完，则代表整个list都取完了
          if (!complete || isEnd) {
            data.review = result
            return data
          }
        }
        //但如果已完成，则滚动取值
        if (complete) list = list.concat(words.slice(end).reverse())
        //还需填充的数量
        maxLength = totalNeed - result.length
        let candidateWords = list.slice(index)
        if (candidateWords.length <= maxLength) {
          data.review = result.concat(shuffle(candidateWords))
        } else {
          //取单词的规则为：从后往前取6个perDayStudyNumber的单词，分6组，总的取maxLength个，越靠前的取的单词越多。
          let days = 6
          let sourceLength = days * perDay
          let waitList = []
          index = 0
          while (waitList.length < sourceLength && index < candidateWords.length) {
            const word = candidateWords[index]
            //判断：1、不在已有的数组里面，2、不在忽略列表里面
            let wordStr = word.word
            if (!selected.has(wordStr) && !ignoreSet.has(wordStr)) {
              selected.add(wordStr)
              waitList.push(word)
            }
            index++
          }

          //分成6组，因为有可能不均
          const groups: Word[][] = splitIntoN(waitList, days)
          // console.log('groups', groups)

          // 分配数量，靠前组多，靠后组少，例如分配比例 [6,5,4,3,2,1]
          const ratio = Array.from({ length: days }, (_, i) => i + 1).reverse()
          const ratioSum = ratio.reduce((a, b) => a + b, 0)
          const realRatio = ratio.map(r => Math.round((r / ratioSum) * maxLength))
          // console.log(ratio, ratioSum, realRatio, realRatio.reduce((a, b) => a + b, 0))

          // 按比例从每组随机取单词
          let words: Word[] = []
          let missingCount = 0
          groups.map((v, i) => {
            let need = realRatio[i] + missingCount
            words = words.concat(getRandomN(v, need))
            let tem = v.length - need
            if (tem < 0) {
              missingCount = Math.abs(tem)
            } else {
              missingCount = 0
            }
          })
          data.review = result.concat(words)
        }
      }
    }
  }
  // console.log('data-new', data.new.map(v => v.word))
  // console.log('data-review', data.review.map(v => v.word))
  return data
}

export function useGetDict() {
  const store = useBaseStore()
  const runtimeStore = useRuntimeStore()
  let waiting = $ref(false)
  let fetching = $ref(false)
  const route = useRoute()
  const router = useRouter()

  watch(
    [() => store.load, () => waiting],
    ([a, b]) => {
      if (a && b) {
        loadDict()
      }
    },
    { immediate: true }
  )

  onMounted(() => {
    // console.log('onMounted')
    if (route.query?.isAdd) {
      runtimeStore.editDict = getDefaultDict()
    } else {
      if (!runtimeStore.editDict?.id) {
        let dictId = route.params?.id
        if (!dictId) {
          return router.push('/articles')
        }
        waiting = true
      } else {
        loadDict(runtimeStore.editDict)
      }
    }
  })

  async function loadDict(dict?: Dict) {
    if (!dict) {
      dict = getDefaultDict()
      let dictId = route.params.id
      //先在自己的词典列表里面找，如果没有再在资源列表里面找
      dict = store.article.bookList.find(v => v.id === dictId)
      let r = await fetch(resourceWrap(DICT_LIST.ARTICLE.ALL))
      let dict_list = await r.json()
      if (!dict) dict = dict_list.flat().find(v => v.id === dictId) as Dict
    }
    if (dict && dict.id) {
      if (
        !dict?.articles?.length &&
        !dict?.custom &&
        ![DictId.articleCollect].includes(dict.en_name || dict.id) &&
        !dict?.is_default
      ) {
        fetching = true
        let r = await _getDictDataByUrl(dict, DictType.article)
        runtimeStore.editDict = r
      }
      if (store.article.bookList.find(book => book.id === runtimeStore.editDict.id)) {
        if (AppEnv.CAN_REQUEST) {
          let res = await detail({ id: runtimeStore.editDict.id })
          if (res.success) {
            runtimeStore.editDict.statistics = res.data.statistics
            if (res.data.articles.length) {
              runtimeStore.editDict.articles = res.data.articles
            }
          }
        }
      }
    } else {
      router.push('/articles')
    }

    waiting = false
    fetching = false
  }

  const loading = computed(() => waiting || fetching)

  return { loading }
}
