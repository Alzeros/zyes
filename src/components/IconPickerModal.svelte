<script lang="ts">
  import { isValidUrl, parseIcon } from '../lib/utils';
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

  // Auto-fetched favicon preview, loaded through the authed icon proxy (blob
  // URL — the exact pipeline the card itself uses). Replaces the old three
  // direct third-party candidates: picking one stored its direct URL in the
  // bookmark, which broke on networks that can't reach that third party and
  // bypassed the proxy cache entirely.
  let autoBlob = $derived(url && isValidUrl(url) ? getIconBlobUrl(url) : '');
  $effect(() => {
    if (url && isValidUrl(url)) ensureIcon(url);
  });

  function clearIcon() {
    icon = '';
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

    <!-- Auto favicon (via the icon proxy). Clicking it clears the custom icon,
         i.e. "use the auto-fetched site icon". Selected state = no custom icon. -->
    {#if url && isValidUrl(url)}
      <div class="mb-5">
        <span class="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-2">{t('modal.autoFetchFromUrl')}</span>
        <button
          type="button"
          onclick={clearIcon}
          title={t('modal.autoFetchFromUrl')}
          class="w-16 h-16 rounded-lg flex items-center justify-center bg-bg dark:bg-bg-dark border transition-all cursor-pointer {!icon.trim() ? 'ring-2 ring-primary border-primary' : 'border-border dark:border-border-dark hover:border-primary/40'}"
        >
          {#if autoBlob}
            <img src={autoBlob} alt="" class="w-10 h-10 object-contain p-1" />
          {:else}
            <span class="text-lg font-bold text-primary">{(title || 'N').charAt(0).toUpperCase()}</span>
          {/if}
        </button>
        <p class="mt-2 text-xs text-text-secondary dark:text-text-secondary-dark">{t('modal.autoFetchHint')}</p>
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
