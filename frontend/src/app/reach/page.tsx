"use client";

import { useEffect, useState } from "react";
import { getReachStats } from "@/lib/api";
import type { ReachStats } from "@/lib/types";

export default function ReachPage() {
  const [s, setS] = useState<ReachStats | null>(null);

  useEffect(() => {
    getReachStats().then(setS).catch(() => {});
  }, []);

  if (!s)
    return <div className="skeleton h-40 w-full rounded-2xl" />;

  const pct = (n: number, target: number) =>
    Math.min(100, (n / target) * 100);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="text-xs tracking-widest text-accent">传播覆盖 · Reach</div>
        <h1 className="mt-1 font-serif text-xl text-fg">
          申报书目标③ · 5 万师生参与 / 50 万人次覆盖
        </h1>
        <p className="mt-1 text-xs text-muted">
          基于平台匿名埋点的实时度量。校园终端 / 插件嵌入 / 二维码扫码 / 直接访问全部计入。
        </p>
      </section>

      {/* 主指标 */}
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Goal
          label="累计独立访客 UV"
          value={s.uv}
          target={s.targets.users_5w}
          targetLabel="5 万师生"
          recent={`30 天 ${s.uv_30d.toLocaleString()}`}
        />
        <Goal
          label="累计访问 PV"
          value={s.pv}
          target={s.targets.reach_50w}
          targetLabel="50 万人次"
          recent={`今日 ${s.pv_today} · 7 天 ${s.pv_7d.toLocaleString()}`}
        />
        <Goal
          label="海外覆盖 PV"
          value={s.overseas_pv}
          target={s.targets.reach_50w}
          targetLabel="50 万人次"
          recent={`海外 UV ${s.overseas_uv} · 占比 ${s.pv ? ((s.overseas_pv / s.pv) * 100).toFixed(1) : 0}%`}
        />
      </section>

      {/* 分布 */}
      <section className="grid gap-3 md:grid-cols-2">
        <Distribution title="终端分布" rows={s.by_device} />
        <Distribution title="来源分布" rows={s.by_source} />
        <Distribution
          title="国家/地区分布"
          rows={s.by_country.map((c) => ({ k: `${c.name} (${c.k})`, v: c.v }))}
        />
        <Distribution title="校园来源" rows={s.by_campus.length ? s.by_campus : [{ k: "暂无（kiosk?campus= 上线后可见）", v: 0 }]} />
        <Distribution title="热门路径" rows={s.by_path} />
      </section>
    </div>
  );

  function Goal({
    label,
    value,
    target,
    targetLabel,
    recent,
  }: {
    label: string;
    value: number;
    target: number;
    targetLabel: string;
    recent: string;
  }) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-end gap-4">
          <div>
            <div className="font-serif text-3xl font-medium text-fg">
              {value.toLocaleString()}
            </div>
            <div className="text-xs text-faint">{label}</div>
          </div>
          <div className="ml-auto text-right text-xs text-faint">
            目标 {target.toLocaleString()} · {targetLabel}
            <br />
            {recent}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${pct(value, target)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-faint">
          {pct(value, target).toFixed(3)}%
        </div>
      </div>
    );
  }

  function Distribution({
    title,
    rows,
  }: {
    title: string;
    rows: { k: string; v: number }[];
  }) {
    const max = Math.max(...rows.map((r) => r.v), 1);
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 text-xs text-faint">{title}</div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-muted">{r.k}</span>
              <div className="relative h-2 flex-1 rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${(r.v / max) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-faint">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
