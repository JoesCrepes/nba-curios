import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shared Taste',
  description: 'Find out which songs your group all loves on Spotify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
