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
  let activeEngineId = $state(localStorage.getItem(ENGINE_KEY) || defaultEngine || 'google');

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
    activeEngineId = engine.id;
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
  <div class="flex items-center bg-bg dark:bg-bg-dark border border-border dark:border-border-dark rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
    <button
      onclick={() => (showSwitcher = !showSwitcher)}
      class="mr-2 p-1 rounded-lg hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors cursor-pointer shrink-0 text-primary"
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
      placeholder={placeholder}
      class="flex-1 bg-transparent outline-none text-sm text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark min-w-0"
    />

    <button
      onclick={doSearch}
      class="ml-2 p-1.5 rounded-full bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer shrink-0"
      aria-label={submitLabel}
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
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
