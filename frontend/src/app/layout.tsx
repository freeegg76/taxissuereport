import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "세무 AI 어시스턴트",
  description: "판례 기반 세무 이슈 분석 보고서 자동 생성 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      {/* FOUC 방지: React hydration 전에 저장된 테마 즉시 적용 */}
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className="h-full flex bg-[var(--clr-bg)] text-[var(--clr-text)]">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-h-screen bg-[var(--clr-bg)]">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
