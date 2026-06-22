"use client";

import { getApiBase } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import {
  exportMe,
  getFavorites,
  getGamifyProfile,
  removeFavorite,
  upgradeAccount,
} from "@/lib/api";
import { clearToken, logout, setToken, switchGuest } from "@/lib/auth";
import type { Favorite, GamifyProfile } from "@/lib/types";


export default function MePage() {
  const [p, setP] = useState<GamifyProfile | null>(null);
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    getGamifyProfile().then(setP).catch(() => setMsg("无法连接后端 (8000)。"));
    getFavorites().then(setFavs).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const doUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      const r = await upgradeAccount(email, pw);
      setToken(r.token);
      setEmail("");
      setPw("");
      setMsg("✅ 升级成功，进度已保留。");
      load();
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
    a.download = "kongzi-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doDelete = async () => {
    if (!confirm("确认删除账户与全部数据？此操作不可撤销。")) return;
    await fetch(`${getApiBase()}/api/v1/auth/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("kongzi_token")}` },
    });
    clearToken();
    location.href = "/";
  };

  if (!p)
    return <div className="skeleton h-28 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-line bg-surface px-4 py-2 text-sm text-muted">
          {msg}
        </div>
      )}

      {/* 头像名片 */}
      <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-celadon font-serif text-2xl text-celadon-deep">
          君
        </span>
        <div className="flex-1">
          <div className="font-serif text-lg text-fg">{p.display_name}</div>
          <div className="text-xs text-faint">
            {p.level.name} · {p.level.xp} XP · 连续 {p.streak_days} 天
            {p.is_guest && (
              <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-faint">游客</span>
            )}
          </div>
        </div>
      </section>

      {/* 游客升级 */}
      {p.is_guest && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-1 text-sm font-medium text-fg">升级为正式账号</div>
          <div className="mb-3 text-xs text-faint">绑定邮箱后进度可跨设备同步，当前进度全部保留。</div>
          <form onSubmit={doUpgrade} className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="密码（≥6 位）"
              className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
            <button className="rounded-lg bg-accent px-4 py-2 text-sm text-white">升级</button>
          </form>
        </section>
      )}

      {/* 勋章墙摘要 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">
          勋章墙 · {p.badges.filter((b) => b.unlocked).length}/{p.badges.length}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.badges.map((b) => (
            <span
              key={b.id}
              title={b.desc}
              className={`rounded-full px-3 py-1 text-xs ${
                b.unlocked
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-surface-2 text-faint opacity-60"
              }`}
            >
              {b.unlocked ? "🏅" : "🔒"} {b.name}
            </span>
          ))}
        </div>
      </section>

      {/* 收藏夹 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">收藏夹 · {favs.length}</div>
        {favs.length === 0 ? (
          <div className="text-xs text-faint">还没有收藏。在「读一读」点 ☆ 收藏经典。</div>
        ) : (
          <div className="space-y-2">
            {favs.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2"
              >
                <span className="flex-1 truncate font-serif text-sm text-fg">
                  {f.label || f.ref}
                </span>
                <span className="text-[10px] text-faint">{f.type}</span>
                <button
                  onClick={async () => {
                    await removeFavorite(f.id);
                    setFavs((x) => x.filter((y) => y.id !== f.id));
                  }}
                  className="text-xs text-faint hover:text-accent"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 登录状态 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">登录状态</div>
        <div className="flex flex-wrap gap-2">
          {p.is_guest ? (
            <button
              onClick={() => {
                if (
                  confirm(
                    "换游客身份后，当前游客名下的进度（打卡/勋章/礼分/收藏）将无法找回。\n\n建议先绑定邮箱再切换。\n\n确认换一个游客身份？",
                  )
                ) {
                  switchGuest("/");
                }
              }}
              className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-surface-2"
            >
              换一个游客身份
            </button>
          ) : (
            <button
              onClick={() => logout("/login")}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
            >
              退出登录
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-faint">
          {p.is_guest
            ? "游客身份的进度只保存在当前浏览器，清缓存或换设备会丢失。绑定邮箱可跨设备恢复。"
            : "退出后可在登录页用邮箱+密码重新登录恢复进度。"}
        </p>
      </section>

      {/* 数据与隐私 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">数据与隐私</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={doExport}
            className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-surface-2"
          >
            导出我的数据 (GDPR/CCPA)
          </button>
          <button
            onClick={doDelete}
            className="rounded-lg border border-line px-4 py-2 text-sm text-accent hover:bg-accent-soft"
          >
            删除账户与数据
          </button>
        </div>
        <p className="mt-2 text-[10px] text-faint">
          删除账户不可逆。如果只是想换账号，请选「{p.is_guest ? "换一个游客身份" : "退出登录"}」。
        </p>
      </section>
    </div>
  );
}
