import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "교환권 관리 시스템",
  description: "Supabase + Next.js 기반 교환권 시스템",
  applicationName: "교환권",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "교환권",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <PWARegister />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
