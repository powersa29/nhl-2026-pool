'use client';

import { useState } from 'react';

interface TeeInput {
  tee_name: string;
  slope_rating: string;
  course_rating: string;
  yards_9: string;
}

interface ExistingCourse {
  id: number;
  name: string;
  city: string;
  state: string;
}

interface Props {
  onClose: () => void;
  onAdded: (courseId: number, courseName: string) => void;
  existingCourses?: ExistingCourse[];
}

const DEFAULT_TEES: TeeInput[] = [
  { tee_name: 'White', slope_rating: '', course_rating: '', yards_9: '' },
];

export default function AddCourseModal({ onClose, onAdded, existingCourses = [] }: Props) {
  const [fName, setFName] = useState('');
  const [fCity, setFCity] = useState('');
  const [fState, setFState] = useState('');
  const [fTees, setFTees] = useState<TeeInput[]>(DEFAULT_TEES.map(t => ({ ...t })));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQ, setSearchQ] = useState('');

  // Filter existing courses as user types
  const suggestions = searchQ.length >= 2
    ? existingCourses.filter(c =>
        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQ.toLowerCase())
      ).slice(0, 6)
    : [];

  function selectExisting(c: ExistingCourse) {
    // Course already exists — pre-fill and let them know
    setFName(c.name);
    setFCity(c.city);
    setFState(c.state);
    setSearchQ('');
  }

  function updateTee(i: number, field: keyof TeeInput, val: string) {
    setFTees(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!fName.trim() || !fCity.trim() || !fState.trim()) {
      setFormError('Course name, city, and state are required.'); return;
    }
    if (fState.trim().length !== 2) {
      setFormError('State must be a 2-letter code (e.g. NY, VA).'); return;
    }
    const validTees = fTees.filter(t => t.tee_name.trim() && t.slope_rating && t.course_rating);
    if (!validTees.length) {
      setFormError('At least one tee with name, slope, and rating is required.'); return;
    }
    if (validTees.some(t => Number(t.slope_rating) < 55 || Number(t.slope_rating) > 155)) {
      setFormError('Slope rating must be between 55 and 155.'); return;
    }
    if (validTees.some(t => Number(t.course_rating) < 20 || Number(t.course_rating) > 50)) {
      setFormError('Course rating should be a 9-hole value (e.g. 34.5).'); return;
    }

    // Check for duplicate name
    const dupe = existingCourses.find(c =>
      c.name.toLowerCase() === fName.trim().toLowerCase() &&
      c.state.toLowerCase() === fState.trim().toLowerCase()
    );
    if (dupe) {
      setFormError(`"${dupe.name}" is already in the directory under ${dupe.city}, ${dupe.state}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fName, city: fCity, state: fState, tees: validTees }),
      });
      if (!res.ok) {
        const j = await res.json();
        setFormError(j.error ?? 'Failed to add course.');
        setSubmitting(false);
        return;
      }
      const { id } = await res.json();
      onAdded(id, fName.trim());
    } catch {
      setFormError('Network error — please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1000, padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--paper)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 580,
        padding: '28px 28px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add a Course</h2>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* Search existing courses first */}
        <div style={{
          background: 'color-mix(in oklab, var(--green) 8%, var(--paper))',
          border: '1.5px solid var(--green)',
          borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Already in the directory?
          </div>
          <input
            type="search"
            placeholder="Search existing courses (e.g. Birkdale, Independence)…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', boxSizing: 'border-box',
              border: '1.5px solid var(--line)', borderRadius: 'var(--radius)',
              background: 'var(--paper)', color: 'var(--ink)', fontSize: 14, outline: 'none',
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8, border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--paper)' }}>
              {suggestions.map((c, i) => (
                <button
                  key={c.id} type="button"
                  onClick={() => selectExisting(c)}
                  style={{
                    display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'none', border: 'none',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer', fontSize: 13, gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ice-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>{c.city}, {c.state} — already added</span>
                </button>
              ))}
            </div>
          )}
          {searchQ.length >= 2 && suggestions.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Not found — fill in the fields below to add it.
            </div>
          )}
          {searchQ.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Type to check before adding a duplicate. Skip this if you know it&apos;s new.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Course basics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <label style={labelStyle}>
              Course Name <Req />
              <input className="input" type="text" required placeholder="e.g. Birkdale Golf Course"
                value={fName} onChange={e => setFName(e.target.value)} style={{ marginTop: 6 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 12 }}>
              <label style={labelStyle}>
                City <Req />
                <input className="input" type="text" required placeholder="e.g. Midlothian"
                  value={fCity} onChange={e => setFCity(e.target.value)} style={{ marginTop: 6 }} />
              </label>
              <label style={labelStyle}>
                State <Req />
                <input className="input" type="text" required maxLength={2} placeholder="VA"
                  value={fState} onChange={e => setFState(e.target.value.toUpperCase())}
                  style={{ marginTop: 6, textTransform: 'uppercase' }} />
              </label>
            </div>
          </div>

          {/* Tees */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Tees</h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>9-hole values from your scorecard</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fTees.map((tee, i) => (
                <div key={i} style={{ background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px 10px' }}>
                  <div className="tee-inputs-grid">
                    <label style={labelStyle}>
                      Tee Name
                      <input className="input" type="text" placeholder="White" value={tee.tee_name}
                        onChange={e => updateTee(i, 'tee_name', e.target.value)} style={{ marginTop: 4 }} />
                    </label>
                    <label style={labelStyle}>
                      Slope
                      <input className="input" type="number" min="55" max="155" placeholder="113"
                        value={tee.slope_rating} onChange={e => updateTee(i, 'slope_rating', e.target.value)} style={{ marginTop: 4 }} />
                    </label>
                    <label style={labelStyle}>
                      Rating (9h)
                      <input className="input" type="number" min="20" max="50" step="0.1" placeholder="34.5"
                        value={tee.course_rating} onChange={e => updateTee(i, 'course_rating', e.target.value)} style={{ marginTop: 4 }} />
                    </label>
                    <label style={labelStyle}>
                      Yards
                      <input className="input" type="number" min="1000" max="5000" placeholder="opt."
                        value={tee.yards_9} onChange={e => updateTee(i, 'yards_9', e.target.value)} style={{ marginTop: 4 }} />
                    </label>
                  </div>
                  {fTees.length > 1 && (
                    <button type="button" onClick={() => setFTees(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: 0 }}>
                      − Remove this tee
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setFTees(prev => [...prev, { tee_name: '', slope_rating: '', course_rating: '', yards_9: '' }])}
              className="btn ghost" style={{ marginTop: 10, fontSize: 13, padding: '8px 14px', width: '100%' }}>
              + Add Another Tee
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Slope &amp; rating are printed on your scorecard or at <strong>USGA.org</strong>.
            If you only have 18-hole ratings, divide the course rating by 2 — slope stays the same.
          </p>

          {formError && (
            <div style={{ background: 'color-mix(in oklab, #dc2626 10%, transparent)', border: '1px solid #dc2626', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Req() { return <span style={{ color: '#dc2626' }}> *</span>; }

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 22, color: 'var(--muted)', lineHeight: 1, padding: '2px 6px',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
};
