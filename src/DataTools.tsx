import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  db,
  type GameRound,
  type GameSession,
  type JimResult,
  type PenaltyResult,
  type Player,
  type RoundResult,
  type SessionPlayer,
} from './db'

import {
  cloudConfigured,
  supabase,
} from './lib/supabase'

import {
  getLastCloudSync,
  getPendingDeletionCount,
  hasPendingCloudSync,
  runCloudSync,
} from './lib/cloudSync'

type AppDialog = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

type Props = {
  onClose: () => void
}

/*
  Dates cannot be stored directly
  inside JSON.

  When exporting, we turn them into
  text.

  When importing, we turn them back
  into Date objects.
*/

type BackupPlayer =
  Omit<Player, 'createdAt'> & {
    createdAt: string
  }

type BackupSession =
  Omit<
    GameSession,
    'startedAt' | 'endedAt'
  > & {
    startedAt: string
    endedAt?: string
  }

type BackupRound =
  Omit<GameRound, 'createdAt'> & {
    createdAt: string
  }

type BackupPenalty =
  Omit<
    PenaltyResult,
    'createdAt'
  > & {
    createdAt: string
  }

type BackupData = {
  formatVersion: number
  exportedAt: string

  players: BackupPlayer[]
  sessions: BackupSession[]
  sessionPlayers: SessionPlayer[]
  rounds: BackupRound[]
  roundResults: RoundResult[]
  jimResults: JimResult[]

  /*
    Optional so backups made before
    we added penalties can still be
    imported.
  */
  penaltyResults?: BackupPenalty[]
}

function isBackupData(
  value: unknown
): value is BackupData {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const data =
    value as Partial<BackupData>

  return (
    typeof data.formatVersion ===
      'number' &&
    typeof data.exportedAt ===
      'string' &&
    Array.isArray(data.players) &&
    Array.isArray(data.sessions) &&
    Array.isArray(
      data.sessionPlayers
    ) &&
    Array.isArray(data.rounds) &&
    Array.isArray(
      data.roundResults
    ) &&
    Array.isArray(data.jimResults) &&
    (
      data.penaltyResults ===
        undefined ||
      Array.isArray(
        data.penaltyResults
      )
    )
  )
}

export default function DataTools({
  onClose,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    )

  const [busy, setBusy] =
    useState(false)

  const [dialog, setDialog] =
    useState<AppDialog | null>(
      null
    )

  function appAlert(
    title: string,
    message: string,
    confirmLabel = 'OK'
  ) {
    return new Promise<void>(
      (resolve) => {
        setDialog({
          title,
          message,
          confirmLabel,
          onConfirm: () => {
            setDialog(null)
            resolve()
          },
        })
      }
    )
  }

  function appConfirm(
    title: string,
    message: string,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
  ) {
    return new Promise<boolean>(
      (resolve) => {
        setDialog({
          title,
          message,
          confirmLabel,
          cancelLabel,
          onConfirm: () => {
            setDialog(null)
            resolve(true)
          },
          onCancel: () => {
            setDialog(null)
            resolve(false)
          },
        })
      }
    )
  }

  const [
    cloudUserEmail,
    setCloudUserEmail,
  ] =
    useState<string | null>(
      null
    )

  const [
    showCloudLogin,
    setShowCloudLogin,
  ] =
    useState(false)

  const [
    cloudLoginEmail,
    setCloudLoginEmail,
  ] =
    useState('')

  const [
    cloudLoginPassword,
    setCloudLoginPassword,
  ] =
    useState('')

  const [
    cloudLoginError,
    setCloudLoginError,
  ] =
    useState('')

  const [
    cloudStatus,
    setCloudStatus,
  ] =
    useState(() => ({
      online:
        navigator.onLine,

      pending:
        hasPendingCloudSync(),

      pendingDeletions:
        getPendingDeletionCount(),

      lastSync:
        getLastCloudSync(),
    }))

  useEffect(() => {
    function refreshCloudStatus() {
      setCloudStatus({
        online:
          navigator.onLine,

        pending:
          hasPendingCloudSync(),

        pendingDeletions:
          getPendingDeletionCount(),

        lastSync:
          getLastCloudSync(),
      })
    }

    window.addEventListener(
      'jimrami-cloud-sync-status',
      refreshCloudStatus
    )

    window.addEventListener(
      'online',
      refreshCloudStatus
    )

    window.addEventListener(
      'offline',
      refreshCloudStatus
    )

    refreshCloudStatus()

    return () => {
      window.removeEventListener(
        'jimrami-cloud-sync-status',
        refreshCloudStatus
      )

      window.removeEventListener(
        'online',
        refreshCloudStatus
      )

      window.removeEventListener(
        'offline',
        refreshCloudStatus
      )
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setCloudUserEmail(
        null
      )

      return
    }

    let active = true

    void supabase.auth
      .getUser()
      .then(
        ({
          data,
        }) => {
          if (!active) {
            return
          }

          setCloudUserEmail(
            data.user?.email ??
            null
          )
        }
      )

    const {
      data:
        authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            session
          ) => {
            if (!active) {
              return
            }

            setCloudUserEmail(
              session
                ?.user
                .email ??
              null
            )
          }
        )

    return () => {
      active = false

      authListener
        .subscription
        .unsubscribe()
    }
  }, [])

  function formatLastSync(
    value: string | null
  ) {
    if (!value) {
      return 'Not synced yet'
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Unknown'
    }

    return date.toLocaleString(
      [],
      {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }
    )
  }

  /*
    EXPORT
  */

  async function exportBackup() {
    if (busy) return

    setBusy(true)

    try {
      const [
        players,
        sessions,
        sessionPlayers,
        rounds,
        roundResults,
        jimResults,
        penaltyResults,
      ] = await Promise.all([
        db.players.toArray(),

        db.sessions.toArray(),

        db.sessionPlayers.toArray(),

        db.rounds.toArray(),

        db.roundResults.toArray(),

        db.jimResults.toArray(),

        db.penaltyResults.toArray(),
      ])

      const backup: BackupData = {
        /*
          Version 2 means:
          penalty records are included.
        */
        formatVersion: 2,

        exportedAt:
          new Date().toISOString(),

        players:
          players.map(
            (player) => ({
              ...player,

              createdAt:
                player.createdAt.toISOString(),
            })
          ),

        sessions:
          sessions.map(
            (session) => ({
              ...session,

              startedAt:
                session.startedAt.toISOString(),

              endedAt:
                session.endedAt
                  ? session.endedAt.toISOString()
                  : undefined,
            })
          ),

        sessionPlayers,

        rounds:
          rounds.map(
            (round) => ({
              ...round,

              createdAt:
                round.createdAt.toISOString(),
            })
          ),

        roundResults,

        jimResults,

        penaltyResults:
          penaltyResults.map(
            (penalty) => ({
              ...penalty,

              createdAt:
                penalty.createdAt.toISOString(),
            })
          ),
      }

      const json =
        JSON.stringify(
          backup,
          null,
          2
        )

      const blob =
        new Blob(
          [json],
          {
            type:
              'application/json',
          }
        )

      const url =
        URL.createObjectURL(blob)

      const link =
        document.createElement('a')

      const today =
        new Date()
          .toISOString()
          .slice(0, 10)

      link.href = url

      link.download =
        `jim-backup-${today}.json`

      document.body.appendChild(
        link
      )

      link.click()

      link.remove()

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(
        'Backup export failed:',
        error
      )

      await appAlert(
        'Export Failed',
        'Backup export failed.'
      )
    } finally {
      setBusy(false)
    }
  }

  /*
    IMPORT
  */

  function chooseImportFile() {
    if (busy) return

    fileInputRef.current?.click()
  }

  async function importBackup(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    /*
      Reset the input immediately.

      This means the same backup file
      can be selected again later.
    */
    event.target.value = ''

    if (!file || busy) {
      return
    }

    setBusy(true)

    try {
      const text =
        await file.text()

      const parsed:
        unknown =
        JSON.parse(text)

      if (!isBackupData(parsed)) {
        await appAlert(
          'Invalid Backup',
          'This does not look like a valid Jim backup.'
        )

        return
      }

      const confirmed =
        await appConfirm(
          'Restore Backup',
          'Importing this backup will replace ALL Jim data currently stored on this device.\n\nContinue?',
          'Restore'
        )

      if (!confirmed) {
        return
      }

      /*
        Older backups were created
        before penalties existed.

        Treat missing penalty data as
        an empty list.
      */
      const backupPenalties =
        parsed.penaltyResults ?? []

      await db.transaction(
        'rw',

        [
          db.players,
          db.sessions,
          db.sessionPlayers,
          db.rounds,
          db.roundResults,
          db.jimResults,
          db.penaltyResults,
        ],

        async () => {
          /*
            Remove the current database
            contents first.
          */

          await Promise.all([
            db.players.clear(),

            db.sessions.clear(),

            db.sessionPlayers.clear(),

            db.rounds.clear(),

            db.roundResults.clear(),

            db.jimResults.clear(),

            db.penaltyResults.clear(),
          ])

          /*
            Restore players.
          */

          if (
            parsed.players.length >
            0
          ) {
            await db.players.bulkPut(
              parsed.players.map(
                (player) => ({
                  ...player,

                  createdAt:
                    new Date(
                      player.createdAt
                    ),
                })
              )
            )
          }

          /*
            Restore sessions.
          */

          if (
            parsed.sessions.length >
            0
          ) {
            await db.sessions.bulkPut(
              parsed.sessions.map(
                (session) => ({
                  ...session,

                  startedAt:
                    new Date(
                      session.startedAt
                    ),

                  endedAt:
                    session.endedAt
                      ? new Date(
                          session.endedAt
                        )
                      : undefined,
                })
              )
            )
          }

          /*
            Restore session players.
          */

          if (
            parsed.sessionPlayers
              .length > 0
          ) {
            await db.sessionPlayers.bulkPut(
              parsed.sessionPlayers
            )
          }

          /*
            Restore rounds.
          */

          if (
            parsed.rounds.length >
            0
          ) {
            await db.rounds.bulkPut(
              parsed.rounds.map(
                (round) => ({
                  ...round,

                  createdAt:
                    new Date(
                      round.createdAt
                    ),
                })
              )
            )
          }

          /*
            Restore Standard results.
          */

          if (
            parsed.roundResults
              .length > 0
          ) {
            await db.roundResults.bulkPut(
              parsed.roundResults
            )
          }

          /*
            Restore Jim results.
          */

          if (
            parsed.jimResults.length >
            0
          ) {
            await db.jimResults.bulkPut(
              parsed.jimResults
            )
          }

          /*
            Restore penalties.
          */

          if (
            backupPenalties.length >
            0
          ) {
            await db.penaltyResults.bulkPut(
              backupPenalties.map(
                (penalty) => ({
                  ...penalty,

                  createdAt:
                    new Date(
                      penalty.createdAt
                    ),
                })
              )
            )
          }
        }
      )

      await appAlert(
        'Backup Restored',
        'Jim backup restored successfully.'
      )

      /*
        Reload everything from the
        freshly restored database.
      */
      window.location.reload()
    } catch (error) {
      console.error(
        'Backup import failed:',
        error
      )

      await appAlert(
        'Import Failed',
        'Backup import failed. Your backup file may be damaged or incompatible.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function signInToCloud(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      busy ||
      !supabase
    ) {
      return
    }

    const email =
      cloudLoginEmail.trim()

    if (
      !email ||
      !cloudLoginPassword
    ) {
      setCloudLoginError(
        'Enter your email and password.'
      )

      return
    }

    setBusy(true)
    setCloudLoginError('')

    try {
      const {
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password:
              cloudLoginPassword,
          })

      if (error) {
        throw error
      }

      /*
        Reload after sign-in so the
        normal JIMRAMI startup cloud
        checks run with the new session.
      */
      window.location.reload()
    } catch (error) {
      console.error(
        'Cloud sign-in failed:',
        error
      )

      setCloudLoginError(
        error instanceof Error
          ? error.message
          : 'Cloud sign-in failed.'
      )

      setBusy(false)
    }
  }

  async function signOutOfCloud() {
    if (
      busy ||
      !supabase
    ) {
      return
    }

    const confirmed =
      await appConfirm(
        'Sign Out',
        'Sign out of JIMRAMI Cloud?\n\nYour local data will stay on this device.',
        'Sign Out'
      )

    if (!confirmed) {
      return
    }

    setBusy(true)
    setCloudLoginError('')

    try {
      const {
        error,
      } =
        await supabase.auth
          .signOut()

      if (error) {
        throw error
      }

      setCloudUserEmail(null)
      setShowCloudLogin(false)
      setCloudLoginEmail('')
      setCloudLoginPassword('')
    } catch (error) {
      console.error(
        'Cloud sign-out failed:',
        error
      )

      await appAlert(
        'Sign Out Failed',
        error instanceof Error
          ? error.message
          : 'Cloud sign-out failed.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    if (busy) return

    setBusy(true)

    try {
      if (!navigator.onLine) {
        throw new Error(
          'You are offline. Changes are safe locally and will sync automatically when you reconnect.'
        )
      }

      if (!supabase) {
        throw new Error(
          'Cloud sync is not configured on this deployment.'
        )
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error(
          'You are not signed in to cloud sync.'
        )
      }

      const result =
        await runCloudSync()

      if (
        result.status === 'queued'
      ) {
        await appAlert(
          'Sync in Progress',
          'A cloud sync is already running. JIMRAMI will finish it automatically.'
        )

        return
      }

      if (
        result.status !== 'synced'
      ) {
        throw new Error(
          result.message
        )
      }

      await appAlert(
        'Cloud Sync',
        'Cloud sync completed successfully.'
      )
    } catch (error) {
      console.error(
        'Cloud sync failed:',
        error
      )

      await appAlert(
        'Cloud Sync Failed',
        error instanceof Error
          ? error.message
          : 'Cloud sync failed.'
      )
    } finally {
      setBusy(false)
    }
  }

  const cloudState =
    !cloudConfigured
      ? 'local'
      : !cloudUserEmail
        ? 'signedOut'
        : !cloudStatus.online
          ? 'offline'
          : cloudStatus.pending ||
              cloudStatus.pendingDeletions >
                0
            ? 'pending'
            : 'connected'

  return (
    <div
      className="dataOverlay"
      onClick={onClose}
    >
      <section
        className="dataPanel"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="dataHeader">
          <div>
            <span>
              JIM DATA
            </span>

            <h2>
              Backup & Restore
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className="dataOption">
          <div>
            <strong>
              Export Backup
            </strong>

            <p>
              Save all players,
              sessions, scores,
              rounds, Jim results
              and penalties as a
              JSON file.
            </p>
          </div>

          <button
            onClick={exportBackup}
            disabled={busy}
          >
            {busy
              ? 'Working...'
              : 'Export'}
          </button>
        </div>

        <div className="dataOption">
          <div>
            <strong>
              Import Backup
            </strong>

            <p>
              Restore Jim from a
              previously exported
              backup.
            </p>
          </div>

          <button
            className={
              busy
                ? 'importDisabled'
                : ''
            }
            onClick={
              chooseImportFile
            }
            disabled={busy}
          >
            Import
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={
              importBackup
            }
            hidden
          />
        </div>

        <div className="dataOption cloudStatusOption">
          <div>
            <strong>
              Supabase Sync
            </strong>

            <div
              className={`cloudStatusLine ${cloudState}`}
            >
              <span
                className="cloudStatusDot"
                aria-hidden="true"
              >
                ●
              </span>

              <span>
                {cloudState ===
                'local'
                  ? 'Local only'
                  : cloudState ===
                      'signedOut'
                    ? 'Not connected'
                    : cloudState ===
                        'offline'
                      ? 'Offline'
                      : cloudState ===
                          'pending'
                        ? 'Sync pending'
                        : 'Connected'}
              </span>
            </div>

            {cloudState ===
            'local' ? (
              <p>
                Supabase is not
                configured for this
                deployment. JIMRAMI is
                stored locally.
              </p>
            ) : cloudState ===
              'signedOut' ? (
              <p>
                Owner/self-hosted sync.
                Connect to the Supabase
                project configured for
                this deployment.
              </p>
            ) : (
              <>
                <p>
                  Connected as{' '}
                  {cloudUserEmail}
                </p>

                {cloudState ===
                'offline' ? (
                  <p>
                    Local data is safe.
                    Changes will sync
                    automatically when
                    you reconnect.
                  </p>
                ) : cloudState ===
                  'pending' ? (
                  <p>
                    Changes are waiting
                    to sync
                    {cloudStatus.pendingDeletions >
                    0
                      ? ` (${cloudStatus.pendingDeletions} deletion${
                          cloudStatus.pendingDeletions ===
                          1
                            ? ''
                            : 's'
                        } queued)`
                      : ''}
                    .
                  </p>
                ) : (
                  <p>
                    Last synced:{' '}
                    {formatLastSync(
                      cloudStatus.lastSync
                    )}
                  </p>
                )}
              </>
            )}
          </div>

          {cloudConfigured &&
            !cloudUserEmail && (
              <button
                className="cloudConnectButton"
                onClick={() => {
                  setCloudLoginError('')
                  setShowCloudLogin(
                    (visible) =>
                      !visible
                  )
                }}
                disabled={busy}
              >
                {showCloudLogin
                  ? 'Close'
                  : 'Connect'}
              </button>
            )}

          {cloudConfigured &&
            cloudUserEmail && (
              <button
                className="cloudSignOutButton"
                onClick={
                  signOutOfCloud
                }
                disabled={busy}
              >
                Sign Out
              </button>
            )}
        </div>

        {cloudConfigured &&
          !cloudUserEmail &&
          showCloudLogin && (
            <form
              className="cloudLoginPanel"
              onSubmit={
                signInToCloud
              }
            >
              <label>
                <span>
                  Supabase Email
                </span>

                <input
                  type="email"
                  value={
                    cloudLoginEmail
                  }
                  onChange={(event) =>
                    setCloudLoginEmail(
                      event.target.value
                    )
                  }
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  disabled={busy}
                />
              </label>

              <label>
                <span>
                  Password
                </span>

                <input
                  type="password"
                  value={
                    cloudLoginPassword
                  }
                  onChange={(event) =>
                    setCloudLoginPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  placeholder="Password"
                  disabled={busy}
                />
              </label>

              {cloudLoginError && (
                <p className="cloudLoginError">
                  {cloudLoginError}
                </p>
              )}

              <button
                className="cloudLoginSubmit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? 'Connecting...'
                  : 'Connect Supabase'}
              </button>

              <p className="cloudLoginHint">
                Uses the Supabase project
                already configured for
                this JIMRAMI deployment.
              </p>
            </form>
          )}

        {cloudConfigured &&
          cloudUserEmail && (
            <div className="dataOption">
              <div>
                <strong>
                  Sync Now
                </strong>

                <p>
                  Changes sync automatically.
                  Use this to sync immediately.
                </p>
              </div>

              <button
                onClick={syncNow}
                disabled={
                  busy ||
                  !cloudStatus.online
                }
              >
                {busy
                  ? 'Syncing...'
                  : cloudStatus.online
                    ? 'Sync Now'
                    : 'Offline'}
              </button>
            </div>
          )}

        <p className="dataWarning">
          Import replaces the data
          currently stored in Jim.
          Export a backup first if
          you want to keep it.
        </p>
      </section>

      {dialog && (
        <div
          className="jimDialogOverlay"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div
            className="jimDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jimDialogTitle"
          >
            <h3 id="jimDialogTitle">
              {dialog.title}
            </h3>

            <p>
              {dialog.message}
            </p>

            <div className="jimDialogActions">
              {dialog.cancelLabel &&
                dialog.onCancel && (
                  <button
                    className="jimDialogSecondary"
                    onClick={dialog.onCancel}
                  >
                    {dialog.cancelLabel}
                  </button>
                )}

              <button
                className="jimDialogPrimary"
                onClick={dialog.onConfirm}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
