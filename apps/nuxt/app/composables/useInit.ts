import { useBaseStore } from '~/stores/base.ts'
import { useRuntimeStore } from '~/stores/runtime.ts'
import { useSettingStore } from '~/stores/setting.ts'
import { useUserStore } from '~/stores/user.ts'
import { syncSetting } from '~/apis'
import { get, set } from 'idb-keyval'
import { AppEnv, DictId } from '~/config/env.ts'
import { shakeCommonDict } from '@/utils/index.ts'
import { APP_VERSION, LOCAL_FILE_KEY, SAVE_DICT_KEY, SAVE_SETTING_KEY } from '@/config/env.ts'
import { Supabase } from '~/utils/supabase.ts'
import type { Word } from '~/types/types.ts'

let unsub = null
let unsub2 = null

async function getServerData() {
  const store = useBaseStore()
  const settingStore = useSettingStore()

  if (Supabase.check()) {
    const { data } = await Supabase.getInstance()?.from('typewords_data').select()
    if (data?.length) {
      data.map(v => {
        if (v.type === 'setting') settingStore.setState(v.data)
        if (v.type === 'word') store.setState(v.data)
      })
    }
  }
}

export function useInit() {
  const store = useBaseStore()
  const settingStore = useSettingStore()
  const runtimeStore = useRuntimeStore()
  const userStore = useUserStore()
  let isInitializing = true // 标记是否正在初始化

  const onvisibilitychange = async () => {
    //如果标签页失活了就不保存数据了
    if (document.hidden) {
      isInitializing = true
    } else {
      //当激活时，要先获取数据，以保证本地是最新的，以免本地老数据上传到后端覆盖新数据
      isInitializing = true
      await getServerData()
      isInitializing = false
    }
  }

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onvisibilitychange)
  })

  //init 有可能重复执行，因为从老网站导了数据之后需要 init
  async function init() {
    let lastAudioFileIdList = []

    document.removeEventListener('visibilitychange', onvisibilitychange)
    document.addEventListener('visibilitychange', onvisibilitychange)

    unsub?.()
    //用 $subscribe 替代 watch
    unsub = store.$subscribe((mutation, n) => {
      // 如果正在初始化，不保存数据，避免覆盖
      if (isInitializing) return
      // console.log('store.$subscribe', mutation, n)
      let data = shakeCommonDict(n)
      set(SAVE_DICT_KEY.key, JSON.stringify({ val: data, version: SAVE_DICT_KEY.version }))
      const updated_at = new Date().toISOString() // 转换为 ISO 8601 格式
      Supabase.getInstance().from('typewords_data').upsert({ id: '1', data, type: 'word', updated_at }).then()

      //筛选自定义和收藏
      let bookList = data.article.bookList.filter(v => v.custom || [DictId.articleCollect].includes(v.id))
      let audioFileIdList = []
      bookList.forEach(v => {
        //筛选 audioFileId 字体有值的
        v.articles
          .filter(s => !s.audioSrc && s.audioFileId)
          .forEach(a => {
            //所有 id 存起来，下次直接判断字符串是否相等，因为这个watch会频繁调用
            audioFileIdList.push(a.audioFileId)
          })
      })
      if (audioFileIdList.toString() !== lastAudioFileIdList.toString()) {
        let result = []
        //删除未使用到的文件
        get(LOCAL_FILE_KEY).then((fileList: Array<{ id: string; file: Blob }>) => {
          if (fileList && fileList.length > 0) {
            audioFileIdList.forEach(a => {
              let item = fileList.find(b => b.id === a)
              item && result.push(item)
            })
            set(LOCAL_FILE_KEY, result)
            lastAudioFileIdList = audioFileIdList
          }
        })
      }
    })

    unsub2?.()
    unsub2 = settingStore.$subscribe((mutation, state) => {
      if (isInitializing) return
      // console.log('settingStore.$subscribe', mutation, state,isInitializing)

      set(SAVE_SETTING_KEY.key, JSON.stringify({ val: state, version: SAVE_SETTING_KEY.version }))
      const updated_at = new Date().toISOString() // 转换为 ISO 8601 格式
      Supabase.getInstance().from('typewords_data').upsert({ id: '2', data: state, type: 'setting', updated_at }).then()
      if (AppEnv.CAN_REQUEST) {
        syncSetting(null, settingStore.$state)
      }
    })

    await userStore.init()
    await store.init()
    await settingStore.init()
    await getServerData()

    store.load = true
    isInitializing = false // 初始化完成，允许保存数据

    if (settingStore.first) {
      set(APP_VERSION.key, APP_VERSION.version)
    } else {
      get(APP_VERSION.key).then(r => {
        runtimeStore.isNew = r ? APP_VERSION.version > Number(r) : true
      })
    }
    window.umami?.track('host', { host: window.location.host })
  }

  return init
}
