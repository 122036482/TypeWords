<script setup lang="ts">
import type { Word } from '~/types/types.ts'
import VolumeIcon from '~/components/icon/VolumeIcon.vue'
import { usePlayWordAudio } from '~/hooks/sound.ts'
import Tooltip from '~/components/base/Tooltip.vue'
import BaseIcon from '~/components/base/BaseIcon.vue'
import { useWordOptions } from '~/hooks/dict.ts'
import SentenceHightLightWord from '~/components/word/SentenceHightLightWord.vue'

withDefaults(
  defineProps<{
    item: Word
    showTranslate?: boolean
    showWord?: boolean
    showTransPop?: boolean
    showOption?: boolean
    showCollectIcon?: boolean
    showMarkIcon?: boolean
    index?: number
    active?: boolean
    disabled?: boolean
  }>(),
  {
    showTranslate: true,
    showWord: true,
    showTransPop: true,
    showOption: true,
    showCollectIcon: true,
    showMarkIcon: true,
    active: false,
    disabled: false,
  }
)

const playWordAudio = usePlayWordAudio()

const { isWordCollect, toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()
</script>

<template>
  <div class="common-list-item" :class="{ active, disabled }">
    <div class="left">
      <slot name="prefix" :item="item"></slot>
      <div class="title-wrapper">
        <div class="item-title">
          <span class="text-sm translate-y-0.5 text-gray-500" v-if="index != undefined">{{ index }}.</span>
          <span class="word" :class="!showWord && 'word-shadow'">{{ item.word }}</span>
          <span class="phonetic text-gray" :class="!showWord && 'word-shadow'">{{ item.phonetic0 }}</span>
          <VolumeIcon class="volume" @click="playWordAudio(item.word)"></VolumeIcon>
        </div>
        <div class="item-sub-title flex flex-col gap-2" v-if="item.trans.length && showTranslate">
          <div v-for="v in item.trans">
            <Tooltip v-if="v.cn.length > 30 && showTransPop" :title="v.pos + '  ' + v.cn">
              <SentenceHightLightWord
                :text="v.pos + '  ' + v.cn.slice(0, 30) + '...'"
                :word="item.word"
                :high-light="false"
                :dictation="!showWord"
              />
            </Tooltip>
            <SentenceHightLightWord
              v-else
              :text="v.pos + '  ' + v.cn"
              :word="item.word"
              :high-light="false"
              :dictation="!showWord"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="right" v-if="showOption">
      <slot name="suffix" :item="item"></slot>
      <BaseIcon
        v-if="showCollectIcon"
        :class="!isWordCollect(item) ? 'collect' : 'fill'"
        @click.stop="toggleWordCollect(item)"
        :title="!isWordCollect(item) ? $t('collect') : $t('uncollect')"
      >
        <IconFluentStar16Regular v-if="!isWordCollect(item)" />
        <IconFluentStar16Filled v-else />
      </BaseIcon>

      <BaseIcon
        v-if="showMarkIcon"
        :class="!isWordSimple(item) ? 'collect' : 'fill'"
        @click.stop="toggleWordSimple(item)"
        :title="!isWordSimple(item) ? $t('mark_mastered') : $t('unmark_mastered')"
      >
        <IconFluentCheckmarkCircle16Regular v-if="!isWordSimple(item)" />
        <IconFluentCheckmarkCircle16Filled v-else />
      </BaseIcon>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
