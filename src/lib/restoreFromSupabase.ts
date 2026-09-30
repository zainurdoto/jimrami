import { db } from '../db'
import {
  requireSupabase,
} from './supabase'

const TABLES = [
  'players',
  'sessions',
  'session_players',
  'rounds',
  'round_results',
  'jim_results',
  'penalty_results',
] as const

async function fetchAll(
  table: string
) {
  const supabase =
    requireSupabase()

  const pageSize = 1000
  let from = 0

  const rows:
    Record<string, unknown>[] = []

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
      data ?? []

    rows.push(...page)

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

export async function previewCloudRestore() {
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

  const cloud =
    Object.fromEntries(
      await Promise.all(
        TABLES.map(
          async table => [
            table,
            await fetchAll(
              table
            ),
          ]
        )
      )
    )

  const local = {
    players:
      await db.players.count(),

    sessions:
      await db.sessions.count(),

    session_players:
      await db.sessionPlayers.count(),

    rounds:
      await db.rounds.count(),

    round_results:
      await db.roundResults.count(),

    jim_results:
      await db.jimResults.count(),

    penalty_results:
      await db.penaltyResults.count(),
  }

  const comparison =
    TABLES.map(
      table => ({
        table,

        local:
          local[table],

        cloud:
          cloud[table]
            .length,

        match:
          local[table] ===
          cloud[table]
            .length,
      })
    )

  console.table(
    comparison
  )

  return {
    comparison,
    cloud,
  }
}

export async function restoreCloudToEmptyLocal() {
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

  /*
    SAFETY CHECK

    Restore is only allowed when every
    local table is empty.
  */
  const localCount =
    (
      await Promise.all([
        db.players.count(),
        db.sessions.count(),
        db.sessionPlayers.count(),
        db.rounds.count(),
        db.roundResults.count(),
        db.jimResults.count(),
        db.penaltyResults.count(),
      ])
    ).reduce(
      (total, value) =>
        total + value,
      0
    )

  if (localCount !== 0) {
    throw new Error(
      'Local database is not empty. Restore cancelled.'
    )
  }

  /*
    Download everything first.
  */
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
      fetchAll('jim_results'),
      fetchAll(
        'penalty_results'
      ),
    ])

  /*
    Cloud UUID -> new local numeric ID
  */
  const playerIds =
    new Map<string, number>()

  const sessionIds =
    new Map<string, number>()

  const roundIds =
    new Map<string, number>()

  /*
    Restore inside one Dexie transaction.

    If something fails halfway through,
    Dexie rolls everything back.
  */
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
              String(row.name),

            nicknames:
              Array.isArray(
                row.nicknames
              )
                ? row.nicknames
                    .map(String)
                : [],

            lastUsedDisplayName:
              row
                .last_used_display_name
                ? String(
                    row
                      .last_used_display_name
                  )
                : undefined,

            createdAt:
              new Date(
                String(
                  row.created_at
                )
              ),
          })

        playerIds.set(
          cloudId,
          localId
        )
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

              const cloudWinnerId =
                String(
                  event
                    .winnerPlayerId
                )

              const winnerPlayerId =
                playerIds.get(
                  cloudWinnerId
                )

              if (
                winnerPlayerId ===
                undefined
              ) {
                throw new Error(
                  `Unknown goalpost winner ${cloudWinnerId}`
                )
              }

              return {
                ...event,
                winnerPlayerId,
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
              row.ended_at
                ? new Date(
                    String(
                      row.ended_at
                    )
                  )
                : undefined,

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
              goalpostEvents as any,
          })

        sessionIds.set(
          cloudId,
          localId
        )
      }

      /*
        Small lookup helpers.
      */
      function playerId(
        cloudId: unknown
      ) {
        const value =
          playerIds.get(
            String(cloudId)
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

      function sessionId(
        cloudId: unknown
      ) {
        const value =
          sessionIds.get(
            String(cloudId)
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

      function roundId(
        cloudId: unknown
      ) {
        const value =
          roundIds.get(
            String(cloudId)
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
              row.display_name
                ? String(
                    row
                      .display_name
                  )
                : undefined,

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
                row.jim_attempts
              ),
          })
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
              row.type === 'jim'
                ? 'jim'
                : 'standard',

            createdAt:
              new Date(
                String(
                  row.created_at
                )
              ),

            editedAt:
              row.edited_at
                ? String(
                    row.edited_at
                  )
                : undefined,
          })

        roundIds.set(
          cloudId,
          localId
        )
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
          })
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
                .caught_by_player_id
                ? playerId(
                    row
                      .caught_by_player_id
                  )
                : undefined,

            outPlayerId:
              row.out_player_id
                ? playerId(
                    row
                      .out_player_id
                  )
                : undefined,

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
          })
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
          })
      }
    }
  )

  const result = {
    players:
      await db.players.count(),

    sessions:
      await db.sessions.count(),

    sessionPlayers:
      await db
        .sessionPlayers
        .count(),

    rounds:
      await db.rounds.count(),

    roundResults:
      await db
        .roundResults
        .count(),

    jimResults:
      await db
        .jimResults
        .count(),

    penaltyResults:
      await db
        .penaltyResults
        .count(),
  }

  console.table(result)

  console.log(
    '☁ Cloud restore complete.'
  )

  return result
}