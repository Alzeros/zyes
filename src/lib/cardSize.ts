import type { CardSize } from './types';

// Per-size spec. The grid now uses ONE column count (the compact one) for the
// whole group; cards opt into compact (span 1, square) or detail (span 2,
// 2:1 box) individually — see BookmarkCard.svelte for the col-span classes.
//
// Sizing ladder design notes:
//   * Each size step reads as visibly different: xs packs the most cards with
//     the tightest gap; lg shows the fewest. No two adjacent sizes collapse to
//     the same density.
//   * Compact card title font has a readability floor of `text-xs` (12px). xs is
//     the smallest tile so titles get the least space, but sub-12px is unreadable
//     for CJK; the two-line clamp already bounds it.
//   * Detail cards are laid out as a 2:1 box (width:height) — width = 2 compact
//     cells + 1 gap, height ≈ 1 compact cell. `aspect-[2/1]` is a close-enough
//     lock (a 6px gap/2 height variance shows only on all-detail rows, which are
//     rare since compact is the default). detailPad/detailTitle are tuned for
//     this short, wide box.
export type SizeSpec = {
  cols: string;
  gap: string;
  compactTitle: string;   // compact card title font size
  detailPad: string;      // detail card padding
  detailTitle: string;    // detail card title font size
};

const SPECS: Record<CardSize, SizeSpec> = {
  // Size ladder (xl breakpoint column counts shown as the headline density):
  //   xs (极小): 20 cols — denser than the old xs (16), scaled down ~equally.
  //   sm (小):   16 cols — was the old xs.
  //   md (中):   12 cols — midway between sm(16) and lg(9).
  //   lg (大):    9 cols — was the old md.
  // Gap and font/padding step down with size. grid-cols > 12 use the arbitrary
  // value form grid-cols-[repeat(N,minmax(0,1fr))] (Tailwind's default caps at 12).
  xs: {
    cols: 'grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-[repeat(20,minmax(0,1fr))]',
    gap: 'gap-1',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-1.5',
    detailTitle: 'text-[10px]',
  },
  sm: {
    // was the old xs
    cols: 'grid-cols-5 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-11 xl:grid-cols-[repeat(16,minmax(0,1fr))]',
    gap: 'gap-1',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-2',
    detailTitle: 'text-[10px]',
  },
  md: {
    // midway between sm(16) and lg(9) → 12
    cols: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12',
    gap: 'gap-2',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-2.5',
    detailTitle: 'text-xs',
  },
  lg: {
    // was the old md
    cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9',
    gap: 'gap-3',
    compactTitle: 'text-[13px] leading-tight',
    detailPad: 'p-3',
    detailTitle: 'text-sm',
  },
};

// Look up a size spec, defaulting to 'md' for any unknown/undefined size. The
// card stack cascades cardSize through a few props; a transient undefined (e.g.
// before the parent's derived resolves) would otherwise become `SPECS[undefined]`
// → undefined → a template crash ("spec is not defined"). This guard keeps
// rendering safe at every tick. Mode is no longer a parameter — each card
// carries its own displayMode and the spec is size-only now.
function isCardSize(v: unknown): v is CardSize {
  return v === 'xs' || v === 'sm' || v === 'md' || v === 'lg';
}

export function sizeSpec(size: CardSize | undefined | null): SizeSpec {
  const s: CardSize = isCardSize(size) ? size : 'md';
  return SPECS[s];
}

export const CARD_SIZE_LABELS: Record<CardSize, { zh: string; en: string }> = {
  xs: { zh: '极小', en: 'XS' },
  sm: { zh: '小', en: 'Small' },
  md: { zh: '中', en: 'Medium' },
  lg: { zh: '大', en: 'Large' },
};
