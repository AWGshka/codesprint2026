import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { getDashboardStats } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import type { DonationCreatedEvent } from "~/shared/api";
import { createDonationEvents } from "~/shared/lib/useSSE";
import { Badge, Card, Chart, ErrorState, ProgressBar, Skeleton, StatCard } from "~/shared/ui";

const sourceBadgeVariant = { web: "neutral", kiosk: "positive" } as const;

const DashboardPage: Component = () => {
  const [stats, { refetch }] = createResource(getDashboardStats);
  const [liveFeed, setLiveFeed] = createSignal<DonationCreatedEvent[]>([]);
  const [liveTotal, setLiveTotal] = createSignal(0);

  const { connected } = createDonationEvents((event) => {
    setLiveFeed((prev) => [event, ...prev].slice(0, 10));
    setLiveTotal((n) => n + 1);
    refetch();
  });

  const totalEUR = createMemo(() => stats()?.totalEURMinor ?? 0);
  const donationCount = createMemo(() => stats()?.donationCount ?? 0);
  const avgGiftMinor = createMemo(() => (donationCount() > 0 ? Math.round(totalEUR() / donationCount()) : 0));

  // Last 30 days vs the 30 before, computed from the daily trend the API already returns —
  // money, gift count, and average gift each get their own period-over-period delta.
  const monthDelta = createMemo(() => {
    const trend = stats()?.trend ?? [];
    if (trend.length < 2) return undefined;
    const current = trend.slice(-30);
    const previous = trend.slice(-60, -30);
    const totals = (points: typeof trend) =>
      points.reduce((acc, p) => ({ total: acc.total + p.totalEURMinor, count: acc.count + p.count }), { total: 0, count: 0 });
    const cur = totals(current);
    const prev = totals(previous);
    const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : now > 0 ? 100 : 0);
    const avg = (x: { total: number; count: number }) => (x.count > 0 ? x.total / x.count : 0);
    return { currentTotal: cur.total, pct: pct(cur.total, prev.total), countPct: pct(cur.count, prev.count), avgPct: pct(avg(cur), avg(prev)) };
  });

  const deltaFor = (pct: number | undefined) => (pct === undefined ? undefined : { pct, label: t("dashboard.vsPrevious30") });

  const recentDonations = createMemo(() => {
    const fromEvents = liveFeed().map((e) => ({
      reference: e.reference,
      campaignName: e.campaignName,
      amountMinor: e.amountMinor,
      currency: e.currency,
      source: e.source,
      createdAt: e.createdAt,
    }));
    const fromServer = stats()?.recentDonations ?? [];
    const seen = new Set(fromEvents.map((d) => d.reference));
    return [...fromEvents, ...fromServer.filter((d) => !seen.has(d.reference))].slice(0, 10);
  });

  const trendChartData = createMemo(() => {
    const trend = stats()?.trend ?? [];
    return {
      labels: trend.map((p) => p.date.slice(5)),
      datasets: [
        {
          label: "EUR",
          data: trend.map((p) => p.totalEURMinor / 100),
          borderColor: "#0e8c7a",
          backgroundColor: "rgba(14,140,122,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    };
  });

  const byCampaignChartData = createMemo(() => {
    const top = stats()?.topCampaigns ?? [];
    return { labels: top.map((c) => c.name), datasets: [{ label: "EUR raised", data: top.map((c) => c.raisedEURMinor / 100), backgroundColor: "#0e8c7a" }] };
  });

  const byCurrencyChartData = createMemo(() => {
    const rows = stats()?.totalsByCurrency ?? [];
    return { labels: rows.map((r) => r.currency), datasets: [{ data: rows.map((r) => r.totalMinor), backgroundColor: ["#0e8c7a", "#1e6fb8", "#b23a6b"] }] };
  });

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="font-display text-h1 font-semibold text-fg">{t("dashboard.title")}</h1>
        <span class="inline-flex items-center gap-1.5 font-sans text-label text-fg-muted">
          <span class="relative inline-flex size-2">
            <span classList={{ "bg-live": connected(), "bg-border-strong": !connected() }} class="absolute inset-0 rounded-full" />
            <Show when={connected()}>
              <span class="absolute inset-0 animate-[gt-pulse_2s_ease-out_infinite] rounded-full bg-live" />
            </Show>
          </span>
          {connected() ? t("dashboard.live") : t("dashboard.connecting")}
        </span>
      </div>

      <Show
        when={stats() || !stats.loading}
        fallback={
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <For each={[0, 1, 2, 3]}>{() => <Skeleton variant="block" class="h-24" />}</For>
          </div>
        }>
        <Show when={!stats.error} fallback={<ErrorState error={stats.error} />}>
          {/* The four M2.3 headline stats: total raised, donations, average gift, progress vs goal. */}
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 transition-all duration-300">
            <StatCard label={t("dashboard.raisedThisMonth")} value={formatMoney(totalEUR(), "EUR")} delta={deltaFor(monthDelta()?.pct)} />
            <StatCard label={t("dashboard.donations")} value={donationCount() + liveTotal()} delta={deltaFor(monthDelta()?.countPct)} />
            <StatCard label={t("dashboard.avgGift")} value={formatMoney(avgGiftMinor(), "EUR")} delta={deltaFor(monthDelta()?.avgPct)} />
            <StatCard
              label={t("dashboard.progressVsGoal")}
              value={`${Math.round(stats()?.goalProgressPct ?? 0)}%`}
              live={connected()}
              hint={t("dashboard.ofGoal", { amount: formatMoney(stats()?.goalEURMinor ?? 0, "EUR") })}
            />
          </div>

          {/* Per-campaign progress lines (reference layout's large middle card). */}
          <Card padding="md" class="space-y-3">
            <h2 class="font-display text-h3 font-semibold text-fg">{t("dashboard.campaignProgress")}</h2>
            <For each={stats()?.topCampaigns ?? []}>
              {(c) => (
                <div class="space-y-1">
                  <div class="flex items-baseline justify-between gap-3 font-sans text-fs-sm">
                    <span class="min-w-0 truncate text-fg">{c.name}</span>
                    <span class="shrink-0 font-mono tabular-nums text-fg-muted">
                      {formatMoney(c.raisedEURMinor, "EUR")}
                      <Show when={c.targetEURMinor > 0}> · {Math.round((c.raisedEURMinor / c.targetEURMinor) * 100)}%</Show>
                    </span>
                  </div>
                  <ProgressBar value={c.targetEURMinor > 0 ? (c.raisedEURMinor / c.targetEURMinor) * 100 : 0} />
                </div>
              )}
            </For>
          </Card>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card padding="md">
              <h2 class="mb-3 font-display text-h3 font-semibold text-fg">{t("dashboard.donationsLast90Days")}</h2>
              <Chart
                type="line"
                data={trendChartData()}
                options={{
                  plugins: { legend: { display: false } },
                  // 90 daily labels are unreadable in this footprint — thin the axes out.
                  scales: { x: { ticks: { maxTicksLimit: 6, maxRotation: 0, autoSkip: true }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4 } } },
                }}
                class="h-40"
              />
            </Card>
            <div class="flex flex-col gap-4">
              <Card padding="md">
                <h2 class="mb-3 font-display text-h3 font-semibold text-fg">{t("dashboard.byCampaign")}</h2>
                <Chart type="bar" data={byCampaignChartData()} options={{ plugins: { legend: { display: false } } }} class="h-32" />
              </Card>
              <Card padding="md" class="flex items-center gap-4">
                <Chart type="doughnut" data={byCurrencyChartData()} options={{ plugins: { legend: { display: false } } }} class="h-20! w-20!" height={80} />
                <div>
                  <p class="font-sans text-fs-sm font-semibold text-fg">{t("dashboard.byCurrency")}</p>
                  <For each={stats()?.totalsByCurrency ?? []}>
                    {(row) => (
                      <p class="font-mono text-label tabular-nums text-fg-muted">
                        {row.currency}: {formatMoney(row.totalMinor, row.currency)}
                      </p>
                    )}
                  </For>
                </div>
              </Card>
            </div>
          </div>

          <Card padding="md">
            <h2 class="mb-3 font-display text-h3 font-semibold text-fg">{t("dashboard.recent")}</h2>
            <div class="divide-y divide-border">
              <For each={recentDonations()} fallback={<p class="py-3 font-sans text-fs-sm text-fg-muted">-</p>}>
                {(d) => (
                  <div class="flex items-center justify-between py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="relative inline-flex size-1.5 rounded-full bg-live" />
                      <span class="font-sans text-fs-sm text-fg">{d.campaignName}</span>
                      <Badge variant={sourceBadgeVariant[d.source]} icon={false}>
                        {d.source}
                      </Badge>
                    </div>
                    <span class="font-mono text-fs-sm tabular-nums text-fg">{formatMoney(d.amountMinor, d.currency)}</span>
                  </div>
                )}
              </For>
            </div>
          </Card>
        </Show>
      </Show>
    </div>
  );
};

export default DashboardPage;
