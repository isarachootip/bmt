import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BMT – Technician Payment Service',
  description: 'ระบบบริหารบัญชีและทำจ่ายเงินให้ช่าง (Builder Management)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
