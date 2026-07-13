import type { CardSize } from './types';

// Per-size mapping for both display modes. `cols` is the responsive grid-cols
// class string; `gap` the grid gap; `card` carries per-card visual tweaks
// (padding for detail cards; title font size for compact cards). IconView's
// own slot size is left alone — it scales with the card box.
//
// Sizing ladder design notes:
//   * Each size step must read as visibly different. The compact `cols`/`gap`
//     and detail `cols`/`gap`/`min-height` are spread out so xs (very small)
//     packs many small cards and lg shows few large ones — no two adjacent
//     sizes collapse to the same density.
//   * Compact card title font has a readability floor. xs is the smallest card
//     so titles get the least space, but the title font is held to never drop
//     below `text-xs` (12px). A sub-12px title is unreadable on the square
//     compact cards especially for CJK; the two-line clamp already bounds it.
export type SizeSpec = {
  cols: string;
  gap: string;
  compactTitle: string;   // compact card title font size
  detailPad: string;     // detail card padding
  detailMinH: string;    // detail card min height
  detailTitle: string;   // detail card title font size
};

const COMPACT: Record<CardSize, Omit<SizeSpec, 'detailPad' | 'detailMinH' | 'detailTitle'>> = {
  // xs: the most cards per row, tightest gap — visibly the smallest tile.
  // grid-cols-13/14 exceed Tailwind's default 1–12 scale, so use the arbitrary
  // value form `grid-cols-[repeat(N,minmax(0,1fr))]` for the densest breakpoints.
  xs: { cols: 'grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-[repeat(14,minmax(0,1fr))]', gap: 'gap-1.5', compactTitle: 'text-xs leading-tight' },
  sm: { cols: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9  xl:grid-cols-11', gap: 'gap-2',   compactTitle: 'text-xs leading-tight' },
  md: { cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7  xl:grid-cols-9',  gap: 'gap-3',   compactTitle: 'text-[13px] leading-tight' },
  lg: { cols: 'grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6  xl:grid-cols-7',  gap: 'gap-4',   compactTitle: 'text-sm leading-tight' },
};

const DETAIL: Record<CardSize, Pick<SizeSpec, 'cols' | 'gap' | 'detailPad' | 'detailMinH' | 'detailTitle'>> = {
  xs: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6', gap: 'gap-3',   detailPad: 'p-3',   detailMinH: 'min-h-[104px]', detailTitle: 'text-xs' },
  sm: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', gap: 'gap-3',   detailPad: 'p-3.5', detailMinH: 'min-h-[118px]', detailTitle: 'text-xs' },
  md: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', gap: 'gap-4',   detailPad: 'p-4',   detailMinH: 'min-h-[140px]', detailTitle: 'text-sm' },
  lg: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',                gap: 'gap-5',   detailPad: 'p-5',   detailMinH: 'min-h-[160px]', detailTitle: 'text-base' },
};

// Look up a size spec, defaulting to 'md' for any unknown/undefined size and
// 'compact' for an unknown mode. The card stack cascades cardSize through a
// few props; a transient undefined (e.g. before the parent's derived resolves)
// would otherwise become `COMPACT[undefined]` → undefined → a template crash
// ("spec is not defined"). This guard keeps rendering safe at every tick.
function isCardSize(v: unknown): v is CardSize {
  return v === 'xs' || v === 'sm' || v === 'md' || v === 'lg';
}

export function sizeSpec(size: CardSize | undefined | null, mode: 'compact' | 'detail' | undefined | null): SizeSpec {
  const s: CardSize = isCardSize(size) ? size : 'md';
  const m = mode === 'detail' ? 'detail' : 'compact';
  const c = COMPACT[s];
  const d = DETAIL[s];
  return {
    cols: m === 'compact' ? c.cols : d.cols,
    gap: m === 'compact' ? c.gap : d.gap,
    compactTitle: c.compactTitle,
    detailPad: d.detailPad,
    detailMinH: d.detailMinH,
    detailTitle: d.detailTitle,
  };
}

export const CARD_SIZE_LABELS: Record<CardSize, { zh: string; en: string }> = {
  xs: { zh: '极小', en: 'XS' },
  sm: { zh: '小', en: 'Small' },
  md: { zh: '中', en: 'Medium' },
  lg: { zh: '大', en: 'Large' },
};
