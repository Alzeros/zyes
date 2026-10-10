<script lang="ts">
  export type ContextMenuItem =
    | { type: 'item'; key: string; label: string; danger?: boolean }
    | { type: 'separator' };

  let {
    x,
    y,
    items,
    onselect,
    onclose,
  }: {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onselect: (key: string) => void;
    onclose: () => void;
  } = $props();

  let menuEl: HTMLDivElement;

  // Clamp the menu inside the viewport so it never overflows near edges.
  let pos = $derived.by(() => {
    const w = 180;
    const h = items.length * 40 + 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 9999;
    const nx = Math.min(x, vw - w - 8);
    const ny = Math.min(y, vh - h - 8);
    return { left: Math.max(8, nx), top: Math.max(8, ny) };
  });

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  $effect(() => {
    function onClick(e: MouseEvent) {
      if (!menuEl?.contains(e.target as Node)) onclose();
    }
    function onContext(e: MouseEvent) {
      if (!menuEl?.contains(e.target as Node)) onclose();
    }
    // Defer one tick so the opening click/contextmenu doesn't immediately close it.
    const timer = setTimeout(() => {
      document.addEventListener('click', onClick);
      document.addEventListener('contextmenu', onContext);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', handleKey);
    };
  });
</script>

<div
  bind:this={menuEl}
  style="left:{pos.left}px;top:{pos.top}px;transform-origin:top left"
  class="fixed z-[60] w-48 p-1.5 bg-surface/95 dark:bg-surface-dark/95 backdrop-blur-xl rounded-2xl border border-border/80 dark:border-border-dark/80 shadow-2xl shadow-black/10 dark:shadow-black/40 anim-pop-anchor-l"
>
  {#each items as item}
    {#if item.type === 'separator'}
      <div class="my-1 mx-1.5 h-px bg-border/70 dark:bg-border-dark/70"></div>
    {:else}
      <button
        onclick={() => onselect(item.key)}
        class="w-full text-left px-3 py-2 text-[13px] font-medium rounded-xl transition-all cursor-pointer flex items-center justify-between {item.danger ? 'text-danger hover:bg-danger/10 active:bg-danger/15' : 'text-text dark:text-text-dark hover:bg-bg/80 dark:hover:bg-bg-dark/80 active:scale-[0.98]'}"
      >
        <span>{item.label}</span>
      </button>
    {/if}
  {/each}
</div>
