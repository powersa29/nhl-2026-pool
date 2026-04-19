import { getParticipants } from '@/lib/db';
import { fetchAllTeamStats, lookupStats } from '@/lib/nhl-api';
import { TEAMS } from '@/lib/data';
import TeamChip from '@/components/TeamChip';
import Avatar from '@/components/Avatar';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 600;

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [participants, statsMap] = await Promise.all([
    getParticipants().catch(() => []),
    fetchAllTeamStats(TEAMS.map(t => t.abbr)).catch(() => ({})),
  ]);

  const participantsWithTotals = participants.map(p => {
    const total = (p.roster ?? []).reduce((sum: number, pick: { playerName: string }) => {
      const s = lookupStats(statsMap as never, pick.playerName);
      return sum + (s?.pts ?? 0);
    }, 0);
    return { ...p, total };
  });
  participantsWithTotals.sort((a, b) => b.total - a.total);
  participantsWithTotals.forEach((p, i) => { p.rank = i + 1; });

  const participant = participantsWithTotals.find(p => String(p.id) === id);
  if (!participant) notFound();

  const idx = participantsWithTotals.findIndex(p => String(p.id) === id);
  const prev = participantsWithTotals[idx - 1];
  const next = participantsWithTotals[idx + 1];

  const roster = participant.roster ?? [];
  const byPos: Record<string, Array<{ pick: typeof roster[0]; stats: ReturnType<typeof lookupStats> }>> = { G: [], D: [], F: [] };
  for (const pick of roster) {
    const stats = lookupStats(statsMap as never, pick.playerName);
    byPos[pick.pos]?.push({ pick, stats });
  }

  const gPts = byPos.G.reduce((s, r) => s + (r.stats?.pts ?? 0), 0);
  const dPts = byPos.D.reduce((s, r) => s + (r.stats?.pts ?? 0), 0);
  const fPts = byPos.F.reduce((s, r) => s + (r.stats?.pts ?? 0), 0);

  const posLabel = { G: 'Goalie', D: 'Defense (6)', F: 'Forwards (9)' };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href="/"><button className="btn ghost" style={{ padding: '7px 14px', fontSize: 13 }}>← Back to standings</button></Link>
        {prev && <Link href={`/participant/${prev.id}`}><button className="btn ghost" style={{ padding: '7px 14px', fontSize: 13 }}>↑ #{prev.rank} {prev.name}</button></Link>}
        {next && <Link href={`/participant/${next.id}`}><button className="btn ghost" style={{ padding: '7px 14px', fontSize: 13 }}>↓ #{next.rank} {next.name}</button></Link>}
      </div>

      <div className="detail-header">
        <Avatar name={participant.name} index={participant.id} />
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Rank #{participant.rank}</div>
          <h2 style={{ marginTop: 4 }}>{participant.name}</h2>
          <div className="detail-meta">
            <div className="pos-split">
              <span><span style={{ color: 'var(--muted)' }}>G</span> {gPts}</span>
              <span><span style={{ color: 'var(--muted)' }}>D</span> {dPts}</span>
              <span><span style={{ color: 'var(--muted)' }}>F</span> {fPts}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 68, fontWeight: 800, lineHeight: 1 }}>{participant.total}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total points</div>
        </div>
      </div>

      {(['G', 'D', 'F'] as const).map(pos => (
        <section key={pos} className="card" style={{ marginBottom: 14 }}>
          <div className="card-header" style={{ marginBottom: 14 }}>
            <h3>{posLabel[pos]}</h3>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {byPos[pos].reduce((s, r) => s + (r.stats?.pts ?? 0), 0)} pts combined
            </div>
          </div>
          <div className="detail-roster">
            {byPos[pos].map(({ pick, stats }, i) => (
              <div key={i} className="dr-card">
                <div className="row1">
                  <TeamChip abbr={pick.team} />
                  <span className="num">#—</span>
                </div>
                <div className="nm">{pick.playerName}</div>
                <div className="row2">
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {stats ? `${stats.gp} GP · ${stats.g}G ${stats.a}A` : 'No stats yet'}
                  </span>
                  <span className="pt">{stats?.pts ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
