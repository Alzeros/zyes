<script lang="ts">
  import type { SearchEngine } from '../lib/types';
  import EngineSwitcher from './EngineSwitcher.svelte';
  import Icon from '@iconify/svelte';
  import { getSearchEngineIcon } from '../lib/utils';
  import { t } from '../lib/i18n';

  let { searchEngines, lang, defaultEngine }: { searchEngines: SearchEngine[]; lang: string; defaultEngine: string } = $props();

  const ENGINE_KEY = 'zyes_active_engine';

  let query = $state('');
  let showSwitcher = $state(false);
  let inputEl: HTMLInputElement;
  // The user's explicit engine choice (persisted locally) wins; otherwise
  // follow the server-side default. Derived (not one-shot $state) because the
  // defaultEngine prop arrives AFTER mount — the bar renders before fetchData
  // resolves, and a $state initializer would freeze the pre-fetch fallback.
  let userChoice = $state(localStorage.getItem(ENGINE_KEY) || '');
  let activeEngineId = $derived(userChoice || defaultEngine || 'google');

  let activeEngine = $derived(
    searchEngines.find((e) => e.id === activeEngineId && e.isActive) ||
    searchEngines.find((e) => e.isActive) ||
    searchEngines[0]
  );

  let activeEngines = $derived(searchEngines.filter((e) => e.isActive));
  let activeIcon = $derived(activeEngine ? getSearchEngineIcon(activeEngine.id) : null);

  // Bind i18n text to the `lang` prop so the bar re-renders on language switch.
  // (t() reads a module-level mutable that Svelte can't otherwise track.)
  let placeholder = $derived(
    `${activeEngine?.name || 'engine'} ${t('search.placeholder')} ( / )`
  );
  let switchLabel = $derived(t('search.switchEngine'));
  let submitLabel = $derived(t('search.submit'));

  function setEngine(engine: SearchEngine) {
    localStorage.setItem(ENGINE_KEY, engine.id);
    userChoice = engine.id;
    showSwitcher = false;
  }

  function doSearch() {
    if (!query.trim() || !activeEngine) return;
    const url = activeEngine.url.replace('{query}', encodeURIComponent(query.trim()));
    window.open(url, '_blank');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') doSearch();
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputEl?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="relative w-full max-w-xl">
  <div class="flex items-center bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-md border border-border/80 dark:border-border-dark/80 rounded-full px-3.5 py-1.5 shadow-sm shadow-black/5 dark:shadow-black/20 focus-within:shadow-md focus-within:border-text/30 dark:focus-within:border-text-dark/30 transition-all duration-200">
    <button
      onclick={() => (showSwitcher = !showSwitcher)}
      class="mr-2 p-1.5 rounded-full hover:bg-bg dark:hover:bg-bg-dark border border-transparent hover:border-border dark:hover:border-border-dark transition-all cursor-pointer shrink-0 text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark"
      aria-label={switchLabel}
    >
      {#if activeIcon}
        <Icon icon={activeIcon.icon} width="18" height="18" />
      {:else}
        <span class="text-sm font-semibold">{activeEngine?.name?.charAt(0) || 'S'}</span>
      {/if}
    </button>

    <input
      bind:this={inputEl}
      bind:value={query}
      onkeydown={handleKeydown}
      type="text"
      placeholder={`${activeEngine?.name || 'engine'} ${t('search.placeholder')}`}
      class="flex-1 bg-transparent outline-none text-sm text-text dark:text-text-dark placeholder-text-secondary/70 dark:placeholder-text-secondary-dark/70 min-w-0"
    />

    <div class="flex items-center gap-1.5 shrink-0 ml-1">
      {#if !query}
        <kbd class="hidden sm:inline-flex items-center justify-center text-[11px] font-mono font-medium text-text-secondary/60 dark:text-text-secondary-dark/60 bg-bg dark:bg-bg-dark border border-border/80 dark:border-border-dark/80 rounded-md px-1.5 py-0.5 shadow-2xs pointer-events-none select-none">
          /
        </kbd>
      {/if}

      <button
        onclick={doSearch}
        class="p-1.5 rounded-full bg-text hover:bg-text/85 text-bg dark:bg-text-dark dark:hover:bg-text-dark/85 dark:text-bg-dark shadow-2xs active:scale-95 transition-all cursor-pointer"
        aria-label={submitLabel}
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </div>
  </div>

  {#if showSwitcher}
    <EngineSwitcher
      engines={activeEngines}
      currentId={activeEngine?.id || ''}
      onselect={setEngine}
      onclose={() => (showSwitcher = false)}
    />
  {/if}
</div>
