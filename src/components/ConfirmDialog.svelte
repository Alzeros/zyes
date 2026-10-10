<script lang="ts">
  import { t } from '../lib/i18n';

  let {
    lang,
    title,
    message,
    onclose,
    onconfirm,
  }: {
    lang: string;
    title: string;
    message: string;
    onclose: () => void;
    onconfirm: () => Promise<void>;
  } = $props();

  let confirming = $state(false);

  async function handleConfirm() {
    confirming = true;
    try {
      await onconfirm();
    } finally {
      confirming = false;
    }
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
  <div class="absolute inset-0 bg-black/50 backdrop-blur-md anim-fade" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-sm bg-surface/95 dark:bg-surface-dark/95 backdrop-blur-2xl rounded-3xl border border-border/80 dark:border-border-dark/80 p-6 sm:p-7 shadow-2xl shadow-black/10 dark:shadow-black/40 anim-pop">
    <div class="w-10 h-10 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4 text-lg">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      </svg>
    </div>
    <h2 class="text-lg font-bold tracking-tight mb-2 text-text dark:text-text-dark">{title}</h2>
    <p class="text-sm text-text-secondary dark:text-text-secondary-dark mb-6 leading-relaxed">{message}</p>

    <div class="flex justify-end gap-2.5">
      <button
        onclick={onclose}
        class="px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark active:scale-[0.98] transition-all cursor-pointer"
      >
        {t('confirm.cancel')}
      </button>
      <button
        onclick={handleConfirm}
        disabled={confirming}
        class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-danger hover:bg-danger/90 text-white shadow-md shadow-danger/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
      >
        {confirming ? t('confirm.deleting') : t('confirm.delete')}
      </button>
    </div>
  </div>
</div>
