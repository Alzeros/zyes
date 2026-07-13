import type { CardSize } from './types';

// Per-size spec. The grid now uses ONE column count (the compact one) for the
// whole group; cards opt into compact (span 1, square) or detail (span 2,
// 2:1 box) individually — see BookmarkCard.svelte for the col-span classes.
//
// Sizing ladder design notes:
//   * Each size step reads as visibly different via its card MINIMUM width,
//     not a fixed column count: the grid uses `repeat(auto-fill, minmax(MIN,1fr))`
//     so the browser computes the column count from the container width. Wide
//     screens get more columns (denser), narrow screens / phones get fewer
//     (bigger cards) — but a card is NEVER smaller than its MIN, so the icon
//     + title always have room. This is what gives cross-platform consistency:
//     a given size's cards have the same physical floor on a phone and a desktop.
//   * Why min-width floor and not fixed columns: the title font has a
//     readability floor (`text-xs` = 12px, below is unreadable for CJK). With a
//     fixed 6-col layout on a 375px phone, each ~58px card is too small for a
//     12px title + an icon — the title eats the whole card. The min-width floor
//     guarantees enough card area, decoupling card size from the font floor.
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

// Min card width (px) per size — the auto-fill floor. These MUST stay in sync
// with the literal minmax values in SPECS below (Tailwind can't see runtime
// values, so they're hardcoded per size). Bigger size → bigger floor → fewer
// columns. Tuned so that even on a 375px phone the smallest card (xs, 48px)
// leaves room for a visible icon above a 2-line 12px title. Detail cards span
// 2 cols so their min effective width is 2*min + 1 gap.
//   xs: 48px   sm: 64px   md: 84px   lg: 104px
// (Whole ladder shifted one rung smaller per user request: new sm = old xs,
//  new md = old sm, new lg = old md; old lg 140px dropped; new xs 48px added
//  on top. compactTitle never goes below text-xs — 12px is the CJK
//  readability floor, so the smallest tier tightens gap/pad/title not the
//  compact title font.)

const SPECS: Record<CardSize, SizeSpec> = {
  // Size ladder: each size's grid uses auto-fill + minmax(minW, 1fr), so column
  // count adapts to container width while each card stays ≥ its floor (see
  // MIN_W). No fixed per-breakpoint counts anymore — the floor IS the sizing
  // contract. Gap and font/padding still step down with size.
  xs: {
    // NOTE: the minmax value must be a LITERAL string, not `${MIN_W.xs}` —
    // Tailwind's JIT scans source for class names statically and can't see
    // runtime-interpolated values, so a template-built class would never get
    // generated and the grid would silently fall back to 1 column.
    cols: 'grid-cols-[repeat(auto-fill,minmax(48px,1fr))]',
    gap: 'gap-1',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-1',
    detailTitle: 'text-[10px]',
  },
  sm: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(64px,1fr))]',
    gap: 'gap-1',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-1.5',
    detailTitle: 'text-[10px]',
  },
  md: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(84px,1fr))]',
    gap: 'gap-1',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-2',
    detailTitle: 'text-[10px]',
  },
  lg: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(104px,1fr))]',
    gap: 'gap-2',
    compactTitle: 'text-xs leading-tight',
    detailPad: 'p-2.5',
    detailTitle: 'text-xs',
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
