import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  BarChart3,
  Check,
  Code,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Settings,
  User,
  X,
} from 'lucide-react'
import './App.css'
import { normalizePreferences, type MovementPreferences } from './domain/preferences'
import {
  MOVEMENT_ROLL_CONFIGS,
  PULLUP_REPS,
  PUSHUP_REPS,
  formatMovementLabel,
  formatMovementLabelLower,
  type Movement,
} from './domain/reps'
import { buildDailyTotals, createMovementEntry, summarizeEntries, type MovementEntry } from './domain/stats'
import {
  fetchAuthConfig,
  fetchCurrentUser,
  fetchServerEntries,
  importLocalEntriesToServer,
  logOut,
  logServerEntry,
  subscribeToServerEntries,
  type AuthProvider,
  type CurrentUser,
} from './lib/api'
import { APP_UPDATE_AVAILABLE_EVENT, type AppUpdateAvailableEvent } from './lib/appUpdates'
import { loadEntries, loadPreferences, saveEntries, savePreferences } from './lib/storage'

type Notice = {
  tone: 'neutral' | 'success' | 'error'
  text: string
}

const SOURCE_URL = 'https://github.com/kevinferretti/movement-break'
const FALLBACK_ROLL: MovementBreak = {
  movement: 'pushups',
  reps: 1,
}
const STAT_MOVEMENTS: readonly Movement[] = ['pushups', 'pullups']
const SETTING_MOVEMENTS = STAT_MOVEMENTS
const REP_ORBIT_OPTIONS = [
  ...PUSHUP_REPS.map((reps, index) => ({
    angle: -90 + (index * 360) / PUSHUP_REPS.length,
    movement: 'pushups' as const,
    orbit: 'outer' as const,
    reps,
    sequence: index,
  })),
  ...PULLUP_REPS.map((reps, index) => ({
    angle: -116.25 + (index * 360) / PULLUP_REPS.length,
    movement: 'pullups' as const,
    orbit: 'inner' as const,
    reps,
    sequence: PUSHUP_REPS.length + index,
  })),
]

type MovementBreak = {
  movement: Movement
  reps: number
}

type PreferenceState = {
  directRepsInput: string
  preferences: MovementPreferences
}

function App() {
  const [entries, setEntries] = useState<MovementEntry[]>(() => loadEntries())
  const [{ preferences, directRepsInput }, setPreferenceState] = useState<PreferenceState>(() => {
    const preferences = loadPreferences()

    return {
      directRepsInput: String(preferences.directReps),
      preferences,
    }
  })
  const [queuedBreak, setQueuedBreak] = useState<MovementBreak | null>(null)
  const [displayBreak, setDisplayBreak] = useState<MovementBreak | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [isSavingCompletion, setIsSavingCompletion] = useState(false)
  const [completionPulse, setCompletionPulse] = useState(false)
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading')
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [refreshUpdate, setRefreshUpdate] = useState<(() => void) | null>(null)
  const [activeStatsMovement, setActiveStatsMovement] = useState<Movement>('pushups')
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    text: '',
  })

  const movementStats = useMemo(
    () =>
      STAT_MOVEMENTS.map((movement) => {
        const movementEntries = entries.filter((entry) => entry.movement === movement)
        const dailyTotals = buildDailyTotals(movementEntries, 7)

        return {
          movement,
          summary: summarizeEntries(movementEntries),
          dailyTotals,
          maxDailyReps: Math.max(1, ...dailyTotals.map((day) => day.reps)),
        }
      }),
    [entries],
  )
  const activeMovementStats = movementStats.find((movementStat) => movementStat.movement === activeStatsMovement)
  const currentUserId = currentUser?.id

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  useEffect(() => {
    savePreferences(preferences)
  }, [preferences])

  useEffect(() => {
    function handleUpdateAvailable(event: Event) {
      const updateEvent = event as AppUpdateAvailableEvent
      setRefreshUpdate(() => updateEvent.detail.refresh)
    }

    window.addEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable)

    return () => {
      window.removeEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadAccount() {
      try {
        const [authConfig, session] = await Promise.all([fetchAuthConfig(), fetchCurrentUser()])

        if (!isMounted) {
          return
        }

        setAuthProviders(authConfig.providers)

        if (!session.user) {
          setCurrentUser(null)
          return
        }

        if (!session.user.importedLocalEntriesAt) {
          const importResult = await importLocalEntriesToServer(loadEntries())

          if (!isMounted) {
            return
          }

          setCurrentUser(importResult.user)
          setEntries(importResult.entries)

          return
        }

        const serverEntries = await fetchServerEntries()

        if (!isMounted) {
          return
        }

        setCurrentUser(session.user)
        setEntries(serverEntries.entries)
      } catch (error) {
        if (isMounted) {
          setNotice({ tone: 'error', text: getErrorMessage(error) })
        }
      } finally {
        if (isMounted) {
          setAuthStatus('ready')
        }
      }
    }

    void loadAccount()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    return subscribeToServerEntries({
      onEntry: ({ entry }) => {
        setEntries((currentEntries) => mergeEntries(currentEntries, [entry]))
      },
      onSync: ({ entries: serverEntries }) => {
        setEntries((currentEntries) => mergeEntries(currentEntries, serverEntries))
      },
    })
  }, [currentUserId])

  function rollReps() {
    if (isRolling) {
      return
    }

    const enabledMovements = preferences.enabledMovements

    setIsRolling(true)
    setQueuedBreak(null)
    setDisplayBreak(randomMovementBreak(enabledMovements))
    setNotice({ tone: 'neutral', text: 'Rolling...' })

    let ticks = 0
    const interval = window.setInterval(() => {
      ticks += 1
      setDisplayBreak(randomMovementBreak(enabledMovements))

      if (ticks >= 12) {
        window.clearInterval(interval)
        queueBreak(randomMovementBreak(enabledMovements))
      }
    }, 58)
  }

  function queueDirectReps(movement: Movement) {
    if (isRolling) {
      return
    }

    queueBreak({
      movement,
      reps: preferences.directReps,
    })
  }

  function queueBreak(breakOption: MovementBreak) {
    setDisplayBreak(breakOption)
    setQueuedBreak(breakOption)
    setIsRolling(false)
    setNotice({
      tone: 'success',
      text: `${breakOption.reps} ${formatMovementLabelLower(breakOption.movement)} queued.`,
    })
  }

  async function completeBreak() {
    if (!queuedBreak || isSavingCompletion) {
      return
    }

    const breakOption = queuedBreak

    setIsSavingCompletion(true)

    try {
      const entry = currentUser
        ? (await logServerEntry(breakOption.movement, breakOption.reps)).entry
        : createMovementEntry(breakOption.movement, breakOption.reps)

      setEntries((currentEntries) => mergeEntries(currentEntries, [entry]))
      setCompletionPulse(true)
      setNotice({
        tone: 'success',
        text: `Logged ${breakOption.reps} ${formatMovementLabelLower(breakOption.movement)}.`,
      })
      setQueuedBreak(null)
      setDisplayBreak(null)
      window.setTimeout(() => setCompletionPulse(false), 650)
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setIsSavingCompletion(false)
    }
  }

  function cancelQueuedBreak() {
    setQueuedBreak(null)
    setDisplayBreak(null)
    setNotice({ tone: 'neutral', text: 'Skipped this roll.' })
  }

  function updateDirectRepsInput(value: string) {
    setPreferenceState((current) => {
      if (value.trim() === '') {
        return {
          ...current,
          directRepsInput: value,
        }
      }

      return {
        directRepsInput: value,
        preferences: normalizePreferences({ directReps: Number(value) }, current.preferences),
      }
    })
  }

  function commitDirectRepsInput() {
    setPreferenceState((current) => ({
      ...current,
      directRepsInput: String(current.preferences.directReps),
    }))
  }

  function updateMovementEnabled(movement: Movement, enabled: boolean) {
    setPreferenceState((current) => ({
      ...current,
      preferences: normalizePreferences(
        {
          ...current.preferences,
          enabledMovements: {
            ...current.preferences.enabledMovements,
            [movement]: enabled,
          },
        },
        current.preferences,
      ),
    }))
  }

  function startLogin(provider: AuthProvider) {
    window.location.assign(`/api/auth/${provider}/start`)
  }

  async function signOut() {
    try {
      await logOut()
      setCurrentUser(null)
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error) })
    }
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
          <AccountActions
            authProviders={authProviders}
            authStatus={authStatus}
            currentUser={currentUser}
            onLogin={startLogin}
            onSignOut={signOut}
          />
        </div>
      </header>

      <section className="break-stage" aria-label="Movement break">
        <div className="movement-label">
          <span>{displayBreak ? formatMovementLabel(displayBreak.movement) : 'Pushups or Pullups'}</span>
        </div>

        <RepOrbitRandomizer
          displayBreak={displayBreak}
          enabledMovements={preferences.enabledMovements}
          isRolling={isRolling}
          completionPulse={completionPulse}
        />

        <div className={`break-actions ${queuedBreak ? 'queued' : 'ready'}`}>
          {queuedBreak ? (
            <>
              <button
                className="complete-action"
                type="button"
                onClick={completeBreak}
                disabled={isSavingCompletion}
                title="Mark complete"
                aria-label="Mark complete"
              >
                <Check size={22} />
                {isSavingCompletion ? 'Saving...' : 'Mark complete'}
              </button>
              <button className="cancel-action" type="button" onClick={cancelQueuedBreak}>
                <X size={20} />
                Actually, nah
              </button>
            </>
          ) : (
            <>
              <button className="primary-action" type="button" onClick={rollReps} disabled={isRolling}>
                <RotateCcw size={20} />
                Roll
              </button>
              <button
                className="direct-action pushups"
                type="button"
                onClick={() => queueDirectReps('pushups')}
                disabled={isRolling || !preferences.enabledMovements.pushups}
              >
                Queue {preferences.directReps} Pushups
              </button>
            </>
          )}
        </div>

        <p className={`stage-status ${notice.tone}`} role="status">
          {notice.text}
        </p>
      </section>

      <section className="dashboard-grid">
        <section className="stats-panel" aria-labelledby="stats-heading">
          <div className="section-heading">
            <BarChart3 size={20} />
            <h2 id="stats-heading">Stats</h2>
          </div>

          <div className="movement-tabs" role="tablist" aria-label="Stats movement">
            {movementStats.map((movementStat) => (
              <button
                className={`movement-tab ${movementStat.movement === activeStatsMovement ? 'active' : ''}`}
                type="button"
                role="tab"
                id={`${movementStat.movement}-stats-tab`}
                aria-controls={`${movementStat.movement}-stats-panel`}
                aria-selected={movementStat.movement === activeStatsMovement}
                key={movementStat.movement}
                onClick={() => setActiveStatsMovement(movementStat.movement)}
              >
                <span>{formatMovementLabel(movementStat.movement)}</span>
                <strong>{movementStat.summary.totalReps}</strong>
              </button>
            ))}
          </div>

          {activeMovementStats ? <MovementStatsSection {...activeMovementStats} /> : null}
        </section>

        <section className="settings-panel" aria-labelledby="settings-heading">
          <div className="section-heading">
            <Settings size={20} />
            <h2 id="settings-heading">Settings</h2>
          </div>

          <div className="setting-row">
            <label htmlFor="direct-reps">Direct reps</label>
            <input
              id="direct-reps"
              type="number"
              inputMode="numeric"
              min="1"
              max="500"
              value={directRepsInput}
              onBlur={commitDirectRepsInput}
              onChange={(event) => updateDirectRepsInput(event.currentTarget.value)}
            />
          </div>

          <fieldset className="setting-row movement-settings">
            <legend>Enabled exercises</legend>
            <div className="movement-toggle-list">
              {SETTING_MOVEMENTS.map((movement) => {
                const isEnabled = preferences.enabledMovements[movement]
                const isLastEnabled = isEnabled && countEnabledMovements(preferences.enabledMovements) === 1

                return (
                  <label className="movement-toggle" key={movement}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={isLastEnabled}
                      onChange={(event) => updateMovementEnabled(movement, event.currentTarget.checked)}
                    />
                    <span>{formatMovementLabel(movement)}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="sync-summary">
            <span>{currentUser ? 'Signed in' : authStatus === 'loading' ? 'Checking login' : 'Local only'}</span>
            <strong>{currentUser?.displayName ?? (authProviders.length > 0 ? 'Not signed in' : 'Login not configured')}</strong>
          </div>
        </section>
      </section>

      {refreshUpdate ? (
        <div className="update-toast" role="alert" aria-live="assertive">
          <div>
            <strong>New version ready</strong>
            <span>Refresh to update.</span>
          </div>
          <button className="update-refresh" type="button" onClick={refreshUpdate}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            className="update-dismiss"
            type="button"
            aria-label="Dismiss update prompt"
            onClick={() => setRefreshUpdate(null)}
          >
            <X size={18} />
          </button>
        </div>
      ) : null}
    </main>
  )
}

function RepOrbitRandomizer({
  completionPulse,
  displayBreak,
  enabledMovements,
  isRolling,
}: {
  completionPulse: boolean
  displayBreak: MovementBreak | null
  enabledMovements: MovementPreferences['enabledMovements']
  isRolling: boolean
}) {
  const movementClass = displayBreak ? `movement-${displayBreak.movement}` : ''
  const orbitOptions = REP_ORBIT_OPTIONS.filter((option) => enabledMovements[option.movement])

  return (
    <div
      className={`rep-orbit ${displayBreak === null ? 'empty' : ''} ${movementClass} ${isRolling ? 'rolling' : ''} ${completionPulse ? 'complete' : ''}`}
      aria-label={
        displayBreak === null
          ? 'No movement rolled yet'
          : `${displayBreak.reps} ${formatMovementLabelLower(displayBreak.movement)}`
      }
    >
      <div className="rep-orbit-path outer" aria-hidden="true" />
      <div className="rep-orbit-path inner" aria-hidden="true" />
      <div className="rep-orbit-options" aria-hidden="true">
        {orbitOptions.map((option) => {
          const isActive = displayBreak?.movement === option.movement && displayBreak.reps === option.reps
          const dotStyle = {
            '--orbit-angle': `${option.angle}deg`,
            '--orbit-angle-inverse': `${option.angle * -1}deg`,
            '--dot-delay': `${option.sequence * 18}ms`,
          } as CSSProperties

          return (
            <span
              className={`rep-orbit-dot ${option.movement} ${option.orbit} ${isActive ? 'active' : ''}`}
              key={`${option.movement}-${option.reps}`}
              style={dotStyle}
            >
              <span className="rep-orbit-dot-core">{isActive ? option.reps : ''}</span>
            </span>
          )
        })}
      </div>
      <div className="rep-orbit-core">
        <span className="rep-orbit-number">{displayBreak?.reps ?? '?'}</span>
        <span className="rep-orbit-movement">{displayBreak ? formatMovementLabel(displayBreak.movement) : 'Ready'}</span>
      </div>
    </div>
  )
}

function AccountActions({
  authProviders,
  authStatus,
  currentUser,
  onLogin,
  onSignOut,
}: {
  authProviders: AuthProvider[]
  authStatus: 'loading' | 'ready'
  currentUser: CurrentUser | null
  onLogin: (provider: AuthProvider) => void
  onSignOut: () => Promise<void>
}) {
  if (authStatus === 'loading') {
    return <span className="account-loading">Checking login</span>
  }

  if (currentUser) {
    return (
      <div className="account-chip">
        <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} />
        <span>{currentUser.displayName}</span>
        <button className="icon-action" type="button" aria-label="Sign out" onClick={() => void onSignOut()}>
          <LogOut size={18} />
        </button>
      </div>
    )
  }

  if (authProviders.length === 0) {
    return <span className="account-loading">Login not configured</span>
  }

  return (
    <div className="login-actions">
      {authProviders.map((provider) => (
        <button className="login-action" type="button" key={provider} onClick={() => onLogin(provider)}>
          <ProviderIcon provider={provider} />
          {provider === 'github' ? 'GitHub' : 'Google'}
        </button>
      ))}
    </div>
  )
}

function ProviderIcon({ provider }: { provider: AuthProvider }) {
  return <LogIn size={18} aria-label={`${provider} login`} />
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" />
  }

  return (
    <span className="avatar fallback" aria-label={name}>
      <User size={16} />
    </span>
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

function MovementStatsSection({
  movement,
  summary,
  dailyTotals,
  maxDailyReps,
}: {
  movement: Movement
  summary: ReturnType<typeof summarizeEntries>
  dailyTotals: ReturnType<typeof buildDailyTotals>
  maxDailyReps: number
}) {
  const headingId = `${movement}-stats-heading`

  return (
    <section
      className="movement-stat-section"
      role="tabpanel"
      id={`${movement}-stats-panel`}
      aria-labelledby={`${movement}-stats-tab`}
    >
      <div className="movement-stat-heading">
        <h3 id={headingId}>{formatMovementLabel(movement)}</h3>
        <span>{summary.totalBreaks} logged</span>
      </div>

      <div className="stat-grid">
        <Metric label="Today" value={summary.todayReps} detail={`${summary.todayBreaks} breaks`} />
        <Metric label="Average" value={summary.averageToday} detail="today" />
        <Metric label="Lifetime" value={summary.totalReps} detail={`${summary.totalBreaks} breaks`} />
      </div>

      <div className="history-bars" aria-label={`Seven day ${formatMovementLabelLower(movement)} history`}>
        {dailyTotals.map((day) => (
          <div className="history-day" key={day.dateKey}>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${Math.max(5, (day.reps / maxDailyReps) * 100)}%` }} />
            </div>
            <span>{day.dateKey.slice(5).replace('-', '/')}</span>
            <strong>{day.reps}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function randomMovementBreak(enabledMovements: MovementPreferences['enabledMovements']): MovementBreak {
  const movementConfigs = MOVEMENT_ROLL_CONFIGS.filter((config) => enabledMovements[config.movement])
  const movementConfig = movementConfigs.length > 0 ? movementConfigs[randomIndex(movementConfigs.length)] : undefined

  if (!movementConfig) {
    return FALLBACK_ROLL
  }

  return {
    movement: movementConfig.movement,
    reps: movementConfig.reps[randomIndex(movementConfig.reps.length)] ?? FALLBACK_ROLL.reps,
  }
}

function countEnabledMovements(enabledMovements: MovementPreferences['enabledMovements']) {
  return Object.values(enabledMovements).filter(Boolean).length
}

function randomIndex(optionCount: number) {
  const values = new Uint32Array(1)
  const unbiasedMax = 2 ** 32 - (2 ** 32 % optionCount)

  do {
    window.crypto.getRandomValues(values)
  } while (values[0] >= unbiasedMax)

  return values[0] % optionCount
}

function mergeEntries(currentEntries: MovementEntry[], incomingEntries: MovementEntry[]) {
  let changed = false
  const entriesById = new Map(currentEntries.map((entry) => [entry.id, entry]))

  for (const incomingEntry of incomingEntries) {
    const currentEntry = entriesById.get(incomingEntry.id)

    if (
      !currentEntry ||
      currentEntry.movement !== incomingEntry.movement ||
      currentEntry.reps !== incomingEntry.reps ||
      currentEntry.completedAt !== incomingEntry.completedAt
    ) {
      entriesById.set(incomingEntry.id, incomingEntry)
      changed = true
    }
  }

  if (!changed) {
    return currentEntries
  }

  return [...entriesById.values()].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export default App
