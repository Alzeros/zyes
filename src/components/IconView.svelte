<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { IconSource } from '../lib/utils';

  let {
    source,
    fallbackUrl,
    title,
    size = 'md',
    bg = false,
    fill = false,
  }: {
    source: IconSource;
    fallbackUrl: string;       // used when source.kind === 'none' -> auto favicon
    title: string;             // for initial fallback on favicon error
    size?: 'sm' | 'md' | 'lg';
    bg?: boolean;              // render a rounded surface background tile
    fill?: boolean;            // fill the parent instead of using a fixed slot size
  } = $props();

  // pixel sizes per slot (ignored when fill is true)
  const slot = $derived({ sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-14 h-14' }[size]);
  const iconFwd = $derived({ sm: 18, md: 26, lg: 32 }[size]);
  const faviconFwd = $derived({ sm: 20, md: 28, lg: 34 }[size]);

  let faviconError = $state(false);

  // Reset favicon error state when the fallback target changes.
  $effect(() => {
    // touch fallbackUrl so effect re-runs when it changes
    void fallbackUrl;
    faviconError = false;
  });

  const boxClass = $derived(fill ? 'w-full h-full' : slot);
</script>

<div class="flex items-center justify-center shrink-0 overflow-hidden rounded-lg {boxClass} {bg ? 'bg-bg dark:bg-bg-dark' : ''}">
  {#if source.kind === 'iconify'}
    <Icon
      icon={source.name}
      width={fill ? '100%' : iconFwd}
      height={fill ? '100%' : iconFwd}
      style={fill ? 'padding: 6%' : ''}
    />
  {:else if source.kind === 'image'}
    <img src={source.url} alt="" class="object-contain w-full h-full" style={fill ? 'padding: 6%' : ''} />
  {:else if !faviconError}
    <img
      src={fallbackUrl}
      alt=""
      class="object-contain"
      style={fill ? 'width:100%;height:100%;padding:6%' : `width:${faviconFwd}px;height:${faviconFwd}px`}
      onerror={() => (faviconError = true)}
    />
  {:else}
    <span class="font-bold text-primary" style={fill ? 'font-size:min(40vw,3rem)' : `font-size:${iconFwd * 0.7}px`}>
      {title.charAt(0).toUpperCase()}
    </span>
  {/if}
</div>
