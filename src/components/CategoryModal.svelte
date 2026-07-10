<script lang="ts">
  import type { Category } from '../lib/types';
  import { t } from '../lib/i18n';

  let {
    lang,
    category,
    onclose,
    onsave,
  }: {
    lang: string;
    category?: Category;
    onclose: () => void;
    onsave: (data: { name: string; icon: string }) => Promise<void>;
  } = $props();

  let name = $state(category?.name || '');
  let icon = $state(category?.icon || '');
  let saving = $state(false);

  const isEdit = !!category;

  const emojiOptions = ['📁', '💻', '🔧', '📚', '🌐', '🎨', '🎮', '🎵', '📱', '⚡', '🔒', '🛠️', '📊', '🚀', '💡'];

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    saving = true;
    try {
      await onsave({ name: name.trim(), icon: icon || '📁' });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      saving = false;
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
    <h2 class="text-lg font-semibold mb-4 text-text dark:text-text-dark">
      {isEdit ? t('modal.editCategory') : t('modal.addCategory')}
    </h2>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="cat-name" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.categoryName')}</label>
        <input
          id="cat-name"
          type="text"
          bind:value={name}
          placeholder={t('modal.categoryPlaceholder')}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
          autofocus
        />
      </div>

      <div>
        <label for="cat-icon" class="block text-sm font-medium mb-2 text-text dark:text-text-dark">{t('modal.icon')}</label>
        <div class="flex flex-wrap gap-2">
          {#each emojiOptions as emoji}
            <button
              type="button"
              onclick={() => (icon = emoji)}
              class="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer {icon === emoji ? 'bg-primary/10 ring-2 ring-primary scale-110' : 'bg-bg dark:bg-bg-dark hover:bg-border dark:hover:bg-border-dark'}"
            >
              {emoji}
            </button>
          {/each}
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={onclose}
          class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
        >
          {t('modal.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? t('modal.saving') : isEdit ? t('modal.update') : t('modal.add')}
        </button>
      </div>
    </form>
  </div>
</div>
