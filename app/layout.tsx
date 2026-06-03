import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";

// Display family per DESIGN.md (Barlow for Latin headings; Pretendard fallback for CJK).
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KnowAI — AI 비교 콘텐츠 메이커",
  description: "AI 성능 비교 · 숏폼 콘텐츠 생성 툴",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${barlow.variable} h-full antialiased`}>
      <head>
        {/* Pretendard Variable (DESIGN.md body family) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
