<script lang="ts">
  import { t } from '../lib/i18n';
  import { CARD_SIZE_LABELS } from '../lib/cardSize';
  import type { CardSize } from '../lib/types';

  let {
    lang,
    cardSize,
    siteName,
    onsave,
    onexport,
    onimport,
    onexportHtml,
    onimportHtml,
    onclose,
  }: {
    lang: string;
    cardSize: CardSize;
    siteName: string;
    onsave: (patch: { cardSize?: CardSize; siteName?: string }) => Promise<boolean>;
    onexport: () => Promise<void>;
    onimport: (file: File) => Promise<void>;
    onexportHtml: () => Promise<void>;
    onimportHtml: (file: File, mode: 'replace' | 'merge') => Promise<void>;
    onclose: () => void;
  } = $props();

  const SIZES: CardSize[] = ['xs', 'sm', 'md', 'lg'];

  // Active settings group: 'cards' | 'site' | 'data'
  let activeGroup = $state<'cards' | 'site' | 'data'>('cards');

  // ── Drafts: the panel edits local copies and only commits on "Apply". Until
  // then the backend / parent state is untouched, so previewing a size can't
  // trigger a network round-trip or hang the page.
  let draftCardSize = $state<CardSize>(cardSize);
  let draftSiteName = $state<string>(siteName);
  let saving = $state(false);

  // ── Data export / import state
  let exporting = $state(false);
  let importing = $state(false);
  let dataMsg = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
  let jsonFileInput = $state<HTMLInputElement | null>(null);
  let htmlFileInput = $state<HTMLInputElement | null>(null);

  // Re-seed drafts whenever the panel is (re)opened with fresh props.
  $effect(() => {
    draftCardSize = cardSize;
    draftSiteName = siteName;
  });

  // Has the user touched anything vs. the last persisted values?
  let dirty = $derived(
    draftCardSize !== cardSize ||
    draftSiteName !== siteName
  );

  async function apply() {
    if (!dirty || saving) return;
    saving = true;
    const ok = await onsave({
      cardSize: draftCardSize,
      siteName: draftSiteName,
    });
    saving = false;
    if (ok) onclose();
  }

  function cancel() {
    // Discard drafts by reseeding from the (unchanged) persisted props.
    draftCardSize = cardSize;
    draftSiteName = siteName;
    onclose();
  }

  // Export: JSON backup or HTML bookmarks. Both delegate to App (auth header +
  // download trigger). Surface any failure inline.
  async function handleExport(kind: 'json' | 'html') {
    if (exporting) return;
    exporting = true;
    dataMsg = null;
    try {
      if (kind === 'json') await onexport();
      else await onexportHtml();
    } catch (e) {
      dataMsg = { kind: 'err', text: String(e) };
    } finally {
      exporting = false;
    }
  }

  // JSON import: pick file → confirm overwrite → delegate. REPLACE only.
  function pickJsonImport() {
    dataMsg = null;
    jsonFileInput?.click();
  }
  async function onJsonChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!confirm(t('data.importConfirm'))) return;
    importing = true;
    dataMsg = null;
    try {
      await onimport(file);
      dataMsg = { kind: 'ok', text: t('data.importSuccess') };
    } catch (e) {
      dataMsg = { kind: 'err', text: `${t('data.importError')}: ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      importing = false;
    }
  }

  // HTML import (browser bookmarks): pick file → choose replace/merge →
  // confirm → delegate. replace needs the overwrite confirm; merge is
  // non-destructive (append) so we just proceed.
  function pickHtmlImport() {
    dataMsg = null;
    htmlFileInput?.click();
  }
  async function onHtmlChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    // Choose mode: native confirm returns a boolean, so we use a two-step
    // confirm — first asks if they want REPLACE (overwrite), if they decline
    // we offer MERGE. Declining both cancels.
    const replace = confirm(`${t('data.modeTitle')}\n\n1. ${t('data.modeReplace')}\n   ${t('data.modeReplaceDesc')}\n\n2. ${t('data.modeMerge')}\n   ${t('data.modeMergeDesc')}\n\n${t('data.modeReplace')}? (取消则询问追加)`);
    const mode: 'replace' | 'merge' | null = replace ? 'replace' : (confirm(`${t('data.modeMerge')}?\n${t('data.modeMergeDesc')}`) ? 'merge' : null);
    if (!mode) return;
    if (mode === 'replace' && !confirm(t('data.importConfirm'))) return;
    importing = true;
    dataMsg = null;
    try {
      await onimportHtml(file, mode);
      dataMsg = { kind: 'ok', text: t('data.importSuccess') };
    } catch (e) {
      dataMsg = { kind: 'err', text: `${t('data.importError')}: ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      importing = false;
    }
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function label(s: CardSize) {
    return CARD_SIZE_LABELS[s][lang === 'zh' ? 'zh' : 'en'];
  }

  const groups = [
    { id: 'cards' as const, label: t('cardSize.nav.cards'), icon: 'M4 5h16M4 12h16M4 19h7' },
    { id: 'site' as const, label: t('cardSize.nav.site'), icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18' },
    { id: 'data' as const, label: t('data.nav'), icon: 'M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-3M20 14a8 8 0 01-14 3' },
  ];
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={cancel} onkeydown={() => {}} role="button" tabindex="-1"></div>

  <div class="relative w-full max-w-2xl h-[80vh] max-h-[600px] bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark shadow-xl flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-border dark:border-border-dark shrink-0">
      <h2 class="text-base font-semibold text-text dark:text-text-dark">{t('cardSize.title')}</h2>
      <button
        type="button"
        onclick={cancel}
        class="p-1.5 rounded-lg hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer text-text-secondary dark:text-text-secondary-dark"
        aria-label="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex flex-1 min-h-0 flex-col sm:flex-row">
      <!-- Group nav -->
      <nav class="flex sm:flex-col gap-1 p-3 sm:w-44 sm:shrink-0 border-b sm:border-b-0 sm:border-r border-border dark:border-border-dark">
        {#each groups as g}
          <button
            type="button"
            onclick={() => (activeGroup = g.id)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer {activeGroup === g.id ? 'bg-primary/10 text-primary' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark'}"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={g.icon} />
            </svg>
            {g.label}
          </button>
        {/each}
      </nav>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5 min-h-0">
        {#if activeGroup === 'cards'}
          <!-- ── Card size ─────────────────────────────────────── -->
          <section class="mb-6">
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.sizeSection')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-3">{t('cardSize.hint')}</p>

            <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark w-full">
              {#each SIZES as s}
                <button
                  type="button"
                  onclick={() => (draftCardSize = s)}
                  class="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer {draftCardSize === s ? 'bg-primary text-white' : 'text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark'}"
                >
                  {label(s)}
                </button>
              {/each}
            </div>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-3 leading-relaxed">{t('cardSize.dragMovedHint')}</p>
          </section>
        {:else if activeGroup === 'site'}
          <!-- ── Site title ────────────────────────────────────── -->
          <section>
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.siteSection')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-4">{t('cardSize.siteHint')}</p>

            <label class="block">
              <span class="block text-xs font-medium mb-1.5 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.siteSection')}</span>
              <input
                type="text"
                value={draftSiteName}
                maxlength="64"
                placeholder={t('cardSize.siteNamePlaceholder')}
                oninput={(e) => (draftSiteName = e.currentTarget.value)}
                class="w-full px-3 py-2 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-sm text-text dark:text-text-dark placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </label>
          </section>
        {:else}
          <!-- ── Data: export / import ─────────────────────────── -->
          <section>
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('data.section')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-4">{t('data.exportHint')}</p>

            <!-- Export -->
            <div class="rounded-xl border border-border dark:border-border-dark p-4 mb-3">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-text dark:text-text-dark">{t('data.export')}</p>
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">{t('data.exportHint')}</p>
                </div>
                <button
                  type="button"
                  onclick={() => handleExport('json')}
                  disabled={exporting}
                  class="shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {#if exporting}<span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>{/if}
                  {t('data.export')}
                </button>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-text dark:text-text-dark">{t('data.exportHtml')}</p>
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">{t('data.exportHtmlHint')}</p>
                </div>
                <button
                  type="button"
                  onclick={() => handleExport('html')}
                  disabled={exporting}
                  class="shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('data.exportHtml')}
                </button>
              </div>
            </div>

            <!-- Import -->
            <div class="rounded-xl border border-border dark:border-border-dark p-4">
              <p class="text-sm font-medium text-text dark:text-text-dark mb-3">{t('data.import')}</p>

              <!-- JSON backup import (replace only) -->
              <div class="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border dark:border-border-dark">
                <div class="min-w-0">
                  <p class="text-sm text-text dark:text-text-dark">{t('data.importJson')}</p>
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">{t('data.importHint')}</p>
                </div>
                <button
                  type="button"
                  onclick={pickJsonImport}
                  disabled={importing}
                  class="shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {#if importing}<span class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>{/if}
                  {importing ? t('data.importing') : t('data.importPick')}
                </button>
              </div>

              <!-- Browser bookmarks (HTML) import — replace or merge -->
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm text-text dark:text-text-dark">{t('data.importHtml')}</p>
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">{t('data.exportHtmlHint')}</p>
                </div>
                <button
                  type="button"
                  onclick={pickHtmlImport}
                  disabled={importing}
                  class="shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {#if importing}<span class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>{/if}
                  {importing ? t('data.importing') : t('data.importHtmlPick')}
                </button>
              </div>

              {#if dataMsg}
                <p class="mt-3 text-xs {dataMsg.kind === 'ok' ? 'text-primary' : 'text-danger'}">{dataMsg.text}</p>
              {/if}
            </div>

            <!-- Hidden file inputs: one for JSON, one for HTML. Accept filters differ. -->
            <input bind:this={jsonFileInput} type="file" accept="application/json,.json" class="hidden" onchange={onJsonChosen} />
            <input bind:this={htmlFileInput} type="file" accept="text/html,.html,.htm" class="hidden" onchange={onHtmlChosen} />
          </section>
        {/if}
      </div>
    </div>

    <!-- Footer: Apply / Cancel -->
    <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-border-dark shrink-0">
      <button
        type="button"
        onclick={cancel}
        class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
      >
        {t('cardSize.cancel')}
      </button>
      <button
        type="button"
        onclick={apply}
        disabled={!dirty || saving}
        class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if saving}
          <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        {/if}
        {t('cardSize.apply')}
      </button>
    </div>
  </div>
</div>
