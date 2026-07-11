<script lang="ts">
  import type { Bookmark, Category } from '../lib/types';
  import BookmarkCard from './BookmarkCard.svelte';
  import BookmarkModal from './BookmarkModal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ContextMenu, { type ContextMenuItem } from './ContextMenu.svelte';
  import { t } from '../lib/i18n';
  import { dndzone } from 'svelte-dnd-action';

  let {
    lang,
    bookmarks,
    categories,
    displayMode,
    title,
    addCategoryId,        // categoryId to default the add-modal to ('' for uncategorized)
    collapsible = false,  // "Uncategorized" group is hidden entirely when empty
    onadd,
    onupdate,
    ondelete,
    onreorder,
  }: {
    lang: string;
    bookmarks: Bookmark[];
    categories: Category[];
    displayMode: 'compact' | 'detail';
    title: string;
    addCategoryId: string;        // '' for uncategorized
    collapsible?: boolean;
    onadd: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onupdate: (id: string, patch: Partial<Bookmark>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
    onreorder: (items: { id: string; sortOrder: number }[]) => Promise<void>;
  } = $props();

  let showAddModal = $state(false);
  let editingBookmark = $state<Bookmark | null>(null);
  let deletingBookmark = $state<Bookmark | null>(null);
  let contextMenu = $state<{ bookmark: Bookmark; x: number; y: number } | null>(null);

  let cols = $derived(
    displayMode === 'compact'
      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  );

  const contextItems: ContextMenuItem[] = [
    { type: 'item', key: 'open', label: t('grid.open') },
    { type: 'separator' },
    { type: 'item', key: 'edit', label: t('grid.edit') },
    { type: 'item', key: 'delete', label: t('grid.delete'), danger: true },
  ];

  // Hide the collapsible (uncategorized) group when it has no cards.
  let visible = $derived(!collapsible || bookmarks.length > 0);

  // Local mutable copy for in-group drag-reorder (drag is scoped to one group).
  let items = $state<Bookmark[]>(bookmarks);
  // morphDisabled keeps the dragged card at its native size (no stretch box);
  // dropTargetClasses highlight the hovered drop slot with the dashed outline.
  let dndConfig = $derived({
    items,
    flipDurationMs: 150,
    morphDisabled: true,
    dropTargetClasses: ['cat-dnd-target'],
  });
  $effect(() => {
    void bookmarks;
    void displayMode;
    items = [...bookmarks];
  });

  function handleContextMenu(e: MouseEvent, bookmark: Bookmark) {
    e.preventDefault();
    contextMenu = { bookmark, x: e.clientX, y: e.clientY };
  }

  function handleContextSelect(key: string) {
    const target = contextMenu?.bookmark;
    contextMenu = null;
    if (!target) return;
    if (key === 'open') window.open(target.url, '_blank');
    else if (key === 'edit') editingBookmark = target;
    else if (key === 'delete') deletingBookmark = target;
  }

  function handleDndConsider(e: CustomEvent<{ items: Bookmark[] }>) {
    items = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<{ items: Bookmark[] }>) {
    items = e.detail.items;
    const reorder = items.map((b, i) => ({ id: b.id, sortOrder: i }));
    try {
      await onreorder(reorder);
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  }
</script>

{#if visible}
  <div class="mb-8 last:mb-0">
    <h2 class="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-3">
      {title}
    </h2>

    {#key displayMode}
      <div
        use:dndzone={dndConfig}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}
        class="cat-dnd-host grid {cols} gap-4"
      >
        {#each items as bookmark (bookmark.id)}
          <BookmarkCard
            {bookmark}
            {lang}
            {displayMode}
            onedit={() => (editingBookmark = bookmark)}
            ondelete={() => (deletingBookmark = bookmark)}
            oncontext={(e) => handleContextMenu(e, bookmark)}
          />
        {/each}

        <button
          onclick={() => (showAddModal = true)}
          class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer {displayMode === 'compact' ? 'aspect-square p-2' : 'min-h-[140px] gap-2'}"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="text-sm font-medium {displayMode === 'compact' ? 'line-clamp-2 break-all' : ''}">{t('grid.addCard')}</span>
        </button>
      </div>
    {/key}
  </div>
{/if}

{#if showAddModal}
  <BookmarkModal
    {lang}
    {categories}
    defaultCategoryId={addCategoryId}
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

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextItems}
    onselect={handleContextSelect}
    onclose={() => (contextMenu = null)}
  />
{/if}
