<script lang="ts">
  import { t } from '../lib/i18n';
  import { dayKey } from '../lib/api';
  import type { Bookmark, Category, ClickStatRow } from '../lib/types';

  // Read-only view over the click-stats feed. All aggregation is derived:
  // the parent (App) owns the rows and refreshes them via onrefreshStats
  // whenever this panel opens, so the numbers here are always fresh-on-open.
  // `todayKey` is owned by App (one source of truth backed by the midnight
  // timer + visibility watcher), so this panel rolls over live even when the
  // modal is left open across midnight.
  let {
    statsRows,
    todayKey,
    bookmarks,
    categories,
  }: {
    statsRows: ClickStatRow[];
    todayKey: string;
    bookmarks: Bookmark[];
    categories: Category[];
  } = $props();

  // Join helpers: stats rows reference card ids; deleted bookmarks' rows are
  // dropped here (the store keeps them as harmless orphans).
  let cardById = $derived(new Map(bookmarks.map((b) => [b.id, b])));
  let catNameById = $derived(new Map(categories.map((c) => [c.id, c.name])));

  // cardId → { today, total }, only for cards that still exist.
  let perCard = $derived.by(() => {
    const m = new Map<string, { today: number; total: number }>();
    for (const r of statsRows) {
      if (!cardById.has(r.cardId)) continue;
      const e = m.get(r.cardId) ?? { today: 0, total: 0 };
      e.total += r.count;
      if (r.day === todayKey) e.today += r.count;
      m.set(r.cardId, e);
    }
    return m;
  });

  let totalAll = $derived([...perCard.values()].reduce((n, e) => n + e.total, 0));
  let todayAll = $derived([...perCard.values()].reduce((n, e) => n + e.today, 0));
  let activeCards = $derived(perCard.size);

  // Top 10 by all-time clicks, carrying display names + category labels.
  let top = $derived(
    [...perCard.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, e]) => ({
        id,
        title: cardById.get(id)?.title ?? id,
        category: catNameById.get(cardById.get(id)?.categoryId ?? '') ?? t('stats.uncategorized'),
        today: e.today,
        total: e.total,
      }))
  );

  // ── Heatmap: 5-week calendar grid, one row per week ───────────────────────
  // Whole-site daily totals (all live cards summed). The window is a FIXED
  // span of the last 5 weeks (current week at the bottom), regardless of how
  // young the data is: a fresh dataset renders mostly empty cells, which is
  // honest and — crucially — always fills the card. Rows are weeks, columns
  // are Mon→Sun, so the grid is wide and shallow (7 cols × 5 rows of large
  // cells) instead of a couple of skinny week-columns floating in whitespace.
  // Days past today render as invisible placeholders so the last row keeps
  // its shape mid-week.
  let heatByDay = $derived.by(() => {
    const m = new Map<string, number>();
    for (const r of statsRows) {
      if (!cardById.has(r.cardId)) continue;
      m.set(r.day, (m.get(r.day) ?? 0) + r.count);
    }
    return m;
  });
  const HEAT_WEEKS = 5;
  let heatRows = $derived.by(() => {
    const today = new Date(`${todayKey}T00:00:00`);
    const dow = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
    const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);

    const rows: ({ day: string; count: number } | null)[][] = [];
    for (let w = HEAT_WEEKS - 1; w >= 0; w--) {
      const row: ({ day: string; count: number } | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - w * 7 + d);
        if (dt > today) {
          row.push(null); // future day in the current week — placeholder cell
          continue;
        }
        const key = dayKey(dt);
        row.push({ day: key, count: heatByDay.get(key) ?? 0 });
      }
      rows.push(row);
    }
    return rows;
  });
  let heatMax = $derived(
    Math.max(1, ...heatRows.flat().map((c) => c?.count ?? 0))
  );

  // ── Efficiency metrics (fills the space beside the adaptive heatmap) ──────
  // Anchor "today" to the todayKey prop (not `new Date()`) so these derive
  // re-run when the prop rolls over at midnight, not only when the panel
  // remounts. todayKey is 'YYYY-MM-DD' so `${todayKey}T00:00:00` parses in
  // local time (per the ECMAScript spec for date-time strings without a zone).
  // streak: consecutive days with ≥1 click, ending today — or yesterday when
  // today hasn't been clicked yet (so the badge doesn't reset at midnight).
  let streak = $derived.by(() => {
    const cur = new Date(`${todayKey}T00:00:00`);
    if (!(heatByDay.get(dayKey(cur)) ?? 0)) cur.setDate(cur.getDate() - 1);
    let n = 0;
    while ((heatByDay.get(dayKey(cur)) ?? 0) > 0) {
      n++;
      cur.setDate(cur.getDate() - 1);
    }
    return n;
  });
  let bestDay = $derived(heatByDay.size ? Math.max(...heatByDay.values()) : 0);
  let last7 = $derived.by(() => {
    const today = new Date(`${todayKey}T00:00:00`);
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      n += heatByDay.get(dayKey(d)) ?? 0;
    }
    return n;
  });

  // Weekday header labels, Mon → Sun.
  const WEEKDAY_KEYS = ['stats.wd1', 'stats.wd2', 'stats.wd3', 'stats.wd4', 'stats.wd5', 'stats.wd6', 'stats.wd7'] as const;

  // Monotone ramp shared by the category stacked bar and its legend dots.
  const CAT_COLORS = [
    'bg-text/90 dark:bg-text-dark/90',
    'bg-text/70 dark:bg-text-dark/70',
    'bg-text/50 dark:bg-text-dark/50',
    'bg-text/30 dark:bg-text-dark/30',
    'bg-text/15 dark:bg-text-dark/15'
  ];

  // ── Category breakdown (the compact card below the metric tiles) ─────────
  // Click totals grouped by owning category, rendered as ONE stacked bar +
  // legend. Bar segments flex by raw click count, so the bar is ALWAYS
  // exactly full — no rounding under/overflow, and slicing can't leave the
  // track showing. Past the top 4 the tail collapses into an "其他" bucket:
  // the legend never exceeds 5 entries (re-flowed into two columns past 3),
  // so the card stays bounded no matter how many categories the user creates.
  let perCat = $derived.by(() => {
    const m = new Map<string, number>();
    for (const [id, e] of perCard) {
      const cid = cardById.get(id)?.categoryId ?? '';
      m.set(cid, (m.get(cid) ?? 0) + e.total);
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    const all = [...m.entries()]
      .map(([cid, n]) => ({
        name: cid ? (catNameById.get(cid) ?? t('stats.uncategorized')) : t('stats.uncategorized'),
        n,
      }))
      .sort((a, b) => b.n - a.n);
    const rows = all.slice(0, 4);
    const restN = all.slice(4).reduce((s, r) => s + r.n, 0);
    if (restN > 0) rows.push({ name: t('stats.otherCat'), n: restN });
    return rows.map((r) => ({ ...r, pct: Math.max(1, Math.round((r.n / total) * 100)) }));
  });

  // 5-step colour ramp, neutral-tinted so it tracks the site theme in both
  // light and dark mode. 0 = neutral track colour.
  function heatCls(count: number): string {
    if (count <= 0) return 'bg-transparent border border-border/40 dark:border-border-dark/40';
    const ratio = count / heatMax;
    if (ratio <= 0.25) return 'bg-text/20 dark:bg-text-dark/20 border border-transparent';
    if (ratio <= 0.5) return 'bg-text/40 dark:bg-text-dark/40 border border-transparent';
    if (ratio <= 0.75) return 'bg-text/60 dark:bg-text-dark/60 border border-transparent';
    return 'bg-text/80 dark:bg-text-dark/80 border border-transparent';
  }

  // ── Heatmap hover tooltip ─────────────────────────────────────────────────
  // Anchored ABOVE the hovered cell (GitHub-style), positioned in the heatmap
  // section's own coordinate system — NOT position:fixed. The modal ancestor
  // carries an entrance animation (transform), which makes it the containing
  // block for fixed descendants and throws viewport-anchored bubbles outside
  // the panel. Section-relative absolute positioning is immune to that, and
  // the left coordinate is clamped so edge columns can't push the bubble out.
  let heatHostEl = $state<HTMLElement | null>(null);
  let heatTip = $state<{ day: string; count: number; left: number; top: number } | null>(null);

  // Approximate bubble half-width ("2026-10-09 · NN 次点击" ≈ 150px). Only
  // used to keep the clamp margin sane; exact centering is transform-based.
  const TIP_HALF = 80;

  function onHeatEnter(e: MouseEvent, cell: { day: string; count: number }) {
    const host = heatHostEl;
    const cellEl = e.currentTarget as HTMLElement | null;
    if (!host || !cellEl) return;
    const hostRect = host.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    // Cell centre in host coords, clamped so the bubble stays inside the card.
    let left = cellRect.left - hostRect.left + cellRect.width / 2;
    left = Math.max(TIP_HALF + 4, Math.min(left, hostRect.width - TIP_HALF - 4));
    // Sit 8px above the cell (bubble translates itself up by its own height).
    const top = cellRect.top - hostRect.top - 8;
    heatTip = { day: cell.day, count: cell.count, left, top };
  }
  function onHeatLeave() {
    heatTip = null;
  }
</script>

{#if statsRows.length === 0 || activeCards === 0}
  <!-- Empty state: no rows at all, or only rows for since-deleted cards -->
  <div class="text-center py-10 text-sm text-text-secondary dark:text-text-secondary-dark">
    {t('stats.empty')}
  </div>
{:else}
  <!-- ── Summary tiles ─────────────────────────────────────────────────── -->
  <div class="grid grid-cols-3 gap-3 mb-6">
    <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/50 dark:bg-surface-dark/50 p-4 text-center shadow-2xs">
      <p class="text-2xl font-black text-text dark:text-text-dark tracking-tight">{todayAll}</p>
      <p class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark mt-1">{t('stats.todayAll')}</p>
    </div>
    <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/50 dark:bg-surface-dark/50 p-4 text-center shadow-2xs">
      <p class="text-2xl font-black text-text dark:text-text-dark tracking-tight">{totalAll}</p>
      <p class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark mt-1">{t('stats.totalAll')}</p>
    </div>
    <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/50 dark:bg-surface-dark/50 p-4 text-center shadow-2xs">
      <p class="text-2xl font-black text-text dark:text-text-dark tracking-tight">{activeCards}</p>
      <p class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark mt-1">{t('stats.activeCards')}</p>
    </div>
  </div>

  <!-- ── Heatmap + metrics + categories ────────────────────────────────── -->
  <section class="mb-6 relative" bind:this={heatHostEl}>
    <div class="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3">
      <!-- Heatmap card -->
      <div class="md:row-span-2 relative rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/40 dark:bg-surface-dark/40 p-4 overflow-hidden flex flex-col shadow-2xs">
        <div class="flex items-baseline justify-between mb-2">
          <p class="text-xs font-semibold text-text dark:text-text-dark">{t('stats.heat')}</p>
          <span class="text-[10px] font-medium tabular-nums text-text-secondary/70 dark:text-text-secondary-dark/70">
            {t('stats.weeks', { n: String(HEAT_WEEKS) })}
          </span>
        </div>
        <div class="flex-1 flex items-center justify-center min-h-0">
          <div class="w-max" onmouseleave={onHeatLeave} role="presentation">
            <!-- Weekday header -->
            <div class="grid grid-cols-7 gap-1.5 mb-1.5" aria-hidden="true">
              {#each WEEKDAY_KEYS as wdKey}
                <div class="w-8.5 h-4 flex items-center justify-center text-[10px] font-medium leading-none text-text-secondary/70 dark:text-text-secondary-dark/70">
                  {t(wdKey)}
                </div>
              {/each}
            </div>
            <div class="grid grid-cols-7 gap-1.5">
              {#each heatRows as row}
                {#each row as cell}
                  {#if cell === null}
                    <div class="w-8.5 h-8.5 rounded-lg opacity-0"></div>
                  {:else}
                    <div
                      class="w-8.5 h-8.5 rounded-lg {heatCls(cell.count)} hover:ring-2 hover:ring-primary/60 cursor-pointer transition-all shadow-2xs"
                      role="presentation"
                      onmouseenter={(e) => onHeatEnter(e, cell)}
                    ></div>
                  {/if}
                {/each}
              {/each}
            </div>
          </div>
        </div>
        <div class="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-text-secondary dark:text-text-secondary-dark font-medium">
          <span>{t('stats.less')}</span>
          <span class="w-3 h-3 rounded-[3px] border border-border/40 dark:border-border-dark/40"></span>
          <span class="w-3 h-3 rounded-[3px] bg-text/20 dark:bg-text-dark/20"></span>
          <span class="w-3 h-3 rounded-[3px] bg-text/40 dark:bg-text-dark/40"></span>
          <span class="w-3 h-3 rounded-[3px] bg-text/60 dark:bg-text-dark/60"></span>
          <span class="w-3 h-3 rounded-[3px] bg-text/80 dark:bg-text-dark/80"></span>
          <span>{t('stats.more')}</span>
        </div>
      </div>

      <!-- Metric tiles -->
      <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/40 dark:bg-surface-dark/40 grid grid-cols-3 divide-x divide-border/70 dark:divide-border-dark/70 shadow-2xs">
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-text dark:text-text-dark tabular-nums">
            {streak}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.daysUnit')}</span>
          </span>
          <span class="text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.streak')}</span>
        </div>
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-text dark:text-text-dark tabular-nums">
            {bestDay}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.clicksUnit')}</span>
          </span>
          <span class="text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.bestDay')}</span>
        </div>
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-text dark:text-text-dark tabular-nums">
            {last7}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.clicksUnit')}</span>
          </span>
          <span class="text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.last7')}</span>
        </div>
      </div>

      <!-- Category card -->
      <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/40 dark:bg-surface-dark/40 p-3.5 flex flex-col shadow-2xs">
        <p class="text-xs font-semibold text-text dark:text-text-dark mb-2">{t('stats.byCategory')}</p>
        <div class="flex h-2.5 rounded-full overflow-hidden bg-bg dark:bg-bg-dark">
          {#each perCat as row, i (row.name)}
            <div class="h-full {CAT_COLORS[i]}" style="flex-grow:{row.n}"></div>
          {/each}
        </div>
        <ul class="flex-1 grid content-center gap-x-3 gap-y-1.5 mt-2.5 list-none p-0 {perCat.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}">
          {#each perCat as row, i (row.name)}
            <li class="flex items-center gap-2 text-xs">
              <span class="w-2 h-2 rounded-full shrink-0 {CAT_COLORS[i]}"></span>
              <span class="flex-1 min-w-0 truncate text-text dark:text-text-dark font-medium">{row.name}</span>
              <span class="shrink-0 tabular-nums text-text-secondary dark:text-text-secondary-dark font-mono">{row.pct}%</span>
              {#if perCat.length <= 3}
                <span class="shrink-0 w-7 text-right tabular-nums font-bold text-text dark:text-text-dark">{row.n}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    {#if heatTip}
      <div
        class="absolute z-20 px-3 py-1.5 rounded-xl bg-neutral-900/95 dark:bg-black/90 text-white text-xs leading-snug shadow-xl pointer-events-none whitespace-nowrap"
        style="left:{heatTip.left}px; top:{heatTip.top}px; transform:translate(-50%,-100%);"
      >
        <span class="font-semibold">{heatTip.day}</span>
        <span class="mx-1 opacity-50">·</span>
        <span>{t('stats.dayCount', { n: String(heatTip.count) })}</span>
      </div>
    {/if}
  </section>

  <!-- ── Top 10 ────────────────────────────────────────────────────────── -->
  <section>
    <h3 class="text-sm font-semibold text-text dark:text-text-dark mb-3">{t('stats.top')}</h3>
    <div class="rounded-2xl border border-border/80 dark:border-border-dark/80 bg-surface/30 dark:bg-surface-dark/30 divide-y divide-border/60 dark:divide-border-dark/60 overflow-hidden shadow-2xs">
      {#each top as row, i (row.id)}
        <div class="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface/50 dark:hover:bg-surface-dark/50 transition-colors">
          <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 {i === 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : i === 1 ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300' : i === 2 ? 'bg-amber-700/15 text-amber-700 dark:text-amber-500' : 'text-text-secondary/60 dark:text-text-secondary-dark/60'}">
            {i + 1}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-text dark:text-text-dark truncate">{row.title}</p>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate">{row.category}</p>
          </div>
          <div class="text-right shrink-0 tabular-nums">
            <span class="text-sm font-bold text-text dark:text-text-dark">{row.total}</span>
            {#if row.today > 0}
              <span class="ml-2 text-xs text-text-secondary dark:text-text-secondary-dark font-medium">
                {t('stats.colToday')} {row.today}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
