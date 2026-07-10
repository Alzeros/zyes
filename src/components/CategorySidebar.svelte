<script lang="ts">
  import type { Category } from '../lib/types';
  import CategoryModal from './CategoryModal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { t } from '../lib/i18n';

  let {
    lang,
    categories,
    counts,
    activeCategoryId,
    onselect,
    onadd,
    onupdate,
    ondelete,
  }: {
    lang: string;
    categories: Category[];
    counts: Record<string, number>;
    activeCategoryId: string;
    onselect: (e: CustomEvent<string>) => void;
    onadd: (cat: { name: string; icon: string }) => Promise<void>;
    onupdate: (id: string, patch: Partial<Category>) => Promise<void>;
    ondelete: (id: string) => Promise<void>;
  } = $props();

  let showAddModal = $state(false);
  let editingCategory = $state<Category | null>(null);
  let deletingCategory = $state<Category | null>(null);

  function selectCategory(id: string) {
    onselect(new CustomEvent('select', { detail: id }));
  }
</script>

<!-- Desktop sidebar: fixed 260px column -->
<aside class="hidden md:flex md:flex-col w-[260px] shrink-0 border-r border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-y-auto">
  <nav class="flex-1 p-4 space-y-1">
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

    {#each categories as cat (cat.id)}
      <div class="group relative">
        <button
          onclick={() => selectCategory(cat.id)}
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer {activeCategoryId === cat.id ? 'bg-primary/10 text-primary' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark'}"
        >
          <span class="text-base shrink-0">{cat.icon || '📁'}</span>
          <span class="flex-1 text-left truncate">{cat.name}</span>
          <span class="text-xs opacity-60">{counts[cat.id] || 0}</span>
        </button>
        <div class="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
          <button
            onclick={(e) => { e.stopPropagation(); editingCategory = cat; }}
            class="p-1 rounded-md hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors cursor-pointer"
            aria-label="Edit"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onclick={(e) => { e.stopPropagation(); deletingCategory = cat; }}
            class="p-1 rounded-md hover:bg-danger/10 text-danger transition-colors cursor-pointer"
            aria-label="Delete"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    {/each}
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
  <div class="flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide">
    <button
      onclick={() => selectCategory('all')}
      class="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap {activeCategoryId === 'all' ? 'bg-primary text-white' : 'bg-bg dark:bg-bg-dark text-text-secondary dark:text-text-secondary-dark'}"
    >
      {t('sidebar.all')}
      <span class="ml-1 opacity-70">{counts.all || 0}</span>
    </button>
    {#each categories as cat (cat.id)}
      <button
        onclick={() => selectCategory(cat.id)}
        class="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap {activeCategoryId === cat.id ? 'bg-primary text-white' : 'bg-bg dark:bg-bg-dark text-text-secondary dark:text-text-secondary-dark'}"
      >
        {cat.icon || '📁'} {cat.name}
        <span class="ml-1 opacity-70">{counts[cat.id] || 0}</span>
      </button>
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
