<script setup lang="ts">
import BaseIcon from '~/components/base/BaseIcon.vue'
import { defineAsyncComponent } from 'vue'
import ShareIcon from '@/components/channel-icons/ShareIcon.vue'
import WeChat from '@/components/channel-icons/WeChat.vue'
import Github from '@/components/channel-icons/Github.vue'

withDefaults(
  defineProps<{
    type?: 'vertical' | 'horizontal'
    share?: boolean
    wechat?: boolean
    github?: boolean
  }>(),
  {
    type: 'vertical',
    share: true,
    github: true,
    wechat: true,
  }
)
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))

let showXhsDialog = $ref(false)
let showQQDialog = $ref(false)
</script>

<template>
  <div class="center" :class="type === 'vertical' ? 'flex-col gap-1' : 'gap-4'">
    <Github v-if="github" />

    <WeChat v-if="wechat" />

    <BaseIcon :title="$t('qq_group')" @click="showQQDialog = true">
      <IconUiwQq class="color-red" />
    </BaseIcon>
    <BaseIcon :title="$t('xiaohongshu')" @click="showXhsDialog = true">
      <IconSimpleIconsXiaohongshu class="color-red-500" />
    </BaseIcon>

    <a
      href="https://x.com/typewords2"
      target="_blank"
      rel="noreferrer"
      :aria-label="$t('follow_x_account', { x_account: 'typewords2' })"
    >
      <BaseIcon :title="$t('twitter')">
        <IconRiTwitterFill class="color-blue" />
      </BaseIcon>
    </a>

    <a
      href="mailto:zyronon@163.com"
      target="_blank"
      rel="noreferrer"
      :aria-label="$t('send_email', { email: 'zyronon@163.com' })"
    >
      <BaseIcon :title="$t('email')">
        <IconMaterialSymbolsMail class="color-blue" />
      </BaseIcon>
    </a>

    <ShareIcon v-if="share" />
  </div>

  <Dialog v-model="showXhsDialog" :title="$t('xiaohongshu')">
    <div class="w-120 p-6 pt-0">
      <div class="mb-4">
        {{ $t('xiaohongshu_desc') }}
      </div>
      <div class="text-center">
        <img src="/imgs/channel/xhs.png" :alt="$t('xiaohongshu_qrcode')" class="w-70 rounded-xl shadow-lg" />
      </div>
    </div>
  </Dialog>

  <Dialog v-model="showQQDialog" :title="$t('qq_group')">
    <div class="w-120 p-6 pt-0">
      <div class="mb-4">
        <span>{{ $t('community_desc') }}</span>
      </div>
      <div class="text-center">
        <img src="/imgs/channel/qq.jpg" :alt="$t('qq_qrcode')" class="w-70 rounded-xl shadow-lg" />
      </div>
    </div>
  </Dialog>
</template>
<style scoped lang="scss"></style>
