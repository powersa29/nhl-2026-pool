import { getParticipants } from '@/lib/db';
import AdminClient from '@/components/AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
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

  const participants = await getParticipants().catch(() => []);

  return <AdminClient participants={participants} secret={secret} />;
}
