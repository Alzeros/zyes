<script lang="ts">
  import type { SearchEngine } from '../lib/types';
  import SearchBar from './SearchBar.svelte';
  import AboutModal from './AboutModal.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import { t } from '../lib/i18n';
  import type { CardSize } from '../lib/types';

  let {
    searchEngines,
    lang,
    cardSize,
    siteName,
    onlogout,
    ontoggleLang,
    onsave,
    onexport,
    onimport,
  }: {
    searchEngines: SearchEngine[];
    lang: string;
    cardSize: CardSize;
    siteName: string;
    onlogout: () => void;
    ontoggleLang: () => void;
    onsave: (patch: { cardSize?: CardSize; siteName?: string }) => Promise<boolean>;
    onexport: () => Promise<void>;
    onimport: (file: File) => Promise<void>;
  } = $props();

  let darkMode = $state(localStorage.getItem('zyes_dark') === 'true');
  let menuOpen = $state(false);
  let aboutOpen = $state(false);
  let settingsOpen = $state(false);

  function toggleDark() {
    darkMode = !darkMode;
    localStorage.setItem('zyes_dark', String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }

  $effect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  });

  // Close the settings dropdown on outside click / Escape.
  $effect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const el = document.getElementById('zyes-settings-menu');
      if (el && !el.contains(e.target as Node)) menuOpen = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') menuOpen = false;
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<header class="sticky top-0 z-30 bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-md border-b border-border dark:border-border-dark">
  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 lg:px-6">
    <a href="/" class="flex items-center gap-1 shrink-0 group/logo justify-self-start">
      <!-- Mark: Design #1 – sharp miter Z, tight crop -->
      <span class="inline-grid place-items-center" style="width:22px;height:28px">
        <!-- viewBox tightly crops just the Z: x 6..23, y 5..27 -->
        <svg width="22" height="28" viewBox="6 5 17 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Light mode: dark slate Z -->
          <g class="zyes-light">
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="1" stroke-linejoin="miter" stroke-linecap="square" transform="translate(-2.5,-2.5)" opacity="0.2" />
          </g>
          <!-- Dark mode: white Z -->
          <g class="zyes-dark">
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="1" stroke-linejoin="miter" stroke-linecap="square" transform="translate(-2.5,-2.5)" opacity="0.3" />
          </g>
        </svg>
      </span>
      <span class="zyes-word text-2xl font-bold tracking-tight">yes</span>
    </a>

    <!-- Desktop search bar: centered on the page midline via CSS grid
         (1fr | auto | 1fr). The left/right 1fr tracks are equal so the
         auto-sized middle track sits exactly on the page center, regardless
         of how wide the logo vs the buttons are. -->
    <div class="hidden md:flex justify-self-center w-full max-w-xl">
      <SearchBar {searchEngines} {lang} />
    </div>

    <div class="flex items-center gap-1 shrink-0 justify-self-end md:ml-0 ml-auto">
      <!-- Language toggle -->
      <button
        onclick={ontoggleLang}
        class="px-2 py-1.5 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer text-xs font-semibold w-9 text-center"
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

      <div class="relative" id="zyes-settings-menu">
        <button
          onclick={() => (menuOpen = !menuOpen)}
          class="p-2 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
          aria-label={t('header.settings')}
          aria-expanded={menuOpen}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {#if menuOpen}
          <div class="absolute right-0 mt-2 w-44 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-xl py-1 z-50 origin-top-right">
            <button
              type="button"
              onclick={() => { settingsOpen = true; menuOpen = false; }}
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-text dark:text-text-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2" />
              </svg>
              {t('settings.cardSize')}
            </button>
            <button
              type="button"
              onclick={() => { aboutOpen = true; menuOpen = false; }}
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-text dark:text-text-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('settings.about')}
            </button>
            <button
              type="button"
              onclick={() => { onlogout(); menuOpen = false; }}
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-text dark:text-text-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('settings.logout')}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Mobile search bar: own row below the top bar -->
  <div class="md:hidden px-4 pb-3">
    <SearchBar {searchEngines} {lang} />
  </div>
</header>

{#if aboutOpen}
  <AboutModal {lang} onclose={() => (aboutOpen = false)} />
{/if}

{#if settingsOpen}
  <SettingsModal
    {lang}
    {cardSize}
    {siteName}
    {onsave}
    {onexport}
    {onimport}
    onclose={() => (settingsOpen = false)}
  />
{/if}
