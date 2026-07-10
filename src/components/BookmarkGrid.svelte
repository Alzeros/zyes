<script lang="ts">
  import type { Bookmark, Category } from '../lib/types';
  import BookmarkCard from './BookmarkCard.svelte';
  import BookmarkModal from './BookmarkModal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { t } from '../lib/i18n';

  let {
    lang,
    bookmarks,
    categories,
    onadd,
    onupdate,
    ondelete,
  }: {
    lang: string;
    bookmarks: Bookmark[];
    categories: Category[];
    onadd: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onupdate: (id: string, patch: Partial<Bookmark>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
  } = $props();

  let showAddModal = $state(false);
  let editingBookmark = $state<Bookmark | null>(null);
  let deletingBookmark = $state<Bookmark | null>(null);
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {#each bookmarks as bookmark (bookmark.id)}
    <BookmarkCard
      {bookmark}
      {lang}
      onedit={() => (editingBookmark = bookmark)}
      ondelete={() => (deletingBookmark = bookmark)}
    />
  {/each}

  <button
    onclick={() => (showAddModal = true)}
    class="flex flex-col items-center justify-center gap-2 min-h-[140px] rounded-xl border-2 border-dashed border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
  >
    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    <span class="text-sm font-medium">{t('grid.add')}</span>
  </button>
</div>

{#if bookmarks.length === 0}
  <div class="text-center py-16">
    <svg class="w-16 h-16 mx-auto text-border dark:text-border-dark mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
    <p class="text-text-secondary dark:text-text-secondary-dark text-sm">{t('grid.empty')}</p>
  </div>
{/if}

{#if showAddModal}
  <BookmarkModal
    {lang}
    {categories}
    onclose={() => (showAddModal = false)}
    onsave={async (data) => {
      await onadd(data);
      showAddModal = false;
    }}
  />
{/if}

{#if editingBookmark}
  <BookmarkModal
    {lang}
    {categories}
    bookmark={editingBookmark}
    onclose={() => (editingBookmark = null)}
    onsave={async (data) => {
      await onupdate(editingBookmark!.id, data);
      editingBookmark = null;
    }}
  />
{/if}

{#if deletingBookmark}
  <ConfirmDialog
    {lang}
    title={t('confirm.deleteBookmark')}
    message={t('confirm.deleteBookmarkMsg', { name: deletingBookmark.title })}
    onclose={() => (deletingBookmark = null)}
    onconfirm={async () => {
      await ondelete(deletingBookmark!.id);
      deletingBookmark = null;
    }}
  />
{/if}
