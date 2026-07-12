<script lang="ts">
  import type { Bookmark, CardSize } from '../lib/types';
  import { getFaviconUrls, truncateUrl, parseIcon } from '../lib/utils';
  import { t } from '../lib/i18n';
  import IconView from './IconView.svelte';
  import { sizeSpec } from '../lib/cardSize';

  let {
    bookmark,
    lang,
    displayMode = 'detail',
    cardSize = 'md',
    interactive = true,
    onedit,
    ondelete,
    oncontext,
  }: {
    bookmark: Bookmark;
    lang: string;
    displayMode?: 'compact' | 'detail';
    cardSize?: CardSize;
    interactive?: boolean;   // false for non-interactive previews (no nav, no ctx menu)
    onedit: () => void;
    ondelete: () => void;
    oncontext: (e: MouseEvent) => void;
  } = $props();

  let spec = $derived(sizeSpec(cardSize, displayMode));
  let iconSource = $derived(parseIcon(bookmark.icon));

  function openBookmark() {
    window.open(bookmark.url, bookmark.openTarget === 'self' ? '_self' : '_blank');
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
    onclick={interactive ? openBookmark : undefined}
    onkeydown={interactive ? handleKeydown : undefined}
    oncontextmenu={interactive ? handleContext : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    title={bookmark.url}
    class="group relative flex flex-col aspect-square bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden transition-all duration-200 ease-out text-center select-none {interactive ? 'hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer' : ''}"
  >
    <!-- Square logo fills the area above the title bar -->
    <div class="flex-1 flex items-center justify-center p-2 min-h-0">
      <IconView source={iconSource} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} fill />
    </div>
    <!-- Title pinned to the bottom -->
    <div class="px-1.5 pb-2 pt-1 shrink-0">
      <h3 class="font-medium text-text dark:text-text-dark line-clamp-2 break-all {spec.compactTitle}">
        {bookmark.title}
      </h3>
    </div>
  </div>
{:else}
  <div
    onclick={interactive ? openBookmark : undefined}
    onkeydown={interactive ? handleKeydown : undefined}
    oncontextmenu={interactive ? handleContext : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    class="group relative flex flex-col {spec.detailPad} {spec.detailMinH} bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark transition-all duration-200 ease-out text-left select-none {interactive ? 'hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer' : ''}"
  >
    <div class="flex items-start gap-3 mb-3">
      <IconView source={iconSource} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} size="sm" bg />
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-text dark:text-text-dark truncate {spec.detailTitle}">{bookmark.title}</h3>
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
