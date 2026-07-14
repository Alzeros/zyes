<script lang="ts">
  import { isAuthenticated, getToken, setToken, removeToken } from './lib/auth';
  import { revokeAll } from './lib/iconCache.svelte';
  import { api } from './lib/api';
  import { getLang, toggleLang } from './lib/i18n';
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
  let viewSettings = $state<ViewSettings>({ allViewMode: 'detail', cardSize: 'md', siteName: 'zyes', siteLogo: '' });
  let didInitialFetch = $state(false);

  // Keep the browser tab title in sync with the persisted site name. Falls back
  // to 'zyes' whenever the settings value is blank. (The Node backend doesn't
  // persist siteName, so GET /api/settings/view can return it missing/undefined;
  // guard against that rather than crashing the whole app.)
  $effect(() => {
    const name = viewSettings?.siteName;
    document.title = (typeof name === 'string' ? name.trim() : '') || 'zyes';
  });

  // Card edit mode: an explicit toggle next to the compact/detail switch.
  // When ON, card drag-to-reorder is enabled on EVERY device (desktop included —
  // it used to be always-on on desktop and gated on touch). Drag is now local-only
  // until the user clicks Apply: each group's finalised order is staged in
  // `pendingReorders` and reconciled to the server in one batch on Apply.
  // Exiting edit mode without Apply DISCARDS local reorder changes (the saved
  // server order is restored by re-fetching).
  let cardEditMode = $state(false);
  // groupId → final card id order reported by that group during edit mode.
  // 'all' view: one entry per category group + the 'uncategorized' (key '').
  let pendingReorders = $state<Map<string, string[]>>(new Map());
  let hasPendingChanges = $derived(pendingReorders.size > 0);

  function enterCardEdit() {
    cardEditMode = true;
    pendingReorders = new Map();
  }
  function exitCardEdit() {
    // Discard: drop staged reorders, leave edit mode, and refetch so each
    // group's local dnd `items` is reset back to the saved server order. The
    // refetch is the authoritative "undo" — it also rebuilds cross-group
    // membership cleanly (cross-group drags share a dnd type, so local-only
    // state is the messiest part to roll back by hand).
    cardEditMode = false;
    pendingReorders = new Map();
    if (authenticated) void fetchData();
  }
  async function applyCardEdits() {
    // Reconcile every changed group in one pass. Each entry pins a card to
    // (groupId, index); cross-group drags are covered because both the source
    // and target groups report their final order.
    for (const [groupId, ids] of pendingReorders) {
      const reassign = ids.map((id, i) => ({ id, categoryId: groupId, sortOrder: i }));
      try {
        await api.put('/api/bookmarks/reassign', { items: reassign });
      } catch (err) {
        console.error('Reassign failed for group', groupId, err);
      }
      // Apply locally so the order/ownership sticks without a refetch.
      const patchById = new Map(reassign.map((r) => [r.id, r]));
      bookmarks = bookmarks.map((b) => {
        const p = patchById.get(b.id);
        return p ? { ...b, categoryId: p.categoryId, sortOrder: p.sortOrder } : b;
      });
    }
    cardEditMode = false;
    pendingReorders = new Map();
  }
  // Stage a group's finalised order (called by BookmarkGroup's onreconcile
  // while in edit mode). Outside edit mode this isn't wired up — drag is off.
  function stageReorder(groupId: string, ids: string[]) {
    if (!cardEditMode) return;
    const next = new Map(pendingReorders);
    next.set(groupId, ids);
    pendingReorders = next;
  }

  let filteredBookmarks = $derived(
    activeCategoryId === 'all'
      ? bookmarks
      : bookmarks.filter((b) => b.categoryId === activeCategoryId)
  );

  // The currently-selected category object (null for "all").
  let activeCategory = $derived(
    activeCategoryId === 'all'
      ? null
      : categories.find((c) => c.id === activeCategoryId) ?? null
  );
  let cardSize = $derived(viewSettings.cardSize);
  let siteName = $derived(viewSettings.siteName);
  let siteLogo = $derived(viewSettings.siteLogo);

  // Per-card display mode (compact/detail) is set via each bookmark's
  // right-click menu — handled by handleBookmarkUpdate (PUT /api/bookmarks/:id).
  // There is no global/per-category view-mode switch anymore.

  // Unified "apply" from the settings panel: a single save of all edited fields.
  // cardSize/siteName go through one PUT so only one network round-trip happens
  // even when both changed. Empty/unchanged fields are omitted from the PUT body.
  // (Card drag is no longer a setting — it's the edit-mode toggle on the grid.)
  interface SettingsPatch {
    cardSize?: ViewSettings['cardSize'];
    siteName?: string;
    siteLogo?: string;
  }
  async function handleSaveSettings(patch: SettingsPatch): Promise<boolean> {
    try {
      const apiBody: Record<string, string> = {};
      if (patch.cardSize !== undefined && patch.cardSize !== viewSettings.cardSize) apiBody.cardSize = patch.cardSize;
      if (patch.siteName !== undefined && patch.siteName !== viewSettings.siteName) apiBody.siteName = patch.siteName.slice(0, 64).trim();
      if (patch.siteLogo !== undefined && patch.siteLogo !== viewSettings.siteLogo) apiBody.siteLogo = patch.siteLogo.slice(0, 256).trim();
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
    revokeAll();
    removeToken();
    authenticated = false;
    categories = [];
    bookmarks = [];
    searchEngines = [];
    activeCategoryId = 'all';
    viewSettings = { allViewMode: 'detail', cardSize: 'md', siteName: 'zyes', siteLogo: '' };
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

  // Bookmarks reconciliation is now staged during card edit mode (see
  // stageReorder/applyCardEdits). Outside edit mode drag is off, so there's no
  // per-drag reconcile handler anymore.

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

  // ── Data export / import ────────────────────────────────────────────────
  // Export: fetch the snapshot with the auth header (can't use api.get — it
  // parses JSON; we need the raw blob to trigger a download + read the
  // Content-Disposition filename). Build an object URL + synthetic <a> click.
  async function handleExport(): Promise<void> {
    const token = getToken();
    const res = await fetch('/api/data/export', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    // Prefer the server's filename (zyes-export-YYYY-MM-DD.json), fall back.
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `zyes-export.json`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Import: POST the parsed JSON. REPLACE strategy on the backend (existing
  // data wiped, a backup stashed). On success, refetch everything so the UI
  // reflects the imported state. The UI confirms twice before calling this.
  async function handleImport(file: File): Promise<void> {
    const text = await file.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('文件不是有效的 JSON');
    }
    const result = await api.post<{ settings: ViewSettings }>('/api/data/import', payload);
    // Refresh all data from the server so categories/bookmarks/settings match
    // the freshly-imported state (local state is fully replaced server-side).
    await fetchData();
    // result.settings is the imported settings; fetchData already pulled the
    // canonical version, but apply immediately for snappy feedback.
    viewSettings = { ...viewSettings, ...result.settings };
  }

  // Export HTML (NETSCAPE bookmarks): same auth-header fetch + download as JSON,
  // just a different endpoint + content type.
  async function handleExportHtml(): Promise<void> {
    const token = getToken();
    const res = await fetch('/api/data/export-html', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export HTML failed: ${res.status}`);
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `zyes-bookmarks.html`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Import HTML (NETSCAPE bookmarks). mode = 'replace' (wipe+overwrite) or
  // 'merge' (append). The caller already confirmed; we just POST the raw HTML
  // text + mode and refresh on success.
  async function handleImportHtml(file: File, mode: 'replace' | 'merge'): Promise<void> {
    const html = await file.text();
    const result = await api.post<{ settings: ViewSettings }>('/api/data/import-html', { html, mode });
    await fetchData();
    viewSettings = { ...viewSettings, ...result.settings };
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
  <div class="h-screen flex flex-col bg-bg dark:bg-bg-dark">
    <Header
      {searchEngines}
      {lang}
      {cardSize}
      {siteName}
      {siteLogo}
      onlogout={handleLogout}
      ontoggleLang={handleSwitchLang}
      onsave={handleSaveSettings}
      onexport={handleExport}
      onimport={handleImport}
      onexportHtml={handleExportHtml}
      onimportHtml={handleImportHtml}
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
            {cardSize}
            editMode={cardEditMode}
            hasPendingChanges
            onenterEdit={enterCardEdit}
            onexitEdit={exitCardEdit}
            onapplyEdits={applyCardEdits}
            onadd={handleBookmarkAdd}
            onupdate={handleBookmarkUpdate}
            ondelete={handleBookmarkDelete}
            onreconcile={stageReorder}
          />
        {/if}
      </main>
    </div>
  </div>
{/if}
