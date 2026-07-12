import type { CardSize } from './types';

// Per-size mapping for both display modes. `cols` is the responsive grid-cols
// class string; `gap` the grid gap; `card` carries per-card visual tweaks
// (padding for detail cards; title font size for compact cards). IconView's
// own slot size is left alone — it scales with the card box.
export type SizeSpec = {
  cols: string;
  gap: string;
  compactTitle: string;   // compact card title font size
  detailPad: string;     // detail card padding
  detailMinH: string;    // detail card min height
  detailTitle: string;   // detail card title font size
};

const COMPACT: Record<CardSize, Omit<SizeSpec, 'detailPad' | 'detailMinH' | 'detailTitle'>> = {
  xs: { cols: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12', gap: 'gap-2', compactTitle: 'text-[10px] leading-tight' },
  sm: { cols: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10', gap: 'gap-3', compactTitle: 'text-[11px] leading-tight' },
  md: { cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10', gap: 'gap-4', compactTitle: 'text-xs leading-tight' },
  lg: { cols: 'grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',  gap: 'gap-5', compactTitle: 'text-sm leading-tight' },
};

const DETAIL: Record<CardSize, Pick<SizeSpec, 'cols' | 'gap' | 'detailPad' | 'detailMinH' | 'detailTitle'>> = {
  xs: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', gap: 'gap-3', detailPad: 'p-3', detailMinH: 'min-h-[112px]', detailTitle: 'text-xs' },
  sm: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', gap: 'gap-3', detailPad: 'p-3.5', detailMinH: 'min-h-[126px]', detailTitle: 'text-sm' },
  md: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', gap: 'gap-4', detailPad: 'p-4', detailMinH: 'min-h-[140px]', detailTitle: 'text-sm' },
  lg: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',                gap: 'gap-5', detailPad: 'p-5', detailMinH: 'min-h-[160px]', detailTitle: 'text-base' },
};

export function sizeSpec(size: CardSize, mode: 'compact' | 'detail'): SizeSpec {
  const c = COMPACT[size];
  const d = DETAIL[size];
  return {
    cols: mode === 'compact' ? c.cols : d.cols,
    gap: mode === 'compact' ? c.gap : d.gap,
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
