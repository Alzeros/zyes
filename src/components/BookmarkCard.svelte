<script lang="ts">
  import type { Bookmark } from '../lib/types';
  import { getFaviconUrl, truncateUrl } from '../lib/utils';
  import { t } from '../lib/i18n';

  let {
    bookmark,
    lang,
    onedit,
    ondelete,
  }: {
    bookmark: Bookmark;
    lang: string;
    onedit: () => void;
    ondelete: () => void;
  } = $props();

  let faviconError = $state(false);

  function openBookmark() {
    window.open(bookmark.url, '_blank');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBookmark();
    }
  }
</script>

<div
  onclick={openBookmark}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  class="group relative flex flex-col p-4 min-h-[140px] bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all text-left cursor-pointer"
>
  <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
    <button
      onclick={(e) => { e.stopPropagation(); onedit(); }}
      class="p-1.5 rounded-lg bg-bg/80 dark:bg-bg-dark/80 hover:bg-border dark:hover:bg-border-dark transition-colors cursor-pointer"
      aria-label={t('grid.edit')}
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
    <button
      onclick={(e) => { e.stopPropagation(); ondelete(); }}
      class="p-1.5 rounded-lg bg-bg/80 dark:bg-bg-dark/80 hover:bg-danger/10 text-danger transition-colors cursor-pointer"
      aria-label={t('grid.delete')}
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>

  <div class="flex items-start gap-3 mb-3">
    <div class="w-10 h-10 rounded-lg bg-bg dark:bg-bg-dark flex items-center justify-center shrink-0 overflow-hidden">
      {#if !faviconError}
        <img
          src={getFaviconUrl(bookmark.url)}
          alt=""
          class="w-6 h-6"
          onerror={() => (faviconError = true)}
        />
      {:else}
        <span class="text-lg font-bold text-primary">
          {bookmark.title.charAt(0).toUpperCase()}
        </span>
      {/if}
    </div>
    <div class="flex-1 min-w-0">
      <h3 class="font-semibold text-sm text-text dark:text-text-dark truncate">{bookmark.title}</h3>
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate mt-0.5">
        {truncateUrl(bookmark.url)}
      </p>
    </div>
  </div>

  {#if bookmark.description}
    <p class="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-2 flex-1">
      {bookmark.description}
    </p>
  {/if}
</div>
