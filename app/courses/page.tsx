'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Course, Tee } from '@/lib/golf-db';
import AddCourseModal from '@/components/AddCourseModal';
import CourseHoleEditor from '@/components/CourseHoleEditor';

const GolfMap = dynamic(() => import('@/components/GolfMap'), { ssr: false });

type CourseWithTees = Course & { tees: Tee[] };

const STATE_LABELS: Record<string, string> = {
  NY: 'New York', MD: 'Maryland', PA: 'Pennsylvania', VA: 'Virginia',
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseWithTees[]>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [coordsMap, setCoordsMap] = useState<Record<number, { lat: number; lng: number }>>({});
  const [geocoding, setGeocoding] = useState<Set<number>>(new Set());

  async function ensureCoords(course: CourseWithTees) {
    if (course.lat && course.lng) {
      setCoordsMap(prev => ({ ...prev, [course.id]: { lat: course.lat!, lng: course.lng! } }));
      return;
    }
    if (geocoding.has(course.id)) return;
    setGeocoding(prev => new Set(prev).add(course.id));
    const res = await fetch(
      `/api/courses/geocode?courseId=${course.id}&name=${encodeURIComponent(course.name)}&city=${encodeURIComponent(course.city)}&state=${encodeURIComponent(course.state)}`
    );
    if (res.ok) {
      const { lat, lng } = await res.json();
      setCoordsMap(prev => ({ ...prev, [course.id]: { lat, lng } }));
    }
    setGeocoding(prev => { const s = new Set(prev); s.delete(course.id); return s; });
  }

  async function loadCourses() {
    const data = await fetch('/api/courses').then(r => r.json());
    setCourses(data);
  }

  useEffect(() => { loadCourses(); }, []);

  function handleAdded(_id: number) {
    loadCourses();
    setShowForm(false);
  }

  const q = search.toLowerCase();
  const filtered = courses.filter(c =>
    (stateFilter === '' || c.state === stateFilter) &&
    (q === '' || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
  );

  const stateList = useMemo(() => [...new Set(courses.map(c => c.state))].sort(), [courses]);

  const grouped: Record<string, CourseWithTees[]> = {};
  for (const c of filtered) {
    if (!grouped[c.state]) grouped[c.state] = [];
    grouped[c.state].push(c);
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 style={{ marginBottom: 4 }}>Course Directory</h2>
          <span className="tag green">{courses.length} courses</span>
        </div>
        <button className="btn" onClick={() => setShowForm(true)} style={{ flexShrink: 0 }}>
          + Add Course
        </button>
      </div>

      <p style={{ marginBottom: 20, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}>
        Courses added by league members. Click a course to see tee details.
        Don&apos;t see yours? Use the button above to add it.
      </p>

      <input
        type="search"
        placeholder="Search by course or city name…"
        value={search}
        onChange={e => { setSearch(e.target.value); setExpandedId(null); }}
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 16,
          border: '1.5px solid var(--line)', borderRadius: 'var(--radius)',
          background: 'var(--ice-2)', color: 'var(--ink)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      <div className="state-tabs">
        <button className={`state-tab ${stateFilter === '' ? 'active' : ''}`} onClick={() => setStateFilter('')}>
          All ({courses.length})
        </button>
        {stateList.map(s => (
          <button key={s} className={`state-tab ${stateFilter === s ? 'active' : ''}`} onClick={() => setStateFilter(s)}>
            {s} ({courses.filter(c => c.state === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <div className="empty-state">No courses match &quot;{search}&quot;</div>
      )}

      {Object.entries(grouped).map(([state, list]) => (
        <div key={state} style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16, color: 'var(--green-dark)' }}>
            {STATE_LABELS[state] ? `${STATE_LABELS[state]} (${state})` : state}
          </h3>
          <div className="course-list">
            {list.map(course => (
              <div key={course.id}>
                <div
                  className={`course-row ${expandedId === course.id ? 'selected' : ''}`}
                  onClick={() => {
                    const next = expandedId === course.id ? null : course.id;
                    setExpandedId(next);
                    if (next) ensureCoords(course);
                  }}
                >
                  <div>
                    <div className="cr-name">{course.name}</div>
                    <div className="cr-loc">{course.city}, {course.state}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {course.tees.map(t => (
                      <span key={t.id} className="tag gray" style={{ fontSize: 10 }}>
                        {t.tee_name[0]} {t.slope_rating}
                      </span>
                    ))}
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {expandedId === course.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {expandedId === course.id && (
                  <div style={{
                    background: 'var(--ice-2)', border: '1.5px solid var(--line)',
                    borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {course.tees.map(t => (
                        <div key={t.id} className={`tee-btn ${t.tee_name.toLowerCase()}`}
                          style={{ cursor: 'default', background: 'var(--chip)' }}>
                          <div className="tee-name">{t.tee_name} Tees</div>
                          <div className="tee-info">
                            <strong>Slope:</strong> {t.slope_rating}<br />
                            <strong>Rating:</strong> {t.course_rating}<br />
                            {t.yards_9 && <><strong>Yards (9):</strong> {t.yards_9.toLocaleString()}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
                      Ratings are for 9-hole play. Course handicap = round(HI × Slope ÷ 113 ÷ 2).
                    </div>

                    <CourseHoleEditor
                      tees={course.tees}
                      courseName={course.name}
                      courseCity={course.city}
                      courseState={course.state}
                    />

                    {/* Course map */}
                    {coordsMap[course.id] ? (
                      <div style={{ marginTop: 14 }}>
                        <GolfMap
                          center={{ ...coordsMap[course.id], label: course.name }}
                          height={280}
                          zoom={16}
                        />
                      </div>
                    ) : geocoding.has(course.id) ? (
                      <div style={{ marginTop: 14, padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                        Loading map…
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <AddCourseModal
          onClose={() => setShowForm(false)}
          onAdded={(_id) => { loadCourses(); setShowForm(false); }}
          existingCourses={courses}
        />
      )}
    </div>
  );
}
