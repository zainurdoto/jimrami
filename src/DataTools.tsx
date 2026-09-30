import {
  cloudConfigured,
  supabase,
} from './lib/supabase'

import {
  migrateLocalDataToSupabase,
} from './lib/migrateToSupabase'

import {
  restoreCloudToEmptyLocal,
} from './lib/restoreFromSupabase'

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
    const [
  cloudUserEmail,
  setCloudUserEmail,
] =
  useState<string | null>(
    null
  )

useEffect(() => {
  if (!supabase) {
    return
  }

  supabase.auth
    .getUser()
    .then(({ data }) => {
      setCloudUserEmail(
        data.user?.email ??
        null
      )
    })
}, [])

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

      window.alert(
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
        window.alert(
          'This does not look like a valid Jim backup.'
        )

        return
      }

      const confirmed =
        window.confirm(
          'Importing this backup will replace ALL Jim data currently stored on this device.\n\nContinue?'
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

      window.alert(
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

      window.alert(
        'Backup import failed. Your backup file may be damaged or incompatible.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function cloudBackup() {
  if (busy) return

  setBusy(true)

  try {
    await migrateLocalDataToSupabase()

    window.alert(
      'Cloud backup completed successfully.'
    )
  } catch (error) {
    console.error(
      'Cloud backup failed:',
      error
    )

    window.alert(
      error instanceof Error
        ? error.message
        : 'Cloud backup failed.'
    )
  } finally {
    setBusy(false)
  }
}

async function cloudRestore() {
  if (busy) return

  const confirmed =
    window.confirm(
      'Restore all Jim data from the cloud?\n\nThis only works when the local database is empty.'
    )

  if (!confirmed) {
    return
  }

  setBusy(true)

  try {
    await restoreCloudToEmptyLocal()

    window.alert(
      'Cloud restore completed successfully.'
    )

    window.location.reload()
  } catch (error) {
    console.error(
      'Cloud restore failed:',
      error
    )

    window.alert(
      error instanceof Error
        ? error.message
        : 'Cloud restore failed.'
    )
  } finally {
    setBusy(false)
  }
}

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

        {/* LOCAL EXPORT */}
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

        {/* LOCAL IMPORT */}
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

        {/* CLOUD STATUS */}
        <div className="dataOption">
          <div>
            <strong>
              Cloud
            </strong>

            {!cloudConfigured ? (
              <p>
                Local mode. Cloud
                backup is not
                configured.
              </p>
            ) : cloudUserEmail ? (
              <p>
                Connected as{' '}
                {cloudUserEmail}
              </p>
            ) : (
              <p>
                Cloud configured,
                but not signed in.
              </p>
            )}
          </div>
        </div>

        {/* CLOUD CONTROLS */}
        {cloudConfigured &&
          cloudUserEmail && (
            <>
              <div className="dataOption">
                <div>
                  <strong>
                    Cloud Backup
                  </strong>

                  <p>
                    Upload the current
                    local Jim database
                    to Supabase.
                  </p>
                </div>

                <button
                  onClick={cloudBackup}
                  disabled={busy}
                >
                  {busy
                    ? 'Working...'
                    : 'Back Up'}
                </button>
              </div>

              <div className="dataOption">
                <div>
                  <strong>
                    Restore from Cloud
                  </strong>

                  <p>
                    Rebuild an empty
                    device from the
                    cloud database.
                  </p>
                </div>

                <button
                  onClick={cloudRestore}
                  disabled={busy}
                >
                  {busy
                    ? 'Working...'
                    : 'Restore'}
                </button>
              </div>
            </>
          )}

        <p className="dataWarning">
          Import replaces the data
          currently stored in Jim.
          Export a backup first if
          you want to keep it.
        </p>
      </section>
    </div>
  )
}