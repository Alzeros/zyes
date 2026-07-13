<script lang="ts">
  import Icon from '@iconify/svelte';
  import { type IconSource } from '../lib/utils';

  let {
    source,
    fallbackUrls = [],
    fallbackUrl = '',
    proxyUrl = '',
    title,
    size = 'md',
    bg = false,
    fill = false,
    class: klass = '',
  }: {
    source: IconSource;
    fallbackUrls?: string[];     // auto-favicon sources tried in order on error
    fallbackUrl?: string;        // legacy single-URL form; merged into fallbackUrls
    proxyUrl?: string;            // backend icon-proxy URL; tried FIRST when kind==='none'
    title: string;               // for initial fallback on favicon error
    size?: 'sm' | 'md' | 'lg';
    bg?: boolean;                // render a rounded surface background tile
    fill?: boolean;              // fill the parent instead of using a fixed slot size
    class?: string;              // extra classes for the outer box (e.g. aspect-square)
  } = $props();

  // pixel sizes per slot (ignored when fill is true)
  const slot = $derived({ sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-14 h-14' }[size]);
  const iconFwd = $derived({ sm: 18, md: 26, lg: 32 }[size]);
  const faviconFwd = $derived({ sm: 20, md: 28, lg: 34 }[size]);

  // Normalize: combine legacy fallbackUrl + fallbackUrls into a single ordered list.
  const sources = $derived(
    [...(fallbackUrl ? [fallbackUrl] : []), ...fallbackUrls].filter(Boolean)
  );

  // Candidate URLs to try in order: when the bookmark has no custom icon
  // (kind === 'none'), the caller passes a backend icon-proxy URL which we try
  // FIRST — it fetches+caches server-side. If it errors (token expired, network
  // blip) the legacy direct multi-source list carries on as before. Empty proxy
  // => behaves exactly as before.
  const tryList = $derived(
    [...(source.kind === 'none' && proxyUrl ? [proxyUrl] : []), ...sources]
  );


  // Index into `sources` we are currently trying. When an <img> errors, we
  // advance to the next source; when all fail, show the initial-letter fallback.
  let sourceIdx = $state(0);
  let allFailed = $state(false);

  // Reset when the candidate list changes (new bookmark being edited, etc).
  $effect(() => {
    void tryList;
    sourceIdx = 0;
    allFailed = false;
  });

  // Fill mode stretches the image to cover the box (so the outer rounded +
  // overflow-hidden actually clips the image corners — centring here would
  // leave the image smaller than the box and the radius would clip empty
  // space, showing a square-edged image). Non-fill mode centres the fixed-size
  // icon inside its slot.
  const boxClass = $derived(fill ? 'w-full h-full' : slot);
  // When the caller passes an explicit shape class (e.g. 'h-full aspect-square'
  // to make a square box inside a wide icon area), prefer it over the default
  // fill box so aspect-square can size the box to its height.
  const outerClass = $derived(klass || boxClass);
  const alignClass = $derived(fill ? 'flex' : 'flex items-center justify-center');
</script>

<div class="{alignClass} shrink-0 overflow-hidden rounded-xl {outerClass} {bg ? 'bg-bg dark:bg-bg-dark' : ''}">
  {#if source.kind === 'iconify'}
    <Icon
      icon={source.name}
      width={fill ? '100%' : iconFwd}
      height={fill ? '100%' : iconFwd}
      style={fill ? 'padding: 2%' : ''}
    />
  {:else if source.kind === 'image'}
    <!-- Fill mode: let the image fill the whole box (no padding) so favicons
         use all the available space above the title bar; object-contain keeps
         the source's aspect ratio. The outer rounded-lg + overflow-hidden clips
         the image to the card's corner radius. -->
    <img src={source.url} alt="" class="object-contain w-full h-full" style={fill ? '' : 'padding: 2%'} />
  {:else if !allFailed && tryList[sourceIdx]}
    <img
      src={tryList[sourceIdx]}
      alt=""
      class="object-contain"
      style={fill ? 'width:100%;height:100%' : `width:${faviconFwd}px;height:${faviconFwd}px`}
      onerror={() => {
        if (sourceIdx < tryList.length - 1) {
          sourceIdx += 1;
        } else {
          allFailed = true;
        }
      }}
    />
  {:else}
    <span class="font-bold text-primary" style={fill ? 'font-size:min(40vw,3rem)' : `font-size:${iconFwd * 0.7}px`}>
      {title.charAt(0).toUpperCase()}
    </span>
  {/if}
</div>
