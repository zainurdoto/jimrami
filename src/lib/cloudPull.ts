import { db } from '../db'

import {
  requireSupabase,
} from './supabase'

import {
  setLocalCloudOwnerEmail,
  setLocalCloudOwnerId,
  setLocalCloudRevision,
} from './cloudRevision'

import {
  withCloudSyncSuppressed,
} from './cloudSyncGuard'

const PENDING_KEY =
  'jimrami-cloud-sync-pending'

const LAST_SYNC_KEY =
  'jimrami-cloud-sync-last'

const DELETE_QUEUE_KEY =
  'jimrami-cloud-delete-queue'

type CloudRow =
  Record<string, unknown>

async function fetchAll(
  table: string
) {
  const supabase =
    requireSupabase()

  const pageSize = 1000
  let from = 0

  const rows:
    CloudRow[] = []

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from(table)
        .select('*')
        .range(
          from,
          from + pageSize - 1
        )

    if (error) {
      throw new Error(
        `${table}: ${error.message}`
      )
    }

    const page =
      (data ?? []) as CloudRow[]

    rows.push(
      ...page
    )

    if (
      page.length <
      pageSize
    ) {
      break
    }

    from += pageSize
  }

  return rows
}

export async function pullCloudSnapshot(
  cloudRevision: number
) {
  const supabase =
    requireSupabase()

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !authData.user
  ) {
    throw new Error(
      'You must be signed into Supabase.'
    )
  }

  const [
    cloudPlayers,
    cloudSessions,
    cloudSessionPlayers,
    cloudRounds,
    cloudRoundResults,
    cloudJimResults,
    cloudPenaltyResults,
  ] =
    await Promise.all([
      fetchAll('players'),
      fetchAll('sessions'),
      fetchAll(
        'session_players'
      ),
      fetchAll('rounds'),
      fetchAll(
        'round_results'
      ),
      fetchAll(
        'jim_results'
      ),
      fetchAll(
        'penalty_results'
      ),
    ])

  const playerIds =
    new Map<string, number>()

  const sessionIds =
    new Map<string, number>()

  const roundIds =
    new Map<string, number>()

  await withCloudSyncSuppressed(
    async () => {
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
            Clear child tables first.
          */
          await db.roundResults.clear()
          await db.jimResults.clear()
          await db.penaltyResults.clear()
          await db.rounds.clear()
          await db.sessionPlayers.clear()
          await db.sessions.clear()
          await db.players.clear()

          /*
            1. PLAYERS
          */
          for (
            const row of cloudPlayers
          ) {
            const cloudId =
              String(row.id)

            const localId =
              await db.players.add({
                cloudId,

                name:
                  String(
                    row.name
                  ),

                nicknames:
                  Array.isArray(
                    row.nicknames
                  )
                    ? row.nicknames
                        .map(String)
                    : [],

                lastUsedDisplayName:
                  row
                    .last_used_display_name ===
                  null
                    ? undefined
                    : String(
                        row
                          .last_used_display_name
                      ),

                createdAt:
                  new Date(
                    String(
                      row.created_at
                    )
                  ),
              } as any)

            playerIds.set(
              cloudId,
              localId
            )
          }

          function playerId(
            cloudId: unknown
          ) {
            const value =
              playerIds.get(
                String(
                  cloudId
                )
              )

            if (
              value === undefined
            ) {
              throw new Error(
                `Unknown player ${String(cloudId)}`
              )
            }

            return value
          }

          /*
            2. SESSIONS
          */
          for (
            const row of cloudSessions
          ) {
            const cloudId =
              String(row.id)

            const metadata =
              (
                row.metadata ??
                {}
              ) as Record<
                string,
                unknown
              >

            const rawEvents =
              Array.isArray(
                metadata.goalpostEvents
              )
                ? metadata
                    .goalpostEvents
                : []

            const goalpostEvents =
              rawEvents.map(
                rawEvent => {
                  const event =
                    rawEvent as Record<
                      string,
                      unknown
                    >

                  return {
                    ...event,

                    winnerPlayerId:
                      playerId(
                        event
                          .winnerPlayerId
                      ),
                  }
                }
              )

            const localId =
              await db.sessions.add({
                cloudId,

                startedAt:
                  new Date(
                    String(
                      row.started_at
                    )
                  ),

                endedAt:
                  row.ended_at ===
                  null
                    ? undefined
                    : new Date(
                        String(
                          row.ended_at
                        )
                      ),

                status:
                  row.status ===
                  'ended'
                    ? 'ended'
                    : 'active',

                roundNumber:
                  Number(
                    row.round_number
                  ),

                goalpostInitial:
                  typeof metadata
                    .goalpostInitial ===
                  'number'
                    ? metadata
                        .goalpostInitial
                    : undefined,

                goalpostCurrent:
                  typeof metadata
                    .goalpostCurrent ===
                  'number'
                    ? metadata
                        .goalpostCurrent
                    : undefined,

                goalpostDeuceStartedRound:
                  typeof metadata
                    .goalpostDeuceStartedRound ===
                  'number'
                    ? metadata
                        .goalpostDeuceStartedRound
                    : undefined,

                goalpostEvents:
                  goalpostEvents
                    .length > 0
                    ? goalpostEvents
                    : undefined,
              } as any)

            sessionIds.set(
              cloudId,
              localId
            )
          }

          function sessionId(
            cloudId: unknown
          ) {
            const value =
              sessionIds.get(
                String(
                  cloudId
                )
              )

            if (
              value === undefined
            ) {
              throw new Error(
                `Unknown session ${String(cloudId)}`
              )
            }

            return value
          }

          /*
            3. SESSION PLAYERS
          */
          for (
            const row of
              cloudSessionPlayers
          ) {
            await db
              .sessionPlayers
              .add({
                cloudId:
                  String(row.id),

                sessionId:
                  sessionId(
                    row.session_id
                  ),

                playerId:
                  playerId(
                    row.player_id
                  ),

                displayName:
                  row.display_name ===
                  null
                    ? undefined
                    : String(
                        row.display_name
                      ),

                rotationOrder:
                  Number(
                    row
                      .rotation_order
                  ),

                points:
                  Number(
                    row.points
                  ),

                wins:
                  Number(
                    row.wins
                  ),

                jimWins:
                  Number(
                    row.jim_wins
                  ),

                jimAttempts:
                  Number(
                    row
                      .jim_attempts
                  ),
              } as any)
          }

          /*
            4. ROUNDS
          */
          for (
            const row of cloudRounds
          ) {
            const cloudId =
              String(row.id)

            const localId =
              await db.rounds.add({
                cloudId,

                sessionId:
                  sessionId(
                    row.session_id
                  ),

                roundNumber:
                  Number(
                    row.round_number
                  ),

                type:
                  row.type ===
                  'jim'
                    ? 'jim'
                    : 'standard',

                createdAt:
                  new Date(
                    String(
                      row.created_at
                    )
                  ),

                editedAt:
                  row.edited_at ===
                  null
                    ? undefined
                    : String(
                        row.edited_at
                      ),
              } as any)

            roundIds.set(
              cloudId,
              localId
            )
          }

          function roundId(
            cloudId: unknown
          ) {
            const value =
              roundIds.get(
                String(
                  cloudId
                )
              )

            if (
              value === undefined
            ) {
              throw new Error(
                `Unknown round ${String(cloudId)}`
              )
            }

            return value
          }

          /*
            5. STANDARD RESULTS
          */
          for (
            const row of
              cloudRoundResults
          ) {
            await db
              .roundResults
              .add({
                cloudId:
                  String(row.id),

                roundId:
                  roundId(
                    row.round_id
                  ),

                sessionId:
                  sessionId(
                    row.session_id
                  ),

                playerId:
                  playerId(
                    row.player_id
                  ),

                cardScore:
                  row.card_score ===
                  null
                    ? undefined
                    : Number(
                        row.card_score
                      ),

                position:
                  Number(
                    row.position
                  ),

                pointsAwarded:
                  Number(
                    row
                      .points_awarded
                  ),
              } as any)
          }

          /*
            6. JIM RESULTS
          */
          for (
            const row of
              cloudJimResults
          ) {
            await db
              .jimResults
              .add({
                cloudId:
                  String(row.id),

                roundId:
                  roundId(
                    row.round_id
                  ),

                sessionId:
                  sessionId(
                    row.session_id
                  ),

                jimPlayerId:
                  playerId(
                    row
                      .jim_player_id
                  ),

                caughtByPlayerId:
                  row
                    .caught_by_player_id ===
                  null
                    ? undefined
                    : playerId(
                        row
                          .caught_by_player_id
                      ),

                outPlayerId:
                  row
                    .out_player_id ===
                  null
                    ? undefined
                    : playerId(
                        row
                          .out_player_id
                      ),

                won:
                  Boolean(
                    row.won
                  ),

                stepsSurvived:
                  Number(
                    row
                      .steps_survived
                  ),

                hideStage:
                  row.hide_stage ===
                  null
                    ? undefined
                    : Number(
                        row.hide_stage
                      ),

                jimPointsAwarded:
                  Number(
                    row
                      .jim_points_awarded
                  ),

                catcherPointsAwarded:
                  Number(
                    row
                      .catcher_points_awarded
                  ),
              } as any)
          }

          /*
            7. PENALTIES
          */
          for (
            const row of
              cloudPenaltyResults
          ) {
            await db
              .penaltyResults
              .add({
                cloudId:
                  String(row.id),

                sessionId:
                  sessionId(
                    row.session_id
                  ),

                playerId:
                  playerId(
                    row.player_id
                  ),

                roundNumber:
                  Number(
                    row
                      .round_number
                  ),

                pointsAwarded:
                  Number(
                    row
                      .points_awarded
                  ),

                createdAt:
                  new Date(
                    String(
                      row.created_at
                    )
                  ),
              } as any)
          }
        }
      )
    }
  )

  /*
    The cloud copy is now authoritative.
    There should be no local pending
    upload/deletion after a successful
    pull.
  */
  localStorage.removeItem(
    PENDING_KEY
  )

  localStorage.removeItem(
    DELETE_QUEUE_KEY
  )

  setLocalCloudRevision(
    cloudRevision
  )

  setLocalCloudOwnerId(
    authData.user.id
  )

  if (authData.user.email) {
    setLocalCloudOwnerEmail(
      authData.user.email
    )
  }

  localStorage.setItem(
    LAST_SYNC_KEY,
    new Date().toISOString()
  )

  window.dispatchEvent(
    new Event(
      'jimrami-cloud-sync-status'
    )
  )

  const result = {
    players:
      cloudPlayers.length,

    sessions:
      cloudSessions.length,

    sessionPlayers:
      cloudSessionPlayers.length,

    rounds:
      cloudRounds.length,

    roundResults:
      cloudRoundResults.length,

    jimResults:
      cloudJimResults.length,

    penaltyResults:
      cloudPenaltyResults.length,

    revision:
      cloudRevision,
  }

  console.table(
    result
  )

  console.log(
    `☁ Cloud pull complete. Revision ${cloudRevision}.`
  )

  return result
}
