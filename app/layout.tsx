import type { Metadata } from "next";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voucher Starter (A4 Single Template)",
  description: "Supabase + Next.js 기반 교환권 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#ffffff',
        color: '#333333'
      }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
