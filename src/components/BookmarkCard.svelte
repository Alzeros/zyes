<script lang="ts">
  import type { Bookmark, CardSize } from '../lib/types';
  import { getFaviconUrls, truncateUrl, parseIcon } from '../lib/utils';
  import { ensureIcon, getIconBlobUrl } from '../lib/iconCache.svelte';
  import { t } from '../lib/i18n';
  import { reportClick } from '../lib/api';
  import IconView from './IconView.svelte';
  import { sizeSpec } from '../lib/cardSize';

  let {
    bookmark,
    lang,
    cardSize = 'md',
    interactive = true,
    enterAnim = true,
    index = 0,
    clickToday = 0,
    clickTotal = 0,
    onedit,
    ondelete,
    oncontext,
    onclicked,
  }: {
    bookmark: Bookmark;
    lang: string;
    cardSize?: CardSize;
    interactive?: boolean;   // false for non-interactive previews (no nav, no ctx menu)
    enterAnim?: boolean;     // mount fade/rise stagger; off for previews + while dragging
    index?: number;          // grid position → stagger delay (see .card-enter in app.css)
    clickToday?: number;     // clicks recorded today (badge; hidden when 0)
    clickTotal?: number;     // all-time clicks (badge tooltip)
    onedit: () => void;
    ondelete: () => void;
    oncontext: (e: MouseEvent) => void;
    onclicked?: (id: string) => void;  // notify App for the optimistic badge bump
  } = $props();

  // displayMode is now a per-bookmark attribute, not a group/global setting.
  // Default to 'compact' for any unknown/legacy value (older bookmarks without
  // the field render as compact, matching the migrate() backfill).
  let displayMode = $derived(bookmark.displayMode === 'detail' ? 'detail' : 'compact');

  let spec = $derived(sizeSpec(cardSize));
  let iconSource = $derived(parseIcon(bookmark.icon));
  // Auto favicon = no custom icon ('none', proxy walks its source chain) or a
  // pinned proxy source ('favicon', e.g. "favicon:google" — the user picked a
  // specific provider because the auto chain returned a wrong/placeholder icon).
  let isAutoIcon = $derived(iconSource.kind === 'none' || iconSource.kind === 'favicon');
  let pinnedSource = $derived(iconSource.kind === 'favicon' ? iconSource.source : '');
  // Route the favicon load through the backend icon proxy (server-side fetch +
  // cache). The blob URL is populated asynchronously by ensureIcon() and
  // reactively updates this derived.
  let proxyUrl = $derived(isAutoIcon ? getIconBlobUrl(bookmark.url, pinnedSource) : '');
  // Trigger the authed fetch (Bearer header, no token in URL). getIconBlobUrl
  // returns '' until the blob is ready; the reactive cache update re-evaluates
  // proxyUrl and the <img> re-renders.
  $effect(() => {
    if (isAutoIcon) ensureIcon(bookmark.url, pinnedSource);
  });

  // Col-span drives the grid layout: compact = 1 cell (square), detail = 2
  // cells (a 2:1 wide box whose height tracks the compact cell height). This
  // lets compact and detail cards coexist in one grid row.
  let colSpan = $derived(displayMode === 'detail' ? 'col-span-2' : 'col-span-1');

  function openBookmark() {
    // Stats first: the report is fire-and-forget (keepalive survives the
    // _self unload below) and the badge bump is pure local state, so neither
    // can delay or break the navigation itself.
    if (interactive) {
      reportClick(bookmark.id);
      onclicked?.(bookmark.id);
    }
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
    style="--i:{index}"
    class="group relative {colSpan} {enterAnim && interactive ? 'card-enter' : ''} flex flex-col aspect-square bg-surface dark:bg-surface-dark rounded-2xl border border-border/80 dark:border-border-dark/80 overflow-hidden transition-all duration-200 ease-out text-center select-none shadow-xs {interactive ? 'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/50 hover:border-text/25 dark:hover:border-text-dark/25 hover:-translate-y-1 cursor-pointer' : ''}"
  >
    <!-- Today-clicks badge -->
    {#if interactive && clickToday > 0}
      <span
        class="absolute top-1.5 right-1.5 z-10 min-w-4.5 h-4.5 px-1.5 rounded-full bg-text text-bg dark:bg-text-dark dark:text-bg-dark text-[10px] font-bold leading-4.5 text-center pointer-events-none shadow-2xs"
        title={t('stats.badge', { today: String(clickToday), total: String(clickTotal) })}
      >
        {clickToday > 99 ? '99+' : clickToday}
      </span>
    {/if}

    <!-- Icon area -->
    <div class="flex-1 flex items-center justify-center min-h-0 p-1.5">
      <div class="w-full h-full flex items-center justify-center rounded-xl bg-bg/50 dark:bg-bg-dark/50">
        <IconView source={iconSource} proxyUrl={proxyUrl} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} fill class="h-3/4 aspect-square card-icon-zoom" />
      </div>
    </div>

    <!-- Title pinned to the bottom -->
    <div class="px-2 pb-2 pt-0.5 shrink-0 overflow-hidden">
      <h3 class="font-medium text-text dark:text-text-dark line-clamp-2 break-words leading-tight {spec.compactTitle}">
        {bookmark.title}
      </h3>
    </div>
  </div>
{:else}
  <!-- Detail card: spans 2 columns -->
  <div
    onclick={interactive ? openBookmark : undefined}
    onkeydown={interactive ? handleKeydown : undefined}
    oncontextmenu={interactive ? handleContext : undefined}
    role={interactive ? 'button' : undefined}
    tabindex={interactive ? 0 : undefined}
    style="--i:{index}"
    class="group relative {colSpan} {enterAnim && interactive ? 'card-enter' : ''} {spec.detailPad} aspect-[2/1] bg-surface dark:bg-surface-dark rounded-2xl border border-border/80 dark:border-border-dark/80 overflow-hidden transition-all duration-200 ease-out text-left select-none shadow-xs {interactive ? 'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/50 hover:border-text/25 dark:hover:border-text-dark/25 hover:-translate-y-1 cursor-pointer' : ''}"
  >
    {#if interactive && clickToday > 0}
      <span
        class="absolute top-2 right-2 z-10 min-w-4.5 h-4.5 px-1.5 rounded-full bg-text text-bg dark:bg-text-dark dark:text-bg-dark text-[10px] font-bold leading-4.5 text-center pointer-events-none shadow-2xs"
        title={t('stats.badge', { today: String(clickToday), total: String(clickTotal) })}
      >
        {clickToday > 99 ? '99+' : clickToday}
      </span>
    {/if}
    <div class="flex items-start gap-3 mb-1.5">
      <div class="w-10 h-10 rounded-xl bg-bg/60 dark:bg-bg-dark/60 flex items-center justify-center shrink-0 border border-border/60 dark:border-border-dark/60 overflow-hidden">
        <IconView source={iconSource} proxyUrl={proxyUrl} fallbackUrls={getFaviconUrls(bookmark.url)} title={bookmark.title} size="sm" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-text dark:text-text-dark truncate {spec.detailTitle}">{bookmark.title}</h3>
        <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate mt-0.5 font-mono opacity-80">
          {truncateUrl(bookmark.url)}
        </p>
      </div>
    </div>

    {#if bookmark.description}
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-1 leading-relaxed">
        {bookmark.description}
      </p>
    {/if}
  </div>
{/if}
