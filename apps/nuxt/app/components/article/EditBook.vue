<script setup lang="ts">
import type { Dict } from '~/types/types.ts'
import { cloneDeep } from '~/utils'
import Toast from '~/components/base/toast/Toast.ts'
import { onMounted, reactive } from 'vue'
import { useRuntimeStore } from '~/stores/runtime.ts'
import { useBaseStore } from '~/stores/base.ts'
import BaseButton from '~/components/base/BaseButton.vue'
import { getDefaultDict } from '~/types/func.ts'
import Select from '~/components/base/select/Select.vue'
import Option from '~/components/base/select/Option.vue'
import BaseInput from '~/components/base/BaseInput.vue'
import Form from '~/components/base/form/Form.vue'
import FormItem from '~/components/base/form/FormItem.vue'
import { addDict } from '~/apis'
import { AppEnv, DictId } from '~/config/env.ts'
import { nanoid } from 'nanoid'
import { DictType } from '~/types/enum.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isAdd: boolean
  isBook: boolean
}>()
const emit = defineEmits<{
  submit: []
  close: []
}>()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()
const DefaultDictForm = {
  id: '',
  name: '',
  description: '',
  category: '',
  tags: [],
  translateLanguage: 'zh-CN',
  language: 'en',
  type: DictType.article,
}
let dictForm: any = $ref(cloneDeep(DefaultDictForm))
const dictFormRef = $ref()
let loading = $ref(false)
const { t: $t } = useI18n()
const dictRules = reactive({
  name: [
    { required: true, message: $t('please_enter_name'), trigger: 'blur' },
    { max: 20, message: $t('name_max_20_chars'), trigger: 'blur' },
  ],
})

async function onSubmit() {
  await dictFormRef.validate(async valid => {
    if (valid) {
      let data: Dict = getDefaultDict(dictForm)
      data.type = props.isBook ? DictType.article : DictType.word
      let source = [store.article, store.word][props.isBook ? 0 : 1]
      //todo 可以检查的更准确些，比如json对比
      if (props.isAdd) {
        data.id = 'custom-dict-' + Date.now()
        data.custom = true
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning($t('name_already_exists'))
          return
        } else {
          if (AppEnv.CAN_REQUEST) {
            loading = true
            let res = await addDict(null, data)
            loading = false
            if (res.success) {
              data = getDefaultDict(res.data)
            } else {
              return Toast.error(res.msg)
            }
          }
          source.bookList.push(cloneDeep(data))
          runtimeStore.editDict = data
          emit('submit')
          Toast.success($t('add_success'))
        }
      } else {
        let rIndex = source.bookList.findIndex(v => v.id === data.id)
        //任意修改，都将其变为自定义词典
        if (
          !data.custom &&
          ![DictId.wordKnown, DictId.wordWrong, DictId.wordCollect, DictId.articleCollect].includes(
            data.en_name || data.id
          )
        ) {
          data.custom = true
          if (!data.id.includes('_custom')) {
            data.id += '_custom_' + nanoid(6)
          }
        }
        runtimeStore.editDict = data
        if (rIndex > -1) {
          source.bookList[rIndex] = getDefaultDict(data)
          emit('submit')
          Toast.success($t('edit_success'))
        } else {
          source.bookList.push(getDefaultDict(data))
          Toast.success($t('edit_and_add_to_dict'))
        }
      }
      console.log('submit!', data)
    } else {
      Toast.warning($t('please_fill_complete'))
    }
  })
}

onMounted(() => {
  if (!props.isAdd) {
    dictForm = cloneDeep(runtimeStore.editDict)
  }
})
</script>

<template>
  <div class="w-120 mt-4">
    <Form ref="dictFormRef" :rules="dictRules" :model="dictForm" label-width="8rem">
      <FormItem :label="$t('name')" prop="name">
        <BaseInput v-model="dictForm.name" />
      </FormItem>
      <FormItem :label="$t('description')">
        <Textarea v-model="dictForm.description" autosize></Textarea>
      </FormItem>
      <FormItem :label="$t('source_language')" v-if="false">
        <Select v-model="dictForm.language" :placeholder="$t('please_select')">
          <Option :label="$t('english')" value="en" />
          <Option :label="$t('german')" value="de" />
          <Option :label="$t('japanese')" value="ja" />
          <Option :label="$t('code')" value="code" />
        </Select>
      </FormItem>
      <FormItem :label="$t('target_language')" v-if="false">
        <Select v-model="dictForm.translateLanguage" :placeholder="$t('please_select')">
          <Option :label="$t('chinese')" value="zh-CN" />
          <Option :label="$t('english')" value="en" />
          <Option :label="$t('german')" value="de" />
          <Option :label="$t('japanese')" value="ja" />
        </Select>
      </FormItem>
      <div class="center">
        <base-button type="info" @click="emit('close')">{{ $t('close') }}</base-button>
        <base-button type="primary" :loading="loading" @click="onSubmit">{{ $t('confirm') }}</base-button>
      </div>
    </Form>
  </div>
</template>

<style scoped lang="scss"></style>
