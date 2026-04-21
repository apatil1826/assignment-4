import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weather Tracker",
  description: "Realtime weather tracker with Supabase, Railway, and Open-Meteo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
