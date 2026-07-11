<script lang="ts">
  import type { Bookmark, Category } from '../lib/types';
  import BookmarkGroup from './BookmarkGroup.svelte';
  import { t } from '../lib/i18n';

  let {
    lang,
    bookmarks,
    categories,
    activeCategoryId,
    displayMode,
    canToggleDisplayMode,
    onadd,
    onupdate,
    ondelete,
    onsetDisplayMode,
    onreorder,
  }: {
    lang: string;
    bookmarks: Bookmark[];
    categories: Category[];
    activeCategoryId: string;
    displayMode: 'compact' | 'detail';
    canToggleDisplayMode: boolean;
    onadd: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onupdate: (id: string, patch: Partial<Bookmark>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
    onsetDisplayMode: (mode: 'compact' | 'detail') => void;
    onreorder: (items: { id: string; sortOrder: number }[]) => Promise<void>;
  } = $props();

  // The "All" view renders a group per category plus a trailing "Uncategorized" group.
  // A single selected category renders just one group.
  let isAll = $derived(activeCategoryId === 'all');

  // Groups for the "All" view: each known category (in its sortOrder), then uncategorized.
  let groups = $derived<{ title: string; categoryId: string; items: Bookmark[]; collapsible: boolean }[]>(
    isAll
      ? [
          ...[...categories]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => ({
              title: `${c.icon || '📁'} ${c.name}`,
              categoryId: c.id,
              items: bookmarks.filter((b) => b.categoryId === c.id),
              collapsible: false,
            })),
          {
            title: t('grid.uncategorized'),
            categoryId: '',
            items: bookmarks.filter((b) => b.categoryId === ''),
            collapsible: true, // hidden when empty
          },
        ]
      : [
          {
            title: (() => {
              const c = categories.find((x) => x.id === activeCategoryId);
              return c ? `${c.icon || '📁'} ${c.name}` : t('grid.uncategorized');
            })(),
            categoryId: activeCategoryId,
            items: bookmarks, // App already filtered for a single category
            collapsible: false,
          },
        ]
  );
</script>

<!-- Per-category view switcher (compact / detail) -->
{#if canToggleDisplayMode}
  <div class="flex items-center justify-end mb-4">
    <div class="inline-flex items-center gap-1 p-1 rounded-full bg-bg dark:bg-bg-dark border border-border dark:border-border-dark">
      <button
        onclick={() => onsetDisplayMode('compact')}
        class="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer {displayMode === 'compact' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
        title={t('grid.viewCompact')}
      >
        {t('grid.viewCompact')}
      </button>
      <button
        onclick={() => onsetDisplayMode('detail')}
        class="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer {displayMode === 'detail' ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
        title={t('grid.viewDetail')}
      >
        {t('grid.viewDetail')}
      </button>
    </div>
  </div>
{/if}

{#if bookmarks.length === 0 && !isAll}
  <div class="text-center py-16">
    <svg class="w-16 h-16 mx-auto text-border dark:text-border-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
    <p class="text-text-secondary dark:text-text-secondary-dark text-sm">{t('grid.empty')}</p>
  </div>
{:else}
  {#each groups as g (g.categoryId || '__uncat__')}
    <BookmarkGroup
      {lang}
      bookmarks={g.items}
      {categories}
      {displayMode}
      title={g.title}
      addCategoryId={g.categoryId}
      collapsible={g.collapsible}
      {onadd}
      {onupdate}
      {ondelete}
      {onreorder}
    />
  {/each}
{/if}
