import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/ui/LenisProvider";

export const metadata: Metadata = {
  title: "Primus — Prontidão Operacional",
  description:
    "Plataforma de prontidão operacional do centro cirúrgico. Verifique se ativos, salas e centros estão prontos para operar com segurança.",
  icons: {
    icon: "/idvisual/icon.webp?v=2",
    shortcut: "/idvisual/icon.webp?v=2",
    apple: "/idvisual/icon.webp?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F2F2F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/webp" href="/idvisual/icon.webp?v=2" />
        <link rel="apple-touch-icon" href="/idvisual/icon.webp?v=2" />
      </head>
      <body className="bg-fundo text-texto antialiased">
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
