<script lang="ts">
  import type { Bookmark, Category } from '../lib/types';
  import { isValidUrl, getFaviconUrl, parseIcon, parseCategoryIcon } from '../lib/utils';
  import { t } from '../lib/i18n';
  import IconView from './IconView.svelte';

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
  let saving = $state(false);
  let urlError = $state('');

  const isEdit = !!bookmark;

  // Live preview of the chosen icon, falling back to the auto favicon from the URL field.
  let previewSource = $derived(parseIcon(icon.trim()));
  let previewFallback = $derived(
    url.trim() && isValidUrl(url.trim()) ? getFaviconUrl(url.trim()) : ''
  );
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
            <img src={getFaviconUrl(url)} alt="" class="w-4 h-4 rounded" onerror={(e) => (e.currentTarget.style.display = 'none')} />
            <span class="text-xs text-text-secondary dark:text-text-secondary-dark">{t('modal.previewFavicon')}</span>
          </div>
        {/if}
      </div>

      <div>
        <label for="bm-icon" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.icon')}</label>
        <div class="flex items-stretch gap-3">
          <div class="flex items-center justify-center rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark w-14 h-14 shrink-0 overflow-hidden">
            <IconView source={previewSource} fallbackUrl={previewFallback} title={previewTitle} size="sm" />
          </div>
          <div class="flex-1 min-w-0">
            <input
              id="bm-icon"
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
