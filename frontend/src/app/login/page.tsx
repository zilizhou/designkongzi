"use client";

import Link from "next/link";
import { useState } from "react";
import { loginByEmail } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await loginByEmail(email, pw);
      setToken(r.token);
      // 登录后跳到 /me 让用户看见自己的账号
      window.location.href = "/me";
    } catch {
      setErr("邮箱或密码错误。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pt-8">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="text-xs tracking-widest text-accent">登录</div>
        <h1 className="mt-1 font-serif text-2xl text-fg">登录已有账号</h1>
        <p className="mt-2 text-sm text-muted">
          原本是游客身份？打开「我的中心」绑定邮箱即可升级——
          升级后用此页面跨设备恢复进度。
        </p>
      </section>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <label className="block text-xs text-muted">
          邮箱
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            autoComplete="email"
          />
        </label>
        <label className="block text-xs text-muted">
          密码
          <input
            type="password"
            required
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="≥ 6 位"
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            autoComplete="current-password"
          />
        </label>
        {err && (
          <div className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "登录中…" : "登录"}
        </button>
      </form>

      <section className="rounded-2xl border border-line bg-surface-2/40 p-4 text-xs text-muted">
        <div className="mb-1 font-medium text-fg">还没账号？</div>
        <p className="leading-relaxed">
          不需要注册。直接{" "}
          <Link href="/" className="text-accent hover:underline">
            进入平台
          </Link>{" "}
          即自动获得游客身份并开始体验。任意时候在「我的中心」
          填邮箱+密码即可升级为正式账号，进度全部保留。
        </p>
      </section>
    </div>
  );
}
