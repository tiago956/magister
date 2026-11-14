import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Magister", template: "%s · Magister" },
  description: "Sistema pedagógico da Trinitas Escola Cristã Clássica",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-cinza-claro text-carvao antialiased">{children}</body>
    </html>
  );
}
