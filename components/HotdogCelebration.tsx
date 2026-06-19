'use client';

import { useEffect, useMemo } from 'react';

interface Dog {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  spin: number;
  emoji: string;
}

const EMOJIS = ['🌭', '🌭', '🌭', '🌭', '🌭', '🌭', '⛳', '🏆'];

export default function HotdogCelebration({ onDone }: { onDone: () => void }) {
  const dogs = useMemo<Dog[]>(() =>
    Array.from({ length: 38 }, (_, i) => ({
      id: i,
      x: Math.random() * 98 + 1,
      delay: Math.random() * 2.2,
      duration: 1.8 + Math.random() * 2,
      size: 22 + Math.floor(Math.random() * 28),
      spin: (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 500),
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    }))
  , []);

  useEffect(() => {
    const t = setTimeout(onDone, 4800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      zIndex: 9999, overflow: 'hidden',
    }}>
      {dogs.map(d => (
        <span
          key={d.id}
          style={{
            position: 'fixed',
            left: `${d.x}%`,
            top: '-60px',
            fontSize: d.size,
            lineHeight: 1,
            display: 'block',
            animation: `hd-fall ${d.duration}s ${d.delay}s ease-in forwards`,
            ['--hd-spin' as string]: `${d.spin}deg`,
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
