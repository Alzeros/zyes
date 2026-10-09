<script lang="ts">
  import { t } from '../lib/i18n';
  import type { Bookmark, Category, ClickStatRow } from '../lib/types';
  import StatsPanel from './StatsPanel.svelte';

  // Standalone stats window, opened from the header chart button. Kept apart
  // from SettingsModal on purpose: stats are read-only, opened often, and
  // mixing them into the settings form made both feel heavier. The feed is
  // refreshed on every open so numbers are current without polling.
  let {
    lang,
    statsRows,
    bookmarks,
    categories,
    onrefreshStats,
    onclose,
  }: {
    lang: string;
    statsRows: ClickStatRow[];
    bookmarks: Bookmark[];
    categories: Category[];
    onrefreshStats: () => Promise<void>;
    onclose: () => void;
  } = $props();

  void lang; // kept for future locale-specific formatting (dates in the panel)

  function cancel() {
    onclose();
  }

  $effect(() => {
    void onrefreshStats();
  });

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm anim-fade" onclick={cancel} onkeydown={() => {}} role="button" tabindex="-1"></div>

  <div class="relative w-full max-w-2xl h-[80vh] max-h-[600px] bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark shadow-xl flex flex-col overflow-hidden anim-pop">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-border dark:border-border-dark shrink-0">
      <h2 class="text-base font-semibold text-text dark:text-text-dark">{t('stats.title')}</h2>
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

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-5 min-h-0 thin-scroll">
      <StatsPanel {statsRows} {bookmarks} {categories} />
    </div>
  </div>
</div>
