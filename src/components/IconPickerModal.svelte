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
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm anim-fade" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl anim-pop max-h-[90vh] overflow-y-auto thin-scroll">
    <h2 class="text-lg font-semibold mb-4 text-text dark:text-text-dark">{t('modal.icon')}</h2>

    <!-- Big live preview -->
    <div class="flex items-center gap-3 mb-5">
      <div class="flex items-center justify-center rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark w-16 h-16 shrink-0 overflow-hidden">
        {#if previewSource.kind === 'iconify'}
          <Icon icon={previewSource.name} width={32} height={32} />
        {:else if previewSource.kind === 'image'}
          <img src={previewSource.url} alt="" class="object-contain w-full h-full" style="padding:6%" />
        {:else if previewSource.kind === 'emoji'}
          <span class="text-2xl font-bold text-primary">{previewSource.char}</span>
        {:else if autoBlob}
          <!-- Auto mode: show the proxied favicon the card will actually render. -->
          <img src={autoBlob} alt="" class="object-contain w-full h-full" style="padding:6%" />
        {:else}
          <span class="text-2xl font-bold text-primary">{(title || 'N').charAt(0).toUpperCase()}</span>
        {/if}
      </div>
      <div class="flex-1 min-w-0">
        <input
          type="text"
          bind:value={icon}
          placeholder={t('modal.iconPlaceholder')}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
        />
        <p class="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">
          {t('modal.iconHintPrefix')}
          <a
            href="https://icon-sets.iconify.design/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
            onclick={(e) => e.stopPropagation()}
          >icon-sets.iconify.design</a>
          {t('modal.iconHintSuffix')}
        </p>
      </div>
    </div>

    <!-- Favicon source picker. "Auto" (clears the icon) lets the proxy walk its
         source chain; the others pin one provider via "favicon:<id>". All tiles
         render the PROXIED image, so what you see is what the card will show —
         and a provider the browser can't reach directly still previews fine. -->
    {#if urlOk}
      <div class="mb-5">
        <span class="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-2">{t('modal.iconSourceTitle')}</span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={clearIcon}
            title={t('modal.iconSourceAuto')}
            class="w-[72px] rounded-lg flex flex-col items-center gap-1 p-1.5 bg-bg dark:bg-bg-dark border transition-all cursor-pointer {autoSelected ? 'ring-2 ring-primary border-primary' : 'border-border dark:border-border-dark hover:border-primary/40'}"
          >
            <span class="w-9 h-9 flex items-center justify-center">
              {#if autoBlob}
                <img src={autoBlob} alt="" class="w-full h-full object-contain" />
              {:else}
                <span class="text-base font-bold text-primary">{(title || 'N').charAt(0).toUpperCase()}</span>
              {/if}
            </span>
            <span class="text-[10px] leading-tight text-text-secondary dark:text-text-secondary-dark truncate w-full text-center">{t('modal.iconSourceAuto')}</span>
          </button>

          {#each FAVICON_SOURCES_UI as s (s.id)}
            <button
              type="button"
              onclick={() => pinSource(s.id)}
              title={s.label}
              class="w-[72px] rounded-lg flex flex-col items-center gap-1 p-1.5 bg-bg dark:bg-bg-dark border transition-all cursor-pointer {pinnedSelected === s.id ? 'ring-2 ring-primary border-primary' : 'border-border dark:border-border-dark hover:border-primary/40'}"
            >
              <span class="w-9 h-9 flex items-center justify-center">
                {#if sourceBlobs[s.id]}
                  <img src={sourceBlobs[s.id]} alt={s.label} class="w-full h-full object-contain" />
                {:else}
                  <!-- No image: that source returned nothing for this site (or
                       is still loading). Kept visible + selectable anyway. -->
                  <span class="text-[10px] text-text-secondary/60 dark:text-text-secondary-dark/60">—</span>
                {/if}
              </span>
              <span class="text-[10px] leading-tight text-text-secondary dark:text-text-secondary-dark truncate w-full text-center">{s.label}</span>
            </button>
          {/each}
        </div>
        <p class="mt-2 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">{t('modal.iconSourceHint')}</p>
      </div>
    {/if}

    <!-- Text icon removed: when no icon is set, the card already falls back to
         the title's first character as the placeholder (IconView 'none' branch).
         There's no separate "text icon" option anymore — just leave the icon
         field empty (or pick an iconify name / image / fetched favicon above). -->

    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onclick={() => { clearIcon(); }}
        class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      >
        {t('modal.noIcon')}
      </button>
      <button
        type="button"
        onclick={onclose}
        class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      >
        {t('modal.cancel')}
      </button>
      <button
        type="button"
        onclick={() => onsave(icon)}
        class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer"
      >
        {t('modal.apply')}
      </button>
    </div>
  </div>
</div>
