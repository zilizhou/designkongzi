import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Tracker from "@/components/Tracker";

export const metadata: Metadata = {
  title: "孔子 · 儒家语义交互平台",
  description: "多终端、多语言、多智能体的儒家经典语义交互平台",
};

// 无闪烁主题：在 React 注水前根据偏好设置 dark 类
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <Tracker />
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-6 pb-20 md:pb-6">{children}</main>
      </body>
    </html>
  );
}
