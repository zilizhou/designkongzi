"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LangSwitcher from "./LangSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { t, useLang } from "@/lib/i18n";

const LINKS = [
  { href: "/",        key: "nav.home",    tab: true,  icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/feed",    key: "nav.feed",    tab: true,  icon: "M4 4h16v7H4zM4 13h16v7H4z" },
  { href: "/read",    key: "nav.read",    tab: true,  icon: "M4 5h7v15H4zM13 5h7v15h-7z" },
  { href: "/graph",   key: "nav.graph",   tab: false, icon: "M5 6a2 2 0 100-1 2 2 0 000 1zM19 18a2 2 0 100-1 2 2 0 000 1zM7 7l10 10" },
  { href: "/chat",    key: "nav.chat",    tab: true,  icon: "M4 5h16v11H8l-4 4z" },
  { href: "/cases",   key: "nav.cases",   tab: false, icon: "M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" },
  { href: "/developers", key: "nav.developers", tab: false, icon: "M8 9l-4 3 4 3M16 9l4 3-4 3M14 6l-4 12" },
  { href: "/co-create", key: "nav.cocreate", tab: false, icon: "M12 4v16M4 12h16" },
  { href: "/plugins",   key: "nav.plugins",  tab: false, icon: "M9 3v6H3v6h6v6h6v-6h6V9h-6V3z" },
  { href: "/reach",     key: "nav.reach",    tab: false, icon: "M3 17l6-6 4 4 8-8" },
  { href: "/journey", key: "nav.journey", tab: false, icon: "M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { href: "/me",      key: "nav.me",      tab: true,  icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
];
const TAB = LINKS.filter((l) => l.tab);

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export default function Nav() {
  const path = usePathname();
  const [lang] = useLang();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="seal flex h-8 w-8 items-center justify-center rounded-md text-lg">
              孔
            </span>
            <span className="font-serif text-base font-medium text-fg">
              <span className="hidden sm:inline">{t("brand.title", lang)}</span>
              <span className="sm:hidden">{t("brand.short", lang)}</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active(path, l.href)
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-2"
                }`}
              >
                {t(l.key, lang)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <LangSwitcher />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-14 border-t border-line bg-bg/95 backdrop-blur md:hidden">
        {TAB.map((l) => {
          const on = active(path, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
                on ? "text-accent" : "text-faint"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
