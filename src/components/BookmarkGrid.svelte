<script lang="ts">
  import type { Bookmark, Category, CardSize } from '../lib/types';
  import BookmarkGroup from './BookmarkGroup.svelte';
  import { t } from '../lib/i18n';

  let {
    lang,
    bookmarks,
    categories,
    activeCategoryId,
    cardSize,
    editMode = false,
    hasPendingChanges = false,
    onenterEdit,
    onexitEdit,
    onapplyEdits,
    onadd,
    onupdate,
    ondelete,
    onreconcile,
  }: {
    lang: string;
    bookmarks: Bookmark[];
    categories: Category[];
    activeCategoryId: string;
    cardSize: CardSize;
    editMode?: boolean;
    hasPendingChanges?: boolean;
    onenterEdit: () => void;
    onexitEdit: () => void;
    onapplyEdits: () => Promise<void> | void;
    onadd: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onupdate: (id: string, patch: Partial<Bookmark>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
    onreconcile: (groupId: string, ids: string[]) => Promise<void> | void;
  } = $props();

  // The "All" view renders a group per category plus a trailing "Uncategorized" group.
  // A single selected category renders just one group.
  let isAll = $derived(activeCategoryId === 'all');

  // Groups for the "All" view: each known category (in its sortOrder), then uncategorized.
  // `icon` carries the raw category icon (emoji / iconify name / image URL); the header
  // renders it via CategoryIcon so iconify glyphs work, not just literal emojis.
  let groups = $derived<{ title: string; icon: string; categoryId: string; items: Bookmark[]; collapsible: boolean }[]>(
    isAll
      ? [
          ...[...categories]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => ({
              title: c.name,
              icon: c.icon,
              categoryId: c.id,
              items: bookmarks.filter((b) => b.categoryId === c.id),
              collapsible: false,
            })),
          {
            title: t('grid.uncategorized'),
            icon: 'openmoji:card-index-dividers',
            categoryId: '',
            items: bookmarks.filter((b) => b.categoryId === ''),
            collapsible: true, // hidden when empty
          },
        ]
      : [
          {
            title: (() => {
              const c = categories.find((x) => x.id === activeCategoryId);
              return c ? c.name : t('grid.uncategorized');
            })(),
            icon: (() => {
              const c = categories.find((x) => x.id === activeCategoryId);
              return c ? c.icon : 'openmoji:card-index-dividers';
            })(),
            categoryId: activeCategoryId,
            items: bookmarks, // App already filtered for a single category
            collapsible: false,
          },
        ]
  );
</script>

<!-- Toolbar: edit mode toggle. Per-card display mode (compact/detail) is set via
     each card's right-click menu — there is no global switch anymore. -->
<div class="flex items-center justify-end mb-4 gap-2">
  {#if editMode}
    <button
      type="button"
      onclick={() => onexitEdit()}
      class="px-3 py-1.5 rounded-full text-xs font-medium border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-all duration-200 cursor-pointer"
    >
      {t('grid.editCancel')}
    </button>
    <button
      type="button"
      onclick={() => onapplyEdits()}
      disabled={!hasPendingChanges}
      class="px-3 py-1.5 rounded-full text-xs font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {t('grid.editApply')}
    </button>
  {:else}
    <button
      type="button"
      onclick={() => onenterEdit()}
      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary transition-all duration-200 cursor-pointer"
      title={t('grid.editEnter')}
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      {t('grid.editEnter')}
    </button>
  {/if}
</div>

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
      {cardSize}
      canDrag={editMode}
      title={g.title}
      icon={g.icon}
      addCategoryId={g.categoryId}
      collapsible={g.collapsible}
      {onadd}
      {onupdate}
      {ondelete}
      {onreconcile}
    />
  {/each}
{/if}
