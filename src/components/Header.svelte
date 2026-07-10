<script lang="ts">
  import type { SearchEngine } from '../lib/types';
  import SearchBar from './SearchBar.svelte';
  import { t } from '../lib/i18n';

  let {
    searchEngines,
    lang,
    onlogout,
    ontoggleSidebar,
    ontoggleLang,
  }: {
    searchEngines: SearchEngine[];
    lang: string;
    onlogout: () => void;
    ontoggleSidebar: () => void;
    ontoggleLang: () => void;
  } = $props();

  let darkMode = $state(localStorage.getItem('zyes_dark') === 'true');

  function toggleDark() {
    darkMode = !darkMode;
    localStorage.setItem('zyes_dark', String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }

  $effect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  });
</script>

<header class="sticky top-0 z-30 bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-md border-b border-border dark:border-border-dark">
  <div class="flex items-center gap-3 px-4 py-3 lg:px-6">
    <button
      onclick={ontoggleSidebar}
      class="md:hidden p-2 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      aria-label={t('header.toggleSidebar')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <a href="/" class="text-xl font-bold text-primary shrink-0 hidden sm:block">zyes</a>

    <div class="flex-1 flex justify-center mx-2">
      <SearchBar {searchEngines} {lang} />
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <!-- Language toggle -->
      <button
        onclick={ontoggleLang}
        class="px-2 py-1.5 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer text-xs font-semibold"
        aria-label="Switch language"
      >
        {lang === 'zh' ? 'EN' : '中'}
      </button>

      <button
        onclick={toggleDark}
        class="p-2 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
        aria-label={t('header.toggleDark')}
      >
        {#if darkMode}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>

      <button
        onclick={onlogout}
        class="p-2 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
        aria-label={t('header.logout')}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  </div>
</header>
