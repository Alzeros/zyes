<script lang="ts">
  import { t } from '../lib/i18n';
  import { CARD_SIZE_LABELS } from '../lib/cardSize';
  import type { CardSize } from '../lib/types';

  let {
    lang,
    cardSize,
    siteName,
    onsave,
    onclose,
  }: {
    lang: string;
    cardSize: CardSize;
    siteName: string;
    onsave: (patch: { cardSize?: CardSize; siteName?: string }) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  const SIZES: CardSize[] = ['xs', 'sm', 'md', 'lg'];

  // Active settings group: 'cards' | 'site'
  let activeGroup = $state<'cards' | 'site'>('cards');

  // ── Drafts: the panel edits local copies and only commits on "Apply". Until
  // then the backend / parent state is untouched, so previewing a size can't
  // trigger a network round-trip or hang the page.
  let draftCardSize = $state<CardSize>(cardSize);
  let draftSiteName = $state<string>(siteName);
  let saving = $state(false);

  // Re-seed drafts whenever the panel is (re)opened with fresh props.
  $effect(() => {
    draftCardSize = cardSize;
    draftSiteName = siteName;
  });

  // Has the user touched anything vs. the last persisted values?
  let dirty = $derived(
    draftCardSize !== cardSize ||
    draftSiteName !== siteName
  );

  async function apply() {
    if (!dirty || saving) return;
    saving = true;
    const ok = await onsave({
      cardSize: draftCardSize,
      siteName: draftSiteName,
    });
    saving = false;
    if (ok) onclose();
  }

  function cancel() {
    // Discard drafts by reseeding from the (unchanged) persisted props.
    draftCardSize = cardSize;
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
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-3 leading-relaxed">{t('cardSize.dragMovedHint')}</p>
          </section>
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
