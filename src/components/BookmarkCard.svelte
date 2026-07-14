<script lang="ts">
  import type { Bookmark, CardSize } from '../lib/types';
  import { getFaviconUrls, truncateUrl, parseIcon } from '../lib/utils';
  import { ensureIcon, getIconBlobUrl } from '../lib/iconCache.svelte';
  import { t } from '../lib/i18n';
  import IconView from './IconView.svelte';
  import { sizeSpec } from '../lib/cardSize';

  let {
    bookmark,
    lang,
    cardSize = 'md',
    interactive = true,
    onedit,
    ondelete,
    oncontext,
  }: {
    bookmark: Bookmark;
    lang: string;
    cardSize?: CardSize;
    interactive?: boolean;   // false for non-interactive previews (no nav, no ctx menu)
    onedit: () => void;
    ondelete: () => void;
    oncontext: (e: MouseEvent) => void;
  } = $props();

  // displayMode is now a per-bookmark attribute, not a group/global setting.
  // Default to 'compact' for any unknown/legacy value (older bookmarks without
  // the field render as compact, matching the migrate() backfill).
  let displayMode = $derived(bookmark.displayMode === 'detail' ? 'detail' : 'compact');

  let spec = $derived(sizeSpec(cardSize));
  let iconSource = $derived(parseIcon(bookmark.icon));
  // When the bookmark has no custom icon, route favicon load through the
  // backend icon proxy (server-side fetch + cache). The blob URL is populated
  // asynchronously by ensureIcon() and reactively updates this derived.
  let proxyUrl = $derived(iconSource.kind === 'none' ? getIconBlobUrl(bookmark.url) : '');
  // Trigger the authed fetch (Bearer header, no token in URL) when the bookmark
  // has no custom icon. getIconBlobUrl returns '' until the blob is ready; the
  // reactive cache update re-evaluates proxyUrl and the <img> re-renders.
  $effect(() => {
    if (iconSource.kind === 'none') ensureIcon(bookmark.url);
  });

  // Col-span drives the grid layout: compact = 1 cell (square), detail = 2
  // cells (a 2:1 wide box whose height tracks the compact cell height). This
  // lets compact and detail cards coexist in one grid row.
  let colSpan = $derived(displayMode === 'detail' ? 'col-span-2' : 'col-span-1');

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
    class="group relative {colSpan} flex flex-col aspect-square bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden transition-all duration-200 ease-out text-center select-none {interactive ? 'hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer' : ''}"
  >
    <!-- Icon area. The card is square but the title bar takes vertical space,
         so this area is a wide rectangle. Favicons are square; with object-contain
         on a wide box they'd centre and leave gaps, and the rounded clip would
         fall on the gaps (square-edged image showing). So we constrain the
         IconView to a SQUARE box (h-full + aspect-square) sized to the area's
         height, centred — the favicon fills the square and the radius clips it. -->
    <div class="flex-1 flex items-center justify-center min-h-0 p-1">
      <IconView source={iconSource} proxyUrl={proxyUrl} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} fill class="h-full aspect-square" />
    </div>
    <!-- Title pinned to the bottom. min-h guarantees room for two clamped lines
         so tall titles aren't clipped by the card's overflow-hidden when the
         icon area is large; overflow-hidden + line-clamp-2 bounds the text. -->
    <div class="px-1.5 pb-1.5 pt-0.5 shrink-0 overflow-hidden">
      <h3 class="font-medium text-text dark:text-text-dark line-clamp-2 break-all leading-tight {spec.compactTitle}">
        {bookmark.title}
      </h3>
    </div>
  </div>
{:else}
  <!-- Detail card: spans 2 columns. aspect-[2/1] locks the 2:1 box so the
       height tracks the compact cell height (≈, see cardSize.ts notes).
       overflow-hidden + line-clamp keep content from growing the row. -->
  <div
    onclick={interactive ? openBookmark : undefined}
    onkeydown={interactive ? handleKeydown : undefined}
    oncontextmenu={interactive ? handleContext : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    class="group relative {colSpan} {spec.detailPad} aspect-[2/1] bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden transition-all duration-200 ease-out text-left select-none {interactive ? 'hover:shadow-lg hover:shadow-black/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer' : ''}"
  >
    <div class="flex items-start gap-3 mb-1">
      <IconView source={iconSource} proxyUrl={proxyUrl} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} size="sm" bg />
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-text dark:text-text-dark truncate {spec.detailTitle}">{bookmark.title}</h3>
        <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate mt-0.5">
          {truncateUrl(bookmark.url)}
        </p>
      </div>
    </div>

    {#if bookmark.description}
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-1">
        {bookmark.description}
      </p>
    {/if}
  </div>
{/if}
