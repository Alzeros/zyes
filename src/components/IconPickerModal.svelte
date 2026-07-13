<script lang="ts">
  import { isValidUrl, getFaviconUrls, parseIcon } from '../lib/utils';
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
  // Favicon candidates produced by the "fetch" action. Each entry tracks load
  // status so we can show a placeholder while it loads and hide broken ones.
  type Candidate = { url: string; label: string; loaded: boolean; failed: boolean };
  let candidates = $state<Candidate[]>([]);

  const FAVICON_SOURCE_LABELS = ['icon.horse', 'Google', 'DuckDuckGo'];

  function fetchCandidates() {
    const u = url.trim();
    if (!u || !isValidUrl(u)) {
      candidates = [];
      return;
    }
    const urls = getFaviconUrls(u);
    candidates = urls.map((url, i) => ({
      url,
      label: FAVICON_SOURCE_LABELS[i] ?? `源 ${i + 1}`,
      loaded: false,
      failed: false,
    }));
  }

  function chooseImage(url: string) {
    icon = url;
  }
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

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
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

    <!-- Fetch favicons from the target URL -->
    {#if url && isValidUrl(url)}
      <div class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">{t('modal.autoFetchFromUrl')}</span>
          <button
            type="button"
            onclick={fetchCandidates}
            class="px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer"
          >
            {t('modal.fetch')}
          </button>
        </div>
        {#if candidates.length > 0}
          <div class="flex flex-wrap gap-3">
            {#each candidates as c}
              <button
                type="button"
                onclick={() => chooseImage(c.url)}
                title={c.label}
                class="w-16 h-16 rounded-lg flex items-center justify-center bg-bg dark:bg-bg-dark border transition-all cursor-pointer {icon === c.url ? 'ring-2 ring-primary border-primary' : 'border-border dark:border-border-dark hover:border-primary/40'}"
              >
                {#if c.failed}
                  <span class="text-[11px] text-text-secondary dark:text-text-secondary-dark">{c.label.slice(0, 3)}</span>
                {:else}
                  <img
                    src={c.url}
                    alt={c.label}
                    class="w-10 h-10 object-contain p-1"
                    onload={() => (c.loaded = true)}
                    onerror={() => (c.failed = true)}
                  />
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-xs text-text-secondary dark:text-text-secondary-dark">{t('modal.autoFetchHint')}</p>
        {/if}
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
