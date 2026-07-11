<script lang="ts">
  import type { SearchEngine } from '../lib/types';
  import Icon from '@iconify/svelte';
  import { getSearchEngineIcon } from '../lib/utils';

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
      if (!target.closest('.engine-switcher')) {
        onclose();
      }
    }
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => document.removeEventListener('click', handleClick);
  });
</script>

<div class="engine-switcher absolute top-full left-0 mt-2 w-56 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl p-2 z-50 shadow-lg">
  {#each engines as engine}
    <button
      onclick={() => onselect(engine)}
      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer {engine.id === currentId ? 'bg-primary/10 text-primary' : 'hover:bg-bg dark:hover:bg-bg-dark text-text dark:text-text-dark'}"
    >
      <span
        class="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
        style="background-color: {brandColor(engine)}"
      >
        {#if brandIcon(engine)}
          <Icon icon={brandIcon(engine)!} width="14" height="14" color="white" />
        {:else}
          <span class="text-xs font-bold">{engine.name.charAt(0)}</span>
        {/if}
      </span>
      <span class="text-sm font-medium">{engine.name}</span>
      {#if engine.id === currentId}
        <svg class="w-4 h-4 ml-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      {/if}
    </button>
  {/each}
</div>
