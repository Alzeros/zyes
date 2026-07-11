<script lang="ts">
  import type { Category } from '../lib/types';
  import CategoryModal from './CategoryModal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ContextMenu, { type ContextMenuItem } from './ContextMenu.svelte';
  import CategoryIcon from './CategoryIcon.svelte';
  import { t } from '../lib/i18n';
  import { dndzone } from 'svelte-dnd-action';

  let {
    lang,
    categories,
    counts,
    activeCategoryId,
    onselect,
    onadd,
    onupdate,
    ondelete,
    onreorder,
  }: {
    lang: string;
    categories: Category[];
    counts: Record<string, number>;
    activeCategoryId: string;
    onselect: (e: CustomEvent<string>) => void;
    onadd: (cat: { name: string; icon: string }) => Promise<void>;
    onupdate: (id: string, patch: Partial<Category>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
    onreorder: (items: { id: string; sortOrder: number }[]) => Promise<void>;
  } = $props();

  let showAddModal = $state(false);
  let editingCategory = $state<Category | null>(null);
  let deletingCategory = $state<Category | null>(null);
  let contextMenu = $state<{ category: Category; x: number; y: number } | null>(null);

  const contextItems: ContextMenuItem[] = [
    { type: 'item', key: 'edit', label: t('sidebar.edit') },
    { type: 'item', key: 'delete', label: t('sidebar.delete'), danger: true },
  ];

  // Local mutable copy so dndzone can reorder categories without a server round-trip
  // on every drag tick. Resynced when the upstream `categories` prop changes.
  let items = $state<Category[]>(categories);
  // morphDisabled:true stops the dragged element from being stretched to the
  // dropzone's dimensions (which produced the odd floating box). dropTargetClasses
  // highlight the row the pointer is currently over so the drop site is obvious.
  // flipDurationMs keeps the reorder settle in sync with the CSS transition.
  let dndConfig = $derived({
    items,
    flipDurationMs: 150,
    morphDisabled: true,
    dropTargetClasses: ['cat-dnd-target'],
  });
  $effect(() => {
    void categories;
    items = [...categories];
  });

  function selectCategory(id: string) {
    onselect(new CustomEvent('select', { detail: id }));
  }

  function handleContextMenu(e: MouseEvent, cat: Category) {
    e.preventDefault();
    contextMenu = { category: cat, x: e.clientX, y: e.clientY };
  }

  function handleContextSelect(key: string) {
    const target = contextMenu?.category;
    contextMenu = null;
    if (!target) return;
    if (key === 'edit') editingCategory = target;
    else if (key === 'delete') deletingCategory = target;
  }

  // Stop the drag handle from also triggering the category click.
  function handleGripPointerDown(e: PointerEvent) {
    e.stopPropagation();
  }

  function handleDndConsider(e: CustomEvent<{ items: Category[] }>) {
    items = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<{ items: Category[] }>) {
    items = e.detail.items;
    const reorder = items.map((c, i) => ({ id: c.id, sortOrder: i }));
    try {
      await onreorder(reorder);
    } catch (err) {
      console.error('Category reorder failed:', err);
    }
  }
</script>

<!-- Desktop sidebar: fixed 260px column -->
<aside class="hidden md:flex md:flex-col w-[260px] shrink-0 border-r border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-y-auto">
  <nav class="cat-dnd-host flex-1 p-4 space-y-1">
    <button
      onclick={() => selectCategory('all')}
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer {activeCategoryId === 'all' ? 'bg-primary/10 text-primary' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark'}"
    >
      <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
      <span class="flex-1 text-left">{t('sidebar.all')}</span>
      <span class="text-xs opacity-60">{counts.all || 0}</span>
    </button>

    <div
      use:dndzone={dndConfig}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}
      class="space-y-1"
    >
      {#each items as cat (cat.id)}
        <div class="flex items-center gap-1 group/cat rounded-xl {activeCategoryId === cat.id ? 'bg-primary/10' : ''}">
          <button
            type="button"
            data-dnd-handle
            onpointerdown={handleGripPointerDown}
            aria-label={t('sidebar.dragCategory')}
            class="shrink-0 px-1 py-2.5 rounded-lg text-text-secondary/30 dark:text-text-secondary-dark/30 hover:text-text-secondary dark:hover:text-text-secondary-dark cursor-grab active:cursor-grabbing transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="5" cy="3" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="5" cy="13" r="1.3" />
              <circle cx="11" cy="3" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="11" cy="13" r="1.3" />
            </svg>
          </button>
          <button
            onclick={() => selectCategory(cat.id)}
            oncontextmenu={(e) => handleContextMenu(e, cat)}
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer {activeCategoryId === cat.id ? 'bg-primary/10 text-primary' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark'}"
          >
            <span class="shrink-0 flex items-center justify-center text-base text-current">
              <CategoryIcon icon={cat.icon} />
            </span>
            <span class="flex-1 text-left truncate">{cat.name}</span>
            <span class="text-xs opacity-60">{counts[cat.id] || 0}</span>
          </button>
        </div>
      {/each}
    </div>
  </nav>

  <div class="p-4 border-t border-border dark:border-border-dark">
    <button
      onclick={() => (showAddModal = true)}
      class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-all duration-200 cursor-pointer"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      {t('sidebar.addCategory')}
    </button>
  </div>
</aside>

<!-- Mobile category bar: horizontal scrolling tabs -->
<div class="md:hidden border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
  <div
    use:dndzone={dndConfig}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
    class="cat-dnd-host flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide"
  >
    <button
      onclick={() => selectCategory('all')}
      class="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap {activeCategoryId === 'all' ? 'bg-primary text-white' : 'bg-bg dark:bg-bg-dark text-text-secondary dark:text-text-secondary-dark'}"
    >
      {t('sidebar.all')}
      <span class="ml-1 opacity-70">{counts.all || 0}</span>
    </button>
    {#each items as cat (cat.id)}
      <div class="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          data-dnd-handle
          onpointerdown={handleGripPointerDown}
          aria-label={t('sidebar.dragCategory')}
          class="shrink-0 p-1.5 rounded-full text-text-secondary/40 dark:text-text-secondary-dark/40 active:cursor-grabbing cursor-grab transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="5" cy="3" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="5" cy="13" r="1.3" />
            <circle cx="11" cy="3" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="11" cy="13" r="1.3" />
          </svg>
        </button>
        <button
          onclick={() => selectCategory(cat.id)}
          oncontextmenu={(e) => handleContextMenu(e, cat)}
          class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap {activeCategoryId === cat.id ? 'bg-primary text-white' : 'bg-bg dark:bg-bg-dark text-text-secondary dark:text-text-secondary-dark'}"
        >
          <span class="inline-flex items-center text-base text-current"><CategoryIcon icon={cat.icon} /></span>
          {cat.name}
          <span class="ml-1 opacity-70">{counts[cat.id] || 0}</span>
        </button>
      </div>
    {/each}
    <button
      onclick={() => (showAddModal = true)}
      class="shrink-0 p-1.5 rounded-full text-primary hover:bg-primary/10 transition-all duration-200 cursor-pointer"
      aria-label={t('sidebar.addCategory')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
</div>

{#if showAddModal}
  <CategoryModal
    {lang}
    onclose={() => (showAddModal = false)}
    onsave={async (data) => {
      await onadd(data);
      showAddModal = false;
    }}
  />
{/if}

{#if editingCategory}
  <CategoryModal
    {lang}
    category={editingCategory}
    onclose={() => (editingCategory = null)}
    onsave={async (data) => {
      await onupdate(editingCategory!.id, data);
      editingCategory = null;
    }}
  />
{/if}

{#if deletingCategory}
  <ConfirmDialog
    {lang}
    title={t('confirm.deleteCategory')}
    message={t('confirm.deleteCategoryMsg', { name: deletingCategory.name })}
    onclose={() => (deletingCategory = null)}
    onconfirm={async () => {
      await ondelete(deletingCategory!.id);
      deletingCategory = null;
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
