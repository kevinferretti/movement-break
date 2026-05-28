import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Check, Code, RotateCcw, Settings, X } from 'lucide-react'
import './App.css'
import { normalizeSettings, type MovementSettings } from './domain/settings'
import { buildDailyTotals, createMovementEntry, summarizeEntries, type MovementEntry } from './domain/stats'
import { loadEntries, loadSettings, saveEntries, saveSettings } from './lib/storage'

type Notice = {
  tone: 'neutral' | 'success'
  text: string
}

const SOURCE_URL = 'https://github.com/kevinferretti/movement-break'

function App() {
  const [settings, setSettings] = useState<MovementSettings>(() => loadSettings())
  const [entries, setEntries] = useState<MovementEntry[]>(() => loadEntries())
  const [rolledReps, setRolledReps] = useState<number | null>(null)
  const [displayReps, setDisplayReps] = useState(settings.repMax)
  const [isRolling, setIsRolling] = useState(false)
  const [completionPulse, setCompletionPulse] = useState(false)
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    text: 'Ready for the next break.',
  })

  const summary = useMemo(() => summarizeEntries(entries), [entries])
  const dailyTotals = useMemo(() => buildDailyTotals(entries, 7), [entries])
  const maxDailyReps = Math.max(1, ...dailyTotals.map((day) => day.reps))
  const visibleReps = Math.min(settings.repMax, Math.max(settings.repMin, displayReps))

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  function updateSettings(patch: Partial<MovementSettings>) {
    setSettings((current) => normalizeSettings({ ...current, ...patch }, current))
  }

  function rollReps() {
    if (isRolling) {
      return
    }

    setIsRolling(true)
    setRolledReps(null)
    setNotice({ tone: 'neutral', text: 'Rolling...' })

    let ticks = 0
    const interval = window.setInterval(() => {
      ticks += 1
      setDisplayReps(randomRep(settings.repMin, settings.repMax))

      if (ticks >= 12) {
        window.clearInterval(interval)
        const finalReps = randomRep(settings.repMin, settings.repMax)
        setDisplayReps(finalReps)
        setRolledReps(finalReps)
        setIsRolling(false)
        setNotice({ tone: 'success', text: `${finalReps} pushups queued.` })
      }
    }, 58)
  }

  function completeBreak() {
    if (!rolledReps) {
      return
    }

    const entry = createMovementEntry(rolledReps)
    setEntries((current) => [entry, ...current])
    setCompletionPulse(true)
    setNotice({ tone: 'success', text: `Logged ${rolledReps} pushups.` })
    setRolledReps(null)
    window.setTimeout(() => setCompletionPulse(false), 650)
  }

  function cancelQueuedBreak() {
    setRolledReps(null)
    setDisplayReps(settings.repMax)
    setNotice({ tone: 'neutral', text: 'Skipped this roll.' })
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-mark" aria-hidden="true">
          <Activity size={24} strokeWidth={2.4} />
        </div>
        <div>
          <h1>Movement Break</h1>
        </div>
        <div className="header-actions">
          <a className="source-link" href={SOURCE_URL} target="_blank" rel="noreferrer">
            <Code size={18} />
            Source code
          </a>
          <div className={`notice ${notice.tone}`} role="status">
            {notice.text}
          </div>
        </div>
      </header>

      <section className="break-stage" aria-label="Pushup break">
        <div className="movement-label">
          <span>Pushups</span>
          <strong>
            {settings.repMin}-{settings.repMax}
          </strong>
        </div>

        <div className={`rep-dial ${isRolling ? 'rolling' : ''} ${completionPulse ? 'complete' : ''}`}>
          <span>{visibleReps}</span>
        </div>

        <div className={`break-actions ${rolledReps ? 'queued' : 'ready'}`}>
          {rolledReps ? (
            <>
              <button className="complete-action" type="button" onClick={completeBreak} title="Mark complete" aria-label="Mark complete">
                <Check size={30} />
              </button>
              <button className="cancel-action" type="button" onClick={cancelQueuedBreak}>
                <X size={20} />
                Actually, nah
              </button>
            </>
          ) : (
            <button className="primary-action" type="button" onClick={rollReps} disabled={isRolling}>
              <RotateCcw size={20} />
              Roll
            </button>
          )}
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="stats-panel" aria-labelledby="stats-heading">
          <div className="section-heading">
            <BarChart3 size={20} />
            <h2 id="stats-heading">Stats</h2>
          </div>

          <div className="stat-grid">
            <Metric label="Today" value={summary.todayReps} detail={`${summary.todayBreaks} breaks`} />
            <Metric label="Average" value={summary.averageToday} detail="today" />
            <Metric label="Lifetime" value={summary.totalReps} detail={`${summary.totalBreaks} breaks`} />
          </div>

          <div className="history-bars" aria-label="Seven day pushup history">
            {dailyTotals.map((day) => (
              <div className="history-day" key={day.dateKey}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${Math.max(5, (day.reps / maxDailyReps) * 100)}%` }}
                  />
                </div>
                <span>{day.dateKey.slice(5).replace('-', '/')}</span>
                <strong>{day.reps}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-panel" aria-labelledby="settings-heading">
          <div className="section-heading">
            <Settings size={20} />
            <h2 id="settings-heading">Settings</h2>
          </div>

          <div className="setting-row compact">
            <label htmlFor="rep-min">Rep range</label>
            <div className="number-pair">
              <input
                id="rep-min"
                type="number"
                min="1"
                max="500"
                value={settings.repMin}
                onChange={(event) => updateSettings({ repMin: event.currentTarget.valueAsNumber })}
              />
              <span>to</span>
              <input
                aria-label="Maximum reps"
                type="number"
                min="1"
                max="500"
                value={settings.repMax}
                onChange={(event) => updateSettings({ repMax: event.currentTarget.valueAsNumber })}
              />
            </div>
          </div>

        </section>
      </section>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function randomRep(min: number, max: number) {
  const range = max - min + 1
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)

  return min + (values[0] % range)
}

export default App
