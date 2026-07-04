import React, { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

/* ---------------- Token logic (TOTP-style, client-side for demo) ---------------- */

const WINDOW_MS = 12000 // QR rotates every 12 seconds
const SESSION_ID = 'DS204-0704'

function codeForWindow(w) {
  // Simple deterministic hash -> 6-char base36 code (demo-grade, backend later)
  let h = 2166136261
  const s = SESSION_ID + ':' + w
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
}

const currentWindow = () => Math.floor(Date.now() / WINDOW_MS)

function isValidCode(code) {
  const w = currentWindow()
  return code === codeForWindow(w) || code === codeForWindow(w - 1)
}

/* ---------------- Mock data (invented) ---------------- */

const CLASS_INFO = {
  course: 'CSD 204 · Data Structures',
  section: 'CSE-2B',
  teacher: 'Prof. Meera Krishnan',
  college: 'Vidyanchal Institute of Technology',
}

const STUDENTS = [
  { name: 'Riya Sharma', roll: '2B01', att: 96, part: 88 },
  { name: 'Arjun Mehta', roll: '2B02', att: 91, part: 74 },
  { name: 'Sana Qureshi', roll: '2B03', att: 88, part: 92 },
  { name: 'Kabir Nair', roll: '2B04', att: 72, part: 41 },
  { name: 'Ishita Rao', roll: '2B05', att: 94, part: 81 },
  { name: 'Dev Patel', roll: '2B06', att: 66, part: 38 },
  { name: 'Ananya Singh', roll: '2B07', att: 89, part: 79 },
  { name: 'Rohan Kulkarni', roll: '2B08', att: 84, part: 63 },
]

// Engagement heatmap: 5 weeks x 8 sessions, 0..4 engagement level
const HEATMAP = [
  [4, 3, 4, 4, 2, 3, 4, 3],
  [3, 4, 3, 2, 2, 3, 3, 4],
  [4, 4, 3, 3, 1, 2, 3, 3],
  [3, 2, 2, 1, 1, 2, 2, 3],
  [4, 3, 3, 2, 1, 1, 2, 2],
]

const QUIZ = {
  q: 'What is the time complexity of searching in a balanced BST?',
  options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
  answer: 1,
}

/* ---------------- Tiny hash router ---------------- */

function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash.replace(/^#/, '') || '/'
}

const go = (path) => { window.location.hash = path }

/* ---------------- Shared bits ---------------- */

function Nav({ active }) {
  const links = [
    ['/', 'Home'],
    ['/teacher', 'Teacher · Live QR'],
    ['/student', 'Student'],
    ['/dashboard', 'Analytics'],
  ]
  return (
    <nav className="nav">
      <button className="brand" onClick={() => go('/')}>
        <span className="brand-dot" /> ClassPulse
      </button>
      <div className="nav-links">
        {links.map(([path, label]) => (
          <button
            key={path}
            className={active === path ? 'nav-link active' : 'nav-link'}
            onClick={() => go(path)}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}

function Tag({ tone = 'violet', children }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

/* ---------------- Landing ---------------- */

function Landing() {
  return (
    <div className="page">
      <Nav active="/" />
      <header className="hero">
        <Tag tone="cyan">IEEE WIE Hackathon · Team LEADERS</Tag>
        <h1>
          Attendance that can't be <span className="strike">proxied</span>.
          <br />
          Engagement you can <span className="hl">see</span>.
        </h1>
        <p className="hero-sub">
          ClassPulse verifies physical presence with rotating QR codes and BLE
          broadcast beacons, then measures real engagement with in-class
          micro-quizzes — all summarised weekly by AI.
        </p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => go('/teacher')}>
            Start a live session →
          </button>
          <button className="btn ghost" onClick={() => go('/dashboard')}>
            View analytics
          </button>
        </div>
      </header>

      <section className="pillars">
        <div className="pillar">
          <div className="pillar-icon">⟳</div>
          <h3>Rotating QR</h3>
          <p>Codes expire every 12 seconds. A screenshot shared on WhatsApp is dead on arrival.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon">📡</div>
          <h3>BLE Broadcast Beacon</h3>
          <p>One-way advertisement signal — no pairing, no device limits. Scales past 300 students per room.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon">⚡</div>
          <h3>Micro-quizzes</h3>
          <p>1–2 question checkpoints mid-lecture. The participation signal that attendance alone can't fake.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon">✦</div>
          <h3>AI Weekly Summary</h3>
          <p>LLM-generated per-student narratives that flag at-risk students before they slip away.</p>
        </div>
      </section>

      <footer className="foot">
        Prototype · Web demo with simulated BLE · Native beacon support lands in the React Native build
      </footer>
    </div>
  )
}

/* ---------------- Teacher: live rotating QR ---------------- */

function Teacher() {
  const [win, setWin] = useState(currentWindow())
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      setWin(currentWindow())
    }, 100)
    return () => clearInterval(t)
  }, [])

  const code = codeForWindow(win)
  const msLeft = WINDOW_MS - (now % WINDOW_MS)
  const frac = msLeft / WINDOW_MS
  const checkinUrl = `${window.location.origin}${window.location.pathname}#/checkin/${code}`

  const R = 148
  const CIRC = 2 * Math.PI * R

  const feed = [
    { name: 'Riya Sharma', time: '2s ago', ble: true },
    { name: 'Sana Qureshi', time: '9s ago', ble: true },
    { name: 'Arjun Mehta', time: '14s ago', ble: true },
    { name: 'Ishita Rao', time: '21s ago', ble: true },
  ]

  return (
    <div className="page">
      <Nav active="/teacher" />
      <div className="teacher-grid">
        <div className="qr-panel">
          <div className="session-head">
            <div>
              <h2>{CLASS_INFO.course}</h2>
              <p className="muted">{CLASS_INFO.section} · {CLASS_INFO.teacher} · Session live</p>
            </div>
            <Tag tone="green">● LIVE</Tag>
          </div>

          <div className="qr-stage">
            <svg className="qr-ring" viewBox="0 0 320 320" aria-hidden="true">
              <circle cx="160" cy="160" r={R} className="ring-track" />
              <circle
                cx="160" cy="160" r={R}
                className="ring-fill"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - frac)}
              />
            </svg>
            <div className="qr-card" key={code}>
              <QRCodeSVG
                value={checkinUrl}
                size={210}
                bgColor="#FFFFFF"
                fgColor="#17102E"
                level="M"
              />
            </div>
          </div>

          <div className="qr-meta">
            <div className="meta-block">
              <span className="meta-label">Session code</span>
              <span className="meta-value mono">{code}</span>
            </div>
            <div className="meta-block">
              <span className="meta-label">Regenerates in</span>
              <span className="meta-value mono">{(msLeft / 1000).toFixed(1)}s</span>
            </div>
            <div className="meta-block">
              <span className="meta-label">Beacon</span>
              <span className="meta-value beacon-on">📡 Broadcasting</span>
            </div>
          </div>

          <p className="hint">
            Scan with a phone camera — it opens the student check-in flow with this
            code. Expired codes are rejected.
          </p>
        </div>

        <aside className="feed-panel">
          <h3>Check-ins <span className="muted">(this session)</span></h3>
          <ul className="feed">
            {feed.map((f) => (
              <li key={f.name} className="feed-item">
                <span className="feed-avatar">{f.name.split(' ').map(w => w[0]).join('')}</span>
                <div className="feed-body">
                  <span className="feed-name">{f.name}</span>
                  <span className="feed-sub">QR ✓ · BLE proximity ✓ · {f.time}</span>
                </div>
                <span className="feed-check">✓</span>
              </li>
            ))}
          </ul>
          <button className="btn primary block" onClick={() => alert('Micro-quiz pushed to all student devices (demo).')}>
            ⚡ Push micro-quiz
          </button>
          <p className="hint">Micro-quizzes are the participation signal — responses feed the engagement heatmap.</p>
        </aside>
      </div>
    </div>
  )
}

/* ---------------- Check-in flow (opened by scanning the QR) ---------------- */

function CheckIn({ code }) {
  const valid = useMemo(() => isValidCode(code), [code])
  const [step, setStep] = useState(0) // 0 validating, 1 ble, 2 done / fail

  useEffect(() => {
    if (!valid) { setStep(3); return }
    const t1 = setTimeout(() => setStep(1), 900)
    const t2 = setTimeout(() => setStep(2), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [valid])

  return (
    <div className="page center-page">
      <div className="checkin-card">
        <div className="brand small"><span className="brand-dot" /> ClassPulse</div>
        {step < 3 ? (
          <>
            <h2>Marking attendance</h2>
            <p className="muted">{CLASS_INFO.course} · {CLASS_INFO.section}</p>
            <ul className="steps">
              <li className={step >= 0 ? (step > 0 ? 'done' : 'active') : ''}>
                <span className="step-ico">{step > 0 ? '✓' : '⟳'}</span>
                QR token <span className="mono">{code}</span> verified
              </li>
              <li className={step >= 1 ? (step > 1 ? 'done' : 'active') : ''}>
                <span className="step-ico">{step > 1 ? '✓' : '📡'}</span>
                BLE beacon proximity check <em>(simulated in web demo)</em>
              </li>
              <li className={step >= 2 ? 'done' : ''}>
                <span className="step-ico">{step >= 2 ? '✓' : '·'}</span>
                Attendance recorded
              </li>
            </ul>
            {step >= 2 && (
              <div className="success">
                <div className="success-ring">✓</div>
                <h3>You're marked present, Riya!</h3>
                <p className="muted">Background presence monitoring is active for this session.</p>
                <button className="btn primary" onClick={() => go('/student')}>Open my dashboard</button>
              </div>
            )}
          </>
        ) : (
          <div className="fail">
            <div className="fail-ring">✕</div>
            <h3>Code expired</h3>
            <p className="muted">
              This QR token is no longer valid — codes rotate every 12 seconds.
              Scan the live QR in your classroom.
            </p>
            <button className="btn ghost" onClick={() => go('/teacher')}>View live QR</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Student view ---------------- */

function Student() {
  const [answered, setAnswered] = useState(null)
  const me = STUDENTS[0]
  const history = [
    { date: 'Jul 4', status: 'Present', quiz: '✓ Correct' },
    { date: 'Jul 2', status: 'Present', quiz: '✓ Correct' },
    { date: 'Jun 30', status: 'Present', quiz: '– No quiz' },
    { date: 'Jun 27', status: 'Absent', quiz: '—' },
    { date: 'Jun 25', status: 'Present', quiz: '✗ Missed' },
  ]

  return (
    <div className="page">
      <Nav active="/student" />
      <div className="student-grid">
        <section className="card">
          <div className="student-head">
            <span className="feed-avatar big">RS</span>
            <div>
              <h2>{me.name}</h2>
              <p className="muted">{me.roll} · {CLASS_INFO.section} · {CLASS_INFO.college}</p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-num">{me.att}%</span>
              <span className="stat-label">Attendance</span>
            </div>
            <div className="stat">
              <span className="stat-num">{me.part}</span>
              <span className="stat-label">Participation score</span>
            </div>
            <div className="stat">
              <span className="stat-num">12</span>
              <span className="stat-label">Quiz streak 🔥</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h3>⚡ Live micro-quiz</h3>
          <p className="quiz-q">{QUIZ.q}</p>
          <div className="quiz-opts">
            {QUIZ.options.map((opt, i) => (
              <button
                key={opt}
                className={
                  'quiz-opt' +
                  (answered !== null && i === QUIZ.answer ? ' correct' : '') +
                  (answered === i && i !== QUIZ.answer ? ' wrong' : '')
                }
                disabled={answered !== null}
                onClick={() => setAnswered(i)}
              >
                {opt}
              </button>
            ))}
          </div>
          {answered !== null && (
            <p className="hint">
              {answered === QUIZ.answer
                ? 'Correct — participation score updated.'
                : 'Recorded. The right answer is O(log n).'}
            </p>
          )}
        </section>

        <section className="card">
          <h3>Recent sessions</h3>
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Attendance</th><th>Micro-quiz</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.date}>
                  <td>{h.date}</td>
                  <td>
                    <Tag tone={h.status === 'Present' ? 'green' : 'red'}>{h.status}</Tag>
                  </td>
                  <td className="muted">{h.quiz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card ai-card">
          <h3>✦ AI weekly summary</h3>
          <p className="ai-text">
            "Riya attended 4 of 5 sessions this week and answered both
            micro-quizzes correctly. Participation is trending up (+6 vs last
            week). One absence on Jun 27 — no follow-up needed yet."
          </p>
          <p className="hint">Generated by LLM from attendance + quiz data. Refreshes every Sunday.</p>
        </section>
      </div>
    </div>
  )
}

/* ---------------- Teacher analytics dashboard ---------------- */

function Dashboard() {
  const atRisk = STUDENTS.filter((s) => s.att < 75 || s.part < 50)
  const levels = ['#241B45', '#3B2A78', '#6D4FD1', '#9F7BFF', '#D6C4FF']

  return (
    <div className="page">
      <Nav active="/dashboard" />
      <div className="dash-grid">
        <section className="card span2">
          <h3>Engagement heatmap <span className="muted">· when the class disengages</span></h3>
          <div className="heatmap">
            <div className="hm-corner" />
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="hm-col-label">S{i + 1}</div>
            ))}
            {HEATMAP.map((row, r) => (
              <React.Fragment key={r}>
                <div className="hm-row-label">Wk {r + 1}</div>
                {row.map((v, c) => (
                  <div
                    key={c}
                    className="hm-cell"
                    style={{ background: levels[v] }}
                    title={`Week ${r + 1}, Session ${c + 1}: engagement ${v}/4`}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
          <p className="hint">
            Darker = lower engagement. Mid-session dips (S4–S6) line up with
            missed micro-quizzes — a cue to change pace, not just take attendance.
          </p>
        </section>

        <section className="card">
          <h3>At-risk students <Tag tone="red">{atRisk.length}</Tag></h3>
          <ul className="risk-list">
            {atRisk.map((s) => (
              <li key={s.roll}>
                <span className="feed-avatar">{s.name.split(' ').map(w => w[0]).join('')}</span>
                <div className="feed-body">
                  <span className="feed-name">{s.name}</span>
                  <span className="feed-sub">Attendance {s.att}% · Participation {s.part}</span>
                </div>
                <Tag tone="red">Flag</Tag>
              </li>
            ))}
          </ul>
          <p className="hint">Auto-flagged: attendance &lt; 75% or participation &lt; 50.</p>
        </section>

        <section className="card span3">
          <h3>Class roster</h3>
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Roll</th><th>Attendance</th><th>Participation</th><th>Status</th></tr>
            </thead>
            <tbody>
              {STUDENTS.map((s) => (
                <tr key={s.roll}>
                  <td>{s.name}</td>
                  <td className="mono muted">{s.roll}</td>
                  <td>
                    <div className="bar"><div className="bar-fill" style={{ width: s.att + '%' }} /></div>
                    <span className="bar-num">{s.att}%</span>
                  </td>
                  <td>
                    <div className="bar"><div className="bar-fill part" style={{ width: s.part + '%' }} /></div>
                    <span className="bar-num">{s.part}</span>
                  </td>
                  <td>
                    {s.att < 75 || s.part < 50
                      ? <Tag tone="red">At risk</Tag>
                      : <Tag tone="green">On track</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

/* ---------------- App shell ---------------- */

export default function App() {
  const route = useRoute()

  if (route.startsWith('/checkin/')) {
    const code = route.split('/')[2] || ''
    return <CheckIn code={code.toUpperCase()} />
  }
  if (route === '/teacher') return <Teacher />
  if (route === '/student') return <Student />
  if (route === '/dashboard') return <Dashboard />
  return <Landing />
}
