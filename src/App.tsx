import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Bell, BellOff, Check, Code, RotateCcw, Send, Settings, X } from 'lucide-react'
import './App.css'
import { normalizeSettings, type MovementSettings } from './domain/settings'
import { buildDailyTotals, createMovementEntry, summarizeEntries, type MovementEntry } from './domain/stats'
import { formatHour } from './domain/time'
import {
  getPushClientStatus,
  getPushServerStatus,
  sendTestBreakNotification,
  subscribeToBreakNotifications,
  syncBreakNotificationSettings,
  unsubscribeFromBreakNotifications,
  type PushClientStatus,
  type PushServerStatus,
} from './lib/push'
import { loadEntries, loadSettings, saveEntries, saveSettings } from './lib/storage'

type Notice = {
  tone: 'neutral' | 'success' | 'warning'
  text: string
}

type NotificationStatus = PushClientStatus &
  PushServerStatus & {
    message: string
  }

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const SOURCE_URL = 'https://github.com/kevinferretti/movement-break'

const initialNotificationStatus: NotificationStatus = {
  supported: false,
  permission: 'unsupported',
  endpoint: null,
  pushConfigured: false,
  publicKey: null,
  message: 'Checking notifications...',
}

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
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>(initialNotificationStatus)
  const [notificationBusy, setNotificationBusy] = useState(false)

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

  useEffect(() => {
    void refreshNotificationStatus()
  }, [])

  useEffect(() => {
    if (!settings.notificationsEnabled) {
      return
    }

    const timeout = window.setTimeout(() => {
      void syncBreakNotificationSettings(settings).catch((error: unknown) => {
        setNotice({
          tone: 'warning',
          text: error instanceof Error ? error.message : 'Notification settings did not sync.',
        })
      })
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [settings])

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

  async function refreshNotificationStatus() {
    try {
      const [clientStatus, serverStatus] = await Promise.all([
        getPushClientStatus(),
        getPushServerStatus(),
      ])

      setNotificationStatus({
        ...clientStatus,
        ...serverStatus,
        message: getNotificationMessage(clientStatus, serverStatus),
      })
    } catch {
      setNotificationStatus({
        ...initialNotificationStatus,
        message: 'Push server is not reachable.',
      })
    }
  }

  async function enableNotifications() {
    setNotificationBusy(true)

    try {
      const nextSettings = { ...settings, notificationsEnabled: true }
      await subscribeToBreakNotifications(nextSettings)
      setSettings(nextSettings)
      setNotice({ tone: 'success', text: 'Notifications enabled.' })
      await refreshNotificationStatus()
    } catch (error) {
      setNotice({
        tone: 'warning',
        text: error instanceof Error ? error.message : 'Notifications could not be enabled.',
      })
    } finally {
      setNotificationBusy(false)
    }
  }

  async function disableNotifications() {
    setNotificationBusy(true)

    try {
      await unsubscribeFromBreakNotifications()
      setSettings({ ...settings, notificationsEnabled: false })
      setNotice({ tone: 'neutral', text: 'Notifications disabled.' })
      await refreshNotificationStatus()
    } catch (error) {
      setNotice({
        tone: 'warning',
        text: error instanceof Error ? error.message : 'Notifications could not be disabled.',
      })
    } finally {
      setNotificationBusy(false)
    }
  }

  async function sendTestNotification() {
    setNotificationBusy(true)

    try {
      await sendTestBreakNotification()
      setNotice({ tone: 'success', text: 'Test notification sent.' })
    } catch (error) {
      setNotice({
        tone: 'warning',
        text: error instanceof Error ? error.message : 'Test notification failed.',
      })
    } finally {
      setNotificationBusy(false)
    }
  }

  const canEnableNotifications =
    notificationStatus.supported && notificationStatus.pushConfigured && notificationStatus.permission !== 'denied'
  const notificationsActive = Boolean(notificationStatus.endpoint && settings.notificationsEnabled)

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

          <div className="setting-row compact">
            <label htmlFor="start-hour">Hours</label>
            <div className="select-pair">
              <select
                id="start-hour"
                value={settings.startHour}
                onChange={(event) => updateSettings({ startHour: Number(event.currentTarget.value) })}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
              <span>to</span>
              <select
                aria-label="End hour"
                value={settings.endHour}
                onChange={(event) => updateSettings({ endHour: Number(event.currentTarget.value) })}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="notification-box">
            <div>
              <span className="box-label">Notifications</span>
              <p>{notificationStatus.message}</p>
            </div>
            <div className="notification-actions">
              {notificationsActive ? (
                <button type="button" className="secondary-action" onClick={disableNotifications} disabled={notificationBusy}>
                  <BellOff size={18} />
                  Off
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={enableNotifications}
                  disabled={!canEnableNotifications || notificationBusy}
                >
                  <Bell size={18} />
                  On
                </button>
              )}
              <button
                type="button"
                className="icon-action"
                onClick={sendTestNotification}
                disabled={!notificationStatus.endpoint || !notificationStatus.pushConfigured || notificationBusy}
                title="Send test notification"
                aria-label="Send test notification"
              >
                <Send size={18} />
              </button>
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

function getNotificationMessage(clientStatus: PushClientStatus, serverStatus: PushServerStatus) {
  if (!clientStatus.supported) {
    return 'Not supported in this browser.'
  }

  if (!serverStatus.pushConfigured) {
    return 'Server keys missing.'
  }

  if (clientStatus.permission === 'denied') {
    return 'Permission blocked.'
  }

  if (clientStatus.endpoint) {
    return 'Hourly reminders active.'
  }

  return 'Ready to enable.'
}

export default App
