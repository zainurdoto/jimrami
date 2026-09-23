import Dexie, { type EntityTable } from 'dexie'

export type Player = {
  id: number

  // Stable / canonical identity name.
  name: string

  // Optional saved aliases for this same player ID.
  nicknames?: string[]

  // Used as the default alias next time this player is selected.
  lastUsedDisplayName?: string

  createdAt: Date
}

export type GameSession = {
  id: number
  startedAt: Date
  endedAt?: Date
  status: 'active' | 'ended'
  roundNumber: number
}

export type SessionPlayer = {
  id: number
  sessionId: number
  playerId: number

  // Snapshot of what this player was called in this session.
  // The permanent identity still comes from playerId.
  displayName?: string

  rotationOrder: number

  points: number

  // Standard round wins
  wins: number

  // Jim statistics
  jimWins: number
  jimAttempts: number
}

export type GameRound = {
  id: number
  sessionId: number
  roundNumber: number
  type: 'standard' | 'jim'
  createdAt: Date
}

export type RoundResult = {
  id: number
  roundId: number
  sessionId: number
  playerId: number
  cardScore?: number
  position: number
  pointsAwarded: number
}

export type JimResult = {
  id: number
  roundId: number
  sessionId: number
  jimPlayerId: number
  caughtByPlayerId?: number
  outPlayerId?: number
  won: boolean
  stepsSurvived: number
  hideStage?: number
  jimPointsAwarded: number
  catcherPointsAwarded: number
}

export type PenaltyResult = {
  id: number
  sessionId: number
  playerId: number
  roundNumber: number
  pointsAwarded: number
  createdAt: Date
}

export const db = new Dexie('JimDatabase') as Dexie & {
  players: EntityTable<Player, 'id'>
  sessions: EntityTable<GameSession, 'id'>
  sessionPlayers: EntityTable<SessionPlayer, 'id'>
  rounds: EntityTable<GameRound, 'id'>
  roundResults: EntityTable<RoundResult, 'id'>
  jimResults: EntityTable<JimResult, 'id'>
  penaltyResults: EntityTable<PenaltyResult,'id'
>
}

db.version(1).stores({
  players: '++id, name, createdAt',
})

db.version(2).stores({
  players: '++id, name, createdAt',
  sessions: '++id, status, startedAt',
  sessionPlayers:
    '++id, sessionId, playerId, rotationOrder',
})

db.version(3).stores({
  players: '++id, name, createdAt',
  sessions: '++id, status, startedAt',
  sessionPlayers:
    '++id, sessionId, playerId, rotationOrder',
  rounds:
    '++id, sessionId, roundNumber, type, createdAt',
  roundResults:
    '++id, roundId, sessionId, playerId',
})

db.version(4)
  .stores({
    players: '++id, name, createdAt',
    sessions: '++id, status, startedAt',

    sessionPlayers:
      '++id, sessionId, playerId, rotationOrder',

    rounds:
      '++id, sessionId, roundNumber, type, createdAt',

    roundResults:
      '++id, roundId, sessionId, playerId',

    jimResults:
      '++id, roundId, sessionId, jimPlayerId, won',
  })
  .upgrade(async (transaction) => {
    await transaction
      .table('sessionPlayers')
      .toCollection()
      .modify((player) => {
        if (typeof player.jimWins !== 'number') {
          player.jimWins = 0
        }

        if (typeof player.jimAttempts !== 'number') {
          player.jimAttempts = 0
        }
      })
  })

  db.version(5).stores({
  players:
    '++id, name, createdAt',

  sessions:
    '++id, status, startedAt',

  sessionPlayers:
    '++id, sessionId, playerId, rotationOrder',

  rounds:
    '++id, sessionId, roundNumber, type, createdAt',

  roundResults:
    '++id, roundId, sessionId, playerId',

  jimResults:
    '++id, roundId, sessionId, jimPlayerId, won',

  penaltyResults:
    '++id, sessionId, playerId, roundNumber, createdAt',
})

db.version(6)
  .stores({
    players:
      '++id, name, createdAt',

    sessions:
      '++id, status, startedAt',

    sessionPlayers:
      '++id, sessionId, playerId, rotationOrder',

    rounds:
      '++id, sessionId, roundNumber, type, createdAt',

    roundResults:
      '++id, roundId, sessionId, playerId',

    jimResults:
      '++id, roundId, sessionId, jimPlayerId, won',

    penaltyResults:
      '++id, sessionId, playerId, roundNumber, createdAt',
  })
  .upgrade(async (transaction) => {
    const playerTable =
      transaction.table('players')

    const sessionPlayerTable =
      transaction.table('sessionPlayers')

    const existingPlayers =
      await playerTable.toArray()

    const nameByPlayerId =
      new Map<number, string>()

    existingPlayers.forEach((player) => {
      const name =
        typeof player.name === 'string'
          ? player.name
          : 'Unknown'

      nameByPlayerId.set(
        player.id,
        name
      )
    })

    await playerTable
      .toCollection()
      .modify((player) => {
        if (!Array.isArray(player.nicknames)) {
          player.nicknames = []
        }

        if (
          typeof player.lastUsedDisplayName !==
          'string'
        ) {
          player.lastUsedDisplayName =
            player.name
        }
      })

    /*
      Existing sessions did not store a
      per-session alias. Snapshot the
      canonical name they already used.
    */
    await sessionPlayerTable
      .toCollection()
      .modify((sessionPlayer) => {
        if (
          typeof sessionPlayer.displayName !==
          'string'
        ) {
          sessionPlayer.displayName =
            nameByPlayerId.get(
              sessionPlayer.playerId
            ) ?? 'Unknown'
        }
      })
  })

