export function courseHandicap9(handicapIndex: number, slopeRating: number): number {
  return Math.round((handicapIndex * slopeRating) / 113 / 2);
}

export function netScore(grossScore: number, handicapIndex: number, slopeRating: number): number {
  return grossScore - courseHandicap9(handicapIndex, slopeRating);
}

export function weekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 9-hole round differential, doubled to 18-hole equivalent (WHS)
export function scoreDifferential9(gross: number, courseRating9: number, slope: number): number {
  return ((gross - courseRating9) * 113 / slope) * 2;
}

// 18-hole round differential — uses 9-hole rating × 2 as the 18-hole course rating estimate
export function scoreDifferential18(gross: number, courseRating9: number, slope: number): number {
  return (gross - courseRating9 * 2) * 113 / slope;
}

// Unified differential — always returns an 18-hole equivalent value for the WHS calculation
export function scoreDifferential(
  gross: number,
  courseRating9: number,
  slope: number,
  holes: 9 | 18 = 9,
): number {
  return holes === 18
    ? scoreDifferential18(gross, courseRating9, slope)
    : scoreDifferential9(gross, courseRating9, slope);
}

export interface HandicapCalc {
  calculatedHI: number;
  diffsUsed: number;   // how many best differentials were averaged
  totalRounds: number;
}

// WHS lookup: [bestN, adjustment] for 1–20 rounds (index 0 = 1 round)
const WHS: [number, number][] = [
  [1, -3.0], [1, -2.5], [1, -2.0], [1, -1.0], [1,  0.0],
  [2, -1.0], [2,  0.0], [2,  0.0], [3,  0.0], [3,  0.0],
  [3,  0.0], [4,  0.0], [4,  0.0], [4,  0.0], [5,  0.0],
  [5,  0.0], [6,  0.0], [6,  0.0], [7,  0.0], [8,  0.0],
];

// differentials must be ordered most-recent first
export function calcHandicapIndex(differentials: number[]): HandicapCalc | null {
  const n = differentials.length;
  if (n === 0) return null;
  const [bestN, adj] = WHS[Math.min(n, 20) - 1];
  const working = differentials.slice(0, 20).sort((a, b) => a - b);
  const avg = working.slice(0, bestN).reduce((s, d) => s + d, 0) / bestN;
  const hi = Math.max(0, Math.floor((avg + adj) * 0.96 * 10) / 10);
  return { calculatedHI: hi, diffsUsed: bestN, totalRounds: n };
}

export function weekLabel(startDate: string): string {
  const d = new Date(startDate + 'T00:00:00Z');
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(d)} – ${fmt(end)}`;
}
