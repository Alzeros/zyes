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
  style="left:{pos.left}px;top:{pos.top}px"
  class="fixed z-[60] w-44 py-1.5 bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark shadow-xl"
>
  {#each items as item}
    {#if item.type === 'separator'}
      <div class="my-1 h-px bg-border dark:bg-border-dark"></div>
    {:else}
      <button
        onclick={() => onselect(item.key)}
        class="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer {item.danger ? 'text-danger hover:bg-danger/10' : 'text-text dark:text-text-dark hover:bg-bg dark:hover:bg-bg-dark'}"
      >
        {item.label}
      </button>
    {/if}
  {/each}
</div>
