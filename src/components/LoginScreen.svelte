<script lang="ts">
  import { api } from '../lib/api';
  import { t, toggleLang } from '../lib/i18n';

  let { lang, onlogin }: { lang: string; onlogin: (event: CustomEvent<string>) => void } = $props();

  let password = $state('');
  let error = $state('');
  let submitting = $state(false);

  function switchLang() {
    toggleLang();
    location.reload();
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    error = '';
    submitting = true;
    try {
      const res = await api.post<{ token: string; expiresIn: string }>('/api/auth/login', {
        password,
      });
      onlogin(new CustomEvent('login', { detail: res.token }));
    } catch (err: any) {
      error = err.message || t('login.failed');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-bg dark:bg-bg-dark p-4 relative">
  <!-- Language toggle -->
  <button
    onclick={switchLang}
    class="absolute top-4 right-4 px-2 py-1.5 rounded-lg hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors cursor-pointer text-xs font-semibold text-text-secondary dark:text-text-secondary-dark w-9 text-center"
    aria-label="Switch language"
  >
    {lang === 'zh' ? 'EN' : '中'}
  </button>

  <div class="w-full max-w-sm">
    <div class="flex flex-col items-center justify-center mb-8">
      <div class="flex items-center gap-1 mb-2">
        <span class="zyes-mark inline-grid place-items-center" style="width:28px;height:36px">
          <svg width="28" height="36" viewBox="6 5 17 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <!-- Light mode: dark slate Z -->
            <g class="zyes-light">
              <path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
              <path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="1" stroke-linejoin="miter" stroke-linecap="square" transform="translate(-2.5,-2.5)" opacity="0.2" />
            </g>
            <!-- Dark mode: white Z -->
            <g class="zyes-dark">
              <path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" />
              <path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="1" stroke-linejoin="miter" stroke-linecap="square" transform="translate(-2.5,-2.5)" opacity="0.3" />
            </g>
          </svg>
        </span>
        <span class="zyes-word text-4xl font-bold tracking-tight">yes</span>
      </div>
      <p class="text-text-secondary dark:text-text-secondary-dark text-sm">{t('login.subtitle')}</p>
    </div>

    <form onsubmit={handleSubmit} class="bg-surface dark:bg-surface-dark rounded-2xl p-6 border border-border dark:border-border-dark">
      <label for="password" class="block text-sm font-medium mb-2 text-text dark:text-text-dark">{t('login.password')}</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        placeholder={t('login.placeholder')}
        class="w-full px-4 py-3 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        autofocus
      />

      {#if error}
        <p class="mt-3 text-sm text-danger">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting || !password.trim()}
        class="w-full mt-4 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? t('login.logging') : t('login.submit')}
      </button>
    </form>
  </div>
</div>
