<script lang="ts">
  import { t } from '../lib/i18n';
  import { sizeSpec, CARD_SIZE_LABELS } from '../lib/cardSize';
  import { isTouchDevice } from '../lib/utils';
  import type { CardSize } from '../lib/types';

  let {
    lang,
    cardSize,
    displayMode,
    enableDrag,
    onselect,
    onsetEnableDrag,
    onclose,
  }: {
    lang: string;
    cardSize: CardSize;
    displayMode: 'compact' | 'detail';
    enableDrag: boolean;
    onselect: (size: CardSize) => void;
    onsetEnableDrag: (v: boolean) => void;
    onclose: () => void;
  } = $props();

  const SIZES: CardSize[] = ['xs', 'sm', 'md', 'lg'];
  const showDragToggle = isTouchDevice();

  // Live preview spec for the chosen size under the current display mode.
  let spec = $derived(sizeSpec(cardSize, displayMode));
  let gridClass = $derived(`grid ${spec.cols} ${spec.gap}`);

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function label(s: CardSize) {
    return CARD_SIZE_LABELS[s][lang === 'zh' ? 'zh' : 'en'];
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
    <h2 class="text-lg font-semibold mb-1 text-text dark:text-text-dark">{t('cardSize.title')}</h2>
    <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-4">{t('cardSize.hint')}</p>

    <!-- Size segment buttons -->
    <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark mb-5 w-full">
      {#each SIZES as s}
        <button
          type="button"
          onclick={() => onselect(s)}
          class="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer {cardSize === s ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
        >
          {label(s)}
        </button>
      {/each}
    </div>

    <span class="block text-xs font-medium mb-2 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.preview')}</span>
    <!-- Mini live preview grid (two fake cards) rendered with the real spec -->
    <div class="rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark p-3 mb-2">
      <div class={gridClass}>
        {#each [{ title: t('cardSize.previewTitle'), url: 'https://example.com' }, { title: 'Zyes', url: 'https://zyes.app' }] as sample}
          {#if displayMode === 'compact'}
            <div class="flex flex-col aspect-square bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark overflow-hidden text-center">
              <div class="flex-1 flex items-center justify-center p-2 min-h-0">
                <span class="font-bold text-primary" style="font-size:min(40vw,2rem)">{sample.title.charAt(0).toUpperCase()}</span>
              </div>
              <div class="px-1.5 pb-2 pt-1 shrink-0">
                <h3 class="font-medium text-text dark:text-text-dark line-clamp-2 break-all {spec.compactTitle}">{sample.title}</h3>
              </div>
            </div>
          {:else}
            <div class="flex flex-col {spec.detailPad} {spec.detailMinH} bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark text-left">
              <div class="flex items-start gap-3 mb-3">
                <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-bg dark:bg-bg-dark shrink-0">
                  <span class="font-bold text-primary" style="font-size:14px">{sample.title.charAt(0).toUpperCase()}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-text dark:text-text-dark truncate {spec.detailTitle}">{sample.title}</h3>
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate mt-0.5">{sample.url}</p>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Drag-to-reorder (only surfaced on touch devices) -->
    {#if showDragToggle}
      <div class="mt-5 pt-4 border-t border-border dark:border-border-dark">
        <span class="block text-xs font-medium mb-1 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.dragSection')}</span>
        <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-3 leading-relaxed">{t('cardSize.dragHint')}</p>
        <button
          type="button"
          role="switch"
          aria-checked={enableDrag}
          onclick={() => onsetEnableDrag(!enableDrag)}
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark hover:border-primary/40 transition-colors cursor-pointer"
        >
          <span class="text-sm font-medium text-text dark:text-text-dark">{t('cardSize.enableDrag')}</span>
          <span class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {enableDrag ? 'bg-primary' : 'bg-text-secondary/30 dark:bg-text-secondary-dark/30'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {enableDrag ? 'translate-x-6' : 'translate-x-1'}"></span>
          </span>
        </button>
      </div>
    {/if}

    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onclick={onclose}
        class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer"
      >
        {t('cardSize.apply')}
      </button>
    </div>
  </div>
</div>
