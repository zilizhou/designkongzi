import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Tracker from "@/components/Tracker";

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif-en",
  display: "swap",
});

export const metadata: Metadata = {
  title: "切问近思",
  description: "可溯源、可核验、可演练的儒家经典交互学习系统",
  applicationName: "切问近思",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EDE6D6",
};

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
      <body
        className={`${notoSerif.variable} ${sourceSerif.variable} qx-paper min-h-screen bg-bg font-sans text-fg antialiased`}
      >
        <Tracker />
        <Nav />
        <main className="qx-shell">{children}</main>
      </body>
    </html>
  );
}
