import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Site Intelligence Auditor',
  description: 'Evidence-first website audits for SEO, UX, performance, accessibility, trust and technical health.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
