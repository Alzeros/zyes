<script lang="ts">
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';

  let { lang, onlogin }: { lang: string; onlogin: (event: CustomEvent<string>) => void } = $props();

  let password = $state('');
  let error = $state('');
  let submitting = $state(false);

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

<div class="min-h-screen flex items-center justify-center bg-bg dark:bg-bg-dark p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-primary mb-2">{t('login.title')}</h1>
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
