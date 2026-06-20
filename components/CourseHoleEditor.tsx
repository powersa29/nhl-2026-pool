'use client';

import { useState, useEffect, useRef } from 'react';
import type { Tee } from '@/lib/golf-db';
import { Download, Search } from './icons';

interface HoleRow {
  hole_number: number;
  par: number;
  yards: number | null;
  handicap: number | null;
}

type Nine = 'front' | 'back';

// ── GolfCourseAPI shapes — field names vary by course/API version ─────────────
interface ApiHole {
  par?: number;
  yardage?: number; yards?: number; distance?: number;
  handicap?: number; stroke_index?: number; hdcp?: number;
  [k: string]: unknown;
}
interface ApiTee {
  tee_name?: string; name?: string; tee_color?: string; color?: string;
  total_yards?: number; par_total?: number;
  holes?: ApiHole[];
  [k: string]: unknown;
}
interface ApiCourse {
  id: string;
  club_name?: string; course_name?: string;
  city?: string; state?: string;
  location?: { city?: string; state?: string; address?: string; country?: string };
}

function apiCity(c: ApiCourse)  { return c.city  ?? c.location?.city  ?? ''; }
function apiState(c: ApiCourse) { return c.state ?? c.location?.state ?? ''; }
function apiName(c: ApiCourse)  { return c.club_name || c.course_name || c.id; }

// Handle every tee structure the API might return
function extractApiTees(data: Record<string, unknown>): ApiTee[] {
  // API wraps the course in a "course" key
  const root = (data.course as Record<string, unknown> | undefined) ?? data;
  const raw = root.tees;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ApiTee[];
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    // { male: [...], female: [...] }
    if (Array.isArray(obj.male) || Array.isArray(obj.female)) {
      return [
        ...(Array.isArray(obj.male)   ? (obj.male   as ApiTee[]) : []),
        ...(Array.isArray(obj.female) ? (obj.female as ApiTee[]) : []),
      ];
    }
    // { Black: { holes:[...] }, Blue: { holes:[...] } }
    return Object.entries(obj).map(([k, v]) => ({
      tee_name: k,
      ...((typeof v === 'object' && v !== null) ? (v as object) : {}),
    })) as ApiTee[];
  }
  return [];
}

function teeName(t: ApiTee): string {
  return t.tee_name ?? t.name ?? t.tee_color ?? t.color ?? '';
}

function mapHole(h: ApiHole, i: number): HoleRow {
  return {
    hole_number: i + 1,
    par:      (h.par as number | undefined) ?? 4,
    yards:    (h.yardage ?? h.yards ?? h.distance) as number | null ?? null,
    handicap: (h.handicap ?? h.stroke_index ?? h.hdcp) as number | null ?? null,
  };
}

function emptyNine(startHole: number): HoleRow[] {
  return Array.from({ length: 9 }, (_, i) => ({
    hole_number: startHole + i, par: 4, yards: null, handicap: null,
  }));
}

function fillHoles(existing: HoleRow[], startHole: number): HoleRow[] {
  return emptyNine(startHole).map(h => {
    const found = existing.find(e => e.hole_number === h.hole_number);
    return found ? { ...h, ...found } : h;
  });
}

type FetchStep = 'idle' | 'searching' | 'manual' | 'selecting' | 'previewing' | 'importing' | 'done' | 'error' | 'scanning' | 'scan-preview';

export default function CourseHoleEditor({
  tees, courseName = '', courseCity = '', courseState = '',
}: {
  tees: Tee[];
  courseName?: string;
  courseCity?: string;
  courseState?: string;
}) {
  const [selectedTeeId, setSelectedTeeId] = useState<number | null>(tees[0]?.id ?? null);
  const [nine, setNine]                   = useState<Nine>('front');
  const [holeData, setHoleData]           = useState<Record<string, HoleRow[]>>({});
  const [editing, setEditing]             = useState(false);
  const [editRows, setEditRows]           = useState<HoleRow[]>(emptyNine(1));
  const [saving, setSaving]               = useState(false);
  const [loaded, setLoaded]               = useState<Set<number>>(new Set());

  // ── Auto-fill state ────────────────────────────────────────────────────────
  const [fetchStep, setFetchStep]         = useState<FetchStep>('idle');
  const [fetchError, setFetchError]       = useState('');
  const [searchResults, setSearchResults] = useState<ApiCourse[]>([]);
  const [apiTees, setApiTees]             = useState<ApiTee[]>([]);
  const [matchCount, setMatchCount]       = useState(0);
  const [rawData, setRawData]             = useState<Record<string, unknown> | null>(null);
  const [manualQuery, setManualQuery]     = useState('');
  const [scanPreviewRows, setScanPreviewRows] = useState<HoleRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedTeeId || loaded.has(selectedTeeId)) return;
    fetch(`/api/holes?teeId=${selectedTeeId}`)
      .then(r => r.json())
      .then((data: HoleRow[]) => {
        const allRows = Array.isArray(data) ? data : [];
        setHoleData(prev => ({ ...prev, [String(selectedTeeId)]: allRows }));
        setLoaded(prev => new Set(prev).add(selectedTeeId));
      });
  }, [selectedTeeId, loaded]);

  const key      = String(selectedTeeId);
  const allRows  = holeData[key] ?? [];
  const front    = allRows.filter(h => h.hole_number <= 9).sort((a, b) => a.hole_number - b.hole_number);
  const back     = allRows.filter(h => h.hole_number >= 10).sort((a, b) => a.hole_number - b.hole_number);
  const display  = nine === 'front' ? front : back;
  const startH   = nine === 'front' ? 1 : 10;
  const hasData  = display.length > 0;
  const totalPar = display.reduce((a, h) => a + h.par, 0);

  function startEditing() {
    setEditRows(fillHoles(display, startH));
    setEditing(true);
  }

  async function saveHoles() {
    if (!selectedTeeId) return;
    setSaving(true);
    await fetch('/api/holes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeId: selectedTeeId, holes: editRows }),
    });
    const allExcept = allRows.filter(h =>
      nine === 'front' ? h.hole_number > 9 : h.hole_number < 10
    );
    setHoleData(prev => ({ ...prev, [key]: [...allExcept, ...editRows] }));
    setEditing(false);
    setSaving(false);
  }

  // ── Auto-fill from GolfCourseAPI ──────────────────────────────────────────
  async function doSearch(query: string): Promise<ApiCourse[]> {
    const res = await fetch(`/api/courses/scorecard?search=${encodeURIComponent(query)}`).catch(() => null);
    if (!res?.ok) return [];
    const data = await res.json();
    return Array.isArray(data.courses) ? data.courses : [];
  }

  async function startFetch(customQuery?: string) {
    setFetchStep('searching');
    setFetchError('');

    // Build progressive search attempts
    const base = customQuery ?? courseName;
    const stripped = base
      .replace(/\s+(golf\s+course|golf\s+club|golf\s+links|golf\s+center|country\s+club|golf\s+&\s+country\s+club)\s*$/i, '')
      .trim();
    const words2 = (stripped || base).split(/\s+/).slice(0, 2).join(' ');
    const attempts = [...new Set([base, stripped, words2].filter(Boolean))];

    let courses: ApiCourse[] = [];
    for (const q of attempts) {
      courses = await doSearch(q);
      if (courses.length > 0) break;
    }

    if (courses.length === 0) {
      setManualQuery(stripped || base);
      setFetchStep('manual');
      return;
    }
    if (courses.length === 1) {
      await loadDetail(courses[0].id);
    } else {
      setSearchResults(courses);
      setFetchStep('selecting');
    }
  }

  async function runManualSearch() {
    if (!manualQuery.trim()) return;
    await startFetch(manualQuery.trim());
  }

  async function loadDetail(apiId: string) {
    setFetchStep('previewing');
    const res = await fetch(`/api/courses/scorecard?courseApiId=${encodeURIComponent(apiId)}`).catch(() => null);
    if (!res?.ok) { setFetchError('Failed to load course detail'); setFetchStep('error'); return; }
    const data = await res.json();
    setRawData(data);

    const extracted = extractApiTees(data);
    setApiTees(extracted);

    const matched = tees.filter(lt =>
      extracted.some(at => teeName(at).toLowerCase() === lt.tee_name.toLowerCase())
    );
    setMatchCount(matched.length);
  }

  // Import holes for all auto-matched tees
  async function importHoles() {
    setFetchStep('importing');
    for (const localTee of tees) {
      const apiTee = apiTees.find(at => teeName(at).toLowerCase() === localTee.tee_name.toLowerCase());
      if (!apiTee?.holes?.length) continue;
      await saveApiHoles(localTee.id, apiTee.holes);
    }
    setFetchStep('done');
    setTimeout(() => setFetchStep('idle'), 2500);
  }

  // Import a specific API tee into the currently selected local tee
  async function importApiTeeIntoSelected(apiTee: ApiTee) {
    if (!selectedTeeId || !apiTee.holes?.length) return;
    setFetchStep('importing');
    await saveApiHoles(selectedTeeId, apiTee.holes);
    setFetchStep('done');
    setTimeout(() => setFetchStep('idle'), 2500);
  }

  async function saveApiHoles(localTeeId: number, holes: ApiHole[]) {
    const mapped = holes.map(mapHole);
    await fetch('/api/holes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeId: localTeeId, holes: mapped }),
    });
    setHoleData(prev => ({ ...prev, [String(localTeeId)]: mapped }));
    setLoaded(prev => new Set(prev).add(localTeeId));
  }

  async function scanScorecard(file: File) {
    setFetchStep('scanning');
    setFetchError('');
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch('/api/courses/scan-scorecard', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.holes) || data.holes.length === 0) {
        setFetchError(data.error === 'no_key' ? 'AI scanning not configured.' : 'Couldn\'t read the scorecard — try a clearer photo or enter manually.');
        setFetchStep('error');
        return;
      }
      setScanPreviewRows(data.holes);
      setFetchStep('scan-preview');
    } catch {
      setFetchError('Network error — try again.');
      setFetchStep('error');
    }
  }

  async function confirmScan() {
    if (!selectedTeeId) return;
    setFetchStep('importing');
    await fetch('/api/holes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeId: selectedTeeId, holes: scanPreviewRows }),
    });
    setHoleData(prev => ({ ...prev, [key]: scanPreviewRows }));
    setLoaded(prev => new Set(prev).add(selectedTeeId));
    setFetchStep('done');
    setTimeout(() => setFetchStep('idle'), 2500);
  }

  function cancelFetch() {
    setFetchStep('idle');
    setSearchResults([]);
    setApiTees([]);
    setFetchError('');
    setRawData(null);
    setManualQuery('');
  }

  const selectedTeeName = tees.find(t => t.id === selectedTeeId)?.tee_name ?? '';

  const cellSt: React.CSSProperties = { padding: '4px 2px', textAlign: 'center', fontSize: 12 };
  const inputSt: React.CSSProperties = {
    width: 38, textAlign: 'center', border: '1px solid var(--line)',
    borderRadius: 3, background: 'var(--chip)', color: 'var(--ink)', fontSize: 11, padding: '2px',
  };

  return (
    <div style={{ marginTop: 16, borderTop: '1.5px dashed var(--line)', paddingTop: 14 }}>

      {/* ── Auto-fill banner ────────────────────────────────────────────── */}
      {fetchStep === 'idle' && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={() => startFetch()}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1.5px solid var(--line)', background: 'var(--chip)', cursor: 'pointer', color: 'var(--ink)' }}>
            <Download size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Pull in scorecard
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1.5px solid var(--line)', background: 'var(--chip)', cursor: 'pointer', color: 'var(--ink)' }}>
            📷 Scan scorecard photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) scanScorecard(f); e.target.value = ''; }}
          />
        </div>
      )}

      {fetchStep === 'searching' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Searching for &quot;{courseName}&quot;…
        </div>
      )}

      {fetchStep === 'manual' && (
        <div style={{ marginBottom: 10, background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Couldn&apos;t find &quot;{courseName}&quot; — try a different search:
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={manualQuery}
              onChange={e => setManualQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runManualSearch()}
              placeholder="e.g. Diamond Hawk"
              style={{ flex: 1, padding: '5px 8px', fontSize: 12, border: '1.5px solid var(--line)', borderRadius: 4, background: 'var(--chip)', color: 'var(--ink)' }}
              autoFocus
            />
            <button onClick={runManualSearch} className="btn" style={{ fontSize: 12, padding: '5px 12px' }}>Search</button>
            <button onClick={cancelFetch} className="btn ghost" style={{ fontSize: 12, padding: '5px 10px' }}>✕</button>
          </div>
          {courseCity && courseState && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Looking for: {courseCity}, {courseState}
            </div>
          )}
        </div>
      )}

      {fetchStep === 'selecting' && (
        <div style={{ marginBottom: 10, background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Multiple matches — pick the right one:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {searchResults.slice(0, 10).map(c => (
              <button key={c.id} onClick={() => loadDetail(c.id)}
                style={{ textAlign: 'left', fontSize: 12, padding: '5px 8px', borderRadius: 4, border: '1.5px solid var(--line)', background: 'var(--chip)', cursor: 'pointer', color: 'var(--ink)' }}>
                {apiName(c)}{(apiCity(c) || apiState(c)) ? ` — ${[apiCity(c), apiState(c)].filter(Boolean).join(', ')}` : ''}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button onClick={() => { setFetchStep('manual'); setManualQuery(''); }} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Search again</button>
            <button onClick={cancelFetch} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Cancel</button>
          </div>
        </div>
      )}

      {fetchStep === 'previewing' && (
        <div style={{ marginBottom: 10, background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
          {matchCount > 0 ? (
            <>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                ✅ <strong>{matchCount}</strong> of {tees.length} tee boxes matched — holes 1–{apiTees[0]?.holes?.length ?? 18} will be imported.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={importHoles} className="btn" style={{ fontSize: 12, padding: '5px 12px' }}>✓ Import All Matched Tees</button>
                <button onClick={cancelFetch} className="btn ghost" style={{ fontSize: 12, padding: '5px 12px' }}>Cancel</button>
              </div>
            </>
          ) : apiTees.length > 0 ? (
            <>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                ⚠️ Tee names didn&apos;t auto-match. Click an API tee below to import its holes into the <strong>{selectedTeeName}</strong> tee:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {apiTees.map((at, i) => (
                  <button key={i} onClick={() => importApiTeeIntoSelected(at)}
                    disabled={!at.holes?.length}
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1.5px solid var(--line)', background: 'var(--chip)', cursor: at.holes?.length ? 'pointer' : 'not-allowed', color: 'var(--ink)', opacity: at.holes?.length ? 1 : 0.5 }}>
                    {teeName(at) || `Tee ${i + 1}`}
                    {at.holes?.length ? ` (${at.holes.length}h)` : ' (no holes)'}
                  </button>
                ))}
              </div>
              <button onClick={cancelFetch} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Cancel</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>No scorecard on file</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                This course is in the database but doesn&apos;t have hole-by-hole data yet.
                Try searching for a different listing, or enter the holes manually below.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { cancelFetch(); setFetchStep('manual'); setManualQuery(''); }} className="btn ghost" style={{ fontSize: 12, padding: '5px 12px' }}>🔍 Try another search</button>
                <button onClick={cancelFetch} className="btn ghost" style={{ fontSize: 12, padding: '5px 12px' }}>Enter manually</button>
              </div>
            </>
          )}
        </div>
      )}

      {fetchStep === 'scanning' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          📷 Reading scorecard with AI…
        </div>
      )}

      {fetchStep === 'scan-preview' && (
        <div style={{ marginBottom: 10, background: 'var(--ice-2)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            ✅ Read {scanPreviewRows.length} holes — review and confirm:
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th style={{ padding: '2px 6px', textAlign: 'left' }}>Hole</th>
                  {scanPreviewRows.map(h => <th key={h.hole_number} style={{ padding: '2px 4px', textAlign: 'center', minWidth: 24 }}>{h.hole_number}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 6px', fontWeight: 600 }}>Par</td>
                  {scanPreviewRows.map(h => <td key={h.hole_number} style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 700 }}>{h.par}</td>)}
                </tr>
                {scanPreviewRows.some(h => h.yards) && (
                  <tr>
                    <td style={{ padding: '2px 6px', fontWeight: 600, color: 'var(--muted)' }}>Yds</td>
                    {scanPreviewRows.map(h => <td key={h.hole_number} style={{ padding: '2px 4px', textAlign: 'center', color: 'var(--muted)' }}>{h.yards ?? '—'}</td>)}
                  </tr>
                )}
                {scanPreviewRows.some(h => h.handicap) && (
                  <tr>
                    <td style={{ padding: '2px 6px', fontWeight: 600, color: 'var(--muted)' }}>HCP</td>
                    {scanPreviewRows.map(h => <td key={h.hole_number} style={{ padding: '2px 4px', textAlign: 'center', color: 'var(--muted)' }}>{h.handicap ?? '—'}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={confirmScan} className="btn" style={{ fontSize: 12, padding: '5px 12px' }}>✓ Save These Holes</button>
            <button onClick={() => fileInputRef.current?.click()} className="btn ghost" style={{ fontSize: 12, padding: '5px 12px' }}>📷 Retake</button>
            <button onClick={cancelFetch} className="btn ghost" style={{ fontSize: 12, padding: '5px 10px' }}>✕</button>
          </div>
        </div>
      )}

      {fetchStep === 'importing' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Importing holes…</div>
      )}

      {fetchStep === 'done' && (
        <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 10 }}>✓ Holes imported!</div>
      )}

      {fetchStep === 'error' && (
        <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 10, background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 4, padding: '6px 10px' }}>
          {fetchError}
          <button onClick={cancelFetch} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>✕</button>
        </div>
      )}

      {/* ── Scorecard tabs ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Scorecard</span>

        {tees.length > 1 && tees.map(t => (
          <button key={t.id} onClick={() => { setSelectedTeeId(t.id); setEditing(false); }} style={{
            padding: '3px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: '1.5px solid var(--line)',
            background: selectedTeeId === t.id ? 'var(--green-dark)' : 'var(--chip)',
            color: selectedTeeId === t.id ? 'white' : 'var(--ink)',
          }}>{t.tee_name}</button>
        ))}

        {(['front', 'back'] as Nine[]).map(n => (
          <button key={n} onClick={() => { setNine(n); setEditing(false); }} style={{
            padding: '3px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: '1.5px solid var(--line)',
            background: nine === n ? 'var(--chip)' : 'transparent',
            color: 'var(--ink)', fontWeight: nine === n ? 700 : 400,
          }}>
            {n === 'front' ? 'Front 9' : 'Back 9'}
          </button>
        ))}

        {!editing && (
          <button onClick={startEditing} style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1.5px solid var(--line)', background: 'var(--chip)', cursor: 'pointer', color: 'var(--ink)' }}>
            {hasData ? '✏ Edit' : '+ Add Holes'}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...cellSt, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, paddingRight: 8 }} />
                  {editRows.map(h => <th key={h.hole_number} style={{ ...cellSt, color: 'var(--muted)', minWidth: 40 }}>{h.hole_number}</th>)}
                  <th style={{ ...cellSt, color: 'var(--muted)' }}>Tot</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>Par</td>
                  {editRows.map((h, i) => (
                    <td key={h.hole_number} style={cellSt}>
                      <select value={h.par} onChange={e => { const n = [...editRows]; n[i] = { ...n[i], par: Number(e.target.value) }; setEditRows(n); }} style={inputSt}>
                        <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                      </select>
                    </td>
                  ))}
                  <td style={{ ...cellSt, fontWeight: 800, color: 'var(--green)' }}>
                    {editRows.reduce((a, h) => a + h.par, 0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>Yds</td>
                  {editRows.map((h, i) => (
                    <td key={h.hole_number} style={cellSt}>
                      <input type="number" value={h.yards ?? ''} placeholder="—" onChange={e => { const n = [...editRows]; n[i] = { ...n[i], yards: e.target.value ? Number(e.target.value) : null }; setEditRows(n); }} style={inputSt} />
                    </td>
                  ))}
                  <td style={{ ...cellSt, fontWeight: 700 }}>
                    {editRows.reduce((a, h) => a + (h.yards ?? 0), 0) || '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>HCP</td>
                  {editRows.map((h, i) => (
                    <td key={h.hole_number} style={cellSt}>
                      <input type="number" value={h.handicap ?? ''} placeholder="—" min={1} max={18} onChange={e => { const n = [...editRows]; n[i] = { ...n[i], handicap: e.target.value ? Number(e.target.value) : null }; setEditRows(n); }} style={inputSt} />
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1, padding: '8px' }} onClick={saveHoles} disabled={saving}>
              {saving ? 'Saving…' : '✓ Save'}
            </button>
            <button className="btn ghost" style={{ flex: 1, padding: '8px' }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : hasData ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...cellSt, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, paddingRight: 8 }} />
                {display.map(h => <th key={h.hole_number} style={{ ...cellSt, color: 'var(--muted)', minWidth: 28 }}>{h.hole_number}</th>)}
                <th style={{ ...cellSt, color: 'var(--muted)' }}>Tot</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>Par</td>
                {display.map(h => <td key={h.hole_number} style={{ ...cellSt, fontWeight: 700 }}>{h.par}</td>)}
                <td style={{ ...cellSt, fontWeight: 800, color: 'var(--green)' }}>{totalPar}</td>
              </tr>
              {display.some(h => h.yards) && (
                <tr>
                  <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>Yds</td>
                  {display.map(h => <td key={h.hole_number} style={{ ...cellSt, color: 'var(--muted)' }}>{h.yards ?? '—'}</td>)}
                  <td style={{ ...cellSt, color: 'var(--muted)' }}>{display.reduce((a, h) => a + (h.yards ?? 0), 0)}</td>
                </tr>
              )}
              {display.some(h => h.handicap) && (
                <tr>
                  <td style={{ ...cellSt, textAlign: 'left', fontWeight: 600, paddingRight: 8 }}>HCP</td>
                  {display.map(h => <td key={h.hole_number} style={{ ...cellSt, color: 'var(--muted)' }}>{h.handicap ?? '—'}</td>)}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : loaded.has(selectedTeeId!) ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          No {nine === 'front' ? 'Front 9' : 'Back 9'} data yet — click &quot;Pull in scorecard&quot; above or &quot;+ Add Holes&quot; to enter manually.
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      )}
    </div>
  );
}
