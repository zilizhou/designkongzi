"use client";

import { getApiBase } from "@/lib/apiBase";

import { useState } from "react";
import { applyForApi, getDeveloperMe } from "@/lib/api";
import type { DeveloperMe } from "@/lib/types";


export default function DevelopersPage() {
  const [form, setForm] = useState({ name: "", country: "", contact_email: "", purpose: "" });
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [dash, setDash] = useState<DeveloperMe | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeKey, setProbeKey] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await applyForApi(form);
      setApiKey(r.api_key);
      setMsg(r.message);
      if (r.api_key) {
        setProbeKey(r.api_key);
        getDeveloperMe(r.api_key).then(setDash).catch(() => {});
      }
    } catch {
      setMsg("申请失败：请检查后端是否已启动 (8000)。");
    } finally {
      setBusy(false);
    }
  };

  const loadDashboard = async () => {
    if (!probeKey) return;
    try {
      const d = await getDeveloperMe(probeKey);
      setDash(d);
    } catch {
      setMsg("Key 无效或后端不可达");
    }
  };

  return (
    <div className="space-y-6">
      {/* 概览 */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="text-xs tracking-widest text-accent">开放接口 · Developers</div>
        <h1 className="mt-1 font-serif text-2xl text-fg">
          为海外教育与文化机构提供的儒家语义 API
        </h1>
        <p className="mt-2 text-sm text-muted">
          申报书目标①：向不少于 20 家海外教育及文化机构提供首批开放接口测试服务。
          下方一键申请，自动审批并发 Demo Key，立即可联调。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5">配额 10,000 / 月</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5">限速 60 / 分钟</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5">5 语支持</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5">可追溯出处</span>
        </div>
      </section>

      {/* 申请 */}
      <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <div className="text-sm font-medium text-fg">申请 API Key</div>
          <Input label="机构名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="国家 / 地区" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <Input
            label="联系邮箱"
            type="email"
            value={form.contact_email}
            onChange={(v) => setForm({ ...form, contact_email: v })}
            required
          />
          <label className="block text-xs text-muted">
            用途说明
            <textarea
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              rows={2}
              placeholder="教学 / 研究 / 跨文化对话 / 海外华文教育…"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "申请中…" : "提交申请并获取 Key"}
          </button>
          {msg && <div className="text-xs text-muted">{msg}</div>}
        </form>

        {/* Key 显示与快速联调 */}
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <div className="text-sm font-medium text-fg">您的 API Key</div>
          {apiKey ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-gold bg-accent-soft p-3">
                <div className="break-all font-mono text-sm text-accent-ink">{apiKey}</div>
                <div className="mt-1 text-[10px] text-accent">
                  ⚠ 仅显示一次，请立即复制保存
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(apiKey)}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-surface-2"
              >
                复制 Key
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                若已有 Key，可在下方粘贴查看用量。否则左侧填写申请。
              </p>
              <input
                value={probeKey}
                onChange={(e) => setProbeKey(e.target.value)}
                placeholder="粘贴 kz_… 查询用量"
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
              />
              <button
                onClick={loadDashboard}
                disabled={!probeKey}
                className="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:bg-surface-2 disabled:opacity-40"
              >
                查询
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 用量看板 */}
      {dash && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-sm font-medium text-fg">
            {dash.institution.name}（{dash.institution.country || "—"}） · 用量看板
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Metric label="今日调用" value={dash.stats.used_today} />
            <Metric label="近 7 天" value={dash.stats.used_7d} />
            <Metric label="本月" value={dash.stats.used_month} />
            <Metric label={`月配额`} value={dash.institution.monthly_quota} />
          </div>
          <div className="mt-3 text-xs text-faint">
            限速：{dash.rate_limit} · 状态：{dash.institution.status}
          </div>
          {dash.stats.top_paths.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-faint">7 天热门接口</div>
              <div className="space-y-1">
                {dash.stats.top_paths.map((p) => (
                  <div key={p.path} className="flex items-center justify-between text-xs">
                    <code className="text-muted">{p.path}</code>
                    <span className="text-faint">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* SDK 快速入门 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">快速入门</div>
        <div className="space-y-3">
          <CodeBlock title="curl" code={`curl -H "X-API-Key: $KEY" \\
  "${getApiBase()}/api/v1/public/search?q=克己复礼&lang=en"`} />
          <CodeBlock title="JavaScript (fetch)" code={`const r = await fetch("${getApiBase()}/api/v1/public/cases?topic_id=climate", {
  headers: { "X-API-Key": process.env.KONGZI_KEY }
});
const data = await r.json();`} />
          <CodeBlock title="Python (requests)" code={`import requests
r = requests.get(
    "${getApiBase()}/api/v1/public/topics",
    headers={"X-API-Key": os.environ["KONGZI_KEY"]},
)
topics = r.json()`} />
        </div>
      </section>

      {/* 接口清单 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">已开放接口</div>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {[
            ["GET", "/public/whoami", "鉴权信息与配额"],
            ["GET", "/public/search?q=&lang=&k=", "语义检索（向量 + 5 语）"],
            ["GET", "/public/passages/{ref_id}", "经典原文五层信息"],
            ["GET", "/public/topics", "5 大全球议题列表"],
            ["GET", "/public/topics/{id}", "议题 + 5 文明对照立场"],
            ["GET", "/public/cases", "跨文明对话案例列表（已审）"],
            ["GET", "/public/cases/{id}", "案例详情"],
            ["GET", "/public/corpus/stats", "平台语料规模"],
          ].map(([m, p, d]) => (
            <div key={p} className="rounded-lg bg-surface-2/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">{m}</span>
                <code className="text-muted">{p}</code>
              </div>
              <div className="mt-1 text-faint">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Input({
  label, value, onChange, required, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2/40 px-3 py-2">
      <div className="font-serif text-xl text-fg">{value.toLocaleString()}</div>
      <div className="text-[10px] text-faint">{label}</div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="border-b border-line bg-surface-2/60 px-3 py-1 text-[10px] text-faint">
        {title}
      </div>
      <pre className="overflow-x-auto bg-surface-2/30 p-3 text-xs leading-relaxed text-fg">
        {code}
      </pre>
    </div>
  );
}
