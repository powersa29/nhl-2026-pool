'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Player, Course, Tee } from '@/lib/golf-db';
import { courseHandicap9, netScore, weekLabel } from '@/lib/golf-scoring';
import AddCourseModal from '@/components/AddCourseModal';
import HotdogCelebration from '@/components/HotdogCelebration';

type CourseWithTees = Course & { tees: Tee[] };

export default function RecordPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [courses, setCourses] = useState<CourseWithTees[]>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [showAddCourse, setShowAddCourse] = useState(false);

  const [roundType, setRoundType] = useState<'competition' | 'handicap'>('competition');
  const [holes, setHoles] = useState<9 | 18>(9);

  const [playerId, setPlayerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [teeId, setTeeId] = useState('');
  const [grossScore, setGrossScore] = useState('');

  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState('');
  const [roundsThisWeek, setRoundsThisWeek] = useState<number | null>(null);

  async function loadCourses() {
    const data = await fetch('/api/courses').then(r => r.json());
    setCourses(data);
  }

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(setPlayers);
    loadCourses();
  }, []);

  const isHandicap = roundType === 'handicap';
  const effectiveHoles = isHandicap ? holes : 9;

  const player = players.find(p => p.id === Number(playerId));
  const filteredCourses = stateFilter ? courses.filter(c => c.state === stateFilter) : courses;
  const course = courses.find(c => c.id === Number(courseId));
  const tee = course?.tees.find(t => t.id === Number(teeId));

  const previewNet = !isHandicap && player && tee && grossScore
    ? netScore(Number(grossScore), player.handicap_index, tee.slope_rating)
    : null;

  const chcp = !isHandicap && player && tee
    ? courseHandicap9(player.handicap_index, tee.slope_rating)
    : null;

  const stateList = useMemo(() => [...new Set(courses.map(c => c.state))].sort(), [courses]);

  useEffect(() => {
    if (!playerId || isHandicap) { setRoundsThisWeek(null); return; }
    fetch(`/api/rounds/count?playerId=${playerId}`)
      .then(r => r.json())
      .then(d => setRoundsThisWeek(d.count));
  }, [playerId, isHandicap]);

  const selectedWeekLabel = weekLabel(playedAt);
  const today = new Date().toISOString().slice(0, 10);
  const isBackdated = playedAt < today;

  const scoreMin = effectiveHoles === 18 ? 36 : 18;
  const scoreMax = effectiveHoles === 18 ? 160 : 72;
  const scoreLabel = effectiveHoles === 18 ? '18-Hole Gross Score' : '9-Hole Gross Score';
  const scorePlaceholder = effectiveHoles === 18 ? 'e.g. 92' : 'e.g. 47';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!playerId || !courseId || !teeId || !grossScore) {
      setError('Please fill in all fields.'); return;
    }
    setSubmitting(true);
    const res = await fetch('/api/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: Number(playerId),
        course_id: Number(courseId),
        tee_id: Number(teeId),
        gross_score: Number(grossScore),
        played_at: playedAt,
        handicap_only: isHandicap,
        holes: effectiveHoles,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
    setDone(true);
    if (!isHandicap) setCelebrate(true);
  }

  function reset() {
    setDone(false);
    setGrossScore('');
    setTeeId('');
    setCourseId('');
    setError('');
    setRoundsThisWeek(null);
    setPlayedAt(new Date().toISOString().slice(0, 10));
  }

  async function handleCourseAdded(newCourseId: number) {
    await loadCourses();
    setCourseId(String(newCourseId));
    setTeeId('');
    setShowAddCourse(false);
  }

  if (done) {
    return (
      <div style={{ maxWidth: 500 }}>
        {celebrate && <HotdogCelebration onDone={() => setCelebrate(false)} />}
        <div className="success-banner" style={{ marginBottom: 20 }}>
          {isHandicap
            ? <>Round logged! Your handicap index has been updated.</>
            : <>Round recorded! Net score: <strong>{previewNet}</strong></>
          }
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={reset}>Record Another Round</button>
          <Link href="/"><button className="btn ghost">See Standings</button></Link>
          {player && <Link href={`/player/${player.id}`}><button className="btn ghost">My Rounds</button></Link>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2>Record a Round</h2>
        <Link href="/join"><button className="btn ghost" style={{ fontSize: 13 }}>New player? Join first →</button></Link>
      </div>

      <form onSubmit={submit} className="form-card" style={{ maxWidth: 640 }}>

        {/* Round type */}
        <div className="form-row">
          <label>Round Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`state-tab ${roundType === 'competition' ? 'active' : ''}`}
              onClick={() => { setRoundType('competition'); setHoles(9); setGrossScore(''); }}
            >
              Competition
            </button>
            <button
              type="button"
              className={`state-tab ${roundType === 'handicap' ? 'active' : ''}`}
              onClick={() => { setRoundType('handicap'); setGrossScore(''); }}
            >
              Handicap Only
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {isHandicap
              ? 'Counts toward your handicap index only — not entered in the weekly standings.'
              : 'Enters you in the weekly standings. Best net score this week counts.'}
          </div>
        </div>

        {/* Holes (handicap-only) */}
        {isHandicap && (
          <div className="form-row">
            <label>Holes Played</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`state-tab ${holes === 9 ? 'active' : ''}`}
                onClick={() => { setHoles(9); setGrossScore(''); }}
              >
                9 Holes
              </button>
              <button
                type="button"
                className={`state-tab ${holes === 18 ? 'active' : ''}`}
                onClick={() => { setHoles(18); setGrossScore(''); }}
              >
                18 Holes
              </button>
            </div>
          </div>
        )}

        {/* Player */}
        <div className="form-row">
          <label>Player</label>
          <select
            className="select"
            value={playerId}
            onChange={e => { setPlayerId(e.target.value); setRoundsThisWeek(null); }}
          >
            <option value="">— Select player —</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (HCP {p.handicap_index.toFixed(1)})
              </option>
            ))}
          </select>
          {roundsThisWeek !== null && !isHandicap && (
            <div className="hint" style={{ marginTop: 6 }}>
              {roundsThisWeek} round{roundsThisWeek !== 1 ? 's' : ''} recorded this week — best net score counts.
            </div>
          )}
        </div>

        {/* State Filter */}
        <div className="form-row">
          <label>Filter by State</label>
          <div className="state-tabs" style={{ marginBottom: 0 }}>
            <button type="button" className={`state-tab ${stateFilter === '' ? 'active' : ''}`}
              onClick={() => { setStateFilter(''); setCourseId(''); setTeeId(''); }}>
              All
            </button>
            {stateList.map(s => (
              <button key={s} type="button"
                className={`state-tab ${stateFilter === s ? 'active' : ''}`}
                onClick={() => { setStateFilter(s); setCourseId(''); setTeeId(''); }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Course */}
        <div className="form-row">
          <label>Course</label>
          <select
            className="select"
            value={courseId}
            onChange={e => { setCourseId(e.target.value); setTeeId(''); }}
          >
            <option value="">— Select course —</option>
            {filteredCourses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}, {c.state}
              </option>
            ))}
          </select>
          <div style={{
            marginTop: 8, padding: '10px 14px',
            background: 'var(--ice-2)', border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Don&apos;t see your course?
            </span>
            <button
              type="button"
              className="btn ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setShowAddCourse(true)}
            >
              + Add a Course
            </button>
          </div>
        </div>

        {/* Tees */}
        {course && (
          <div className="form-row">
            <label>Tees</label>
            <div className="tee-grid">
              {course.tees.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`tee-btn ${t.tee_name.toLowerCase()} ${teeId === String(t.id) ? 'selected' : ''}`}
                  onClick={() => setTeeId(String(t.id))}
                >
                  <div className="tee-name">{t.tee_name} Tees</div>
                  <div className="tee-info">
                    Slope: <strong>{t.slope_rating}</strong><br />
                    Rating: {t.course_rating}<br />
                    {t.yards_9 ? `${t.yards_9} yds` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date played */}
        <div className="form-row">
          <label>Date Played</label>
          <input
            className="input"
            type="date"
            value={playedAt}
            max={today}
            onChange={e => setPlayedAt(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          {isBackdated && !isHandicap && (
            <div className="hint" style={{ marginTop: 6 }}>
              Back-dated — will count in the week of <strong>{selectedWeekLabel}</strong>.
            </div>
          )}
        </div>

        {/* Score */}
        <div className="form-row">
          <label>{scoreLabel}</label>
          <input
            className="input"
            type="number"
            placeholder={scorePlaceholder}
            min={scoreMin}
            max={scoreMax}
            value={grossScore}
            onChange={e => setGrossScore(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          {chcp !== null && (
            <div className="hint">
              Course handicap (9 holes): <strong>{chcp} strokes</strong>
              {grossScore && previewNet !== null && (
                <> &nbsp;·&nbsp; Net score: <strong style={{ color: 'var(--green)' }}>{previewNet}</strong></>
              )}
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ marginTop: 24 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Saving…' : isHandicap ? 'Log Round →' : 'Save Round →'}
          </button>
        </div>
      </form>

      {showAddCourse && (
        <AddCourseModal
          onClose={() => setShowAddCourse(false)}
          onAdded={handleCourseAdded}
          existingCourses={courses}
        />
      )}
    </div>
  );
}
