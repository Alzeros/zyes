<script lang="ts">
  import { t } from '../lib/i18n';
  import { APP_VERSION } from '../lib/version';
  import Icon from '@iconify/svelte';
  import { parseIcon } from '../lib/utils';

  let { lang, siteLogo, onclose }: { lang: string; siteLogo: string; onclose: () => void } = $props();

  // Custom logo replaces the whole brand block (Z mark + "Zyes" wordmark),
  // matching Header/LoginScreen's "replace the whole group" behaviour.
  let logoSrc = $derived(parseIcon(siteLogo));

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
  <div class="relative w-full max-w-sm bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl text-center">
    {#if logoSrc.kind === 'none'}
      <div class="mx-auto mb-4 inline-grid place-items-center" style="width:48px;height:56px">
        <svg width="48" height="56" viewBox="6 5 17 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g class="zyes-light">
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
          </g>
          <g class="zyes-dark">
            <path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
          </g>
        </svg>
      </div>

      <h2 class="text-xl font-bold mb-1 text-text dark:text-text-dark">Zyes</h2>
    {:else if logoSrc.kind === 'iconify'}
      <div class="mx-auto mb-4 flex items-center justify-center" style="height:56px">
        <Icon icon={logoSrc.name} width={56} height={56} class="shrink-0" inline />
      </div>
    {:else}
      <div class="mx-auto mb-4 flex items-center justify-center" style="height:56px">
        <img src={logoSrc.url} alt="" class="shrink-0 object-contain w-auto" style="max-height:56px" />
      </div>
    {/if}
    <p class="text-sm text-text-secondary dark:text-text-secondary-dark mb-5">
      {t('about.tagline')}
    </p>

    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg dark:bg-bg-dark border border-border dark:border-border-dark mb-6">
      <span class="text-xs text-text-secondary dark:text-text-secondary-dark">{t('about.version')}</span>
      <span class="text-xs font-semibold text-text dark:text-text-dark font-mono">v{APP_VERSION}</span>
    </div>

    <div class="flex justify-center">
      <button
        type="button"
        onclick={onclose}
        class="px-5 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer"
      >
        {t('about.close')}
      </button>
    </div>
  </div>
</div>
