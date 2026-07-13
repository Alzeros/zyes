<script lang="ts">
  import type { Bookmark, Category } from '../lib/types';
  import { isValidUrl, parseIcon, parseCategoryIcon, getIconProxyUrl } from '../lib/utils';
  import { t } from '../lib/i18n';
  import IconView from './IconView.svelte';
  import IconPickerModal from './IconPickerModal.svelte';

  let {
    lang,
    categories,
    bookmark,
    defaultCategoryId = '',
    onclose,
    onsave,
  }: {
    lang: string;
    categories: Category[];
    bookmark?: Bookmark;
    defaultCategoryId?: string;
    onclose: () => void;
    onsave: (data: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  } = $props();

  let title = $state(bookmark?.title || '');
  let url = $state(bookmark?.url || '');
  // Preserve empty string (uncategorized) on edit; default to provided default (group)
  // or first category only when adding with no group context.
  let categoryId = $state(
    bookmark ? bookmark.categoryId : (defaultCategoryId || categories[0]?.id || '')
  );
  let description = $state(bookmark?.description || '');
  let icon = $state(bookmark?.icon || '');
  let openTarget = $state<'new' | 'self'>(bookmark?.openTarget === 'self' ? 'self' : 'new');
  // Per-card display mode. New cards default to compact; editing preserves the
  // existing value. Only committed on "update" (unlike the old right-click toggle
  // which flipped immediately).
  let displayMode = $state<'compact' | 'detail'>(bookmark?.displayMode === 'detail' ? 'detail' : 'compact');
  let saving = $state(false);
  let urlError = $state('');
  let pickerOpen = $state(false);

  const isEdit = !!bookmark;

  // Live preview of the chosen icon, falling back to the auto favicon from the URL field.
  let previewSource = $derived(parseIcon(icon.trim()));
  let previewTitle = $derived(title.trim() || url.trim() || 'zyes');

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    urlError = '';

    if (!title.trim()) return;
    if (!url.trim() || !isValidUrl(url.trim())) {
      urlError = t('modal.urlError');
      return;
    }

    saving = true;
    try {
      await onsave({
        categoryId,
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        icon: icon.trim() || null,
        openTarget,
        // Commit the edited display mode on update; new cards default compact.
        displayMode,
        sortOrder: bookmark?.sortOrder ?? 0,
      });
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
  <div class="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
    <h2 class="text-lg font-semibold mb-4 text-text dark:text-text-dark">
      {isEdit ? t('modal.editBookmark') : t('modal.addBookmark')}
    </h2>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="bm-title" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.title')}</label>
        <input
          id="bm-title"
          type="text"
          bind:value={title}
          placeholder={t('modal.titlePlaceholder')}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
          autofocus
        />
      </div>

      <div>
        <label for="bm-url" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.url')}</label>
        <input
          id="bm-url"
          type="url"
          bind:value={url}
          placeholder={t('modal.urlPlaceholder')}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
        />
        {#if urlError}
          <p class="mt-1 text-xs text-danger">{urlError}</p>
        {/if}
        {#if url && isValidUrl(url) && previewSource.kind === 'none'}
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-text-secondary dark:text-text-secondary-dark">{t('modal.previewFavicon')}</span>
          </div>
        {/if}
      </div>

      <div>
        <label for="bm-icon" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.icon')}</label>
        <button
          type="button"
          onclick={() => (pickerOpen = true)}
          disabled={!url.trim() && !icon.trim()}
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/40 cursor-pointer"
        >
          <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shrink-0 overflow-hidden">
            <IconView source={previewSource} proxyUrl={getIconProxyUrl(url.trim())} fallbackUrls={[]} fallbackUrl="" title={previewTitle} size="md" fill />
          </div>
          <span class="flex-1 min-w-0 text-sm text-text-secondary dark:text-text-secondary-dark truncate">
            {#if icon.trim()}
              {icon.trim()}
            {:else}
              {t('modal.iconPickerCta')}
            {/if}
          </span>
          <svg class="w-4 h-4 text-text-secondary dark:text-text-secondary-dark shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <div>
        <label for="bm-category" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.category')}</label>
        <select
          id="bm-category"
          bind:value={categoryId}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
        >
          <option value="">{t('modal.uncategorized')}</option>
          {#each categories as cat}
            <option value={cat.id}>{parseCategoryIcon(cat.icon).kind === 'emoji' ? `${parseCategoryIcon(cat.icon).char} ` : ''}{cat.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <span class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.openTarget')}</span>
        <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark">
          <button
            type="button"
            onclick={() => (openTarget = 'new')}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer {openTarget === 'new' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
          >
            {t('modal.openNew')}
          </button>
          <button
            type="button"
            onclick={() => (openTarget = 'self')}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer {openTarget === 'self' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
          >
            {t('modal.openSelf')}
          </button>
        </div>
      </div>

      <div>
        <span class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.displayMode')}</span>
        <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark">
          <button
            type="button"
            onclick={() => (displayMode = 'compact')}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer {displayMode === 'compact' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
          >
            {t('grid.viewCompact')}
          </button>
          <button
            type="button"
            onclick={() => (displayMode = 'detail')}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer {displayMode === 'detail' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
          >
            {t('grid.viewDetail')}
          </button>
        </div>
      </div>

      <div>
        <label for="bm-desc" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.description')}</label>
        <textarea
          id="bm-desc"
          bind:value={description}
          placeholder={t('modal.descPlaceholder')}
          rows="2"
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm resize-none"
        ></textarea>
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
          disabled={saving || !title.trim()}
          class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? t('modal.saving') : isEdit ? t('modal.update') : t('modal.add')}
        </button>
      </div>
    </form>
  </div>
</div>

{#if pickerOpen}
  <IconPickerModal
    {lang}
    url={url.trim()}
    currentIcon={icon}
    title={title.trim()}
    onclose={() => (pickerOpen = false)}
    onsave={(picked) => { icon = picked; pickerOpen = false; }}
  />
{/if}
