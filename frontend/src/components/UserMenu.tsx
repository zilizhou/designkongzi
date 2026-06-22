"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getMe } from "@/lib/api";
import { logout, switchGuest } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export default function UserMenu() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-surface-2"
      >
        登录
      </Link>
    );
  }

  const initial = (me.display_name || "君").slice(0, 1);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="账户菜单"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-celadon font-serif text-sm text-celadon-deep hover:opacity-90"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg">
          <div className="border-b border-line px-3 py-2">
            <div className="font-serif text-sm text-fg">{me.display_name}</div>
            <div className="mt-0.5 text-[10px] text-faint">
              {me.is_guest ? "游客身份" : me.email || "正式账号"}
              {me.is_admin && (
                <span className="ml-1 rounded-full bg-accent-soft px-1.5 text-accent">admin</span>
              )}
            </div>
          </div>

          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2"
          >
            我的中心
          </Link>
          <Link
            href="/journey"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2"
          >
            君子之路
          </Link>

          <div className="my-1 border-t border-line" />

          {me.is_guest ? (
            <button
              onClick={() => {
                if (
                  confirm(
                    "换游客身份后，当前游客名下的进度（打卡/勋章/礼分/收藏）将无法找回。\n\n建议先在「我的中心」绑定邮箱再切换。\n\n确认换一个游客身份？",
                  )
                ) {
                  switchGuest("/");
                }
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2"
            >
              换一个游客身份
            </button>
          ) : (
            <button
              onClick={() => logout("/login")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft"
            >
              退出登录
            </button>
          )}
        </div>
      )}
    </div>
  );
}
