<script lang="ts">
  import { isAuthenticated, getToken, setToken, removeToken } from './lib/auth';
  import { api } from './lib/api';
  import { getLang, toggleLang } from './lib/i18n';
  import { isTouchDevice } from './lib/utils';
  import type { Bookmark, Category, SearchEngine, ViewSettings } from './lib/types';
  import LoginScreen from './components/LoginScreen.svelte';
  import Header from './components/Header.svelte';
  import CategorySidebar from './components/CategorySidebar.svelte';
  import BookmarkGrid from './components/BookmarkGrid.svelte';

  let authenticated = $state(isAuthenticated());
  let loading = $state(false);
  let lang = $state(getLang());
  let categories = $state<Category[]>([]);
  let bookmarks = $state<Bookmark[]>([]);
  let searchEngines = $state<SearchEngine[]>([]);
  let activeCategoryId = $state<string>('all');
  let viewSettings = $state<ViewSettings>({ allViewMode: 'detail', cardSize: 'md', siteName: 'zyes' });
  let didInitialFetch = $state(false);

  // Keep the browser tab title in sync with the persisted site name. Falls back
  // to 'zyes' whenever the settings value is blank.
  $effect(() => {
    document.title = viewSettings.siteName.trim() || 'zyes';
  });

  // Drag-to-reorder is always available on desktop. On touch devices it is gated
  // by a local preference (zyes_enable_drag) because drag-on-touch is jittery
  // by default; the user opts in from the card settings panel.
  const DRAG_KEY = 'zyes_enable_drag';
  let enableDrag = $state<boolean>(localStorage.getItem(DRAG_KEY) === 'true');
  let canDrag = $derived(!isTouchDevice() || enableDrag);
  function handleSetEnableDrag(v: boolean) {
    enableDrag = v;
    localStorage.setItem(DRAG_KEY, String(v));
  }

  let filteredBookmarks = $derived(
    activeCategoryId === 'all'
      ? bookmarks
      : bookmarks.filter((b) => b.categoryId === activeCategoryId)
  );

  // The currently-selected category object (null for "all"), drives the view mode.
  let activeCategory = $derived(
    activeCategoryId === 'all'
      ? null
      : categories.find((c) => c.id === activeCategoryId) ?? null
  );
  let displayMode = $derived(activeCategory?.displayMode ?? viewSettings.allViewMode);
  let cardSize = $derived(viewSettings.cardSize);
  let siteName = $derived(viewSettings.siteName);
  // Now both real categories and the "All" view persist a view mode, so always toggleable.
  let canToggleDisplayMode = $derived(true);

  async function handleSetDisplayMode(mode: 'compact' | 'detail') {
    if (activeCategory) {
      if (activeCategory.displayMode === mode) return;
      try {
        const updated = await api.put<Category>(`/api/categories/${activeCategory.id}`, { displayMode: mode });
        categories = categories.map((c) => (c.id === activeCategory.id ? updated : c));
      } catch (err) {
        console.error('Failed to update view mode:', err);
      }
    } else {
      if (viewSettings.allViewMode === mode) return;
      try {
        const updated = await api.put<ViewSettings>('/api/settings/view', { allViewMode: mode });
        viewSettings = { ...viewSettings, ...updated };
      } catch (err) {
        console.error('Failed to update view mode:', err);
      }
    }
  }

  // Unified "apply" from the settings panel: a single save of all edited fields.
  // Drag is local-only (localStorage); cardSize/siteName go through one PUT so
  // only one network round-trip happens even when both changed. Empty/unchanged
  // fields are omitted from the PUT body.
  interface SettingsPatch {
    cardSize?: ViewSettings['cardSize'];
    enableDrag?: boolean;
    siteName?: string;
  }
  async function handleSaveSettings(patch: SettingsPatch): Promise<boolean> {
    try {
      if (patch.enableDrag !== undefined) handleSetEnableDrag(patch.enableDrag);
      const apiBody: Record<string, string> = {};
      if (patch.cardSize !== undefined && patch.cardSize !== viewSettings.cardSize) apiBody.cardSize = patch.cardSize;
      if (patch.siteName !== undefined && patch.siteName !== viewSettings.siteName) apiBody.siteName = patch.siteName.slice(0, 64).trim();
      if (Object.keys(apiBody).length > 0) {
        const updated = await api.put<ViewSettings>('/api/settings/view', apiBody);
        viewSettings = { ...viewSettings, ...updated };
      }
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      return false;
    }
  }

  let categoryCounts = $derived(() => {
    const counts: Record<string, number> = { all: bookmarks.length };
    for (const b of bookmarks) {
      counts[b.categoryId] = (counts[b.categoryId] || 0) + 1;
    }
    return counts;
  });

  async function fetchData() {
    loading = true;
    try {
      const [cats, bms, engines, settings] = await Promise.all([
        api.get<Category[]>('/api/categories'),
        api.get<Bookmark[]>('/api/bookmarks'),
        api.get<SearchEngine[]>('/api/search/engines'),
        api.get<ViewSettings>('/api/settings/view'),
      ]);
      categories = cats;
      bookmarks = bms;
      searchEngines = engines;
      viewSettings = settings;
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      loading = false;
    }
  }

  async function handleLogin(event: CustomEvent<string>) {
    setToken(event.detail);
    authenticated = true;
    await fetchData();
  }

  function handleLogout() {
    removeToken();
    authenticated = false;
    categories = [];
    bookmarks = [];
    searchEngines = [];
    activeCategoryId = 'all';
    viewSettings = { allViewMode: 'detail', cardSize: 'md', siteName: 'zyes' };
    didInitialFetch = false;
  }

  async function handleBookmarkAdd(bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) {
    const newBm = await api.post<Bookmark>('/api/bookmarks', bookmark);
    bookmarks = [...bookmarks, newBm];
  }

  async function handleBookmarkUpdate(id: string, patch: Partial<Bookmark>) {
    const updated = await api.put<Bookmark>(`/api/bookmarks/${id}`, patch);
    bookmarks = bookmarks.map((b) => (b.id === id ? updated : b));
  }

  async function handleBookmarkDelete(id: string) {
    await api.delete(`/api/bookmarks/${id}`);
    bookmarks = bookmarks.filter((b) => b.id !== id);
  }

  async function handleReconcile(groupId: string, ids: string[]) {
    // Pin every id in this group's final order to (groupId, index). Cards dragged
    // out of another group are absent here and handled by that group's own
    // reconcile firing (both sides share the 'bookmark' dnd type).
    const reassign = ids.map((id, i) => ({ id, categoryId: groupId, sortOrder: i }));
    try {
      await api.put('/api/bookmarks/reassign', { items: reassign });
    } catch (err) {
      console.error('Reassign failed:', err);
    }
    // Apply locally so the order/ownership sticks without a refetch.
    const patchById = new Map(reassign.map((r) => [r.id, r]));
    bookmarks = bookmarks.map((b) => {
      const p = patchById.get(b.id);
      return p ? { ...b, categoryId: p.categoryId, sortOrder: p.sortOrder } : b;
    });
  }

  async function handleCategoryAdd(cat: { name: string; icon: string }) {
    const newCat = await api.post<Category>('/api/categories', cat);
    categories = [...categories, newCat];
  }

  async function handleCategoryUpdate(id: string, patch: Partial<Category>) {
    const updated = await api.put<Category>(`/api/categories/${id}`, patch);
    categories = categories.map((c) => (c.id === id ? updated : c));
  }

  async function handleCategoryReorder(items: { id: string; sortOrder: number }[]) {
    await api.put('/api/categories/reorder', { items });
    // Apply new sortOrder locally so the sidebar and the "All" page section order
    // (which derives from categories.sortOrder) update immediately.
    const orderById = new Map(items.map((it) => [it.id, it.sortOrder]));
    categories = categories.map((c) =>
      orderById.has(c.id) ? { ...c, sortOrder: orderById.get(c.id)! } : c
    );
  }

  async function handleCategoryDelete(id: string) {
    await api.delete(`/api/categories/${id}?strategy=move`);
    categories = categories.filter((c) => c.id !== id);
    // Move bookmarks from deleted category to uncategorized
    bookmarks = bookmarks.map((b) => (b.categoryId === id ? { ...b, categoryId: '' } : b));
    if (activeCategoryId === id) activeCategoryId = 'all';
  }

  function handleSwitchLang() {
    toggleLang();
    location.reload();
  }

  // Auto-fetch when becoming authenticated (runs once per login session)
  $effect(() => {
    if (authenticated && !didInitialFetch) {
      didInitialFetch = true;
      fetchData();
    }
  });
</script>

{#if !authenticated}
  <LoginScreen {lang} onlogin={handleLogin} />
{:else}
  <div class="min-h-screen flex flex-col bg-bg dark:bg-bg-dark">
    <Header
      {searchEngines}
      {lang}
      {cardSize}
      {siteName}
      enableDrag={enableDrag}
      onlogout={handleLogout}
      ontoggleLang={handleSwitchLang}
      onsave={handleSaveSettings}
    />
    <div class="flex flex-1 flex-col md:flex-row overflow-hidden">
      <CategorySidebar
        {lang}
        {categories}
        counts={categoryCounts()}
        {activeCategoryId}
        onselect={(e) => (activeCategoryId = e.detail)}
        onadd={handleCategoryAdd}
        onupdate={handleCategoryUpdate}
        ondelete={handleCategoryDelete}
        onreorder={handleCategoryReorder}
      />
      <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {#if loading}
          <div class="flex items-center justify-center h-64">
            <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        {:else}
          <BookmarkGrid
            {lang}
            bookmarks={filteredBookmarks}
            {categories}
            {activeCategoryId}
            {displayMode}
            {cardSize}
            {canDrag}
            {canToggleDisplayMode}
            onadd={handleBookmarkAdd}
            onupdate={handleBookmarkUpdate}
            ondelete={handleBookmarkDelete}
            onsetDisplayMode={handleSetDisplayMode}
            onreconcile={handleReconcile}
          />
        {/if}
      </main>
    </div>
  </div>
{/if}
