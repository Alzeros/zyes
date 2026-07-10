<script lang="ts">
  import { isAuthenticated, getToken, setToken, removeToken } from './lib/auth';
  import { api } from './lib/api';
  import { getLang, toggleLang } from './lib/i18n';
  import type { Bookmark, Category, SearchEngine } from './lib/types';
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
  let didInitialFetch = $state(false);

  let filteredBookmarks = $derived(
    activeCategoryId === 'all'
      ? bookmarks
      : bookmarks.filter((b) => b.categoryId === activeCategoryId)
  );

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
      const [cats, bms, engines] = await Promise.all([
        api.get<Category[]>('/api/categories'),
        api.get<Bookmark[]>('/api/bookmarks'),
        api.get<SearchEngine[]>('/api/search/engines'),
      ]);
      categories = cats;
      bookmarks = bms;
      searchEngines = engines;
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

  async function handleCategoryAdd(cat: { name: string; icon: string }) {
    const newCat = await api.post<Category>('/api/categories', cat);
    categories = [...categories, newCat];
  }

  async function handleCategoryUpdate(id: string, patch: Partial<Category>) {
    const updated = await api.put<Category>(`/api/categories/${id}`, patch);
    categories = categories.map((c) => (c.id === id ? updated : c));
  }

  async function handleCategoryDelete(id: string) {
    await api.delete(`/api/categories/${id}?strategy=move`);
    categories = categories.filter((c) => c.id !== id);
    // Move bookmarks from deleted category to uncategorized
    bookmarks = bookmarks.map((b) => (b.categoryId === id ? { ...b, categoryId: '' } : b));
    if (activeCategoryId === id) activeCategoryId = 'all';
  }

  function handleSwitchLang() {
    lang = toggleLang();
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
      onlogout={handleLogout}
      ontoggleLang={handleSwitchLang}
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
            onadd={handleBookmarkAdd}
            onupdate={handleBookmarkUpdate}
            ondelete={handleBookmarkDelete}
          />
        {/if}
      </main>
    </div>
  </div>
{/if}
