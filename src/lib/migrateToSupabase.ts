import { db } from '../db'

import {
  requireSupabase,
} from './supabase'

function requireCloudId(
  value: {
    cloudId?: string
  },
  label: string
) {
  if (!value.cloudId) {
    throw new Error(
      `${label} is missing cloudId`
    )
  }

  return value.cloudId
}

function chunks<T>(
  values: T[],
  size = 500
) {
  const result: T[][] = []

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size
      )
    )
  }

  return result
}

async function upsertChunks(
  table: string,
  rows: Record<string, unknown>[]
) {
  const supabase =
    requireSupabase()

  for (
    const batch of chunks(rows)
  ) {
    const {
      error,
    } =
      await supabase
        .from(table)
        .upsert(
          batch,
          {
            onConflict: 'id',
          }
        )

    if (error) {
      throw new Error(
        `${table}: ${error.message}`
      )
    }
  }
}

export async function previewCloudMigration() {
  const [
    players,
    sessions,
    sessionPlayers,
    rounds,
    roundResults,
    jimResults,
    penaltyResults,
  ] =
    await Promise.all([
      db.players.toArray(),
      db.sessions.toArray(),
      db.sessionPlayers.toArray(),
      db.rounds.toArray(),
      db.roundResults.toArray(),
      db.jimResults.toArray(),
      db.penaltyResults.toArray(),
    ])

  const collections = {
    players,
    sessions,
    sessionPlayers,
    rounds,
    roundResults,
    jimResults,
    penaltyResults,
  }

  for (
    const [
      tableName,
      rows,
    ] of Object.entries(
      collections
    )
  ) {
    const missing =
      rows.filter(
        (
          row: {
            cloudId?: string
          }
        ) =>
          !row.cloudId
      )

    if (
      missing.length > 0
    ) {
      throw new Error(
        `${tableName} has ${missing.length} record(s) without cloudId`
      )
    }
  }

  console.table({
    players:
      players.length,

    sessions:
      sessions.length,

    sessionPlayers:
      sessionPlayers.length,

    rounds:
      rounds.length,

    roundResults:
      roundResults.length,

    jimResults:
      jimResults.length,

    penaltyResults:
      penaltyResults.length,
  })

  return {
    players:
      players.length,

    sessions:
      sessions.length,

    sessionPlayers:
      sessionPlayers.length,

    rounds:
      rounds.length,

    roundResults:
      roundResults.length,

    jimResults:
      jimResults.length,

    penaltyResults:
      penaltyResults.length,
  }
}

export async function migrateLocalDataToSupabase() {
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
      'You must be signed into Supabase before migrating.'
    )
  }

  const [
    players,
    sessions,
    sessionPlayers,
    rounds,
    roundResults,
    jimResults,
    penaltyResults,
  ] =
    await Promise.all([
      db.players.toArray(),
      db.sessions.toArray(),
      db.sessionPlayers.toArray(),
      db.rounds.toArray(),
      db.roundResults.toArray(),
      db.jimResults.toArray(),
      db.penaltyResults.toArray(),
    ])

  const playerIds =
    new Map<number, string>()

  const sessionIds =
    new Map<number, string>()

  const roundIds =
    new Map<number, string>()

  players.forEach(
    (player) => {
      playerIds.set(
        player.id,
        requireCloudId(
          player,
          `Player ${player.id}`
        )
      )
    }
  )

  sessions.forEach(
    (session) => {
      sessionIds.set(
        session.id,
        requireCloudId(
          session,
          `Session ${session.id}`
        )
      )
    }
  )

  rounds.forEach(
    (round) => {
      roundIds.set(
        round.id,
        requireCloudId(
          round,
          `Round ${round.id}`
        )
      )
    }
  )

  function playerCloudId(
    localId: number
  ) {
    const value =
      playerIds.get(
        localId
      )

    if (!value) {
      throw new Error(
        `Unknown player ID ${localId}`
      )
    }

    return value
  }

  function sessionCloudId(
    localId: number
  ) {
    const value =
      sessionIds.get(
        localId
      )

    if (!value) {
      throw new Error(
        `Unknown session ID ${localId}`
      )
    }

    return value
  }

  function roundCloudId(
    localId: number
  ) {
    const value =
      roundIds.get(
        localId
      )

    if (!value) {
      throw new Error(
        `Unknown round ID ${localId}`
      )
    }

    return value
  }

  await upsertChunks(
    'players',
    players.map(
      (player) => ({
        id:
          requireCloudId(
            player,
            `Player ${player.id}`
          ),

        name:
          player.name,

        nicknames:
          player.nicknames ?? [],

        last_used_display_name:
          player.lastUsedDisplayName ??
          null,

        created_at:
          player.createdAt
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
    )
  )

  console.log(
    `✓ Players: ${players.length}`
  )

  await upsertChunks(
    'sessions',
    sessions.map(
      (session) => ({
        id:
          requireCloudId(
            session,
            `Session ${session.id}`
          ),

        started_at:
          session.startedAt
            .toISOString(),

        ended_at:
          session.endedAt
            ? session.endedAt
                .toISOString()
            : null,

        status:
          session.status,

        round_number:
          session.roundNumber,

        metadata: {
          goalpostInitial:
            session.goalpostInitial,

          goalpostCurrent:
            session.goalpostCurrent,

          goalpostDeuceStartedRound:
            session
              .goalpostDeuceStartedRound,

          goalpostEvents:
            (
              session.goalpostEvents ??
              []
            ).map(
              (event) => ({
                ...event,

                winnerPlayerId:
                  playerCloudId(
                    event.winnerPlayerId
                  ),
              })
            ),
        },

        updated_at:
          new Date()
            .toISOString(),
      })
    )
  )

  console.log(
    `✓ Sessions: ${sessions.length}`
  )

  await upsertChunks(
    'session_players',
    sessionPlayers.map(
      (entry) => ({
        id:
          requireCloudId(
            entry,
            `SessionPlayer ${entry.id}`
          ),

        session_id:
          sessionCloudId(
            entry.sessionId
          ),

        player_id:
          playerCloudId(
            entry.playerId
          ),

        display_name:
          entry.displayName ??
          null,

        rotation_order:
          entry.rotationOrder,

        points:
          entry.points,

        wins:
          entry.wins,

        jim_wins:
          entry.jimWins,

        jim_attempts:
          entry.jimAttempts,
      })
    )
  )

  console.log(
    `✓ Session players: ${sessionPlayers.length}`
  )

  await upsertChunks(
    'rounds',
    rounds.map(
      (round) => ({
        id:
          requireCloudId(
            round,
            `Round ${round.id}`
          ),

        session_id:
          sessionCloudId(
            round.sessionId
          ),

        round_number:
          round.roundNumber,

        type:
          round.type,

        created_at:
          round.createdAt
            .toISOString(),

        edited_at:
          round.editedAt ??
          null,
      })
    )
  )

  console.log(
    `✓ Rounds: ${rounds.length}`
  )

  await upsertChunks(
    'round_results',
    roundResults.map(
      (result) => ({
        id:
          requireCloudId(
            result,
            `RoundResult ${result.id}`
          ),

        round_id:
          roundCloudId(
            result.roundId
          ),

        session_id:
          sessionCloudId(
            result.sessionId
          ),

        player_id:
          playerCloudId(
            result.playerId
          ),

        card_score:
          result.cardScore ??
          null,

        position:
          result.position,

        points_awarded:
          result.pointsAwarded,
      })
    )
  )

  console.log(
    `✓ Standard results: ${roundResults.length}`
  )

  await upsertChunks(
    'jim_results',
    jimResults.map(
      (result) => ({
        id:
          requireCloudId(
            result,
            `JimResult ${result.id}`
          ),

        round_id:
          roundCloudId(
            result.roundId
          ),

        session_id:
          sessionCloudId(
            result.sessionId
          ),

        jim_player_id:
          playerCloudId(
            result.jimPlayerId
          ),

        caught_by_player_id:
          result.caughtByPlayerId !==
          undefined
            ? playerCloudId(
                result.caughtByPlayerId
              )
            : null,

        out_player_id:
          result.outPlayerId !==
          undefined
            ? playerCloudId(
                result.outPlayerId
              )
            : null,

        won:
          result.won,

        steps_survived:
          result.stepsSurvived,

        hide_stage:
          result.hideStage ??
          null,

        jim_points_awarded:
          result.jimPointsAwarded,

        catcher_points_awarded:
          result.catcherPointsAwarded,
      })
    )
  )

  console.log(
    `✓ Jim results: ${jimResults.length}`
  )

  await upsertChunks(
    'penalty_results',
    penaltyResults.map(
      (penalty) => ({
        id:
          requireCloudId(
            penalty,
            `Penalty ${penalty.id}`
          ),

        session_id:
          sessionCloudId(
            penalty.sessionId
          ),

        player_id:
          playerCloudId(
            penalty.playerId
          ),

        round_number:
          penalty.roundNumber,

        points_awarded:
          penalty.pointsAwarded,

        created_at:
          penalty.createdAt
            .toISOString(),
      })
    )
  )

  console.log(
    `✓ Penalties: ${penaltyResults.length}`
  )

  console.log(
    '☁ JIMRAMI migration complete.'
  )

  return {
    players:
      players.length,

    sessions:
      sessions.length,

    sessionPlayers:
      sessionPlayers.length,

    rounds:
      rounds.length,

    roundResults:
      roundResults.length,

    jimResults:
      jimResults.length,

    penaltyResults:
      penaltyResults.length,
  }
}
