import { useState } from 'react'

import {
  db,
  type Player,
  type GameSession,
  type SessionPlayer,
  type GameRound,
  type RoundResult,
  type JimResult,
} from './db'

type Props = {
  onClose: () => void
}

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

type BackupData = {
  formatVersion: 1
  exportedAt: string

  players: BackupPlayer[]
  sessions: BackupSession[]
  sessionPlayers: SessionPlayer[]
  rounds: BackupRound[]
  roundResults: RoundResult[]
  jimResults: JimResult[]
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
    value as Record<
      string,
      unknown
    >

  return (
    data.formatVersion === 1 &&
    Array.isArray(data.players) &&
    Array.isArray(data.sessions) &&
    Array.isArray(
      data.sessionPlayers
    ) &&
    Array.isArray(data.rounds) &&
    Array.isArray(
      data.roundResults
    ) &&
    Array.isArray(
      data.jimResults
    )
  )
}

export default function DataTools({
  onClose,
}: Props) {
  const [busy, setBusy] =
    useState(false)

  async function exportBackup() {
    setBusy(true)

    try {
      const [
        players,
        sessions,
        sessionPlayers,
        rounds,
        roundResults,
        jimResults,
      ] = await Promise.all([
        db.players.toArray(),
        db.sessions.toArray(),
        db.sessionPlayers.toArray(),
        db.rounds.toArray(),
        db.roundResults.toArray(),
        db.jimResults.toArray(),
      ])

      const backup: BackupData = {
        formatVersion: 1,

        exportedAt:
          new Date().toISOString(),

        players: players.map(
          (player) => ({
            ...player,

            createdAt:
              player.createdAt.toISOString(),
          })
        ),

        sessions: sessions.map(
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

        rounds: rounds.map(
          (round) => ({
            ...round,

            createdAt:
              round.createdAt.toISOString(),
          })
        ),

        roundResults,
        jimResults,
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
        URL.createObjectURL(
          blob
        )

      const link =
        document.createElement(
          'a'
        )

      const date =
        new Date()
          .toISOString()
          .slice(0, 10)

      link.href = url

      link.download =
        `jim-backup-${date}.json`

      link.click()

      URL.revokeObjectURL(
        url
      )
    } finally {
      setBusy(false)
    }
  }

  async function importBackup(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    if (!file) return

    try {
      const text =
        await file.text()

      const parsed:
        unknown =
        JSON.parse(text)

      if (
        !isBackupData(parsed)
      ) {
        window.alert(
          'This does not look like a valid Jim backup.'
        )

        return
      }

      const confirmed =
        window.confirm(
          'Importing this backup will replace all Jim data currently stored on this device. Continue?'
        )

      if (!confirmed) return

      setBusy(true)

            await db.transaction(
            'rw',
            [
                db.players,
                db.sessions,
                db.sessionPlayers,
                db.rounds,
                db.roundResults,
                db.jimResults,
            ],
            async () => {
          /*
            Remove the existing local
            game data first.
          */
          await Promise.all([
            db.jimResults.clear(),
            db.roundResults.clear(),
            db.rounds.clear(),
            db.sessionPlayers.clear(),
            db.sessions.clear(),
            db.players.clear(),
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

          if (
            parsed.sessionPlayers
              .length > 0
          ) {
            await db.sessionPlayers.bulkPut(
              parsed.sessionPlayers
            )
          }

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

          if (
            parsed.roundResults
              .length > 0
          ) {
            await db.roundResults.bulkPut(
              parsed.roundResults
            )
          }

          if (
            parsed.jimResults
              .length > 0
          ) {
            await db.jimResults.bulkPut(
              parsed.jimResults
            )
          }
        }
      )

      window.alert(
        'Jim backup restored successfully.'
      )

      /*
        Easiest clean way to reload
        everything from the restored DB.
      */
      window.location.reload()
    } catch {
      window.alert(
        'Could not import this backup.'
      )
    } finally {
      setBusy(false)

      event.target.value = ''
    }
  }

  return (
    <div className="dataOverlay">
      <section className="dataPanel">
        <header className="dataHeader">
          <div>
            <span>JIM</span>
            <h2>Data</h2>
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
              sessions and game
              history to a JSON file.
            </p>
          </div>

          <button
            onClick={exportBackup}
            disabled={busy}
          >
            Export
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

          <label
            className={
              busy
                ? 'importDisabled'
                : ''
            }
          >
            Import

            <input
              type="file"
              accept=".json,application/json"
              onChange={
                importBackup
              }
              disabled={busy}
            />
          </label>
        </div>

        <p className="dataWarning">
          Import replaces the Jim data
          currently stored on this
          device.
        </p>
      </section>
    </div>
  )
}