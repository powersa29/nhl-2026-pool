import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'NHL 2026 Playoff Pool',
  description: 'Build your 16-team roster. Points roll in live from every playoff game.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <div className="app">
          <Header />
          {children}
          <footer style={{ marginTop: 40, paddingTop: 20, borderTop: '2px dashed var(--line)', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            NHL 2026 Playoff Pool · Stats via NHL.com · Built for bragging rights 🏆
          </footer>
        </div>
      </body>
    </html>
  );
}
