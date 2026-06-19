'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Player, Course, Tee } from '@/lib/golf-db';
import type { LivePin } from '@/components/GolfMap';
import { courseHandicap9 } from '@/lib/golf-scoring';
import { GolfPin, TrophyCup, MapPin, CheckCircle } from '@/components/icons';

const GolfMap = dynamic(() => import('@/components/GolfMap'), { ssr: false });

type CourseWithTees = Course & { tees: Tee[] };
type Step = 'setup' | 'playing' | 'done' | 'submitted';
type Nine = 'front' | 'back';

interface LiveLocation {
  id: number; player_id: number; player_name: string;
  course_id: number | null; course_name: string;
  lat: number; lng: number; updated_at: string;
}
interface LiveRound {
  id: number; player_id: number | null; player_name: string;
  course_name: string; tee_name: string;
  scores: number[]; hole_pars: { par: number }[];
  slope_rating: number; handicap_index: number | null;
  pin_lat?: number | null; pin_lng?: number | null; pin_hole?: number | null;
}
interface HoleData {
  hole_number: number; par: number;
  yards: number | null; handicap: number | null;
}

type CelebrationKind = 'birdie' | 'eagle' | 'ace' | 'snowman' | 'par';
const CELEBRATIONS: Record<CelebrationKind, { emoji: string; label: string; bg: string }> = {
  birdie:  { emoji: '🐦', label: 'Birdie!',       bg: 'rgba(21,128,61,0.92)'  },
  eagle:   { emoji: '🦅', label: 'Eagle!!',        bg: 'rgba(29,78,216,0.92)'  },
  ace:     { emoji: '🃏', label: 'Hole in One!!!', bg: 'rgba(109,40,217,0.94)' },
  snowman: { emoji: '☃️', label: 'Snowman...',     bg: 'rgba(15,23,42,0.90)'   },
  par:     { emoji: '👍', label: 'Par!',            bg: 'rgba(55,65,81,0.88)'   },
};

function CelebrationOverlay({ kind, onDone }: { kind: CelebrationKind; onDone: () => void }) {
  const cfg = CELEBRATIONS[kind];
  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      left:  `${((i * 19 + 11) % 89) + 4}%`,
      top:   `${((i * 13 +  7) % 82) + 4}%`,
      delay: `${((i * 7) % 40) * 0.01}s`,
      dur:   `${(0.7 + (i % 6) * 0.12).toFixed(2)}s`,
      size:  `${22 + (i % 5) * 7}px`,
    })), []);
  return (
    <div onClick={onDone} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: cfg.bg, cursor: 'pointer',
      animation: 'celebrate-bg 2.4s ease-in-out forwards',
    }}>
      {particles.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', left: p.left, top: p.top, lineHeight: 1,
          fontSize: p.size, pointerEvents: 'none', userSelect: 'none',
          animation: `confetti-burst ${p.dur} ${p.delay} ease-out forwards`,
        }}>{cfg.emoji}</span>
      ))}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 12, animation: 'celebrate-pop 0.5s ease-out forwards' }}>
          {cfg.emoji}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: 'white', textShadow: '0 2px 12px rgba(0,0,0,0.6)', letterSpacing: -0.5 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 10 }}>tap to dismiss</div>
      </div>
    </div>
  );
}

const POLL_MS   = 12_000;
const UPDATE_MS = 15_000;
const COLORS    = ['#15803d','#1d4ed8','#b45309','#7c3aed','#dc2626','#0891b2'];

const SCORE_NAMES: Record<number, string> = {
  [-4]: 'Condor', [-3]: 'Albatross', [-2]: 'Eagle', [-1]: 'Birdie',
  [0]: 'Par', [1]: 'Bogey', [2]: 'Double', [3]: 'Triple',
};

function scoreName(score: number, par: number): string {
  return SCORE_NAMES[score - par] ?? `+${score - par}`;
}
function vsParStr(n: number) { return n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`; }
function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function haversineYards(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.09361);
}

function getScoreBtns(par: number | null) {
  const max = par ? Math.min(12, par + 6) : 10;
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const d = par != null ? n - par : null;
    const label = d != null && SCORE_NAMES[d] ? SCORE_NAMES[d] : '';
    return { n, label };
  });
}

function btnBg(n: number, par: number | null): string {
  if (!par) return 'var(--chip)';
  const d = n - par;
  if (d <= -2) return '#1d4ed8';
  if (d === -1) return '#15803d';
  if (d === 0)  return 'var(--green-dark)';
  if (d === 1)  return '#92400e';
  return '#991b1b';
}

function ScoreBubble({ score, par, size = 26 }: { score: number; par?: number; size?: number }) {
  const diff   = par != null ? score - par : null;
  const bg     = diff == null ? 'transparent'
    : diff <= -2 ? '#1d4ed8'
    : diff === -1 ? '#15803d'
    : diff === 0  ? 'transparent'
    : diff === 1  ? '#92400e'
    : '#991b1b';
  const color  = diff == null || diff === 0 ? 'var(--ink)' : 'white';
  const radius = diff == null || diff <= 0 ? '50%' : '3px';
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: bg, color, fontWeight: 700,
      fontSize: size * 0.52, display: 'grid', placeItems: 'center', margin: '0 auto',
      border: diff === -2 ? '1.5px solid #93c5fd' : diff === 2 ? '1.5px solid #fca5a5' : 'none',
    }}>{score}</div>
  );
}

export default function LivePage() {
  const [players, setPlayers]   = useState<Player[]>([]);
  const [courses, setCourses]   = useState<CourseWithTees[]>([]);
  const [liveList, setLiveList]     = useState<LiveLocation[]>([]);
  const [liveRounds, setLiveRounds] = useState<LiveRound[]>([]);

  const [playerId, setPlayerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [teeId, setTeeId]       = useState('');
  const [nine, setNine]         = useState<Nine>('front');

  const [step, setStep]             = useState<Step>('setup');
  const [sharing, setSharing]       = useState(false);
  const [geoError, setGeoError]     = useState('');
  const [starting, setStarting]     = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [allHoles, setAllHoles]     = useState<HoleData[]>([]);
  const [scores, setScores]         = useState<number[]>([]);
  const [currentHole, setCurrentHole] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashLabel, setFlashLabel] = useState('');
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);
  const [myLatLng, setMyLatLng]   = useState<{ lat: number; lng: number } | null>(null);
  const [pinLatLng, setPinLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [showPinMap, setShowPinMap] = useState(false);

  const watchIdRef  = useRef<number | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos      = useRef<{ lat: number; lng: number } | null>(null);
  const liveRoundRef = useRef<number | null>(null);
  const playerIdRef  = useRef('');
  const courseIdRef  = useRef('');
  const playersRef   = useRef<Player[]>([]);
  const coursesRef   = useRef<CourseWithTees[]>([]);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { coursesRef.current = courses; }, [courses]);

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(setPlayers);
    fetch('/api/courses').then(r => r.json()).then(setCourses);
    pollLive();
    pollTimerRef.current = setInterval(pollLive, POLL_MS);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!teeId) { setAllHoles([]); return; }
    fetch(`/api/holes?teeId=${teeId}`)
      .then(r => r.json())
      .then(data => setAllHoles(Array.isArray(data) ? data : []));
  }, [teeId]);

  useEffect(() => {
    if (allHoles.length > 0 || !teeId || !courseId || courses.length === 0) return;
    const c = courses.find(cx => cx.id === Number(courseId));
    const t = c?.tees.find(tx => tx.id === Number(teeId));
    if (!c || !t) return;
    const params = new URLSearchParams({
      teeId, courseName: c.name, teeName: t.tee_name, slope: String(t.slope_rating),
    });
    fetch(`/api/courses/auto-holes?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setAllHoles(data); })
      .catch(() => {});
  }, [allHoles.length, teeId, courseId, courses.length]);

  useEffect(() => {
    const stop = () => {
      if (sendTimerRef.current) clearInterval(sendTimerRef.current);
      if (watchIdRef.current != null) navigator.geolocation?.clearWatch(watchIdRef.current);
    };
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('golf-round');
    if (!saved) return;
    try {
      const d = JSON.parse(saved);
      if (!d.roundId) return;
      fetch('/api/live-scoring')
        .then(r => r.json())
        .then((list: { id: number }[]) => {
          if (!Array.isArray(list) || !list.find(r => r.id === d.roundId)) {
            localStorage.removeItem('golf-round');
            return;
          }
          liveRoundRef.current = d.roundId;
          playerIdRef.current  = String(d.playerId ?? '');
          courseIdRef.current  = String(d.courseId ?? '');
          setPlayerId(String(d.playerId ?? ''));
          setCourseId(String(d.courseId ?? ''));
          setTeeId(String(d.teeId ?? ''));
          setNine(d.nine ?? 'front');
          setScores(d.scores ?? []);
          setCurrentHole(d.currentHole ?? 0);
          setMapCollapsed(true);
          setStep(d.step ?? 'playing');
        })
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    if (step === 'playing' || step === 'done') {
      localStorage.setItem('golf-round', JSON.stringify({
        roundId: liveRoundRef.current,
        scores, currentHole, step, playerId, courseId, teeId, nine,
      }));
    }
  }, [step, scores, currentHole, playerId, courseId, teeId, nine]);

  async function pollLive() {
    const [locs, rounds] = await Promise.all([
      fetch('/api/live').then(r => r.json()).catch(() => []),
      fetch('/api/live-scoring').then(r => r.json()).catch(() => []),
    ]);
    setLiveList(Array.isArray(locs) ? locs : []);
    setLiveRounds(Array.isArray(rounds) ? rounds : []);
  }

  async function dropPin(lat: number, lng: number) {
    setPinLatLng({ lat, lng });
    setShowPinMap(false);
    if (liveRoundRef.current) {
      fetch('/api/live-scoring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: liveRoundRef.current, pin_lat: lat, pin_lng: lng, pin_hole: currentHoleNum }),
      }).catch(() => {});
    }
  }

  function pushLocation(lat: number, lng: number) {
    const p = playersRef.current.find(p => p.id === Number(playerIdRef.current));
    const c = coursesRef.current.find(c => c.id === Number(courseIdRef.current));
    return fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: Number(playerIdRef.current), player_name: p?.name ?? '',
        course_id: c?.id ?? null, course_name: c?.name ?? '', lat, lng,
      }),
    }).then(() => pollLive());
  }

  const frontHoles = allHoles.filter(h => h.hole_number <= 9).sort((a, b) => a.hole_number - b.hole_number);
  const backHoles  = allHoles.filter(h => h.hole_number >= 10).sort((a, b) => a.hole_number - b.hole_number);
  const hasBack    = backHoles.length > 0;
  const holes      = nine === 'front' ? frontHoles : backHoles;
  const startHole  = nine === 'front' ? 1 : 10;
  const holeRange  = Array.from({ length: 9 }, (_, i) => startHole + i);
  const holeMap    = new Map(holes.map(h => [h.hole_number, h]));

  const player         = players.find(p => p.id === Number(playerId));
  const course         = courses.find(c => c.id === Number(courseId));
  const tee            = course?.tees.find(t => t.id === Number(teeId));
  const gross          = scores.reduce((a, b) => a + b, 0);
  const hcp            = player && tee ? courseHandicap9(player.handicap_index, tee.slope_rating) : 0;
  const net            = gross - hcp;
  const currentHoleNum = holeRange[currentHole] ?? startHole;
  const currentHolePar = holeMap.get(currentHoleNum)?.par ?? null;
  const currentHoleYds = holeMap.get(currentHoleNum)?.yards ?? null;
  const parThrough     = holeRange.slice(0, scores.length).reduce((a, h) => a + (holeMap.get(h)?.par ?? 0), 0);
  const totalCoursePar = holes.reduce((a, h) => a + h.par, 0);
  const vsParNow       = scores.length > 0 && parThrough > 0 ? gross - parThrough : null;
  const scoreBtns      = getScoreBtns(currentHolePar);
  const pinDist        = pinLatLng && myLatLng
    ? haversineYards(myLatLng.lat, myLatLng.lng, pinLatLng.lat, pinLatLng.lng)
    : null;

  const pins: LivePin[] = liveList.map(l => ({
    player_id: l.player_id, player_name: l.player_name,
    lat: l.lat, lng: l.lng, course_id: l.course_id,
  }));

  // Pick up a pin dropped by someone else in the group
  useEffect(() => {
    if (step !== 'playing' || pinLatLng) return;
    const pinRow = liveRounds.find(r => r.pin_lat && r.pin_lng && r.pin_hole === currentHoleNum);
    if (pinRow?.pin_lat && pinRow?.pin_lng) {
      setPinLatLng({ lat: pinRow.pin_lat, lng: pinRow.pin_lng });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRounds, currentHoleNum, step]);

  async function startRound() {
    if (!playerId || !courseId || !teeId) return;
    setStarting(true);
    setGeoError('');
    playerIdRef.current = playerId;
    courseIdRef.current = courseId;

    const p = players.find(px => px.id === Number(playerId))!;
    const c = courses.find(cx => cx.id === Number(courseId))!;
    const t = c.tees.find(tx => tx.id === Number(teeId))!;

    const holeParsPayload = holes.map(h => ({
      hole_number: h.hole_number, par: h.par, yards: h.yards ?? null,
    }));

    const res = await fetch('/api/live-scoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: p.id, player_name: p.name,
        course_id: c.id, course_name: c.name,
        tee_name: t.tee_name, slope_rating: t.slope_rating,
        course_rating: t.course_rating, handicap_index: p.handicap_index,
        start_hole: startHole, hole_pars: holeParsPayload,
      }),
    });
    const roundData = await res.json();
    liveRoundRef.current = roundData.id;
    setScores([]);
    setCurrentHole(0);
    setMapCollapsed(true);
    setStep('playing');
    setStarting(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          lastPos.current = { lat, lng };
          await pushLocation(lat, lng);
          setSharing(true);
          watchIdRef.current = navigator.geolocation.watchPosition(
            px => {
              const pos = { lat: px.coords.latitude, lng: px.coords.longitude };
              lastPos.current = pos;
              setMyLatLng(pos);
            },
            () => {}, { enableHighAccuracy: true, maximumAge: 3000 },
          );
          sendTimerRef.current = setInterval(() => {
            if (lastPos.current) pushLocation(lastPos.current.lat, lastPos.current.lng);
          }, UPDATE_MS);
        },
        err => setGeoError(
          err.code === 1
            ? 'Location permission denied — scoring only.'
            : 'Could not get GPS — scoring only.',
        ),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    }
  }

  function enterScore(score: number) {
    let celebKind: CelebrationKind | null = null;
    if (currentHolePar) {
      const diff = score - currentHolePar;
      setFlashLabel(scoreName(score, currentHolePar));
      setTimeout(() => setFlashLabel(''), 1400);
      if (score === 1)      celebKind = 'ace';
      else if (diff <= -2)  celebKind = 'eagle';
      else if (diff === -1) celebKind = 'birdie';
      else if (diff === 0)  celebKind = 'par';
      else if (score === 8) celebKind = 'snowman';
      if (celebKind) {
        setCelebration(celebKind);
        setTimeout(() => setCelebration(null), 2400);
      }
    }
    const next = [...scores, score];
    setScores(next);
    if (liveRoundRef.current) {
      fetch('/api/live-scoring', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: liveRoundRef.current, scores: next }),
      });
    }
    if (currentHole >= 8) {
      if (celebKind) setTimeout(() => setStep('done'), 2200);
      else setStep('done');
    } else {
      setCurrentHole(h => h + 1);
      setPinLatLng(null); // clear pin when advancing to next hole
    }
  }

  function undoLast() {
    if (scores.length === 0) return;
    const prev = scores.slice(0, -1);
    setScores(prev);
    setCurrentHole(h => Math.max(0, h - 1));
    if (step === 'done') setStep('playing');
    if (liveRoundRef.current) {
      fetch('/api/live-scoring', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: liveRoundRef.current, scores: prev }),
      });
    }
  }

  async function submitRound() {
    setSubmitting(true);
    await fetch('/api/rounds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: Number(playerId), course_id: Number(courseId),
        tee_id: Number(teeId), gross_score: gross,
      }),
    });
    if (liveRoundRef.current) {
      await fetch(`/api/live-scoring?id=${liveRoundRef.current}`, { method: 'DELETE' });
    }
    localStorage.removeItem('golf-round');
    setSubmitting(false);
    setStep('submitted');
  }

  async function stopEverything() {
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    if (watchIdRef.current != null) { navigator.geolocation?.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (playerIdRef.current) await fetch(`/api/live?playerId=${playerIdRef.current}`, { method: 'DELETE' });
    if (liveRoundRef.current) await fetch(`/api/live-scoring?id=${liveRoundRef.current}`, { method: 'DELETE' });
    localStorage.removeItem('golf-round');
    setSharing(false); setStep('setup'); setScores([]); setCurrentHole(0);
    liveRoundRef.current = null; setMapCollapsed(false); pollLive();
  }

  const cellSt: React.CSSProperties = {
    padding: '6px 3px', textAlign: 'center',
    borderRight: '1px solid var(--line)', minWidth: 30, fontSize: 12,
  };
  const stickyLabel: React.CSSProperties = {
    padding: '6px 8px', textAlign: 'left', fontWeight: 600,
    position: 'sticky', left: 0, zIndex: 2, background: 'var(--chip)',
    borderRight: '2px solid var(--line)', whiteSpace: 'nowrap', fontSize: 12,
  };

  function ScorecardTable({ forDone = false }: { forDone?: boolean }) {
    const hasYards = holes.some(h => h.yards);
    const hasHdcp  = holes.some(h => h.handicap);
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as unknown as undefined }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
          <thead>
            <tr style={{ background: 'var(--green-dark)', color: 'white' }}>
              <th style={{ ...stickyLabel, background: 'var(--green-dark)', color: 'white', borderRight: '2px solid rgba(255,255,255,0.25)' }}>
                Hole
              </th>
              {holeRange.map((h, i) => (
                <th key={h} style={{
                  ...cellSt,
                  background: !forDone && i === currentHole ? '#14532d' : 'var(--green-dark)',
                  color: 'white', fontWeight: !forDone && i === currentHole ? 800 : 600,
                  borderBottom: !forDone && i === currentHole ? '3px solid #4ade80' : undefined,
                }}>{h}</th>
              ))}
              <th style={{ ...cellSt, background: 'var(--green-deep)', color: 'white', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.2)' }}>Out</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--ice-2)' }}>
              <td style={{ ...stickyLabel, background: 'var(--ice-2)', color: 'var(--muted)', fontWeight: 600 }}>Par</td>
              {holeRange.map((h, i) => {
                const par = holeMap.get(h)?.par;
                const isActive = !forDone && i === currentHole;
                return (
                  <td key={h} style={{
                    ...cellSt, fontWeight: 700,
                    color: par == null ? 'var(--muted)' : isActive ? 'var(--green)' : 'var(--ink)',
                  }}>
                    {par ?? '—'}
                  </td>
                );
              })}
              <td style={{ ...cellSt, fontWeight: 800, borderLeft: '2px solid var(--line)', color: totalCoursePar ? 'var(--ink)' : 'var(--muted)' }}>
                {totalCoursePar || '—'}
              </td>
            </tr>
            {hasYards && (
              <tr>
                <td style={{ ...stickyLabel, color: 'var(--muted)', fontWeight: 600 }}>Yds</td>
                {holeRange.map(h => (
                  <td key={h} style={{ ...cellSt, color: 'var(--muted)', fontSize: 10 }}>{holeMap.get(h)?.yards ?? ''}</td>
                ))}
                <td style={{ ...cellSt, color: 'var(--muted)', fontSize: 10, borderLeft: '2px solid var(--line)' }}>
                  {holes.reduce((a, h) => a + (h.yards ?? 0), 0) || ''}
                </td>
              </tr>
            )}
            {hasHdcp && (
              <tr>
                <td style={{ ...stickyLabel, color: 'var(--muted)', fontWeight: 600 }}>Hdcp</td>
                {holeRange.map(h => (
                  <td key={h} style={{ ...cellSt, color: 'var(--muted)' }}>{holeMap.get(h)?.handicap ?? ''}</td>
                ))}
                <td style={{ ...cellSt, borderLeft: '2px solid var(--line)' }} />
              </tr>
            )}
            <tr style={{ borderTop: '2px solid var(--green)' }}>
              <td style={{ ...stickyLabel, fontWeight: 800, fontSize: 13 }}>
                {player?.name.split(' ')[0] ?? 'Score'}
              </td>
              {holeRange.map((h, i) => {
                const s   = scores[i];
                const par = holeMap.get(h)?.par;
                const isActive = !forDone && i === currentHole;
                if (s !== undefined) {
                  return (
                    <td key={h} style={{ ...cellSt, padding: '3px 2px' }}>
                      <ScoreBubble score={s} par={par} size={24} />
                    </td>
                  );
                }
                if (isActive) {
                  return (
                    <td key={h} style={{ ...cellSt, background: 'rgba(21,128,61,0.1)' }}>
                      <div style={{
                        width: 24, height: 24, margin: '0 auto',
                        border: '2px dashed var(--green)', borderRadius: '50%',
                        display: 'grid', placeItems: 'center',
                        fontSize: 10, color: 'var(--green)', fontWeight: 700,
                        animation: 'gpulse 1.4s infinite',
                      }}>▼</div>
                    </td>
                  );
                }
                return <td key={h} style={cellSt} />;
              })}
              <td style={{ ...cellSt, fontWeight: 800, fontSize: 14, borderLeft: '2px solid var(--line)' }}>
                {scores.length > 0 ? gross : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {scores.length > 0 && (
          <div style={{ display: 'flex', borderTop: '1px solid var(--line)', fontSize: 12 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRight: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>HCP </span>
              <strong>-{hcp}</strong>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRight: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Net </span>
              <strong style={{ color: 'var(--green)' }}>{net}</strong>
            </div>
            {vsParNow !== null && (
              <div style={{ flex: 1, textAlign: 'center', padding: '7px 4px' }}>
                <span style={{ color: 'var(--muted)' }}>vs Par </span>
                <strong style={{ color: vsParNow <= 0 ? 'var(--green)' : 'var(--ink)' }}>{vsParStr(vsParNow)}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (step === 'submitted') {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <CheckCircle size={56} color="var(--green)" strokeWidth={1.5} />
        </div>
        <h2 style={{ marginTop: 12 }}>Round Submitted!</h2>
        <p style={{ color: 'var(--muted)' }}>{player?.name} · {course?.name} · {tee?.tee_name} Tees</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '20px 0' }}>
          {([['Gross', String(gross)], ['HCP', `-${hcp}`], ['Net', String(net)]] as [string, string][]).map(([label, val]) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: label === 'Net' ? 'var(--green)' : 'var(--ink)' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
        {totalCoursePar > 0 && (
          <p style={{ fontSize: 18, fontWeight: 800, color: gross - totalCoursePar <= 0 ? 'var(--green)' : 'var(--ink)' }}>
            {vsParStr(gross - totalCoursePar)} vs par
          </p>
        )}
        <button className="btn danger" onClick={stopEverything} style={{ width: '100%', marginTop: 8 }}>
          {sharing ? 'Stop GPS & Done' : 'Done'}
        </button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrophyCup size={20} color="var(--gold)" /> Round Complete</h2>
          <span className="tag green">9/9 holes</span>
        </div>

        <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 8px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>
            {player?.name} · {course?.name} · {tee?.tee_name}
            {nine === 'back' && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>Back 9</span>}
          </div>
          <ScorecardTable forDone />
        </div>

        {totalCoursePar > 0 && (
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 16,
            color: gross - totalCoursePar <= 0 ? 'var(--green)' : 'var(--ink)' }}>
            {vsParStr(gross - totalCoursePar)} vs par
          </div>
        )}

        <button className="btn" style={{ width: '100%', marginBottom: 10 }} onClick={submitRound} disabled={submitting}>
          {submitting ? 'Submitting…' : '✓ Submit Official Round'}
        </button>
        <button className="btn ghost" style={{ width: '100%', marginBottom: 10 }} onClick={undoLast}>← Edit Last Hole</button>
        {confirmEnd ? (
          <div style={{ border: '1.5px solid var(--danger, #dc2626)', borderRadius: 'var(--radius)', padding: '12px 14px', background: 'color-mix(in oklab, #dc2626 6%, transparent)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Discard this round?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmEnd(false)}>Cancel</button>
              <button className="btn danger" style={{ flex: 1 }} onClick={stopEverything}>Yes, Discard</button>
            </div>
          </div>
        ) : (
          <button className="btn danger" style={{ width: '100%' }} onClick={() => setConfirmEnd(true)}>Discard & End</button>
        )}
        {celebration && <CelebrationOverlay kind={celebration} onDone={() => setCelebration(null)} />}
      </div>
    );
  }

  if (step === 'playing') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
          <div>
            <strong>{player?.name}</strong>
            <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{course?.name} · {tee?.tee_name}</span>
            {nine === 'back' && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>· Back 9</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {sharing && <span style={{ color: 'var(--green)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> GPS</span>}
            <span style={{ color: 'var(--muted)' }}>{scores.length}/9</span>
          </div>
        </div>

        <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <ScorecardTable />
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
              Hole {currentHoleNum}
              {currentHolePar && (
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)', marginLeft: 8 }}>
                  Par {currentHolePar}
                </span>
              )}
              {currentHoleYds && (
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                  {currentHoleYds} yds
                </span>
              )}
            </div>
            {flashLabel && (
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
                {flashLabel}
              </div>
            )}
          </div>

          {/* Distance to pin */}
          {pinDist !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--green)', color: 'white',
              borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 10,
            }}>
              <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{pinDist}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>YDS</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>to pin</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scoreBtns.map(btn => (
                <button
                  key={btn.n}
                  onClick={() => enterScore(btn.n)}
                  style={{
                    flex: '1 1 0', minWidth: 44, height: 60, borderRadius: 'var(--radius)',
                    border: '2px solid var(--line)',
                    background: btnBg(btn.n, currentHolePar),
                    color: !currentHolePar ? 'var(--ink)' : 'white',
                    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{btn.n}</span>
                  {btn.label && (
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, opacity: 0.85, textTransform: 'uppercase' }}>
                      {btn.label}
                    </span>
                  )}
                </button>
              ))}
            </div>

          {/* Drop pin button */}
          <button
            onClick={() => setShowPinMap(true)}
            style={{
              width: '100%', marginTop: 10, padding: '9px', borderRadius: 'var(--radius)',
              border: '1.5px solid var(--line)', background: 'var(--chip)',
              color: 'var(--ink-soft)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            📍 {pinDist !== null ? `Move Pin · ${pinDist} yds` : 'Drop Pin on Green'}
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setMapCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: '2px 0', marginBottom: 4 }}>
            {mapCollapsed ? '▶ Show map & group' : '▼ Hide map'}
          </button>
          {!mapCollapsed && (
            <>
              <div style={{ border: '2px solid var(--green-dark)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 8 }}>
                <GolfMap liveLocations={pins} height={200} />
              </div>
              {liveList.filter(l => l.player_id !== Number(playerId)).map((l, i) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS[i % COLORS.length], color: 'white', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {l.player_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>{l.player_name}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11 }}>{timeAgo(l.updated_at)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {confirmEnd ? (
          <div style={{ border: '1.5px solid var(--danger, #dc2626)', borderRadius: 'var(--radius)', padding: '12px 14px', background: 'color-mix(in oklab, #dc2626 6%, transparent)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>End this round?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmEnd(false)}>Keep Playing</button>
              <button className="btn danger" style={{ flex: 1 }} onClick={stopEverything}>Yes, End Round</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {scores.length > 0 && <button className="btn ghost" style={{ flex: 1 }} onClick={undoLast}>← Undo</button>}
            <button className="btn danger" style={{ flex: scores.length > 0 ? 1 : undefined, width: scores.length === 0 ? '100%' : undefined }} onClick={() => setConfirmEnd(true)}>End Round</button>
          </div>
        )}
        {geoError && <div className="error-banner" style={{ marginTop: 10, fontSize: 12 }}>{geoError}</div>}
        {celebration && <CelebrationOverlay kind={celebration} onDone={() => setCelebration(null)} />}

        {/* Full-screen pin drop overlay */}
        {showPinMap && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--line)', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📍 Drop Pin — Hole {currentHoleNum}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {pinLatLng ? `${pinDist} yds away · tap map to move` : 'Tap the center of the green'}
                </div>
              </div>
              <button onClick={() => setShowPinMap(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px', lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <GolfMap
                liveLocations={pins}
                myPosition={myLatLng}
                droppedPin={pinLatLng}
                pinDropMode
                onPinDrop={dropPin}
                height={typeof window !== 'undefined' ? window.innerHeight - 130 : 500}
                zoom={18}
                center={myLatLng ? { lat: myLatLng.lat, lng: myLatLng.lng, label: '' } : undefined}
              />
            </div>
            {pinLatLng && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
                <button className="btn" style={{ width: '100%' }} onClick={() => setShowPinMap(false)}>
                  ✓ Pin Set{pinDist !== null ? ` · ${pinDist} yds away` : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><GolfPin size={20} color="var(--green-dark)" /> On Course</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Share your GPS and score hole by hole — your group sees it all live.
          </p>
        </div>
        {liveRounds.length > 0 && (
          <span className="tag green">
            <span className="pulse-dot" style={{ background: 'white' }} />
            {liveRounds.length} on course
          </span>
        )}
      </div>

      <div style={{ marginBottom: 20, border: '2px solid var(--green-dark)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <GolfMap liveLocations={pins} height={300} />
      </div>

      <div className="live-grid">
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Start Your Round</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Your name</label>
              <select className="select" value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ marginTop: 6 }}>
                <option value="">— Select your name —</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Course</label>
              <select className="select" value={courseId} onChange={e => { setCourseId(e.target.value); setTeeId(''); }} style={{ marginTop: 6 }}>
                <option value="">— Select course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} — {c.state}</option>)}
              </select>
            </div>
            {course && (
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Tee box</label>
                <select className="select" value={teeId} onChange={e => setTeeId(e.target.value)} style={{ marginTop: 6 }}>
                  <option value="">— Select tee —</option>
                  {course.tees.map(t => (
                    <option key={t.id} value={t.id}>{t.tee_name} — Slope {t.slope_rating}</option>
                  ))}
                </select>
              </div>
            )}

            {teeId && (
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Which 9?</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['front', 'back'] as Nine[]).map(n => (
                    <button key={n} onClick={() => setNine(n)} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)',
                      border: `2px solid ${nine === n ? 'var(--green)' : 'var(--line)'}`,
                      background: nine === n ? 'var(--green-dark)' : 'var(--chip)',
                      color: nine === n ? 'white' : 'var(--ink)',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>
                      {n === 'front' ? 'Front 9' : 'Back 9'}
                      {n === 'front' && frontHoles.length > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                          Holes 1–9 · Par {frontHoles.reduce((a, h) => a + h.par, 0)}
                        </div>
                      )}
                      {n === 'back' && backHoles.length > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                          Holes 10–18 · Par {backHoles.reduce((a, h) => a + h.par, 0)}
                        </div>
                      )}
                      {n === 'back' && !hasBack && (
                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.6, marginTop: 2 }}>No scorecard yet</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {teeId && holes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--ice-2)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
                {nine === 'front' ? 'Front 9' : 'Back 9'} · Par {totalCoursePar} · {holes.map(h => h.par).join('–')}
              </div>
            )}
            {geoError && <div className="error-banner" style={{ marginTop: 0, fontSize: 12 }}>⚠️ {geoError}</div>}
            <button className="btn" onClick={startRound} disabled={starting || !playerId || !courseId || !teeId}>
              {starting ? 'Starting…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GolfPin size={15} color="white" />Start Round</span>}
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
              Shares your GPS and tracks scores on a live scorecard visible to the whole group.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>On Course Now</h3>
          {liveRounds.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>No one is on course yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {liveRounds.map((r, i) => {
                const hasGps = liveList.some(l => l.player_id === r.player_id);
                const gross = r.scores.reduce((a: number, b: number) => a + b, 0);
                const hcp = r.handicap_index != null ? Math.round((r.handicap_index * r.slope_rating) / 113 / 2) : 0;
                const net = gross - hcp;
                const holesPlayed = r.scores.length;
                return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: COLORS[i % COLORS.length], color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>
                    {r.player_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.player_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {r.course_name} · {holesPlayed}/9
                      {hasGps && <span style={{ color: 'var(--green)', fontWeight: 600 }}>· GPS</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {holesPlayed > 0 ? (
                      <>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>net {net}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{gross} gross</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Starting…</div>
                    )}
                  </div>
                  <span className="pulse-dot" style={{ width: 8, height: 8, background: 'var(--green)', display: 'inline-block', borderRadius: '50%', animation: 'gpulse 1.4s infinite', flexShrink: 0 }} />
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
        GPS visible while page is open. Scores update each hole. Auto-expires after 30 min of inactivity.
      </p>
    </div>
  );
}
