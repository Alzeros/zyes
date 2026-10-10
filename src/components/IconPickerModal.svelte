<script lang="ts">
  import { isValidUrl, parseIcon, FAVICON_SOURCES_UI } from '../lib/utils';
  import { ensureIcon, getIconBlobUrl } from '../lib/iconCache.svelte';
  import Icon from '@iconify/svelte';
  import { t } from '../lib/i18n';

  let {
    lang,
    url,
    currentIcon = '',
    title = '',
    onclose,
    onsave,
  }: {
    lang: string;
    url: string;
    currentIcon?: string;
    title?: string;
    onclose: () => void;
    onsave: (icon: string) => void;
  } = $props();

  // The working icon value (what will be saved). Empty = no icon / fallback.
  let icon = $state(currentIcon || '');

  // Parsed view-model for the live big preview.
  let previewSource = $derived(parseIcon(icon.trim()) ?? { kind: 'none' as const });

  // ── Favicon source candidates ────────────────────────────────────────────
  // Every candidate is loaded through the authed icon proxy (blob URL — the
  // exact pipeline a card uses), NOT by pointing <img> at the third party:
  // picking one used to store its direct URL in the bookmark, which broke on
  // networks that can't reach that provider and bypassed the proxy cache.
  // Picking a candidate stores "favicon:<id>", which pins the proxy to that
  // one source (?s=<id>) — needed because the auto chain takes the first 200,
  // and some providers answer 200 with a generated letter placeholder.
  let urlOk = $derived(!!url && isValidUrl(url));
  let autoBlob = $derived(urlOk ? getIconBlobUrl(url) : '');
  let sourceBlobs = $derived(
    Object.fromEntries(FAVICON_SOURCES_UI.map((s) => [s.id, urlOk ? getIconBlobUrl(url, s.id) : '']))
  );
  $effect(() => {
    if (!urlOk) return;
    ensureIcon(url);
    for (const s of FAVICON_SOURCES_UI) ensureIcon(url, s.id);
  });

  // Which candidate is currently selected (derived from the parsed value so a
  // legacy direct-URL icon highlights its matching source too).
  let autoSelected = $derived(!icon.trim());
  let pinnedSelected = $derived(previewSource.kind === 'favicon' ? previewSource.source : '');

  function clearIcon() {
    icon = '';
  }
  function pinSource(id: string) {
    icon = `favicon:${id}`;
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-md anim-fade" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-[560px] bg-surface/95 dark:bg-surface-dark/95 backdrop-blur-2xl rounded-3xl border border-border/80 dark:border-border-dark/80 p-6 sm:p-7 shadow-2xl shadow-black/10 dark:shadow-black/40 anim-pop max-h-[90vh] overflow-y-auto thin-scroll">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-lg font-bold tracking-tight text-text dark:text-text-dark">{t('modal.icon')}</h2>
      <button
        type="button"
        onclick={onclose}
        class="p-1.5 rounded-xl hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer text-text-secondary dark:text-text-secondary-dark"
        aria-label="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Big live preview -->
    <div class="flex items-center gap-3.5 mb-6 p-3.5 bg-bg/50 dark:bg-bg-dark/50 rounded-2xl border border-border/60 dark:border-border-dark/60">
      <div class="flex items-center justify-center rounded-2xl bg-surface dark:bg-surface-dark border border-border/80 dark:border-border-dark/80 w-16 h-16 shrink-0 overflow-hidden shadow-2xs">
        {#if previewSource.kind === 'iconify'}
          <Icon icon={previewSource.name} width={32} height={32} />
        {:else if previewSource.kind === 'image'}
          <img src={previewSource.url} alt="" class="object-contain w-full h-full" style="padding:6%" />
        {:else if previewSource.kind === 'emoji'}
          <span class="text-2xl font-bold text-text dark:text-text-dark">{previewSource.char}</span>
        {:else if autoBlob}
          <!-- Auto mode: show the proxied favicon the card will actually render. -->
          <img src={autoBlob} alt="" class="object-contain w-full h-full" style="padding:6%" />
        {:else}
          <span class="text-2xl font-bold text-text dark:text-text-dark">{(title || 'N').charAt(0).toUpperCase()}</span>
        {/if}
      </div>
      <div class="flex-1 min-w-0">
        <input
          type="text"
          bind:value={icon}
          placeholder={t('modal.iconPlaceholder')}
          class="w-full px-3.5 py-2.5 rounded-xl bg-surface dark:bg-surface-dark border border-border/80 dark:border-border-dark/80 text-text dark:text-text-dark placeholder-text-secondary/60 dark:placeholder-text-secondary-dark/60 focus:outline-none focus:ring-2 focus:ring-text/10 focus:border-text/40 dark:focus:border-text-dark/40 transition-all text-sm"
        />
        <p class="mt-1.5 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
          {t('modal.iconHintPrefix')}
          <a
            href="https://icon-sets.iconify.design/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-text dark:text-text-dark underline font-medium"
            onclick={(e) => e.stopPropagation()}
          >icon-sets.iconify.design</a>
          {t('modal.iconHintSuffix')}
        </p>
      </div>
    </div>

    <!-- Favicon source picker: 5 items arranged neatly in 1 single row -->
    {#if urlOk}
      <div class="mb-6">
        <span class="block text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark mb-2.5">{t('modal.iconSourceTitle')}</span>
        <div class="grid grid-cols-5 gap-2 w-full">
          <button
            type="button"
            onclick={clearIcon}
            title={t('modal.iconSourceAuto')}
            class="rounded-2xl flex flex-col items-center gap-1.5 py-2 sm:py-2.5 px-1 sm:px-2 transition-all cursor-pointer {autoSelected ? 'bg-surface dark:bg-surface-dark ring-2 ring-text dark:ring-text-dark shadow-xs' : 'bg-bg/70 dark:bg-bg-dark/70 border border-border/80 dark:border-border-dark/80 hover:bg-surface dark:hover:bg-surface-dark hover:border-text/30'}"
          >
            <span class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
              {#if autoBlob}
                <img src={autoBlob} alt="" class="w-full h-full object-contain" />
              {:else}
                <span class="text-sm sm:text-base font-bold text-text dark:text-text-dark">{(title || 'N').charAt(0).toUpperCase()}</span>
              {/if}
            </span>
            <span class="text-[10px] sm:text-[11px] font-semibold leading-tight text-text-secondary dark:text-text-secondary-dark truncate w-full text-center tracking-tight">{t('modal.iconSourceAuto')}</span>
          </button>

          {#each FAVICON_SOURCES_UI as s (s.id)}
            <button
              type="button"
              onclick={() => pinSource(s.id)}
              title={s.label}
              class="rounded-2xl flex flex-col items-center gap-1.5 py-2 sm:py-2.5 px-1 sm:px-2 transition-all cursor-pointer {pinnedSelected === s.id ? 'bg-surface dark:bg-surface-dark ring-2 ring-text dark:ring-text-dark shadow-xs' : 'bg-bg/70 dark:bg-bg-dark/70 border border-border/80 dark:border-border-dark/80 hover:bg-surface dark:hover:bg-surface-dark hover:border-text/30'}"
            >
              <span class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                {#if sourceBlobs[s.id]}
                  <img src={sourceBlobs[s.id]} alt={s.label} class="w-full h-full object-contain" />
                {:else}
                  <span class="text-xs text-text-secondary/50 dark:text-text-secondary-dark/50">—</span>
                {/if}
              </span>
              <span class="text-[10px] sm:text-[11px] font-medium leading-tight text-text-secondary dark:text-text-secondary-dark truncate w-full text-center tracking-tight">{s.label}</span>
            </button>
          {/each}
        </div>
        <p class="mt-2.5 text-xs text-text-secondary/80 dark:text-text-secondary-dark/80 leading-relaxed">{t('modal.iconSourceHint')}</p>
      </div>
    {/if}

    <div class="flex justify-end gap-2.5 pt-2 border-t border-border/40 dark:border-border-dark/40">
      <button
        type="button"
        onclick={() => { clearIcon(); }}
        class="px-3.5 py-2.5 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark active:scale-[0.98] transition-all cursor-pointer mr-auto"
      >
        {t('modal.noIcon')}
      </button>
      <button
        type="button"
        onclick={onclose}
        class="px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark active:scale-[0.98] transition-all cursor-pointer"
      >
        {t('modal.cancel')}
      </button>
      <button
        type="button"
        onclick={() => onsave(icon)}
        class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-text hover:bg-text/85 text-bg dark:bg-text-dark dark:hover:bg-text-dark/85 dark:text-bg-dark shadow-sm active:scale-[0.98] transition-all cursor-pointer"
      >
        {t('modal.apply')}
      </button>
    </div>
  </div>
</div>
