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

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-sm bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
    <h2 class="text-lg font-semibold mb-2 text-text dark:text-text-dark">{title}</h2>
    <p class="text-sm text-text-secondary dark:text-text-secondary-dark mb-6">{message}</p>

    <div class="flex justify-end gap-2">
      <button
        onclick={onclose}
        class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      >
        {t('confirm.cancel')}
      </button>
      <button
        onclick={handleConfirm}
        disabled={confirming}
        class="px-4 py-2 rounded-xl text-sm font-medium bg-danger hover:bg-danger/90 text-white transition-colors disabled:opacity-50 cursor-pointer"
      >
        {confirming ? t('confirm.deleting') : t('confirm.delete')}
      </button>
    </div>
  </div>
</div>
