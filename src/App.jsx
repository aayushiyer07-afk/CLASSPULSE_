import React, { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, configured, currentWindow, totpCode } from './lib/supabase.js'

/* ================= tiny hash router ================= */

function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash.replace(/^#/, '') || '/'
}
const go = (p) => { window.location.hash = p }

/* ================= shared ================= */

function Tag({ tone = 'violet', children }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

function initials(name = '?') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function Nav({ profile, active }) {
  const links = profile.role === 'teacher'
    ? [['/teacher', 'Live Session'], ['/analytics', 'Analytics']]
    : [['/student', 'My Dashboard']]
  return (
    <nav className="nav">
      <button className="brand" onClick={() => go(links[0][0])}>
        <span className="brand-dot" /> ClassPulse
      </button>
      <div className="nav-links">
        {links.map(([path, label]) => (
          <button key={path} className={active === path ? 'nav-link active' : 'nav-link'} onClick={() => go(path)}>
            {label}
          </button>
        ))}
        <button className="nav-link" onClick={async () => { await supabase.auth.signOut(); go('/') }}>
          Log out ({profile.name.split(' ')[0]})
        </button>
      </div>
    </nav>
  )
}

/* ================= config warning ================= */

function NotConfigured() {
  return (
    <div className="page center-page">
      <div className="checkin-card">
        <div className="brand small"><span className="brand-dot" /> ClassPulse</div>
        <h2>Supabase not configured</h2>
        <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Open <span className="mono">src/config.js</span> and paste your Supabase
          Project URL and anon public key, then redeploy. Full steps are in
          <span className="mono"> SETUP.md</span>.
        </p>
      </div>
    </div>
  )
}

/* ================= auth: login / signup ================= */

function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [role, setRole] = useState('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!email.includes('@') || password.length < 6) {
      setErr('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // stash chosen role for the setup step
        localStorage.setItem('cp_pending_role', role)
        if (!data.session) {
          setErr('Account created — if login does not continue automatically, disable "Confirm email" in Supabase Auth settings and sign in.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page center-page">
      <div className="checkin-card">
        <div className="brand small"><span className="brand-dot" /> ClassPulse</div>
        <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">Use your college email ID — attendance is tied to your verified identity.</p>

        {mode === 'signup' && (
          <div className="role-row">
            <button className={role === 'student' ? 'role-btn active' : 'role-btn'} onClick={() => setRole('student')}>
              🎓 Student
            </button>
            <button className={role === 'teacher' ? 'role-btn active' : 'role-btn'} onClick={() => setRole('teacher')}>
              🧑‍🏫 Teacher
            </button>
          </div>
        )}

        <label className="field-label">College email</label>
        <input className="input" type="email" placeholder="name@college.ac.in"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="field-label">Password</label>
        <input className="input" type="password" placeholder="min 6 characters"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />

        {err && <p className="err">{err}</p>}

        <button className="btn primary block" disabled={busy} onClick={submit}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account →' : 'Log in →'}
        </button>

        <p className="hint center">
          {mode === 'signup' ? 'Already have an account? ' : 'First time here? '}
          <button className="linklike" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr('') }}>
            {mode === 'signup' ? 'Log in' : 'Create account'}
          </button>
        </p>

        <div className="login-pillars">
          <span>🔄 Rotating QR</span><span>📡 BLE beacon</span><span>⚡ Micro-quizzes</span><span>✦ AI summaries</span>
        </div>
      </div>
    </div>
  )
}

/* ================= first-time profile setup ================= */

function Setup({ user, onDone }) {
  const [role] = useState(localStorage.getItem('cp_pending_role') || 'student')
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [section, setSection] = useState('')
  const [dept, setDept] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) { setErr('Please enter your name'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      name: name.trim(),
      role,
      roll_number: role === 'student' ? roll.trim() : null,
      section: section.trim() || null,
      department: role === 'teacher' ? dept.trim() : null,
    })
    setBusy(false)
    if (error) { setErr(error.message) } else { localStorage.removeItem('cp_pending_role'); onDone() }
  }

  return (
    <div className="page center-page">
      <div className="checkin-card">
        <div className="brand small"><span className="brand-dot" /> ClassPulse</div>
        <h2>Set up your profile</h2>
        <p className="muted">One-time setup · signed in as <span className="mono">{user.email}</span> · {role}</p>

        <label className="field-label">Full name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Sharma" />

        {role === 'student' ? (
          <>
            <label className="field-label">Roll number</label>
            <input className="input" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 2B01" />
            <label className="field-label">Section</label>
            <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. CSE-2B" />
          </>
        ) : (
          <>
            <label className="field-label">Department</label>
            <input className="input" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="e.g. Computer Science" />
            <label className="field-label">Default section</label>
            <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. CSE-2B" />
          </>
        )}

        {err && <p className="err">{err}</p>}
        <button className="btn primary block" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

/* ================= teacher: live session ================= */

function Teacher({ profile }) {
  const [session, setSession] = useState(null)
  const [course, setCourse] = useState('')
  const [section, setSection] = useState(profile.section || '')
  const [code, setCode] = useState('')
  const [msLeft, setMsLeft] = useState(12000)
  const [feed, setFeed] = useState([])
  const [showQuiz, setShowQuiz] = useState(false)
  const [busy, setBusy] = useState(false)

  // resume an active session on load
  useEffect(() => {
    supabase.from('sessions').select('*')
      .eq('teacher_id', profile.id).eq('is_active', true)
      .order('started_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setSession(data[0]) })
  }, [profile.id])

  // rotating code + countdown
  useEffect(() => {
    if (!session) return
    let alive = true
    async function tick() {
      const win = currentWindow()
      const c = await totpCode(session.session_secret, win)
      if (alive) {
        setCode(c)
        setMsLeft(12000 - (Date.now() % 12000))
      }
    }
    tick()
    const t = setInterval(tick, 100)
    return () => { alive = false; clearInterval(t) }
  }, [session])

  // load + subscribe to check-ins
  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function loadFeed() {
      const { data } = await supabase
        .from('attendance')
        .select('id, checked_in_at, ble_verified, profiles:student_id (name, roll_number)')
        .eq('session_id', session.id)
        .order('checked_in_at', { ascending: false })
      if (!cancelled && data) {
        setFeed(data.map((r) => ({
          id: r.id,
          name: r.profiles?.name || 'Student',
          roll: r.profiles?.roll_number || '',
          ble: r.ble_verified,
          at: new Date(r.checked_in_at),
        })))
      }
    }
    loadFeed()

    const ch = supabase
      .channel('att-' + session.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance', filter: `session_id=eq.${session.id}` },
        async (payload) => {
          const { data: p } = await supabase.from('profiles')
            .select('name, roll_number').eq('id', payload.new.student_id).single()
          setFeed((f) => [{
            id: payload.new.id,
            name: p?.name || 'Student',
            roll: p?.roll_number || '',
            ble: payload.new.ble_verified,
            at: new Date(payload.new.checked_in_at),
          }, ...f])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setFeed((f) => f.map((item) =>
            item.id === payload.new.id ? { ...item, ble: payload.new.ble_verified } : item))
        })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [session?.id])

  async function startSession() {
    if (!course.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('sessions')
      .insert({ teacher_id: profile.id, course_name: course.trim(), section: section.trim() || '—' })
      .select().single()
    setBusy(false)
    if (!error) setSession(data)
  }

  async function endSession() {
    await supabase.from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', session.id)
    setSession(null); setFeed([])
  }

  if (!session) {
    return (
      <div className="page">
        <Nav profile={profile} active="/teacher" />
        <div className="center-block">
          <div className="checkin-card">
            <h2>Start a session</h2>
            <p className="muted">A rotating QR will be generated for students to scan.</p>
            <label className="field-label">Course name</label>
            <input className="input" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. CSD 204 · Data Structures" />
            <label className="field-label">Section</label>
            <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. CSE-2B" />
            <button className="btn primary block" disabled={busy} onClick={startSession}>
              {busy ? 'Starting…' : '▶ Start session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const frac = msLeft / 12000
  const R = 148
  const CIRC = 2 * Math.PI * R
  const checkinUrl = `${window.location.origin}${window.location.pathname}#/checkin/${session.id}/${code}`

  return (
    <div className="page">
      <Nav profile={profile} active="/teacher" />
      <div className="teacher-grid">
        <div className="qr-panel">
          <div className="session-head">
            <div>
              <h2>{session.course_name}</h2>
              <p className="muted">{session.section} · {profile.name} · Session live</p>
            </div>
            <Tag tone="green">● LIVE</Tag>
          </div>

          <div className="qr-stage">
            <svg className="qr-ring" viewBox="0 0 320 320" aria-hidden="true">
              <circle cx="160" cy="160" r={R} className="ring-track" />
              <circle cx="160" cy="160" r={R} className="ring-fill"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} />
            </svg>
            <div className="qr-card" key={code}>
              {code && <QRCodeSVG value={checkinUrl} size={210} bgColor="#FFFFFF" fgColor="#17102E" level="M" />}
            </div>
          </div>

          <div className="qr-meta">
            <div className="meta-block">
              <span className="meta-label">Session code</span>
              <span className="meta-value mono">{code || '······'}</span>
            </div>
            <div className="meta-block">
              <span className="meta-label">Regenerates in</span>
              <span className="meta-value mono">{(msLeft / 1000).toFixed(1)}s</span>
            </div>
            <div className="meta-block">
              <span className="meta-label">Beacon name</span>
              <span className="meta-value beacon-on mono">📡 {beaconName(session.id)}</span>
            </div>
          </div>

          <p className="hint">
            Students scan with their phone camera while logged in — attendance is tied to
            their verified account. Expired codes are rejected server-side.
            For real Bluetooth verification, broadcast <span className="mono">{beaconName(session.id)}</span> from
            a beacon app (e.g. "Beacon Simulator" on Android) or rename a Bluetooth device to it.
          </p>
          <button className="btn ghost block" onClick={endSession}>■ End session</button>
        </div>

        <aside className="feed-panel">
          <h3>Check-ins <Tag tone="violet">{feed.length}</Tag></h3>
          {feed.length === 0 && <p className="muted">Waiting for the first scan…</p>}
          <ul className="feed">
            {feed.map((f) => (
              <li key={f.id} className="feed-item">
                <span className="feed-avatar">{initials(f.name)}</span>
                <div className="feed-body">
                  <span className="feed-name">{f.name} {f.roll && <span className="muted mono">· {f.roll}</span>}</span>
                  <span className="feed-sub">QR ✓ · {f.ble ? 'BLE ✓ real 📡' : 'BLE simulated'} · {f.at.toLocaleTimeString()}</span>
                </div>
                <span className="feed-check">✓</span>
              </li>
            ))}
          </ul>
          <button className="btn primary block" onClick={() => setShowQuiz(true)}>⚡ Push micro-quiz</button>
          <p className="hint">Micro-quizzes are the participation signal — responses feed the engagement analytics.</p>
        </aside>
      </div>

      {showQuiz && <QuizComposer session={session} onClose={() => setShowQuiz(false)} />}
    </div>
  )
}

function QuizComposer({ session, onClose }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function push() {
    const cleaned = opts.map((o) => o.trim()).filter(Boolean)
    if (!q.trim() || cleaned.length < 2) { setErr('Enter a question and at least 2 options'); return }
    if (correct >= cleaned.length) { setErr('Pick which option is correct'); return }
    setBusy(true)
    const { error } = await supabase.from('quizzes').insert({
      session_id: session.id, question: q.trim(), options: cleaned, correct_option_index: correct,
    })
    setBusy(false)
    if (error) setErr(error.message)
    else onClose()
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="checkin-card" onClick={(e) => e.stopPropagation()}>
        <h2>⚡ Push micro-quiz</h2>
        <p className="muted">Goes live instantly on every checked-in student's device.</p>
        <label className="field-label">Question</label>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Time complexity of BST search?" />
        {opts.map((o, i) => (
          <div key={i} className="opt-row">
            <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} title="Correct answer" />
            <input className="input slim" value={o} placeholder={`Option ${i + 1}${i < 2 ? '' : ' (optional)'}`}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
        {err && <p className="err">{err}</p>}
        <div className="btn-row">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={push}>{busy ? 'Pushing…' : 'Push to class →'}</button>
        </div>
      </div>
    </div>
  )
}

/* ================= check-in (opened by scanning QR) ================= */

export const beaconName = (sessionId) => 'CP-' + sessionId.replace(/-/g, '').slice(0, 4).toUpperCase()

function CheckIn({ sessionId, code, profile }) {
  const [step, setStep] = useState(0) // 0 validating, 1 ble, 2 done, 3 expired, 4 error
  const [msg, setMsg] = useState('')
  const [bleMsg, setBleMsg] = useState('')
  const [bleMode, setBleMode] = useState(null) // 'ble' | 'sim'
  const [meta, setMeta] = useState(null)
  const ran = useRef(false)
  const beacon = beaconName(sessionId)
  const bleSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      const { data: s } = await supabase.from('sessions')
        .select('course_name, section').eq('id', sessionId).single()
      setMeta(s)
      await new Promise((r) => setTimeout(r, 600))
      const { data, error } = await supabase.rpc('checkin', { p_session_id: sessionId, p_code: code })
      if (error) { setMsg(error.message); setStep(4); return }
      if (data.status === 'expired') { setStep(3); return }
      if (data.status === 'ended') { setMsg('This session has already ended.'); setStep(4); return }
      if (data.status !== 'ok') { setMsg(data.message || 'Check-in failed'); setStep(4); return }
      setStep(1) // BLE verification step — user action required
    })()
  }, [sessionId, code])

  async function verifyBluetooth() {
    setBleMsg('')
    try {
      // Web Bluetooth device picker — REAL proximity: only physically nearby
      // devices appear in this list. Works on Chrome (Android / desktop).
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true })
      const name = (device.name || '').toUpperCase()
      if (name.includes(beacon.toUpperCase())) {
        await supabase.rpc('verify_ble', { p_session_id: sessionId, p_verified: true })
        setBleMode('ble'); setStep(2)
      } else {
        setBleMsg(`That device ("${device.name || 'unnamed'}") isn't the classroom beacon ${beacon}. Pick the beacon from the list, or use simulate.`)
      }
    } catch (e) {
      if (e.name === 'NotFoundError') setBleMsg('No device selected. Try again or use simulate.')
      else setBleMsg('Bluetooth unavailable here — use simulate. (' + e.message + ')')
    }
  }

  async function simulateBle() {
    await supabase.rpc('verify_ble', { p_session_id: sessionId, p_verified: false })
    setBleMode('sim')
    await new Promise((r) => setTimeout(r, 900))
    setStep(2)
  }

  return (
    <div className="page center-page">
      <div className="checkin-card">
        <div className="brand small"><span className="brand-dot" /> ClassPulse</div>
        {step <= 2 && (
          <>
            <h2>Marking attendance</h2>
            <p className="muted">{meta ? `${meta.course_name} · ${meta.section}` : '…'}</p>
            <ul className="steps">
              <li className={step > 0 ? 'done' : 'active'}>
                <span className="step-ico">{step > 0 ? '✓' : '⟳'}</span>
                QR token <span className="mono">{code}</span> verified server-side
              </li>
              <li className={step >= 1 ? (step > 1 ? 'done' : 'active') : ''}>
                <span className="step-ico">{step > 1 ? '✓' : '📡'}</span>
                Bluetooth proximity — beacon <span className="mono">{beacon}</span>
              </li>
              <li className={step >= 2 ? 'done' : ''}>
                <span className="step-ico">{step >= 2 ? '✓' : '·'}</span>
                Proximity verified{bleMode === 'sim' ? ' (simulated)' : bleMode === 'ble' ? ' (real BLE)' : ''}
              </li>
            </ul>

            {step === 1 && (
              <div className="ble-actions">
                {bleSupported ? (
                  <>
                    <button className="btn primary block" onClick={verifyBluetooth}>
                      📡 Verify via Bluetooth
                    </button>
                    <p className="hint">Opens your browser's Bluetooth picker — only devices physically
                      in range appear. Select the classroom beacon <span className="mono">{beacon}</span>.</p>
                  </>
                ) : (
                  <p className="hint">Web Bluetooth isn't available in this browser (e.g. iPhone Safari) —
                    the native app build handles this automatically.</p>
                )}
                <button className="btn ghost block" onClick={simulateBle}>
                  Skip — simulate proximity
                </button>
                {bleMsg && <p className="err">{bleMsg}</p>}
              </div>
            )}

            {step >= 2 && (
              <div className="success">
                <div className="success-ring">✓</div>
                <h3>You're marked present, {profile.name.split(' ')[0]}!</h3>
                <p className="muted">
                  Recorded against your account ({profile.email})
                  {bleMode === 'ble' ? ' · proximity verified over real Bluetooth 📡' : ' · proximity simulated for this device'}
                </p>
                <button className="btn primary" onClick={() => go('/student')}>Open my dashboard</button>
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <div className="fail">
            <div className="fail-ring">✕</div>
            <h3>Code expired</h3>
            <p className="muted">QR codes rotate every 12 seconds — screenshots don't work. Scan the live QR in your classroom.</p>
          </div>
        )}
        {step === 4 && (
          <div className="fail">
            <div className="fail-ring">✕</div>
            <h3>Check-in failed</h3>
            <p className="muted">{msg}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================= student dashboard ================= */

function Student({ profile }) {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [quiz, setQuiz] = useState(null)      // active pushed quiz
  const [answered, setAnswered] = useState(null)
  const myAttendance = useRef(new Set())

  async function loadAll() {
    const [{ data: sessions }, { data: att }, { data: quizzes }, { data: resp }] = await Promise.all([
      supabase.from('sessions').select('id, course_name, section, started_at, is_active'),
      supabase.from('attendance').select('session_id, checked_in_at').eq('student_id', profile.id),
      supabase.from('quizzes').select('id, session_id, question, options, correct_option_index, pushed_at'),
      supabase.from('quiz_responses').select('quiz_id, is_correct').eq('student_id', profile.id),
    ])
    const attSet = new Set((att || []).map((a) => a.session_id))
    myAttendance.current = attSet
    const respMap = new Map((resp || []).map((r) => [r.quiz_id, r.is_correct]))

    const total = (sessions || []).length
    const attended = (sessions || []).filter((s) => attSet.has(s.id)).length
    const myQuizzes = (quizzes || []).filter((qz) => attSet.has(qz.session_id))
    const answeredQ = myQuizzes.filter((qz) => respMap.has(qz.id))
    const correctQ = answeredQ.filter((qz) => respMap.get(qz.id))
    const participation = myQuizzes.length
      ? Math.round(((correctQ.length * 100 + (answeredQ.length - correctQ.length) * 50)) / myQuizzes.length)
      : 0

    // streak: consecutive answered from latest
    const ordered = [...myQuizzes].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    let streak = 0
    for (const qz of ordered) { if (respMap.has(qz.id)) streak++; else break }

    setStats({ total, attended, attPct: total ? Math.round((attended / total) * 100) : 0, participation, streak })
    setHistory((sessions || [])
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, 8)
      .map((s) => {
        const qz = (quizzes || []).find((q2) => q2.session_id === s.id)
        return {
          id: s.id,
          date: new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          course: s.course_name,
          present: attSet.has(s.id),
          quiz: qz ? (respMap.has(qz.id) ? (respMap.get(qz.id) ? '✓ Correct' : '✗ Wrong') : '– Missed') : '—',
        }
      }))

    // any live quiz in an active session I attended, that I haven't answered
    const live = (quizzes || []).find((qz) => {
      const s = (sessions || []).find((s2) => s2.id === qz.session_id)
      return s?.is_active && attSet.has(qz.session_id) && !respMap.has(qz.id)
    })
    if (live) setQuiz(live)
  }

  useEffect(() => { loadAll() }, [profile.id])

  // realtime: new quiz pushed
  useEffect(() => {
    const ch = supabase
      .channel('quiz-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quizzes' }, (payload) => {
        if (myAttendance.current.has(payload.new.session_id)) {
          setQuiz(payload.new); setAnswered(null)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function answer(i) {
    setAnswered(i)
    await supabase.from('quiz_responses').insert({
      quiz_id: quiz.id, student_id: profile.id,
      selected_option_index: i, is_correct: i === quiz.correct_option_index,
    })
    setTimeout(loadAll, 800)
  }

  const summary = useMemo(() => {
    if (!stats) return ''
    const first = profile.name.split(' ')[0]
    if (stats.total === 0) return `No sessions recorded yet — ${first}'s summary will appear once classes begin.`
    const risk = stats.attPct < 75 || (stats.participation < 50 && stats.total > 2)
    return risk
      ? `${first} attended ${stats.attended} of ${stats.total} sessions (${stats.attPct}%). Participation score is ${stats.participation}. Flagged for follow-up — early intervention recommended.`
      : `${first} attended ${stats.attended} of ${stats.total} sessions (${stats.attPct}%) with a participation score of ${stats.participation}. Engagement is on track — no follow-up needed.`
  }, [stats, profile.name])

  return (
    <div className="page">
      <Nav profile={profile} active="/student" />
      <div className="student-grid">
        <section className="card">
          <div className="student-head">
            <span className="feed-avatar big">{initials(profile.name)}</span>
            <div>
              <h2>{profile.name}</h2>
              <p className="muted">{profile.roll_number || '—'} · {profile.section || '—'} · {profile.email}</p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat"><span className="stat-num">{stats ? stats.attPct : '–'}%</span><span className="stat-label">Attendance</span></div>
            <div className="stat"><span className="stat-num">{stats ? stats.participation : '–'}</span><span className="stat-label">Participation</span></div>
            <div className="stat"><span className="stat-num">{stats ? stats.streak : '–'}</span><span className="stat-label">Quiz streak 🔥</span></div>
          </div>
        </section>

        <section className="card ai-card">
          <h3>✦ AI weekly summary</h3>
          <p className="ai-text">"{summary}"</p>
          <p className="hint">Generated from your live attendance + quiz data.</p>
        </section>

        <section className="card span2w">
          <h3>Recent sessions</h3>
          {history.length === 0 && <p className="muted">No sessions yet — scan a QR in class to get started.</p>}
          {history.length > 0 && (
            <table className="table">
              <thead><tr><th>Date</th><th>Course</th><th>Attendance</th><th>Micro-quiz</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td className="muted">{h.course}</td>
                    <td><Tag tone={h.present ? 'green' : 'red'}>{h.present ? 'Present' : 'Absent'}</Tag></td>
                    <td className="muted">{h.quiz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {quiz && (
        <div className="modal-back">
          <div className="checkin-card">
            <h2>⚡ Live micro-quiz</h2>
            <p className="quiz-q">{quiz.question}</p>
            <div className="quiz-opts">
              {quiz.options.map((opt, i) => (
                <button key={i}
                  className={'quiz-opt' +
                    (answered !== null && i === quiz.correct_option_index ? ' correct' : '') +
                    (answered === i && i !== quiz.correct_option_index ? ' wrong' : '')}
                  disabled={answered !== null}
                  onClick={() => answer(i)}>
                  {opt}
                </button>
              ))}
            </div>
            {answered !== null && (
              <>
                <p className="hint">{answered === quiz.correct_option_index ? 'Correct — participation updated.' : 'Recorded — participation updated.'}</p>
                <button className="btn primary block" onClick={() => setQuiz(null)}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= teacher analytics ================= */

const SAMPLE_ROWS = [
  { name: 'Riya Sharma', roll: '2B01', att: 96, part: 88, sample: true },
  { name: 'Arjun Mehta', roll: '2B02', att: 91, part: 74, sample: true },
  { name: 'Sana Qureshi', roll: '2B03', att: 88, part: 92, sample: true },
  { name: 'Kabir Nair', roll: '2B04', att: 72, part: 41, sample: true },
  { name: 'Ishita Rao', roll: '2B05', att: 94, part: 81, sample: true },
  { name: 'Dev Patel', roll: '2B06', att: 66, part: 38, sample: true },
]
const SAMPLE_HEAT = [
  [4, 3, 4, 4, 2, 3, 4, 3],
  [3, 4, 3, 2, 2, 3, 3, 4],
  [4, 4, 3, 3, 1, 2, 3, 3],
  [3, 2, 2, 1, 1, 2, 2, 3],
]

function Analytics({ profile }) {
  const [rows, setRows] = useState([])
  const [sessions, setSessions] = useState([])
  const [showSample, setShowSample] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: ses }, { data: att }, { data: quizzes }, { data: resp }, { data: profs }] = await Promise.all([
        supabase.from('sessions').select('*').eq('teacher_id', profile.id).order('started_at', { ascending: false }),
        supabase.from('attendance').select('session_id, student_id'),
        supabase.from('quizzes').select('id, session_id, correct_option_index'),
        supabase.from('quiz_responses').select('quiz_id, student_id, is_correct'),
        supabase.from('profiles').select('id, name, roll_number').eq('role', 'student'),
      ])
      const myIds = new Set((ses || []).map((s) => s.id))
      const myAtt = (att || []).filter((a) => myIds.has(a.session_id))
      const myQuiz = (quizzes || []).filter((q) => myIds.has(q.session_id))
      const quizIds = new Set(myQuiz.map((q) => q.id))
      const myResp = (resp || []).filter((r) => quizIds.has(r.quiz_id))

      const total = (ses || []).length || 1
      const real = (profs || [])
        .filter((p) => myAtt.some((a) => a.student_id === p.id))
        .map((p) => {
          const attended = myAtt.filter((a) => a.student_id === p.id).length
          const answered = myResp.filter((r) => r.student_id === p.id)
          const correct = answered.filter((r) => r.is_correct)
          const part = myQuiz.length
            ? Math.round((correct.length * 100 + (answered.length - correct.length) * 50) / myQuiz.length)
            : 0
          return { name: p.name, roll: p.roll_number || '—', att: Math.round((attended / total) * 100), part, sample: false }
        })

      setRows(real)
      setSessions((ses || []).map((s) => ({
        ...s,
        count: myAtt.filter((a) => a.session_id === s.id).length,
        hasQuiz: myQuiz.some((q) => q.session_id === s.id),
      })))
    })()
  }, [profile.id])

  const merged = showSample ? [...rows, ...SAMPLE_ROWS] : rows
  const atRisk = merged.filter((r) => r.att < 75 || r.part < 50)
  const levels = ['#241B45', '#3B2A78', '#6D4FD1', '#9F7BFF', '#D6C4FF']

  return (
    <div className="page">
      <Nav profile={profile} active="/analytics" />
      <div className="dash-grid">
        <section className="card span2">
          <h3>Engagement heatmap <span className="muted">· when the class disengages</span></h3>
          <div className="heatmap">
            <div className="hm-corner" />
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="hm-col-label">S{i + 1}</div>)}
            {SAMPLE_HEAT.map((row, r) => (
              <React.Fragment key={r}>
                <div className="hm-row-label">Wk {r + 1}</div>
                {row.map((v, c) => (
                  <div key={c} className="hm-cell" style={{ background: levels[v] }}
                    title={`Week ${r + 1}, Session ${c + 1}: engagement ${v}/4`} />
                ))}
              </React.Fragment>
            ))}
          </div>
          <p className="hint">Sample visualization — populates from live data as sessions accumulate. Darker = lower engagement.</p>
        </section>

        <section className="card">
          <h3>At-risk students <Tag tone="red">{atRisk.length}</Tag></h3>
          <ul className="risk-list">
            {atRisk.map((s) => (
              <li key={s.roll + s.name}>
                <span className="feed-avatar">{initials(s.name)}</span>
                <div className="feed-body">
                  <span className="feed-name">{s.name} {s.sample && <span className="muted">(sample)</span>}</span>
                  <span className="feed-sub">Attendance {s.att}% · Participation {s.part}</span>
                </div>
                <Tag tone="red">Flag</Tag>
              </li>
            ))}
            {atRisk.length === 0 && <p className="muted">No at-risk students 🎉</p>}
          </ul>
          <p className="hint">Auto-flagged: attendance &lt; 75% or participation &lt; 50.</p>
        </section>

        <section className="card span3">
          <div className="row-between">
            <h3>Class roster</h3>
            <label className="hint toggle">
              <input type="checkbox" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} />
              include sample data
            </label>
          </div>
          <table className="table">
            <thead><tr><th>Student</th><th>Roll</th><th>Attendance</th><th>Participation</th><th>Status</th></tr></thead>
            <tbody>
              {merged.map((s) => (
                <tr key={s.roll + s.name}>
                  <td>{s.name} {s.sample && <span className="muted">(sample)</span>}</td>
                  <td className="mono muted">{s.roll}</td>
                  <td><div className="bar"><div className="bar-fill" style={{ width: s.att + '%' }} /></div><span className="bar-num">{s.att}%</span></td>
                  <td><div className="bar"><div className="bar-fill part" style={{ width: Math.min(s.part, 100) + '%' }} /></div><span className="bar-num">{s.part}</span></td>
                  <td>{s.att < 75 || s.part < 50 ? <Tag tone="red">At risk</Tag> : <Tag tone="green">On track</Tag>}</td>
                </tr>
              ))}
              {merged.length === 0 && <tr><td colSpan="5" className="muted">No students yet — run a session and get some scans!</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card span3">
          <h3>Session history</h3>
          <table className="table">
            <thead><tr><th>Date</th><th>Course</th><th>Section</th><th>Check-ins</th><th>Quiz</th><th>Status</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.course_name}</td>
                  <td className="muted">{s.section}</td>
                  <td className="mono">{s.count}</td>
                  <td className="muted">{s.hasQuiz ? '⚡ Yes' : '—'}</td>
                  <td>{s.is_active ? <Tag tone="green">Live</Tag> : <Tag tone="violet">Ended</Tag>}</td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan="6" className="muted">No sessions yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

/* ================= app shell ================= */

export default function App() {
  const route = useRoute()
  const [user, setUser] = useState(undefined)      // undefined = loading
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setProfile(user === null ? null : undefined); return }
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data ?? null))
  }, [user])

  if (!configured) return <NotConfigured />
  if (user === undefined || (user && profile === undefined)) {
    return <div className="page center-page"><p className="muted">Loading ClassPulse…</p></div>
  }
  if (!user) return <Login />
  if (!profile) return <Setup user={user} onDone={() => window.location.reload()} />

  if (route.startsWith('/checkin/')) {
    const [, , sessionId, code] = route.split('/')
    return <CheckIn sessionId={sessionId} code={(code || '').toUpperCase()} profile={profile} />
  }
  if (profile.role === 'teacher') {
    if (route === '/analytics') return <Analytics profile={profile} />
    return <Teacher profile={profile} />
  }
  return <Student profile={profile} />
}
