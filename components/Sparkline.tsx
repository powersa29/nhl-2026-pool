'use client';

export default function Sparkline({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 60, h = 24;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}
