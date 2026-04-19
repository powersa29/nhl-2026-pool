export default function RulesPage() {
  const rules = [
    { t: 'Pick 16', b: 'Build a 16-player roster with 1 goalie, 6 defensemen, and 9 forwards. Each pick must come from a different playoff team.' },
    { t: 'One per team', b: "You can only select one player from each of the 16 playoff teams. If your guy gets eliminated, you live with it." },
    { t: 'Scoring', b: 'Goals and assists count 1 point each. Goalie wins are worth 2, shutouts are worth 3. All stats pulled live from NHL.com.' },
  ];
  const scoring = [
    { n: 1, l: 'Goal' },
    { n: 1, l: 'Assist' },
    { n: 2, l: 'Goalie Win' },
    { n: 3, l: 'Shutout' },
  ];

  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2><span className="strike">How it works</span></h2>
        </div>
        <div className="rules-grid">
          {rules.map((r, i) => (
            <div key={i} className="rule-card">
              <div className="rule-num">{i + 1}</div>
              <h3>{r.t}</h3>
              <p>{r.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2><span className="strike">Scoring</span></h2>
        </div>
        <div className="scoring-grid">
          {scoring.map((s, i) => (
            <div key={i} className="score-card">
              <div className="n">+{s.n}</div>
              <div className="l">{s.l}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          All stats pulled live from NHL.com. Ties in final standings broken by: (1) most goals on roster, (2) most players still active in the next round, (3) coin flip on live video.
        </p>
      </section>
    </>
  );
}
