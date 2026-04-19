import { getParticipants, getRoundsConfig } from '@/lib/db';
import AdminClient from '@/components/AdminClient';

export const dynamic = 'force-dynamic';

const ADMIN_SECRET = 'buffalosabres';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;

  if (secret !== ADMIN_SECRET) {
    return (
      <section className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <h2>Admin Access</h2>
        <p style={{ color: 'var(--muted)', marginTop: 12, marginBottom: 24 }}>
          Add <code style={{ background: 'var(--chip)', padding: '2px 6px', borderRadius: 6 }}>?secret=YOUR_PASSWORD</code> to the URL to access the admin panel.
        </p>
        <a href="/"><button className="btn ghost">← Back to site</button></a>
      </section>
    );
  }

  const [participants, savedRounds] = await Promise.all([
    getParticipants().catch(() => []),
    getRoundsConfig().catch(() => null),
  ]);

  return <AdminClient participants={participants} secret={ADMIN_SECRET} savedRounds={savedRounds as never} />;
}
