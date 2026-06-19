'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function JoinPage() {
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const hcp = parseFloat(handicap);
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (isNaN(hcp) || hcp < 0 || hcp > 54) { setError('Handicap index must be 0.0 – 54.0'); return; }

    setSubmitting(true);
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), handicap_index: hcp }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
    setDone({ id: data.id, name: data.name });
  }

  if (done) {
    return (
      <div style={{ maxWidth: 500 }}>
        <div className="success-banner" style={{ marginBottom: 20 }}>
          Welcome, {done.name}! You&apos;re in the league.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/record"><button className="btn">Record your first round →</button></Link>
          <Link href="/golf"><button className="btn ghost">See Standings</button></Link>
          <Link href={`/player/${done.id}`}><button className="btn ghost">My Profile</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2>Join the League</h2>
      </div>
      <p style={{ marginBottom: 28, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}>
        Create your player profile to start recording rounds and appearing in the weekly standings.
        You can update your handicap index at any time from your player profile.
      </p>

      <form onSubmit={submit} className="form-card">
        <div className="form-row">
          <label htmlFor="name">Your Name</label>
          <input
            id="name"
            className="input"
            type="text"
            placeholder="e.g. John Smith"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor="hcp">Handicap Index</label>
          <input
            id="hcp"
            className="input input-sm"
            type="number"
            placeholder="e.g. 14.2"
            min="0"
            max="54"
            step="0.1"
            value={handicap}
            onChange={e => setHandicap(e.target.value)}
            required
            style={{ maxWidth: 160 }}
          />
          <div className="hint">
            Enter your USGA Handicap Index (0.0 – 54.0). If you don&apos;t have an official index, use your
            approximate average score minus par for 18 holes divided by 2 as a rough guide.
            You can update this at any time.
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ marginTop: 24 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Joining…' : 'Join the League →'}
          </button>
        </div>
      </form>
    </div>
  );
}
