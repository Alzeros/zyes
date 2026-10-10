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

<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-md anim-fade" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-sm bg-surface dark:bg-surface-dark rounded-3xl border border-border/80 dark:border-border-dark/80 p-7 shadow-2xl text-center anim-pop">
    {#if logoSrc.kind === 'none'}
      <div class="mx-auto mb-4 w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shadow-xs">
        <svg width="28" height="34" viewBox="6 5 17 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 9 8 H 22 L 10 24 H 23" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
        </svg>
      </div>

      <h2 class="text-xl font-bold mb-1 text-text dark:text-text-dark">Zyes</h2>
    {:else if logoSrc.kind === 'iconify'}
      <div class="mx-auto mb-4 w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shadow-xs">
        <Icon icon={logoSrc.name} width={32} height={32} class="shrink-0" inline />
      </div>
      <h2 class="text-xl font-bold mb-1 text-text dark:text-text-dark">Zyes</h2>
    {:else}
      <div class="mx-auto mb-4 flex items-center justify-center" style="height:56px">
        <img src={logoSrc.url} alt="" class="shrink-0 object-contain w-auto max-h-14 rounded-xl" />
      </div>
      <h2 class="text-xl font-bold mb-1 text-text dark:text-text-dark">Zyes</h2>
    {/if}
    <p class="text-sm text-text-secondary dark:text-text-secondary-dark mb-5 leading-relaxed">
      {t('about.tagline')}
    </p>

    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-bg/80 dark:bg-bg-dark/80 border border-border/80 dark:border-border-dark/80 mb-6 shadow-2xs">
      <span class="text-xs text-text-secondary dark:text-text-secondary-dark font-medium">{t('about.version')}</span>
      <span class="text-xs font-bold text-primary font-mono">v{APP_VERSION}</span>
    </div>

    <div class="flex justify-center">
      <button
        type="button"
        onclick={onclose}
        class="w-full py-2.5 px-5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white shadow-sm shadow-primary/20 transition-all cursor-pointer"
      >
        {t('about.close')}
      </button>
    </div>
  </div>
</div>
