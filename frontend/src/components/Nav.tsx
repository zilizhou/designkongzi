"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LangSwitcher from "./LangSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { t, useLang } from "@/lib/i18n";

const PRIMARY = [
  { href: "/chat", key: "nav.ask", icon: "M4 5h16v11H8l-4 4z" },
  { href: "/journey/li", key: "nav.practice", icon: "M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { href: "/me", key: "nav.me", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
];

const CANON = [
  { href: "/read", key: "nav.read" },
  { href: "/graph", key: "nav.graph" },
];

const MORE = [
  { href: "/journey", key: "nav.journey" },
  { href: "/cases", key: "nav.cases" },
  { href: "/design", key: "nav.studio" },
  { href: "/feed", key: "nav.feed" },
  { href: "/developers", key: "nav.developers" },
];

function active(path: string, href: string) {
  if (href === "/chat") return path.startsWith("/chat");
  if (href === "/journey/li") return path.startsWith("/journey/li");
  return path.startsWith(href);
}

export default function Nav() {
  const path = usePathname();
  const [lang] = useLang();
  const [open, setOpen] = useState<"canon" | "more" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const immersive = path.startsWith("/journey/li") && path.includes("play");

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (immersive) return null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="qx-mark flex h-8 w-8 items-center justify-center text-[17px] leading-none">
              问
            </span>
            <span className="font-serif text-[17px] font-medium tracking-[0.18em] text-fg">
              {t("brand.title", lang)}
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-0.5 lg:flex" ref={menuRef}>
            {PRIMARY.slice(0, 2).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-[13px] tracking-wide transition ${
                  active(path, l.href)
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t(l.key, lang)}
              </Link>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen(open === "canon" ? null : "canon")}
                className={`rounded-full px-3.5 py-1.5 text-[13px] tracking-wide transition ${
                  CANON.some((l) => active(path, l.href))
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t("nav.canon", lang)}
              </button>
              {open === "canon" && (
                <div className="absolute left-0 top-full z-40 mt-2 min-w-[8.5rem] rounded-xl border border-line bg-surface p-1 shadow-paper">
                  {CANON.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(null)}
                      className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      {t(l.key, lang)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/me"
              className={`rounded-full px-3.5 py-1.5 text-[13px] tracking-wide transition ${
                active(path, "/me")
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {t("nav.me", lang)}
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen(open === "more" ? null : "more")}
                className="rounded-full px-3.5 py-1.5 text-[13px] text-faint hover:bg-surface-2 hover:text-muted"
              >
                {t("nav.more", lang)}
              </button>
              {open === "more" && (
                <div className="absolute left-0 top-full z-40 mt-2 min-w-[9rem] rounded-xl border border-line bg-surface p-1 shadow-paper">
                  {MORE.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(null)}
                      className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      {t(l.key, lang)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LangSwitcher compact />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[3.6rem] border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {PRIMARY.map((l) => {
          const on = active(path, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] tracking-wide ${
                on ? "text-accent" : "text-faint"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={l.icon} />
              </svg>
              {t(l.key, lang)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
