<script lang="ts">
  import type { Bookmark } from '../lib/types';
  import { getFaviconUrl, truncateUrl, parseIcon } from '../lib/utils';
  import { t } from '../lib/i18n';
  import IconView from './IconView.svelte';

  let {
    bookmark,
    lang,
    displayMode = 'detail',
    onedit,
    ondelete,
    oncontext,
  }: {
    bookmark: Bookmark;
    lang: string;
    displayMode?: 'compact' | 'detail';
    onedit: () => void;
    ondelete: () => void;
    oncontext: (e: MouseEvent) => void;
  } = $props();

  let iconSource = $derived(parseIcon(bookmark.icon));

  function openBookmark() {
    window.open(bookmark.url, '_blank');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBookmark();
    }
  }

  function handleContext(e: MouseEvent) {
    e.preventDefault();
    oncontext(e);
  }
</script>

{#if displayMode === 'compact'}
  <div
    onclick={openBookmark}
    onkeydown={handleKeydown}
    oncontextmenu={handleContext}
    role="button"
    tabindex="0"
    title={bookmark.url}
    class="group relative flex flex-col aspect-square bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 ease-out text-center cursor-pointer select-none"
  >
    <!-- Square logo fills the area above the title bar -->
    <div class="flex-1 flex items-center justify-center p-2 min-h-0">
      <IconView source={iconSource} fallbackUrl={getFaviconUrl(bookmark.url)} title={bookmark.title} fill />
    </div>
    <!-- Title pinned to the bottom -->
    <div class="px-1.5 pb-2 pt-1 shrink-0">
      <h3 class="text-xs font-medium text-text dark:text-text-dark leading-tight line-clamp-2 break-all">
        {bookmark.title}
      </h3>
    </div>
  </div>
{:else}
  <div
    onclick={openBookmark}
    onkeydown={handleKeydown}
    oncontextmenu={handleContext}
    role="button"
    tabindex="0"
    class="group relative flex flex-col p-4 min-h-[140px] bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 ease-out text-left cursor-pointer select-none"
  >
    <div class="flex items-start gap-3 mb-3">
      <IconView source={iconSource} fallbackUrl={getFaviconUrl(bookmark.url)} title={bookmark.title} size="sm" bg />
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
{/if}
