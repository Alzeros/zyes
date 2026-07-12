<script lang="ts">
  import { t } from '../lib/i18n';
  import { CARD_SIZE_LABELS } from '../lib/cardSize';
  import { isTouchDevice } from '../lib/utils';
  import type { Bookmark, CardSize } from '../lib/types';
  import BookmarkCard from './BookmarkCard.svelte';

  let {
    lang,
    cardSize,
    displayMode,
    enableDrag,
    siteName,
    onsave,
    onclose,
  }: {
    lang: string;
    cardSize: CardSize;
    displayMode: 'compact' | 'detail';
    enableDrag: boolean;
    siteName: string;
    onsave: (patch: { cardSize?: CardSize; enableDrag?: boolean; siteName?: string }) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  const SIZES: CardSize[] = ['xs', 'sm', 'md', 'lg'];
  const showDragToggle = isTouchDevice();

  // Active settings group: 'cards' | 'site'
  let activeGroup = $state<'cards' | 'site'>('cards');

  // ── Drafts: the panel edits local copies and only commits on "Apply". Until
  // then the backend / parent state is untouched, so previewing a size can't
  // trigger a network round-trip or hang the page.
  let draftCardSize = $state<CardSize>(cardSize);
  let draftEnableDrag = $state<boolean>(enableDrag);
  let draftSiteName = $state<string>(siteName);
  let saving = $state(false);

  // Re-seed drafts whenever the panel is (re)opened with fresh props.
  $effect(() => {
    draftCardSize = cardSize;
    draftEnableDrag = enableDrag;
    draftSiteName = siteName;
  });

  // Has the user touched anything vs. the last persisted values?
  let dirty = $derived(
    draftCardSize !== cardSize ||
    draftEnableDrag !== enableDrag ||
    draftSiteName !== siteName
  );

  async function apply() {
    if (!dirty || saving) return;
    saving = true;
    const ok = await onsave({
      cardSize: draftCardSize,
      enableDrag: draftEnableDrag,
      siteName: draftSiteName,
    });
    saving = false;
    if (ok) onclose();
  }

  function cancel() {
    // Discard drafts by reseeding from the (unchanged) persisted props.
    draftCardSize = cardSize;
    draftEnableDrag = enableDrag;
    draftSiteName = siteName;
    onclose();
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function label(s: CardSize) {
    return CARD_SIZE_LABELS[s][lang === 'zh' ? 'zh' : 'en'];
  }

  // Sample bookmarks rendered with the REAL BookmarkCard so the preview is a
  // faithful miniature of the main grid (square compact tiles vs. horizontal
  // detail tiles, real padding/fonts, real favicon fallback). `interactive:false`
  // disables navigation/ctx-menu so clicking a preview tile does nothing.
  const sampleBookmarks: Bookmark[] = [
    { id: 'p1', categoryId: '', title: t('cardSize.previewTitle'), url: 'https://example.com', description: t('cardSize.sampleDesc'), icon: null, openTarget: 'new', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'p2', categoryId: '', title: 'Zyes', url: 'https://zyes.app', description: t('cardSize.sampleDesc2'), icon: null, openTarget: 'new', sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'p3', categoryId: '', title: 'GitHub', url: 'https://github.com', description: '', icon: null, openTarget: 'new', sortOrder: 2, createdAt: '', updatedAt: '' },
    { id: 'p4', categoryId: '', title: 'Hacker News', url: 'https://news.ycombinator.com', description: '', icon: null, openTarget: 'new', sortOrder: 3, createdAt: '', updatedAt: '' },
  ];
  // Fixed preview grid: compact → many small square tiles, detail → 2 wider tiles.
  // (Not the responsive cols from sizeSpec, which depend on viewport width that
  // the panel can't reproduce; fixed columns keep the preview shape stable.)
  let previewCols = $derived(displayMode === 'compact' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2');
  let previewGap = $derived(displayMode === 'compact' ? 'gap-2' : 'gap-3');

  const groups = [
    { id: 'cards' as const, label: t('cardSize.nav.cards'), icon: 'M4 5h16M4 12h16M4 19h7' },
    { id: 'site' as const, label: t('cardSize.nav.site'), icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18' },
  ];
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={cancel} onkeydown={() => {}} role="button" tabindex="-1"></div>

  <div class="relative w-full max-w-2xl h-[80vh] max-h-[600px] bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark shadow-xl flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-border dark:border-border-dark shrink-0">
      <h2 class="text-base font-semibold text-text dark:text-text-dark">{t('cardSize.title')}</h2>
      <button
        type="button"
        onclick={cancel}
        class="p-1.5 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer text-text-secondary dark:text-text-secondary-dark"
        aria-label="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex flex-1 min-h-0 flex-col sm:flex-row">
      <!-- Group nav -->
      <nav class="flex sm:flex-col gap-1 p-3 sm:w-44 sm:shrink-0 border-b sm:border-b-0 sm:border-r border-border dark:border-border-dark">
        {#each groups as g}
          <button
            type="button"
            onclick={() => (activeGroup = g.id)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer {activeGroup === g.id ? 'bg-primary/10 text-primary' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark'}"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={g.icon} />
            </svg>
            {g.label}
          </button>
        {/each}
      </nav>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5 min-h-0">
        {#if activeGroup === 'cards'}
          <!-- ── Card size ─────────────────────────────────────── -->
          <section class="mb-6">
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.sizeSection')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-3">{t('cardSize.hint')}</p>

            <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark w-full">
              {#each SIZES as s}
                <button
                  type="button"
                  onclick={() => (draftCardSize = s)}
                  class="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer {draftCardSize === s ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
                >
                  {label(s)}
                </button>
              {/each}
            </div>
          </section>

          <span class="block text-xs font-medium mb-2 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.preview')}</span>
          <div class="rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark p-3 mb-6">
            <div class="grid {previewCols} {previewGap}">
              {#each sampleBookmarks as b}
                <BookmarkCard
                  bookmark={b}
                  {lang}
                  {displayMode}
                  cardSize={draftCardSize}
                  interactive={false}
                  onedit={() => {}}
                  ondelete={() => {}}
                  oncontext={() => {}}
                />
              {/each}
            </div>
          </div>

          <!-- ── Drag to reorder (touch only) ─────────────────── -->
          {#if showDragToggle}
            <section class="pt-5 border-t border-border dark:border-border-dark">
              <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.dragSection')}</h3>
              <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-3 leading-relaxed">{t('cardSize.dragHint')}</p>
              <button
                type="button"
                role="switch"
                aria-checked={draftEnableDrag}
                onclick={() => (draftEnableDrag = !draftEnableDrag)}
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark hover:border-primary/40 transition-colors cursor-pointer"
              >
                <span class="text-sm font-medium text-text dark:text-text-dark">{t('cardSize.enableDrag')}</span>
                <span class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {draftEnableDrag ? 'bg-primary' : 'bg-text-secondary/30 dark:bg-text-secondary-dark/30'}">
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {draftEnableDrag ? 'translate-x-6' : 'translate-x-1'}"></span>
                </span>
              </button>
            </section>
          {/if}
        {:else}
          <!-- ── Site title ────────────────────────────────────── -->
          <section>
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.siteSection')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-4">{t('cardSize.siteHint')}</p>

            <label class="block">
              <span class="block text-xs font-medium mb-1.5 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.siteSection')}</span>
              <input
                type="text"
                value={draftSiteName}
                maxlength="64"
                placeholder={t('cardSize.siteNamePlaceholder')}
                oninput={(e) => (draftSiteName = e.currentTarget.value)}
                class="w-full px-3 py-2 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-sm text-text dark:text-text-dark placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </label>

            <!-- Live tab preview (reflects the draft, not persisted) -->
            <div class="mt-6">
              <span class="block text-xs font-medium mb-2 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.preview')}</span>
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg dark:bg-bg-dark border border-border dark:border-border-dark max-w-[280px]">
                <span class="w-3.5 h-3.5 rounded-full bg-primary/70 shrink-0"></span>
                <span class="text-xs text-text dark:text-text-dark truncate">{draftSiteName.trim() || 'zyes'}</span>
              </div>
            </div>
          </section>
        {/if}
      </div>
    </div>

    <!-- Footer: Apply / Cancel -->
    <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-border-dark shrink-0">
      <button
        type="button"
        onclick={cancel}
        class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      >
        {t('cardSize.cancel')}
      </button>
      <button
        type="button"
        onclick={apply}
        disabled={!dirty || saving}
        class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if saving}
          <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        {/if}
        {t('cardSize.apply')}
      </button>
    </div>
  </div>
</div>
