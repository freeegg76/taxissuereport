import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
