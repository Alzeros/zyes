<script lang="ts">
  import Icon from '@iconify/svelte';
  import { parseCategoryIcon, type CategoryIconSource } from '../lib/utils';

  let {
    icon,
    size = 'base',
    fallback = 'lucide:folder',
  }: {
    icon: string | null | undefined;
    size?: 'base' | 'lg' | 'inline';
    fallback?: string;
  } = $props();

  let src = $derived<CategoryIconSource>(parseCategoryIcon(icon, fallback));

  // iconify glyph thickness scales with context; emoji just sizes the span.
  const px = $derived(size === 'lg' ? 18 : size === 'inline' ? 16 : 16);
</script>

{#if src.kind === 'emoji'}
  <span>{src.char}</span>
{:else if src.kind === 'iconify'}
  <Icon icon={src.name} width={px} height={px} class="shrink-0" inline />
{:else}
  <img src={src.url} alt="" class="shrink-0 object-contain {size === 'lg' ? 'w-[18px] h-[18px]' : 'w-4 h-4'}" style="padding: 4%" />
{/if}
