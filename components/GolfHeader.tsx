'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const NAV = [
  { href: '/',         label: 'Standings' },
  { href: '/record',   label: 'Record Round' },
  { href: '/live',     label: 'On Course' },
  { href: '/courses',  label: 'Courses' },
  { href: '/join',     label: 'Join' },
  { href: '/rules',    label: 'How It Works' },
];

export default function GolfHeader() {
  const path = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('golf-theme');
    if (stored === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
      document.querySelector('.golf-app')?.classList.add('dark');
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.querySelector('.golf-app')?.classList.toggle('dark', next);
    localStorage.setItem('golf-theme', next ? 'dark' : 'light');
  }

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">⛳</div>
        <div>
          <div className="brand-name">Glizzy Golf League</div>
          <div className="brand-sub">Weekly 9-Hole Stroke Play</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <nav className="nav">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={path === n.href ? 'active' : ''}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
