<script lang="ts">
  import { t } from '../lib/i18n';
  import { CARD_SIZE_LABELS } from '../lib/cardSize';
  import { parseNetscape } from '../lib/netscape';
  import type { CardSize } from '../lib/types';
  import Icon from '@iconify/svelte';
  import { parseIcon } from '../lib/utils';

  let {
    lang,
    cardSize,
    siteName,
    siteLogo,
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
    siteLogo: string;
    onsave: (patch: { cardSize?: CardSize; siteName?: string; siteLogo?: string }) => Promise<boolean>;
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
  let draftSiteLogo = $state<string>(siteLogo);
  let saving = $state(false);

  // ── Data export / import state
  let exporting = $state(false);
  let importing = $state(false);
  let dataMsg = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
  let jsonFileInput = $state<HTMLInputElement | null>(null);
  let htmlFileInput = $state<HTMLInputElement | null>(null);
  // HTML import mode panel: shown after a file is picked. We pre-parse the
  // file client-side (parseNetscape is shared with the backend) to show the
  // user exactly how many bookmarks/categories will land before they choose
  // replace vs merge. `replaceArmed` toggles the two-click confirm on the
  // replace button (first click arms it red, second executes).
  let htmlModeOpen = $state(false);
  let htmlPendingFile = $state<File | null>(null);
  let htmlPreview = $state<{ bm: number; cat: number; fail: boolean } | null>(null);
  let replaceArmed = $state(false);

  // Re-seed drafts whenever the panel is (re)opened with fresh props.
  $effect(() => {
    draftCardSize = cardSize;
    draftSiteName = siteName;
    draftSiteLogo = siteLogo;
  });

  // Has the user touched anything vs. the last persisted values?
  let dirty = $derived(
    draftCardSize !== cardSize ||
    draftSiteName !== siteName ||
    draftSiteLogo !== siteLogo
  );

  // Live preview of the drafted logo (iconify name / image URL / empty = default Z).
  let logoPreview = $derived(parseIcon(draftSiteLogo));

  async function apply() {
    if (!dirty || saving) return;
    saving = true;
    const ok = await onsave({
      cardSize: draftCardSize,
      siteName: draftSiteName,
      siteLogo: draftSiteLogo,
    });
    saving = false;
    if (ok) onclose();
  }

  function cancel() {
    // Discard drafts by reseeding from the (unchanged) persisted props.
    draftCardSize = cardSize;
    draftSiteName = siteName;
    draftSiteLogo = siteLogo;
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
  // Pick the file, then open the mode-choice panel (no native confirms).
  // We pre-parse client-side via the shared parseNetscape so the panel can show
  // the exact bookmark/category count before the user chooses replace/merge.
  async function onHtmlChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      dataMsg = { kind: 'err', text: t('data.importError') };
      return;
    }
    let bm = 0, cat = 0, fail = false;
    try {
      const parsed = parseNetscape(text);
      cat = parsed.categories.length;
      bm = parsed.unfiled.length + parsed.categories.reduce((n, c) => n + c.bookmarks.length, 0);
      if (bm === 0) fail = true;
    } catch {
      fail = true;
    }
    if (fail) {
      dataMsg = { kind: 'err', text: t('data.importHtmlParseFail') };
      return;
    }
    htmlPendingFile = file;
    htmlPreview = { bm, cat, fail };
    replaceArmed = false;
    htmlModeOpen = true;
  }

  // Execute the chosen mode. Called from the panel buttons. replace is only
  // reached after the two-click arm (see onClickReplace).
  async function doHtmlImport(mode: 'replace' | 'merge') {
    const file = htmlPendingFile;
    if (!file) return;
    htmlModeOpen = false;
    replaceArmed = false;
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

  // Two-click confirm on the replace button: first click arms it (button turns
  // red, label → "confirm replace"), second click executes. Resets if the
  // panel reopens or the other button is used.
  function onClickReplace() {
    if (replaceArmed) {
      void doHtmlImport('replace');
    } else {
      replaceArmed = true;
    }
  }
  function cancelHtmlImport() {
    htmlModeOpen = false;
    htmlPendingFile = null;
    htmlPreview = null;
    replaceArmed = false;
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
          <!-- ── Site title + logo ─────────────────────────────── -->
          <section>
            <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-1">{t('cardSize.siteSection')}</h3>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-4">{t('cardSize.siteHint')}</p>

            <!-- Logo input + live preview. Empty = built-in Z wordmark; an
                 iconify name (e.g. "mdi:github") or an image URL replaces the
                 whole brand mark on Header / LoginScreen / About. -->
            <label class="block mb-4">
              <span class="block text-xs font-medium mb-1.5 text-text-secondary dark:text-text-secondary-dark">{t('cardSize.siteLogoLabel')}</span>
              <div class="flex items-center gap-3">
                <div class="shrink-0 w-10 h-10 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark flex items-center justify-center overflow-hidden">
                  {#if logoPreview.kind === 'iconify'}
                    <Icon icon={logoPreview.name} width={26} height={26} class="shrink-0" inline />
                  {:else if logoPreview.kind === 'image'}
                    <img src={logoPreview.url} alt="" class="shrink-0 object-contain w-full h-full" style="padding:6%" />
                  {:else}
                    <!-- Default Z mark mini-preview -->
                    <svg width="18" height="23" viewBox="6 5 17 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <g class="zyes-light"><path d="M 9 8 H 22 L 10 24 H 23" stroke="#1e293b" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" /></g>
                      <g class="zyes-dark"><path d="M 9 8 H 22 L 10 24 H 23" stroke="#ffffff" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" /></g>
                    </svg>
                  {/if}
                </div>
                <input
                  type="text"
                  value={draftSiteLogo}
                  maxlength="256"
                  placeholder={t('cardSize.siteLogoPlaceholder')}
                  oninput={(e) => (draftSiteLogo = e.currentTarget.value)}
                  class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-sm text-text dark:text-text-dark placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <p class="mt-1.5 text-xs text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                {t('cardSize.siteLogoHint')}
                <a
                  href="https://icon-sets.iconify.design/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                  onclick={(e) => e.stopPropagation()}
                >icon-sets.iconify.design</a>
              </p>
            </label>

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
                  <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">{t('data.importHtmlHint')}</p>
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

{#if htmlModeOpen && htmlPreview}
  <!-- HTML import mode chooser: shown after a file is picked + pre-parsed.
       Replaces the old chain of native confirm() dialogs. Shows the exact
       count of bookmarks/categories to import, then offers replace (two-click
       armed confirm) or merge (one-click). -->
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={cancelHtmlImport} onkeydown={() => {}} role="button" tabindex="-1"></div>
    <div class="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
      <h2 class="text-lg font-semibold mb-1 text-text dark:text-text-dark">{t('data.importHtmlTitle')}</h2>
      <p class="text-sm text-text-secondary dark:text-text-secondary-dark mb-5">
        {t('data.importHtmlCount', { bm: String(htmlPreview.bm), cat: String(htmlPreview.cat) })}
      </p>

      <div class="grid grid-cols-2 gap-3">
        <!-- Replace: two-click. First click arms (red, label flips to confirm).
             Second click executes. -->
        <button
          type="button"
          onclick={onClickReplace}
          disabled={importing}
          class="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed {replaceArmed
            ? 'border-danger bg-danger/10 text-danger'
            : 'border-border dark:border-border-dark text-text dark:text-text-dark hover:border-danger/50'}"
        >
          <span class="text-sm font-semibold">{replaceArmed ? t('data.confirmReplace') : t('data.modeReplace')}</span>
          <span class="text-xs text-text-secondary dark:text-text-secondary-dark text-center leading-relaxed">{replaceArmed ? t('data.modeReplaceWarn') : t('data.modeReplaceDesc')}</span>
        </button>

        <!-- Merge: one-click execute. -->
        <button
          type="button"
          onclick={() => doHtmlImport('merge')}
          disabled={importing}
          class="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-border dark:border-border-dark text-text dark:text-text-dark hover:border-primary/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span class="text-sm font-semibold">{t('data.modeMerge')}</span>
          <span class="text-xs text-text-secondary dark:text-text-secondary-dark text-center leading-relaxed">{t('data.modeMergeDesc')}</span>
        </button>
      </div>

      {#if importing}
        <div class="mt-4 flex items-center justify-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
          <span class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          {t('data.importing')}
        </div>
      {/if}

      <div class="flex justify-end mt-5">
        <button
          type="button"
          onclick={cancelHtmlImport}
          disabled={importing}
          class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer disabled:opacity-50"
        >
          {t('cardSize.cancel')}
        </button>
      </div>
    </div>
  </div>
{/if}
