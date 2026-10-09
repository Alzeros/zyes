<script lang="ts">
  import { t } from '../lib/i18n';
  import { dayKey } from '../lib/api';
  import type { Bookmark, Category, ClickStatRow } from '../lib/types';

  // Read-only view over the click-stats feed. All aggregation is derived:
  // the parent (App) owns the rows and refreshes them via onrefreshStats
  // whenever this panel opens, so the numbers here are always fresh-on-open.
  let {
    statsRows,
    bookmarks,
    categories,
  }: {
    statsRows: ClickStatRow[];
    bookmarks: Bookmark[];
    categories: Category[];
  } = $props();

  // Join helpers: stats rows reference card ids; deleted bookmarks' rows are
  // dropped here (the store keeps them as harmless orphans).
  let cardById = $derived(new Map(bookmarks.map((b) => [b.id, b])));
  let catNameById = $derived(new Map(categories.map((c) => [c.id, c.name])));

  // "Today" = the viewer's local calendar day, consistent with what reportClick
  // stored. Snapshotted at mount; the panel remounts on each open (v-if in
  // SettingsModal), so every open re-reads the clock.
  let todayKey = $derived(dayKey());

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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  // streak: consecutive days with ≥1 click, ending today — or yesterday when
  // today hasn't been clicked yet (so the badge doesn't reset at midnight).
  let streak = $derived.by(() => {
    const now = new Date();
    const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  const CAT_COLORS = ['bg-primary', 'bg-primary/70', 'bg-primary/50', 'bg-primary/35', 'bg-primary/25'];

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

  // 5-step colour ramp, primary-tinted so it tracks the site theme in both
  // light and dark mode. 0 = neutral track colour.
  function heatCls(count: number): string {
    if (count <= 0) return 'bg-border/50 dark:bg-border-dark/50';
    const ratio = count / heatMax;
    if (ratio <= 0.25) return 'bg-primary/25';
    if (ratio <= 0.5) return 'bg-primary/45';
    if (ratio <= 0.75) return 'bg-primary/70';
    return 'bg-primary';
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
    <div class="rounded-xl border border-border dark:border-border-dark p-3 text-center">
      <p class="text-xl font-bold text-primary">{todayAll}</p>
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">{t('stats.todayAll')}</p>
    </div>
    <div class="rounded-xl border border-border dark:border-border-dark p-3 text-center">
      <p class="text-xl font-bold text-primary">{totalAll}</p>
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">{t('stats.totalAll')}</p>
    </div>
    <div class="rounded-xl border border-border dark:border-border-dark p-3 text-center">
      <p class="text-xl font-bold text-primary">{activeCards}</p>
      <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">{t('stats.activeCards')}</p>
    </div>
  </div>

  <!-- ── Heatmap + metrics + categories ────────────────────────────────── -->
  <!-- Left: the heatmap card owns the column and spans both rows. Right: a
       metric tile strip above the category card. One dominant card plus two
       compact companions reads far better than three equal boxes holding
       very unequal amounts of content. Stacks on narrow panels. The tooltip
       anchors to this SECTION (not the w-max heatmap card): the card can be
       narrower than the bubble itself, so the section is the only coordinate
       space wide enough to host + clamp it. -->
  <section class="mb-6 relative" bind:this={heatHostEl}>
    <div class="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3">
      <!-- Heatmap card: title + span badge, weekday header row, then one row
           per week. The window is a fixed 5 weeks (see heatRows), and the big
           cells fill the card edge-to-edge at any data age. -->
      <div class="md:row-span-2 relative rounded-xl border border-border dark:border-border-dark p-3.5 overflow-hidden flex flex-col">
        <div class="flex items-baseline justify-between mb-2">
          <p class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.heat')}</p>
          <span class="text-[10px] tabular-nums text-text-secondary/70 dark:text-text-secondary-dark/70">
            {t('stats.weeks', { n: String(HEAT_WEEKS) })}
          </span>
        </div>
        <div class="flex-1 flex items-center justify-center min-h-0">
          <div class="w-max" onmouseleave={onHeatLeave} role="presentation">
            <!-- Weekday header: one label per column (Mon → Sun) -->
            <div class="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
              {#each WEEKDAY_KEYS as wdKey}
                <div class="w-9 h-4 flex items-center justify-center text-[10px] leading-none text-text-secondary/70 dark:text-text-secondary-dark/70">
                  {t(wdKey)}
                </div>
              {/each}
            </div>
            <div class="grid grid-cols-7 gap-1">
              {#each heatRows as row}
                {#each row as cell}
                  {#if cell === null}
                    <div class="w-9 h-9 rounded-md opacity-0"></div>
                  {:else}
                    <div
                      class="w-9 h-9 rounded-md {heatCls(cell.count)} hover:ring-1 hover:ring-primary/60 cursor-default"
                      role="presentation"
                      onmouseenter={(e) => onHeatEnter(e, cell)}
                    ></div>
                  {/if}
                {/each}
              {/each}
            </div>
          </div>
        </div>
        <div class="flex items-center justify-center gap-1 mt-2 text-[10px] text-text-secondary dark:text-text-secondary-dark">
          <span>{t('stats.less')}</span>
          <span class="w-3 h-3 rounded-[3px] bg-border/50 dark:bg-border-dark/50"></span>
          <span class="w-3 h-3 rounded-[3px] bg-primary/25"></span>
          <span class="w-3 h-3 rounded-[3px] bg-primary/45"></span>
          <span class="w-3 h-3 rounded-[3px] bg-primary/70"></span>
          <span class="w-3 h-3 rounded-[3px] bg-primary"></span>
          <span>{t('stats.more')}</span>
        </div>
      </div>

      <!-- Metric tiles: three compact figure/label pairs sharing one flat card,
           echoing the summary tiles above at a smaller scale. -->
      <div class="rounded-xl border border-border dark:border-border-dark grid grid-cols-3 divide-x divide-border dark:divide-border-dark">
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-primary tabular-nums">
            {streak}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.daysUnit')}</span>
          </span>
          <span class="text-[10px] text-text-secondary dark:text-text-secondary-dark">{t('stats.streak')}</span>
        </div>
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-primary tabular-nums">
            {bestDay}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.clicksUnit')}</span>
          </span>
          <span class="text-[10px] text-text-secondary dark:text-text-secondary-dark">{t('stats.bestDay')}</span>
        </div>
        <div class="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
          <span class="text-lg font-bold text-primary tabular-nums">
            {last7}<span class="ml-0.5 text-[10px] font-medium text-text-secondary dark:text-text-secondary-dark">{t('stats.clicksUnit')}</span>
          </span>
          <span class="text-[10px] text-text-secondary dark:text-text-secondary-dark">{t('stats.last7')}</span>
        </div>
      </div>

      <!-- Category card: one always-full stacked bar + legend rows (name,
           share, count). Beyond 3 rows the legend switches to two columns. -->
      <div class="rounded-xl border border-border dark:border-border-dark p-3.5 flex flex-col">
        <p class="text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-2">{t('stats.byCategory')}</p>
        <div class="flex h-2 rounded-full overflow-hidden bg-bg dark:bg-bg-dark">
          {#each perCat as row, i (row.name)}
            <div class="h-full {CAT_COLORS[i]}" style="flex-grow:{row.n}"></div>
          {/each}
        </div>
        <ul class="flex-1 grid content-center gap-x-3 gap-y-1.5 mt-2.5 list-none p-0 {perCat.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}">
          {#each perCat as row, i (row.name)}
            <!-- Two-column cells are narrow: keep name + share, drop the raw -->
            <!-- count (it's what the bar shows anyway) so names don't clip. -->
            <li class="flex items-center gap-2 text-xs">
              <span class="w-2 h-2 rounded-full shrink-0 {CAT_COLORS[i]}"></span>
              <span class="flex-1 min-w-0 truncate text-text dark:text-text-dark">{row.name}</span>
              <span class="shrink-0 tabular-nums text-text-secondary dark:text-text-secondary-dark">{row.pct}%</span>
              {#if perCat.length <= 3}
                <span class="shrink-0 w-7 text-right tabular-nums font-semibold text-primary">{row.n}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    {#if heatTip}
      <!-- Anchored above the hovered cell, centred via translate(-50%,-100%).
           Lives at SECTION level: the heatmap card can be narrower than the
           bubble, so the section is the clamp + render space. -->
      <div
        class="absolute z-20 px-2.5 py-1.5 rounded-lg bg-neutral-900/95 dark:bg-black/90 text-white text-xs leading-snug shadow-lg pointer-events-none whitespace-nowrap"
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
    <div class="rounded-xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark overflow-hidden">
      {#each top as row, i (row.id)}
        <div class="flex items-center gap-3 px-3 py-2.5">
          <span class="w-6 text-center text-sm font-bold text-text-secondary/70 dark:text-text-secondary-dark/70 shrink-0">
            {i + 1}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-text dark:text-text-dark truncate">{row.title}</p>
            <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate">{row.category}</p>
          </div>
          <div class="text-right shrink-0 tabular-nums">
            <span class="text-sm font-semibold text-primary">{row.total}</span>
            {#if row.today > 0}
              <span class="ml-2 text-xs text-text-secondary dark:text-text-secondary-dark">
                {t('stats.colToday')} {row.today}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
