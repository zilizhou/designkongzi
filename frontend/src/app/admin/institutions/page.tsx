"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getMe,
  issueKey,
  listInstitutions,
  updateInstitution,
} from "@/lib/api";
import type { AuthUser, InstitutionAdminItem } from "@/lib/types";

const STATUS = ["pending", "approved", "suspended", "rejected"] as const;

export default function AdminInstitutionsPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [items, setItems] = useState<InstitutionAdminItem[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [newKey, setNewKey] = useState<{ inst: number; key: string } | null>(null);

  const refresh = () => listInstitutions(filter || undefined).then(setItems).catch(() => {});

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
  }, []);
  useEffect(() => {
    if (me?.is_admin) refresh();
  }, [me, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (id: number, body: { status?: string; monthly_quota?: number }) => {
    setBusy(id);
    try {
      await updateInstitution(id, body);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const issue = async (id: number) => {
    setBusy(id);
    try {
      const r = await issueKey(id);
      setNewKey({ inst: id, key: r.key });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!me)
    return <div className="skeleton h-40 w-full rounded-2xl" />;

  if (!me.is_admin)
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-2 text-sm font-medium text-fg">需要管理员权限</div>
        <p className="text-xs text-muted">
          管理员通过邮箱白名单授予。如果你是被授权的管理员，请用对应邮箱登录。
        </p>
        {me.is_guest ? (
          <Link
            href="/login"
            className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            用管理员邮箱登录 →
          </Link>
        ) : (
          <div className="mt-3 text-xs text-muted">
            当前登录账号 <span className="font-mono">{me.email}</span> 不在管理员白名单。
            如需申请，请联系平台运营。
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 新 key 一次性提示 */}
      {newKey && (
        <div className="rounded-xl border border-gold bg-accent-soft p-3 text-sm">
          <div className="mb-1 text-xs text-accent">机构 #{newKey.inst} 新 Key（仅此一次显示）</div>
          <code className="break-all font-mono text-accent-ink">{newKey.key}</code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(newKey.key);
              setNewKey(null);
            }}
            className="ml-3 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-muted"
          >
            复制并关闭
          </button>
        </div>
      )}

      {/* 统计 */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["全部", ""],
          ["待审", "pending"],
          ["已审批", "approved"],
          ["暂停", "suspended"],
          ["拒绝", "rejected"],
        ].map(([label, val]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`rounded-xl border px-3 py-2 text-xs ${
              filter === val
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </section>

      {/* 列表 */}
      <section className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-faint">
            暂无机构
          </div>
        ) : (
          items.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-faint">#{i.id}</span>
                <div className="flex-1">
                  <div className="font-serif text-sm text-fg">
                    {i.name} <span className="text-xs text-faint">· {i.country || "—"}</span>
                  </div>
                  <div className="text-[10px] text-faint">
                    {i.contact_email} · 配额 {i.monthly_quota.toLocaleString()} · keys {i.key_count}
                    {i.purpose && <> · {i.purpose}</>}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    i.status === "approved"
                      ? "bg-cel-soft text-cel-ink"
                      : "bg-surface-2 text-faint"
                  }`}
                >
                  {i.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-faint">改状态：</span>
                {STATUS.map((s) => (
                  <button
                    key={s}
                    disabled={busy === i.id || i.status === s}
                    onClick={() => update(i.id, { status: s })}
                    className={`rounded-full px-2.5 py-1 text-[10px] ${
                      i.status === s
                        ? "bg-accent text-white"
                        : "border border-line text-muted hover:bg-surface-2"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-line" />
                <input
                  type="number"
                  defaultValue={i.monthly_quota}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n && n !== i.monthly_quota) update(i.id, { monthly_quota: n });
                  }}
                  className="w-24 rounded border border-line bg-surface-2 px-2 py-0.5 text-[10px]"
                />
                <span className="text-[10px] text-faint">配额/月</span>
                <button
                  disabled={busy === i.id || i.status !== "approved"}
                  onClick={() => issue(i.id)}
                  className="ml-auto rounded-full bg-accent px-3 py-1 text-[10px] text-white disabled:opacity-40"
                >
                  发新 Key
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
