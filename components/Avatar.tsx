'use client';

const COLORS = ['var(--red)', 'var(--cyan)', 'var(--yellow)', 'var(--green)', 'var(--ink)'];

export default function Avatar({ name, index }: { name: string; index: number }) {
  const initials = name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const color = COLORS[index % COLORS.length];
  return (
    <div className="avatar" style={{ background: color }}>{initials}</div>
  );
}
