import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyWords (Standalone)',
  description: 'Standalone dictionary + thesaurus app for direct word lookup.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
