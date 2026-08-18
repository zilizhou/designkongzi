"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MockMark from "@/components/qiewen/MockMark";
import { exportMe, getFavorites, getGamifyProfile, upgradeAccount } from "@/lib/api";
import { getApiBase } from "@/lib/apiBase";
import { clearToken, logout, setToken, switchGuest } from "@/lib/auth";
import { MOCK_ARCHIVE } from "@/lib/qiewen/mock";
import type { Favorite, GamifyProfile } from "@/lib/types";

export default function MePage() {
  const [p, setP] = useState<GamifyProfile | null>(null);
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    getGamifyProfile().then(setP).catch(() => {});
    getFavorites().then(setFavs).catch(() => {});
  }, []);

  const doUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await upgradeAccount(email, pw);
      setToken(r.token);
      setMsg("升级成功，进度已保留。");
      getGamifyProfile().then(setP);
    } catch {
      setMsg("升级失败：邮箱可能已被注册。");
    }
  };

  const doExport = async () => {
    const data = await exportMe();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qiewen-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doDelete = async () => {
    if (!confirm("确认删除账户与全部数据？")) return;
    await fetch(`${getApiBase()}/api/v1/auth/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("kongzi_token")}` },
    });
    clearToken();
    location.href = "/";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] tracking-[0.32em] text-accent">学习档案</p>
          <MockMark />
        </div>
        <h1 className="mt-2 font-serif text-3xl text-fg">
          {p?.display_name || "来学者"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          只记已读出处、核验警示和演练复盘。不把游客分数当成用户规模。
        </p>
      </div>

      <section className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-paper">
        <h2 className="font-serif text-lg text-fg">已读出处</h2>
        <div className="mt-3 space-y-2">
          {MOCK_ARCHIVE.reads.map((r) => (
            <Link
              key={r.ref_id}
              href={`/read?ref=${r.ref_id}`}
              className="block rounded-xl bg-surface-2 px-4 py-3 hover:bg-accent-soft"
            >
              <div className="text-[11px] text-faint">{r.label}</div>
              <div className="font-serif text-fg">{r.text}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-line bg-surface p-5">
        <h2 className="font-serif text-lg text-fg">核验警示</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {MOCK_ARCHIVE.warnings.map((w) => (
            <li key={w.text} className="rounded-xl bg-surface-2 px-4 py-3">
              {w.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.4rem] border border-line bg-surface p-5">
        <h2 className="font-serif text-lg text-fg">演练记录</h2>
        <div className="mt-3 space-y-2">
          {MOCK_ARCHIVE.practices.map((x) => (
            <Link
              key={x.title}
              href={x.href}
              className="block rounded-xl bg-accent-soft px-4 py-3"
            >
              <div className="font-serif text-accent-ink">{x.title}</div>
              <div className="mt-1 text-sm text-accent">{x.verdict}</div>
            </Link>
          ))}
        </div>
      </section>

      {favs.length > 0 && (
        <section className="rounded-[1.4rem] border border-line bg-surface p-5">
          <h2 className="font-serif text-lg text-fg">收藏 · {favs.length}</h2>
          <div className="mt-3 space-y-2 text-sm">
            {favs.map((f) => (
              <div key={f.id} className="font-serif text-fg">{f.label || f.ref}</div>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAccountOpen((o) => !o)}
        className="text-xs text-faint hover:text-muted"
      >
        {accountOpen ? "收起账户与隐私" : "账户与隐私"}
      </button>

      {accountOpen && (
        <section className="space-y-3 rounded-[1.4rem] border border-line bg-surface p-5 text-sm">
          {msg && <p className="text-muted">{msg}</p>}
          {p?.is_guest && (
            <form onSubmit={doUpgrade} className="flex flex-wrap gap-2">
              <input className="flex-1 rounded-lg border border-line px-3 py-2" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="flex-1 rounded-lg border border-line px-3 py-2" type="password" placeholder="密码" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button className="rounded-lg bg-accent px-3 py-2 text-white">升级</button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {p?.is_guest ? (
              <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => switchGuest("/")}>
                换游客身份
              </button>
            ) : p ? (
              <button type="button" className="rounded-lg bg-accent px-3 py-2 text-white" onClick={() => logout("/login")}>
                退出
              </button>
            ) : null}
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => void doExport()}>
              导出数据
            </button>
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-accent" onClick={() => void doDelete()}>
              删除账户
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
