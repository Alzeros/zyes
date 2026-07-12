<script lang="ts">
  import type { Category } from '../lib/types';
  import { t } from '../lib/i18n';
  import { parseCategoryIcon } from '../lib/utils';
  import IconView from './IconView.svelte';
  import Icon from '@iconify/svelte';

  let {
    lang,
    category,
    onclose,
    onsave,
  }: {
    lang: string;
    category?: Category;
    onclose: () => void;
    onsave: (data: { name: string; icon: string }) => Promise<void>;
  } = $props();

  let name = $state(category?.name || '');
  let icon = $state(category?.icon || '');
  let saving = $state(false);

  const isEdit = !!category;

  const categoryIconOptions = [
    { id: 'code', label: '代码开发', icon: 'lucide:code-2', color: '#3b82f6' },
    { id: 'server', label: '服务器', icon: 'lucide:server', color: '#10b981' },
    { id: 'network', label: '网络节点', icon: 'lucide:globe', color: '#6366f1' },
    { id: 'terminal', label: '脚本工具', icon: 'lucide:terminal', color: '#4b5563' },
    { id: 'tools', label: '常用工具', icon: 'lucide:wrench', color: '#f59e0b' },
    { id: 'cloud', label: '云盘存储', icon: 'lucide:cloud', color: '#06b6d4' },
    { id: 'docs', label: '文档笔记', icon: 'lucide:file-text', color: '#8b5cf6' },
    { id: 'design', label: '设计素材', icon: 'lucide:palette', color: '#ec4899' },
    { id: 'media', label: '流媒体', icon: 'lucide:video', color: '#ef4444' },
    { id: 'community', label: '社交社区', icon: 'lucide:messages-square', color: '#14b8a6' },
    { id: 'game', label: '游戏摸鱼', icon: 'lucide:gamepad-2', color: '#f43f5e' },
    { id: 'finance', label: '财务账单', icon: 'lucide:wallet', color: '#eab308' },
    { id: 'star', label: '特别关注', icon: 'lucide:folder-heart', color: '#a855f7' },
    { id: 'default', label: '其它/未分类', icon: 'lucide:folder', color: '#6b7280' },
  ];

  // Preview of the chosen category icon: emoji rendered literally, iconify /
  // image rendered through the shared IconView/Icon path.
  let preview = $derived(parseCategoryIcon(icon, 'lucide:folder'));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    saving = true;
    try {
      await onsave({ name: name.trim(), icon: icon || 'lucide:folder' });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={onclose} onkeydown={() => {}} role="button" tabindex="-1"></div>
  <div class="relative w-full max-w-sm bg-surface dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-6 shadow-xl">
    <h2 class="text-lg font-semibold mb-4 text-text dark:text-text-dark">
      {isEdit ? t('modal.editCategory') : t('modal.addCategory')}
    </h2>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="cat-name" class="block text-sm font-medium mb-1 text-text dark:text-text-dark">{t('modal.categoryName')}</label>
        <input
          id="cat-name"
          type="text"
          bind:value={name}
          placeholder={t('modal.categoryPlaceholder')}
          class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
          autofocus
        />
      </div>

      <div>
        <label for="cat-icon" class="block text-sm font-medium mb-2 text-text dark:text-text-dark">{t('modal.icon')}</label>
        <div class="flex flex-wrap gap-1.5 mb-3">
          {#each categoryIconOptions as opt}
            <button
              type="button"
              onclick={() => (icon = opt.icon)}
              title={opt.label}
              class="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer {icon === opt.icon ? 'bg-primary/10 ring-2 ring-primary scale-110' : 'bg-bg dark:bg-bg-dark hover:bg-border dark:hover:bg-border-dark'}"
            >
              <Icon icon={opt.icon} width={18} height={18} color={opt.color} />
            </button>
          {/each}
        </div>
        <div class="flex items-stretch gap-3">
          <div class="flex items-center justify-center rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark w-14 h-14 shrink-0 overflow-hidden text-2xl">
            {#if preview.kind === 'emoji'}
              <span>{preview.char}</span>
            {:else if preview.kind === 'iconify'}
              <Icon icon={preview.name} width={26} height={26} />
            {:else}
              <img src={preview.url} alt="" class="object-contain w-full h-full" style="padding:6%" />
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <input
              id="cat-icon"
              type="text"
              bind:value={icon}
              placeholder={t('modal.iconPlaceholder')}
              class="w-full px-3 py-2.5 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark text-text dark:text-text-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
            />
            <p class="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">
              {t('modal.iconHintPrefix')}
              <a
                href="https://icon-sets.iconify.design/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
                onclick={(e) => e.stopPropagation()}
              >icon-sets.iconify.design</a>
              {t('modal.iconHintSuffix')}
            </p>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={onclose}
          class="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark transition-colors cursor-pointer"
        >
          {t('modal.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          class="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? t('modal.saving') : isEdit ? t('modal.update') : t('modal.add')}
        </button>
      </div>
    </form>
  </div>
</div>
