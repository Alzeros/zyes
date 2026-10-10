<script lang="ts">
  import type { SearchEngine } from '../lib/types';
  import Icon from '@iconify/svelte';
  import { getSearchEngineIcon } from '../lib/utils';
  import { t } from '../lib/i18n';

  let {
    engines,
    currentId,
    onselect,
    onclose,
  }: {
    engines: SearchEngine[];
    currentId: string;
    onselect: (engine: SearchEngine) => void;
    onclose: () => void;
  } = $props();

  function brandColor(engine: SearchEngine): string {
    return getSearchEngineIcon(engine.id)?.color ?? '#6366f1';
  }
  function brandIcon(engine: SearchEngine): string | null {
    return getSearchEngineIcon(engine.id)?.icon ?? null;
  }

  // Close on click outside
  $effect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.engine-switcher') && !target.closest('.engine-switcher-btn')) {
        onclose();
      }
    }
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => document.removeEventListener('click', handleClick);
  });
</script>

<div class="engine-switcher absolute top-full left-0 mt-2.5 w-60 bg-surface/95 dark:bg-surface-dark/95 backdrop-blur-2xl border border-border/80 dark:border-border-dark/80 rounded-2xl p-1.5 z-50 shadow-2xl shadow-black/10 dark:shadow-black/40 anim-pop-anchor-l">
  <div class="px-2.5 py-1 mb-1 text-[11px] font-semibold text-text-secondary/70 dark:text-text-secondary-dark/70 tracking-wider uppercase">
    {t('search.switchEngine')}
  </div>
  {#each engines as engine}
    <button
      onclick={() => onselect(engine)}
      class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all cursor-pointer {engine.id === currentId ? 'bg-text/10 dark:bg-text-dark/15 text-text dark:text-text-dark font-semibold shadow-2xs' : 'hover:bg-bg dark:hover:bg-bg-dark text-text dark:text-text-dark'}"
    >
      <span
        class="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
        style="background-color: {brandColor(engine)}"
      >
        {#if brandIcon(engine)}
          <Icon icon={brandIcon(engine)!} width="16" height="16" color="white" />
        {:else}
          <span class="text-xs font-bold">{engine.name.charAt(0)}</span>
        {/if}
      </span>
      <span class="text-sm flex-1 text-left">{engine.name}</span>
      {#if engine.id === currentId}
        <svg class="w-4 h-4 text-text dark:text-text-dark shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      {/if}
    </button>
  {/each}
</div>
