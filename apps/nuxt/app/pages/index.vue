<script setup lang="ts">
import { APP_NAME, GITHUB } from '~/config/env.ts'
import BaseIcon from '~/components/base/BaseIcon.vue'
import { getSystemTheme, listenToSystemThemeChange, setTheme, swapTheme } from '~/hooks/theme.ts'

definePageMeta({
  layout: 'empty',
})

let theme = $ref('light')

onMounted(() => {
  // 开启监听系统主题变更,后期可以通过用户配置来决定是否开启
  listenToSystemThemeChange(val => {
    // 如果系统主题变更后和当前的主题一致，则不需要再重新切换
    if (theme === val) return
    theme = val
    setTheme(theme)
  })
  theme = getSystemTheme()
  console.log('theme', theme)
  setTheme(theme)
})

// 获取当前具体的主题名称
function getTheme() {
  // auto模式下，则通过查询系统主题来获取当前具体的主题名称
  return theme === 'auto' ? getSystemTheme() : theme
}

function toggleTheme() {
  // auto模式下，默认是使用系统主题，切换时应该使用当前系统主题为基础进行切换
  theme = swapTheme((theme === 'auto' ? getSystemTheme() : theme) as any)
  setTheme(theme)
}

const { locales, setLocale, locale } = useI18n()
</script>
<template>
  <div class="wrapper bg-primary2 text-lg" :class="theme" id="wrapper">
    <div class="center relative h-14">
      <div class="flex gap-10">
        <NuxtLink to="/words" class="black-link">
          {{ $t('words') }}
        </NuxtLink>
        <NuxtLink to="/articles" class="black-link">
          {{ $t('articles') }}
        </NuxtLink>
        <!--        <NuxtLink to="/nce" class="black-link">-->
        <!--          {{ $t('new_concept_english') }}-->
        <!--        </NuxtLink>-->
        <NuxtLink to="/doc" class="black-link">
          {{ $t('english_document') }}
        </NuxtLink>
      </div>
      <div class="absolute right-6 flex items-center gap-2 color-reverse-black">
        <NuxtLink to="/help" class="color-reverse-black" aria-label="Help page">
          <BaseIcon>
            <IconFluentQuestionCircle20Regular />
          </BaseIcon>
        </NuxtLink>

        <div class="relative group">
          <div class="more w-10 rounded-r-lg h-full center box-border transition-all duration-300">
            <IconPhTranslate />
          </div>
          <div
            class="space-y-2 btn-no-margin pt-2 absolute z-2 right-0 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto"
          >
            <div class="card p-4! space-y-2">
              <div v-for="locale in locales" @click="setLocale(locale.code)" class="w-full cp break-keep black-link">
                {{ locale.name }}
              </div>
            </div>
          </div>
        </div>

        <BaseIcon :title="$t('toggle_theme')" @click="toggleTheme">
          <IconFluentWeatherMoon16Regular v-if="theme === 'light'" />
          <IconFluentWeatherSunny16Regular v-else />
        </BaseIcon>

        <a
          class="flex gap-2 relative color-reverse-black"
          :href="GITHUB"
          target="_blank"
          aria-label="Github project address"
        >
          <BaseIcon class="z-1" title="Github" noBg>
            <IconSimpleIconsGithub />
          </BaseIcon>
          <NuxtImg
            class="z-0 shrink-0 h-8 -ml-4"
            :src="`https://img.shields.io/github/stars/zyronon/typing-word?style=flat-square&label=%20&color=${theme === 'light' ? 'white' : 'black'}`"
          />
        </a>
      </div>
    </div>
    <div class="line"></div>

    <div class="content">
      <h1>{{ APP_NAME }}</h1>
      <h2 class="font-normal m-0">{{ $t('app_desc') }}</h2>
      <div class="">
        <div class="base-button" @click="navigateTo('/words')">{{ $t('start_word_practice') }}</div>
        <div class="base-button" @click="navigateTo('/articles')">{{ $t('start_article_practice') }}</div>
      </div>

      <div class="w-70vw mb-4 mt-20">
        <div class="flex gap-10">
          <div>
            <div class="text-4xl font-bold mb-8">{{ $t('home_word_practice') }}</div>
            <ul class="p-0 m-0 list-none space-y-2 max-w-80">
              <li>{{ $t('home_word_practice_desc1') }}</li>
              <li>{{ $t('home_word_practice_desc2') }}</li>
              <li>{{ $t('home_word_practice_desc3') }}</li>
            </ul>
          </div>
          <div class="flex-1">
            <NuxtImg src="/imgs/words.png" class="rounded-xl w-full" />
          </div>
        </div>

        <div class="flex gap-14 w-full mt-30">
          <div class="flex-1">
            <NuxtImg src="/imgs/articles.png" class="rounded-xl w-full" />
          </div>
          <div>
            <div class="text-4xl font-bold mb-8  text-right">{{ $t('home_article_practice') }}</div>
            <ul class="p-0 m-0 list-none space-y-2 max-w-80">
              <li>{{ $t('home_article_practice_desc1') }}</li>
              <li>{{ $t('home_article_practice_desc2') }}</li>
              <li>{{ $t('home_article_practice_desc3') }}</li>
            </ul>
          </div>
        </div>

        <div class="text-4xl font-bold mb-8 mt-20 text-center">{{ $t('function_desc') }}</div>
        <div class="card-wrap">
          <div class="card1 hover">
            <div class="emoji">📕</div>
            <div class="title">{{ $t('home_collection') }}</div>
            <div class="desc">
              <ul>
                <li>{{ $t('home_collection_desc1') }}</li>
                <li>{{ $t('home_collection_desc2') }}</li>
                <li>{{ $t('home_collection_desc3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card1 hover">
            <div class="emoji">🌐</div>
            <div class="title">{{ $t('home_vocabulary') }}</div>
            <div class="desc">{{ $t('home_vocabulary_desc') }}</div>
          </div>
          <div class="card1 hover">
            <div class="emoji">🆓</div>
            <div class="title">{{ $t('home_free_opensource') }}</div>
            <div class="desc">
              <ul>
                <li>{{ $t('home_free_opensource_desc1') }}</li>
                <li>{{ $t('home_free_opensource_desc2') }}</li>
                <li>{{ $t('home_free_opensource_desc3') }}</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="card-wrap">
          <div class="card1 hover">
            <div class="emoji">⚙️</div>
            <div class="title">{{ $t('home_customization') }}</div>
            <div class="desc">
              <ul>
                <li>{{ $t('home_customization_desc1') }}</li>
                <li>{{ $t('home_customization_desc2') }}</li>
                <li>{{ $t('home_customization_desc3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card1 hover">
            <div class="emoji">🎨</div>
            <div class="title">{{ $t('home_design') }}</div>
            <div class="desc">
              <ul>
                <li>{{ $t('home_design_desc1') }}</li>
                <li>{{ $t('home_design_desc2') }}</li>
                <li>{{ $t('home_design_desc3') }}</li>
              </ul>
            </div>
          </div>
          <div class="card1 hover">
            <div class="emoji">🎯</div>
            <div class="title">{{ $t('home_personalized') }}</div>
            <div class="desc">
              <ul>
                <li>{{ $t('home_personalized_desc1') }}</li>
                <li>{{ $t('home_personalized_desc2') }}</li>
                <li>{{ $t('home_personalized_desc3') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="line"></div>
    <div class="w-full center gap-4 h-20">
      <channel-icons type="horizontal" :share="false" />
      <template v-if="locale === 'zh'">
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=51015602001426"
          target="_blank"
          class="black-link text-sm"
          >{{ $t('cn_limit_no1') }}
        </a>
        <a href="https://beian.miit.gov.cn/" class="black-link text-sm" target="_blank">{{ $t('cn_limit_no2') }}</a>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wrapper {
  --color-bg: #e6e8eb;
  --color-card1-bg: #f6f6f7;
  --color-line: #cecece;
  --color-h2: rgb(91, 91, 91);
  --accent: #818cf8;
  --accent-2: #60a5fa;
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

.wrapper.dark {
  --color-bg: #0e1217;
  --color-card1-bg: #202127;
  --color-line: #333333;
  --color-h2: rgb(151, 151, 151);
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  :deep(.github) {
    color: white !important;
  }
}

.wrapper {
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Helvetica,
    Arial,
    'Apple Color Emoji',
    'Segoe UI Emoji';
  //color: var(--color-card-text);

  .content {
    @apply mt-16 flex flex-col items-center gap-8;

    .card-wrap {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      margin-bottom: 1.2rem;
      gap: 1rem;
    }
  }
}

h1 {
  font-size: 4.8rem !important;
  line-height: 1.6;
  background: linear-gradient(120deg, #bd34fe 30%, #41d1ff);
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  @apply m-0 font-bold color-transparent bg-clip-text;
}

.card1 {
  @apply w-auto relative rounded-xl p-5 box-border flex flex-col items-start gap-2 mb-0;
  //background: var(--color-second);
  background: var(--color-card1-bg);
  //border: 1px solid var(--color-line);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &.hover:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  }

  .title {
    @apply font-bold;
  }

  .emoji {
    @apply inline-block bg-third rounded-lg p-1.5 text-xl;
  }

  ul {
    @apply mt-0 pl-0 list-none;
  }
}

.base-button {
  @apply inline-flex items-center justify-center outline-none text-center transition-all duration-200 user-select-none
   vertical-align-middle whitespace-nowrap rounded-lg cp text-white p-x-5 h-11;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 20px rgba(129, 140, 248, 0.25);
}

.base-button + .base-button {
  @apply ml-8;
}

.base-button:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.line {
  border-bottom: 1px solid var(--color-line);
}

@media (max-width: 768px) {
  h1 {
    font-size: 3rem !important;
  }

  .content {
    margin-top: 4rem;
    gap: 1.4rem;
  }

  .base-button {
    width: 100%;
    margin: 0.5rem 0;
    height: 2.8rem;
    font-size: 1rem;
  }

  .base-button + .base-button {
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 2.4rem !important;
  }

  .content {
    margin-top: 3.2rem;
    gap: 1.2rem;
  }
}
</style>
