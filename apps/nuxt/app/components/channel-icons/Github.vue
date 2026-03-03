<script setup lang="ts">
import { GITHUB } from '@/config/env.ts'
import BaseIcon from '~/components/base/BaseIcon.vue'
</script>

<template>
  <a
    :href="GITHUB"
    target="_blank"
    rel="noreferrer"
    :aria-label="$t('github_project')"
    class="color-reverse-black github"
  >
    <BaseIcon title="Github" v-bind="$attrs">
      <IconSimpleIconsGithub />
    </BaseIcon>
  </a>
</template>

<style scoped lang="scss"></style>
