'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  ['/', 'Standings'],
  ['/signup', 'Sign Up'],
  ['/rounds', 'Rounds'],
  ['/rules', 'Rules'],
];

export default function Header() {
  const path = usePathname();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('pool-theme');
    const isDark = saved !== null ? saved === 'dark' : true;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('pool-theme', next ? 'dark' : 'light');
  };

  const isActive = (href: string) => href === '/' ? path === '/' : path.startsWith(href);

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="12" rx="9" ry="4" />
            <ellipse cx="12" cy="10" rx="9" ry="4" />
            <path d="M3 10v2M21 10v2" />
          </svg>
        </div>
        <div>
          <div className="brand-name">NHL 2026 Playoff Pool</div>
          <div className="brand-sub">Bragging rights · since forever</div>
        </div>
      </div>

      <nav className="nav">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href}>
            <button className={isActive(href) ? 'active' : ''}>{label}</button>
          </Link>
        ))}
      </nav>

      <div className="header-right">
        <button className="theme-toggle" onClick={toggleDark} aria-label="Toggle theme">
          {dark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <Link href="/signup">
          <button className="btn red">Join the pool</button>
        </Link>
      </div>
    </header>
  );
}
